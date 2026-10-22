import test, { after } from "node:test";
import assert from "node:assert/strict";
import { query, pool, mongo } from "../../lib/db";
import { reports, maintenance, recurringFaults } from "../../lib/data";
import type { User } from "../../lib/types";
after(async () => {
  await pool.end();
  await mongo.close();
});
for (const role of ["customer", "staff", "admin"])
  test(`${role} SQL reports and MongoDB aggregates execute with role scope`, async () => {
    const [u] = await query(
      "SELECT id,name,email,role,centre_id FROM users WHERE email=$1",
      [`${role}@motive.test`],
    );
    const r = await reports(u as User);
    assert.ok(Number(r.totals.charges) >= 0);
    assert.ok(r.totals.completed > 0);
    assert.ok(r.monthly.length > 0);
    assert.equal(r.inspectionAnalyticsAvailable, true);
    for (const m of r.monthly) assert.match(m.month, /^\d{4}-\d{2}$/);
  });
test("customer maintenance and recurrence use real historical evidence", async () => {
  const [u] = await query(
    "SELECT id,name,email,role,centre_id FROM users WHERE email='customer@motive.test'",
  );
  const m = await maintenance(u as User),
    f = await recurringFaults(u as User);
  assert.ok(m.length >= 7);
  assert.ok(m.some((r) => r.status === "INSUFFICIENT_HISTORY"));
  assert.ok(f.length >= 1);
  assert.ok(f.every((r) => r.occurrences >= 2));
});
