import pg from "pg";
import { MongoClient } from "mongodb";
const globalDB = globalThis as unknown as { pg?: pg.Pool; mongo?: MongoClient };
export const pool =
  globalDB.pg ??
  new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 12,
    connectionTimeoutMillis: 4000,
    statement_timeout: 10000,
  });
if (process.env.NODE_ENV !== "production") globalDB.pg = pool;
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  values: unknown[] = [],
): Promise<T[]> {
  return (await pool.query<T>(sql, values)).rows;
}
export const mongo =
  globalDB.mongo ??
  new MongoClient(
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27029/motive",
    { serverSelectionTimeoutMS: 2500, socketTimeoutMS: 4000 },
  );
if (process.env.NODE_ENV !== "production") globalDB.mongo = mongo;
export async function inspections() {
  await mongo.connect();
  return mongo.db("motive").collection("job_inspections");
}
