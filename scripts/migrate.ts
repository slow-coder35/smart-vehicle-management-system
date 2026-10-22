import pg from "pg";
import { MongoClient } from "mongodb";
import { readdir, readFile } from "node:fs/promises";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_ADMIN_URL });
let connected = false;
for (let i = 0; i < 40; i++) {
  try {
    await pool.query("SELECT 1");
    connected = true;
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 1000));
  }
}
if (!connected) throw new Error("PostgreSQL did not become ready");
await pool.query(
  "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz DEFAULT now())",
);
for (const name of (await readdir("db/migrations"))
  .filter((f) => f.endsWith(".sql"))
  .sort()) {
  if (
    (await pool.query("SELECT 1 FROM schema_migrations WHERE name=$1", [name]))
      .rowCount
  )
    continue;
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query(await readFile(`db/migrations/${name}`, "utf8"));
    await c.query("INSERT INTO schema_migrations(name) VALUES($1)", [name]);
    await c.query("COMMIT");
    console.log(`Applied ${name}`);
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
const app = new URL(process.env.DATABASE_URL!);
const pw = decodeURIComponent(app.password).replaceAll("'", "''");
await pool.query(
  "DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='motive_app') THEN CREATE ROLE motive_app LOGIN; END IF; END $$",
);
await pool.query(`ALTER ROLE motive_app PASSWORD '${pw}'`);
await pool.query(`GRANT USAGE ON SCHEMA public TO motive_app;
 GRANT SELECT ON ALL TABLES IN SCHEMA public TO motive_app;
 REVOKE ALL ON schema_migrations FROM motive_app;
 GRANT INSERT ON users,vehicles,sessions TO motive_app;
 GRANT UPDATE(name,email,password_hash,active) ON users TO motive_app;
 GRANT UPDATE(make,model,model_year) ON vehicles TO motive_app;
 GRANT DELETE ON sessions TO motive_app;
 GRANT INSERT,UPDATE ON service_centres TO motive_app;
 GRANT UPDATE(capacity),DELETE ON service_slots TO motive_app;
 GRANT EXECUTE ON FUNCTION reserve_booking(uuid,uuid,uuid,uuid,text,uuid),transition_booking(uuid,uuid,text),complete_service(uuid,uuid,integer,text,jsonb),update_vehicle_mileage(uuid,uuid,integer),publish_slot(uuid,timestamptz,integer),save_maintenance_rule(uuid,uuid,uuid,integer,integer,date,integer),lock_inspection_job(uuid,uuid) TO motive_app;`);
await pool.end();
const admin = new MongoClient(process.env.MONGODB_ADMIN_URI!, {
  serverSelectionTimeoutMS: 2000,
});
for (let i = 0; i < 30; i++) {
  try {
    await admin.connect();
    break;
  } catch (e) {
    if (i === 29) throw e;
    await new Promise((r) => setTimeout(r, 1000));
  }
}
const db = admin.db("motive");
const mu = new URL(process.env.MONGODB_URI!);
const account = await db.command({ usersInfo: "motive_app" });
if (!account.users.length)
  await db.command({
    createUser: "motive_app",
    pwd: decodeURIComponent(mu.password),
    roles: [{ role: "readWrite", db: "motive" }],
  });
const uuid = { bsonType: "string", pattern: "^[0-9a-fA-F-]{36}$" };
const validator = {
  $jsonSchema: {
    bsonType: "object",
    required: [
      "booking_id",
      "vehicle_id",
      "centre_id",
      "revision",
      "items",
      "updated_by",
      "created_at",
      "updated_at",
    ],
    additionalProperties: false,
    properties: {
      _id: { bsonType: "objectId" },
      booking_id: uuid,
      vehicle_id: uuid,
      centre_id: uuid,
      updated_by: uuid,
      revision: { bsonType: ["int", "double"], minimum: 1, multipleOf: 1 },
      diagnostic_notes: { bsonType: "string", maxLength: 5000 },
      created_at: { bsonType: "date" },
      updated_at: { bsonType: "date" },
      items: {
        bsonType: "array",
        minItems: 1,
        maxItems: 50,
        items: {
          bsonType: "object",
          required: ["component", "result", "comment", "measurements"],
          additionalProperties: false,
          properties: {
            component: { bsonType: "string", minLength: 1, maxLength: 100 },
            result: { enum: ["PASS", "ATTENTION", "FAIL"] },
            comment: { bsonType: "string", maxLength: 1000 },
            measurements: {
              bsonType: "array",
              maxItems: 20,
              items: {
                bsonType: "object",
                required: ["name", "value", "unit"],
                additionalProperties: false,
                properties: {
                  name: { bsonType: "string" },
                  value: { bsonType: ["double", "int", "long", "decimal"] },
                  unit: { bsonType: "string" },
                },
              },
            },
          },
        },
      },
    },
  },
};
if ((await db.listCollections({ name: "job_inspections" }).toArray()).length)
  await db.command({
    collMod: "job_inspections",
    validator,
    validationLevel: "strict",
    validationAction: "error",
  });
else await db.createCollection("job_inspections", { validator });
await db
  .collection("job_inspections")
  .createIndex({ booking_id: 1 }, { unique: true });
await db
  .collection("job_inspections")
  .createIndex({ centre_id: 1, updated_at: -1 });
await admin.close();
console.log("Database roles, MongoDB validator, and indexes ready.");
