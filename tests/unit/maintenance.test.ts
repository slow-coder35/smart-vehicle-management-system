import test from "node:test";
import assert from "node:assert/strict";
import {
  addMonths,
  calculateMaintenance,
  localDate,
} from "../../lib/maintenance";
const now = new Date("2026-10-20T05:00:00Z");
const base = {
  intervalMonths: 6,
  intervalKm: 5000,
  baselineDate: "2026-06-01",
  baselineKm: 25000,
  currentKm: 29000,
  mileageUpdatedAt: now.toISOString(),
};
test("calendar addition clamps January to leap and non-leap February", () => {
  assert.equal(addMonths("2024-01-31", 1), "2024-02-29");
  assert.equal(addMonths("2025-01-31", 1), "2025-02-28");
  assert.equal(addMonths("2026-12-31", 2), "2027-02-28");
});
test("date is calculated in Asia/Kolkata across UTC midnight", () =>
  assert.equal(localDate(new Date("2026-10-19T19:00:00Z")), "2026-10-20"));
test("known thresholds outside reminders are up to date", () =>
  assert.equal(calculateMaintenance(base, now).status, "UP_TO_DATE"));
test("mileage equal to threshold is due", () => {
  const r = calculateMaintenance({ ...base, currentKm: 30000 }, now);
  assert.equal(r.status, "DUE");
  assert.equal(r.kmRemaining, 0);
});
test("exactly 500 km remaining is due soon", () =>
  assert.equal(
    calculateMaintenance({ ...base, currentKm: 29500 }, now).status,
    "DUE_SOON",
  ));
test("exactly 30 days remaining is due soon", () =>
  assert.equal(
    calculateMaintenance(
      { ...base, intervalMonths: 1, baselineDate: "2026-10-19" },
      now,
    ).status,
    "DUE_SOON",
  ));
test("due date wins over a later mileage threshold", () =>
  assert.equal(
    calculateMaintenance(
      { ...base, baselineDate: "2026-04-20", currentKm: 26000 },
      now,
    ).status,
    "DUE",
  ));
test("missing configured baseline is not falsely up to date", () => {
  const r = calculateMaintenance({ ...base, baselineDate: null }, now);
  assert.equal(r.status, "INSUFFICIENT_HISTORY");
  assert.equal(r.missingDate, true);
});
test("missing baseline does not hide a known due mileage", () => {
  const r = calculateMaintenance(
    { ...base, baselineDate: null, currentKm: 31000 },
    now,
  );
  assert.equal(r.status, "DUE");
  assert.equal(r.missingDate, true);
});
test("zero mileage baseline is valid", () =>
  assert.equal(
    calculateMaintenance({ ...base, baselineKm: 0, currentKm: 5000 }, now)
      .status,
    "DUE",
  ));
test("mileage becomes stale strictly after thirty days", () => {
  assert.equal(
    calculateMaintenance(
      {
        ...base,
        mileageUpdatedAt: new Date(now.getTime() - 30 * 86400000).toISOString(),
      },
      now,
    ).mileageStale,
    false,
  );
  assert.equal(
    calculateMaintenance(
      {
        ...base,
        mileageUpdatedAt: new Date(now.getTime() - 31 * 86400000).toISOString(),
      },
      now,
    ).mileageStale,
    true,
  );
});
test("date-only interval does not require a mileage baseline", () =>
  assert.equal(
    calculateMaintenance({ ...base, intervalKm: null, baselineKm: null }, now)
      .status,
    "UP_TO_DATE",
  ));
