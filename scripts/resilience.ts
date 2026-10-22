// Explicit local-only outage check. It stops and restarts only our labelled MongoDB container.
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
const base = process.env.APP_ORIGIN || "http://localhost:3000";
const owner = execFileSync(
  "docker",
  ["inspect", "--format", '{{index .Config.Labels "app"}}', "motive-mongo"],
  { encoding: "utf8" },
).trim();
assert.equal(owner, "motive", "Refusing to change an unrelated container");
let cookie = "";
async function call(path: string, method = "GET", data?: unknown) {
  const r = await fetch(`${base}/api/${path}`, {
    method,
    headers: { origin: base, cookie, "Content-Type": "application/json" },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const c = r.headers.get("set-cookie");
  if (c) cookie = c.split(";")[0];
  return { status: r.status, ...(await r.json()) };
}
let vehicle: string | undefined;
const admin = new pg.Pool({ connectionString: process.env.DATABASE_ADMIN_URL });
try {
  assert.equal(
    (
      await call("auth/login", "POST", {
        email: "staff@motive.test",
        password: process.env.DEMO_PASSWORD,
      })
    ).status,
    200,
  );
  const jobs = await call("bookings?status=COMPLETED");
  const existing = jobs.data.items[0].id;
  execFileSync("docker", ["stop", "motive-mongo"], { stdio: "ignore" });
  const report = await call("reports");
  assert.equal(report.status, 200);
  assert.equal(report.data.inspectionAnalyticsAvailable, false);
  assert.ok(Number(report.data.totals.charges) > 0);
  assert.equal((await call(`bookings/${existing}/inspection`)).status, 503);
  assert.equal(
    (
      await call("auth/login", "POST", {
        email: "customer@motive.test",
        password: process.env.DEMO_PASSWORD,
      })
    ).status,
    200,
  );
  const v = await call("vehicles", "POST", {
    registration: `RES${Date.now().toString().slice(-10)}`,
    make: "Test",
    model: "Outage",
    modelYear: 2024,
    currentKm: 1000,
  });
  assert.equal(v.status, 201);
  vehicle = v.data.id;
  const centres = await call("centres");
  const slots = await call(`centres/${centres.data[0].id}/slots`);
  const slot = slots.data.find((s: any) => s.remaining > 0);
  const catalogue = await call("catalogue");
  const b = await call("bookings", "POST", {
    vehicleId: vehicle,
    slotId: slot.id,
    serviceTypeId: catalogue.data.services[0].id,
    complaint: "MongoDB outage isolation test",
    requestKey: randomUUID(),
  });
  assert.equal(b.status, 201);
  assert.equal((await call(`bookings/${b.data.id}`)).status, 200);
  assert.equal(
    (await call(`bookings/${b.data.id}/cancel`, "POST", {})).status,
    200,
  );
  console.log(
    "PASS: SQL reports explicitly mark unavailable inspection analytics. Inspection retrieval returns 503. SQL booking, details, and cancellation still work.",
  );
} finally {
  execFileSync("docker", ["start", "motive-mongo"], { stdio: "ignore" });
  if (vehicle) {
    await admin.query(
      "DELETE FROM booking_status_history WHERE booking_id IN(SELECT id FROM bookings WHERE vehicle_id=$1)",
      [vehicle],
    );
    await admin.query("DELETE FROM bookings WHERE vehicle_id=$1", [vehicle]);
    await admin.query("DELETE FROM vehicles WHERE id=$1", [vehicle]);
  }
  await admin.end();
}
