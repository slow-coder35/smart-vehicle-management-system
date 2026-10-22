import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { MongoClient } from "mongodb";
const admin = new pg.Pool({ connectionString: process.env.DATABASE_ADMIN_URL }),
  app = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 8 });
const mongo = new MongoClient(process.env.MONGODB_URI!);
const ids = {
  centre: randomUUID(),
  customer: randomUUID(),
  other: randomUUID(),
  staff: randomUUID(),
  foreignStaff: randomUUID(),
  foreignCentre: randomUUID(),
  v1: randomUUID(),
  v2: randomUUID(),
  service: randomUUID(),
};
const createdSlots: string[] = [];
const start = (offset = 0) => {
  const d = new Date(Date.now() + 2 * 86400000);
  const local = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  return new Date(
    `${local}T${String(9 + offset).padStart(2, "0")}:00:00+05:30`,
  );
};
async function slot(offset = 0, capacity = 1, past = false) {
  const sid = randomUUID();
  const s = start(offset);
  if (past) s.setUTCDate(s.getUTCDate() - 4);
  await admin.query(
    "INSERT INTO service_slots(id,centre_id,starts_at,ends_at,capacity) VALUES($1,$2,$3,$4,$5)",
    [sid, ids.centre, s, new Date(+s + 3600000), capacity],
  );
  createdSlots.push(sid);
  return sid;
}
async function reserve(
  vehicle: string,
  slotId: string,
  key = randomUUID(),
  actor = ids.customer,
) {
  return (
    await app.query("SELECT * FROM reserve_booking($1,$2,$3,$4,$5,$6)", [
      actor,
      vehicle,
      slotId,
      ids.service,
      "Integration test maintenance",
      key,
    ])
  ).rows[0];
}
before(async () => {
  await admin.query(
    "INSERT INTO service_centres(id,name,address,city,phone) VALUES($1,'Test Centre','Test Address','Bengaluru','1234567890'),($2,'Other Centre','Other Address','Bengaluru','1234567890')",
    [ids.centre, ids.foreignCentre],
  );
  for (const [uid, role, centre] of [
    [ids.customer, "CUSTOMER", null],
    [ids.other, "CUSTOMER", null],
    [ids.staff, "STAFF", ids.centre],
    [ids.foreignStaff, "STAFF", ids.foreignCentre],
  ])
    await admin.query(
      "INSERT INTO users(id,name,email,password_hash,role,centre_id) VALUES($1,'Test User',$2,$3,$4,$5)",
      [uid, `${uid}@test.invalid`, "$2b$12$testhash", role, centre],
    );
  for (const vid of [ids.v1, ids.v2])
    await admin.query(
      "INSERT INTO vehicles(id,owner_id,registration,make,model,model_year,current_km) VALUES($1,$2,$3,'Test','Car',2024,10000)",
      [
        vid,
        ids.customer,
        `T${vid.replaceAll("-", "").slice(0, 12).toUpperCase()}`,
      ],
    );
  await admin.query(
    "INSERT INTO service_types(id,code,name,description) VALUES($1,$2,'Test Service','Test')",
    [ids.service, `TEST-${ids.service}`],
  );
  await mongo.connect();
});
after(async () => {
  const b = (
    await admin.query(
      "SELECT id FROM bookings WHERE vehicle_id=ANY($1::uuid[])",
      [[ids.v1, ids.v2]],
    )
  ).rows.map((x) => x.id);
  await mongo
    .db("motive")
    .collection("job_inspections")
    .deleteMany({ vehicle_id: { $in: [ids.v1, ids.v2] } });
  await admin.query(
    "DELETE FROM service_items WHERE record_id IN (SELECT id FROM service_records WHERE booking_id=ANY($1::uuid[]))",
    [b],
  );
  await admin.query(
    "DELETE FROM service_records WHERE booking_id=ANY($1::uuid[])",
    [b],
  );
  await admin.query(
    "DELETE FROM booking_status_history WHERE booking_id=ANY($1::uuid[])",
    [b],
  );
  await admin.query("DELETE FROM bookings WHERE id=ANY($1::uuid[])", [b]);
  await admin.query(
    "DELETE FROM maintenance_rules WHERE vehicle_id=ANY($1::uuid[])",
    [[ids.v1, ids.v2]],
  );
  await admin.query("DELETE FROM vehicles WHERE id=ANY($1::uuid[])", [
    [ids.v1, ids.v2],
  ]);
  await admin.query(
    "DELETE FROM service_slots WHERE centre_id=ANY($1::uuid[])",
    [[ids.centre, ids.foreignCentre]],
  );
  await admin.query("DELETE FROM users WHERE id=ANY($1::uuid[])", [
    [ids.customer, ids.other, ids.staff, ids.foreignStaff],
  ]);
  await admin.query("DELETE FROM service_centres WHERE id=ANY($1::uuid[])", [
    [ids.centre, ids.foreignCentre],
  ]);
  await admin.query("DELETE FROM service_types WHERE id=$1", [ids.service]);
  await app.end();
  await admin.end();
  await mongo.close();
});
let firstBooking: any;
test("two concurrent reservations for the last space yield exactly one success", async () => {
  const s = await slot();
  const results = await Promise.allSettled([
    reserve(ids.v1, s),
    reserve(ids.v2, s),
  ]);
  assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
  firstBooking = (
    results.find((x) => x.status === "fulfilled") as PromiseFulfilledResult<any>
  ).value;
  assert.equal(
    (
      await admin.query(
        "SELECT count(*)::int n FROM bookings WHERE slot_id=$1",
        [s],
      )
    ).rows[0].n,
    1,
  );
});
test("same request key replays the original reservation without duplicates", async () => {
  const b = await reserve(
    firstBooking.vehicle_id,
    firstBooking.slot_id,
    firstBooking.request_key,
  );
  assert.equal(b.id, firstBooking.id);
});
test("request key with changed inputs is rejected", async () => {
  await assert.rejects(
    reserve(
      firstBooking.vehicle_id === ids.v1 ? ids.v2 : ids.v1,
      firstBooking.slot_id,
      firstBooking.request_key,
    ),
    /different inputs/,
  );
});
test("foreign customer cannot reserve another owner vehicle", async () => {
  await assert.rejects(
    reserve(ids.v1, firstBooking.slot_id, randomUUID(), ids.other),
    /access denied/i,
  );
});
test("runtime account cannot bypass reservation function with direct SQL", async () => {
  await assert.rejects(
    app.query("UPDATE bookings SET status='CANCELLED' WHERE id=$1", [
      firstBooking.id,
    ]),
    /permission denied/,
  );
  await assert.rejects(
    app.query("UPDATE vehicles SET current_km=1 WHERE id=$1", [ids.v1]),
    /permission denied/,
  );
});
test("referenced slot cannot be edited or deleted", async () => {
  await assert.rejects(
    app.query("UPDATE service_slots SET capacity=3 WHERE id=$1", [
      firstBooking.slot_id,
    ]),
    /cannot be changed/,
  );
  await assert.rejects(
    app.query("DELETE FROM service_slots WHERE id=$1", [firstBooking.slot_id]),
    /cannot be changed/,
  );
});
test("cancellation is idempotent and space is reusable", async () => {
  for (let i = 0; i < 2; i++) {
    const b = (
      await app.query("SELECT * FROM transition_booking($1,$2,'CANCELLED')", [
        ids.customer,
        firstBooking.id,
      ])
    ).rows[0];
    assert.equal(b.status, "CANCELLED");
  }
  const next = await reserve(ids.v1, firstBooking.slot_id);
  assert.equal(next.status, "CONFIRMED");
});
test("same vehicle cannot book simultaneous arrival windows across centres", async () => {
  const original = (
    await admin.query("SELECT * FROM service_slots WHERE id=$1", [
      firstBooking.slot_id,
    ])
  ).rows[0];
  const sid = randomUUID();
  await admin.query(
    "INSERT INTO service_slots(id,centre_id,starts_at,ends_at,capacity) VALUES($1,$2,$3,$4,3)",
    [sid, ids.foreignCentre, original.starts_at, original.ends_at],
  );
  await assert.rejects(reserve(ids.v1, sid), /already booked/);
});
test("inactive centres cannot receive reservations", async () => {
  const s = await slot(1);
  await admin.query("UPDATE service_centres SET active=false WHERE id=$1", [
    ids.centre,
  ]);
  await assert.rejects(reserve(ids.v2, s), /inactive/);
  await admin.query("UPDATE service_centres SET active=true WHERE id=$1", [
    ids.centre,
  ]);
});
test("slot time alignment and negative mileage are database constraints", async () => {
  await assert.rejects(
    admin.query(
      "INSERT INTO service_slots(centre_id,starts_at,ends_at,capacity) VALUES($1,$2,$3,3)",
      [ids.centre, new Date(+start(2) + 60000), new Date(+start(2) + 3660000)],
    ),
    /check constraint/,
  );
  await assert.rejects(
    app.query("SELECT * FROM update_vehicle_mileage($1,$2,-1)", [
      ids.customer,
      ids.v1,
    ]),
    /cannot decrease/,
  );
});
test("maintenance baseline cannot exceed current mileage or date", async () => {
  await assert.rejects(
    app.query(
      "SELECT * FROM save_maintenance_rule($1,$2,$3,6,5000,NULL,20000)",
      [ids.customer, ids.v1, ids.service],
    ),
    /Baseline/,
  );
});
let job: any;
test("staff centre boundary and timing checks apply before state changes", async () => {
  await assert.rejects(
    app.query("SELECT * FROM transition_booking($1,$2,'IN_PROGRESS')", [
      ids.staff,
      firstBooking.id,
    ]),
    /Invalid booking transition/,
  );
  const s = await slot(2, 3, true);
  const bid = randomUUID();
  await admin.query(
    "INSERT INTO bookings(id,vehicle_id,slot_id,requested_service_type_id,complaint,request_key) VALUES($1,$2,$3,$4,'Past fixture',$5)",
    [bid, ids.v2, s, ids.service, randomUUID()],
  );
  await assert.rejects(
    app.query("SELECT * FROM transition_booking($1,$2,'IN_PROGRESS')", [
      ids.foreignStaff,
      bid,
    ]),
    /Access denied/,
  );
  job = (
    await app.query("SELECT * FROM transition_booking($1,$2,'IN_PROGRESS')", [
      ids.staff,
      bid,
    ])
  ).rows[0];
  assert.equal(job.status, "IN_PROGRESS");
});
test("inspection locking works without granting direct booking update rights", async () => {
  const c = await app.connect();
  try {
    await c.query("BEGIN");
    const r = (
      await c.query("SELECT * FROM lock_inspection_job($1,$2)", [
        ids.staff,
        job.id,
      ])
    ).rows[0];
    assert.equal(r.status, "IN_PROGRESS");
    await c.query("ROLLBACK");
  } finally {
    c.release();
  }
});
test("failed completion leaves record, items, mileage, and booking unchanged", async () => {
  const bad = [
    {
      serviceTypeId: ids.service,
      description: "Invalid quantity",
      quantity: 0,
      unitPrice: "100.00",
    },
  ];
  await assert.rejects(
    app.query("SELECT * FROM complete_service($1,$2,11000,'Test',$3)", [
      ids.staff,
      job.id,
      JSON.stringify(bad),
    ]),
  );
  assert.equal(
    (
      await admin.query(
        "SELECT count(*)::int n FROM service_records WHERE booking_id=$1",
        [job.id],
      )
    ).rows[0].n,
    0,
  );
  assert.equal(
    (await admin.query("SELECT current_km FROM vehicles WHERE id=$1", [ids.v2]))
      .rows[0].current_km,
    10000,
  );
  assert.equal(
    (await admin.query("SELECT status FROM bookings WHERE id=$1", [job.id]))
      .rows[0].status,
    "IN_PROGRESS",
  );
});
test("concurrent duplicate completion creates one record and updates mileage once", async () => {
  const items = JSON.stringify([
    {
      serviceTypeId: ids.service,
      description: "Oil change",
      quantity: 2,
      unitPrice: "100.25",
    },
  ]);
  const results = await Promise.all([
    app.query("SELECT * FROM complete_service($1,$2,11000,'All done',$3)", [
      ids.staff,
      job.id,
      items,
    ]),
    app.query("SELECT * FROM complete_service($1,$2,11000,'All done',$3)", [
      ids.staff,
      job.id,
      items,
    ]),
  ]);
  assert.equal(results[0].rows[0].id, results[1].rows[0].id);
  const r = results[0].rows[0];
  assert.equal(
    (
      await app.query(
        "SELECT total FROM service_charge_totals WHERE record_id=$1",
        [r.id],
      )
    ).rows[0].total,
    "200.50",
  );
  assert.equal(
    (await app.query("SELECT current_km FROM vehicles WHERE id=$1", [ids.v2]))
      .rows[0].current_km,
    11000,
  );
});
test("audit trigger records real actor and successful transition only", async () => {
  const rows = (
    await app.query(
      "SELECT * FROM booking_status_history WHERE booking_id=$1 ORDER BY changed_at",
      [job.id],
    )
  ).rows;
  assert.deepEqual(
    rows.map((x) => x.to_status),
    ["CONFIRMED", "IN_PROGRESS", "COMPLETED"],
  );
  assert.equal(rows[2].actor_id, ids.staff);
});
test("terminal booking cannot be reopened", async () => {
  await assert.rejects(
    app.query("SELECT * FROM transition_booking($1,$2,'IN_PROGRESS')", [
      ids.staff,
      job.id,
    ]),
    /Invalid booking transition/,
  );
});
test("MongoDB validator rejects malformed inspection documents", async () => {
  await assert.rejects(
    mongo
      .db("motive")
      .collection("job_inspections")
      .insertOne({ booking_id: "invalid", items: [] } as any),
    /validation/,
  );
});
test("MongoDB unique booking and revision support prevent duplicate inspections", async () => {
  const doc = {
    booking_id: job.id,
    vehicle_id: ids.v2,
    centre_id: ids.centre,
    revision: 1,
    items: [
      {
        component: "brakes",
        result: "FAIL",
        comment: "Check wear",
        measurements: [],
      },
    ],
    diagnostic_notes: "Test",
    updated_by: ids.staff,
    created_at: new Date(),
    updated_at: new Date(),
  };
  const col = mongo.db("motive").collection("job_inspections");
  await col.insertOne(doc);
  await assert.rejects(
    col.insertOne({ ...doc, _id: undefined }),
    /duplicate key/,
  );
  assert.equal(
    (
      await col.findOneAndUpdate(
        { booking_id: job.id, revision: 1 },
        { $inc: { revision: 1 } },
        { returnDocument: "after" },
      )
    )?.revision,
    2,
  );
  assert.equal(
    await col.findOneAndUpdate(
      { booking_id: job.id, revision: 1 },
      { $inc: { revision: 1 } },
    ),
    null,
  );
});
