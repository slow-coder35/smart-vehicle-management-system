import { pool, query, mongo, inspections } from "../lib/db";
try {
  const [stats] = await query(
    "SELECT (SELECT count(*) FROM users) users,(SELECT count(*) FROM vehicles) vehicles,(SELECT count(*) FROM bookings) bookings,(SELECT count(*) FROM service_records) services",
  );
  const bad = await query(
    `SELECT b.id FROM bookings b LEFT JOIN service_records r ON r.booking_id=b.id WHERE (b.status='COMPLETED' AND r.id IS NULL) OR (b.status<>'COMPLETED' AND r.id IS NOT NULL)`,
  );
  const empty = await query(
    "SELECT r.id FROM service_records r WHERE NOT EXISTS(SELECT 1 FROM service_items i WHERE i.record_id=r.id)",
  );
  const overflow = await query(
    `SELECT s.id FROM service_slots s JOIN bookings b ON b.slot_id=s.id WHERE b.status<>'CANCELLED' GROUP BY s.id HAVING count(*)>s.capacity`,
  );
  const col = await inspections();
  const docs = await col.find({}, { projection: { booking_id: 1 } }).toArray();
  const bookings = new Set(
    (
      await query("SELECT id FROM bookings WHERE id=ANY($1::uuid[])", [
        docs.map((d) => d.booking_id),
      ])
    ).map((b) => b.id),
  );
  const orphans = docs.filter((d) => !bookings.has(d.booking_id));
  console.log("Data:", stats);
  console.log(
    `Inspection documents: ${docs.length}. Status mismatches: ${bad.length}. Empty services: ${empty.length}. Over-capacity slots: ${overflow.length}. Orphan inspections: ${orphans.length}.`,
  );
  if (bad.length || empty.length || overflow.length || orphans.length)
    process.exitCode = 1;
  else console.log("All consistency checks passed.");
} finally {
  await pool.end();
  await mongo.close();
}
