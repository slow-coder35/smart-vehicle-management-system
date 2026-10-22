import pg from "pg";
import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_ADMIN_URL });
const mongo = new MongoClient(process.env.MONGODB_ADMIN_URI!);
await mongo.connect();
const c = await pool.connect();
const day = (offset: number, hour = 10) => {
  const local = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const d = new Date(`${local}T${String(hour).padStart(2, "0")}:00:00+05:30`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
};
try {
  await c.query("BEGIN");
  if (
    !(await c.query("SELECT 1 FROM users WHERE email='admin@motive.test'"))
      .rowCount
  ) {
    const password = process.env.DEMO_PASSWORD;
    if (!password || password.length < 10)
      throw new Error("Set DEMO_PASSWORD to at least 10 characters");
    const hash = await bcrypt.hash(password, 12);
    const id = () => randomUUID();
    const centres = [
      [
        "Motive Central",
        "12 Residency Road, Ashok Nagar",
        "Bengaluru",
        "080-4000-1200",
      ],
      [
        "Greenline Auto Care",
        "45 100 Feet Road, Indiranagar",
        "Bengaluru",
        "080-4000-1300",
      ],
      [
        "Precision Motors",
        "18 Outer Ring Road, HSR Layout",
        "Bengaluru",
        "080-4000-1400",
      ],
    ].map((x) => ({ id: id(), data: x }));
    for (const x of centres)
      await c.query(
        "INSERT INTO service_centres(id,name,address,city,phone) VALUES($1,$2,$3,$4,$5)",
        [x.id, ...x.data],
      );
    await c.query(
      "INSERT INTO users(name,email,password_hash,role) VALUES('Platform Administrator','admin@motive.test',$1,'ADMIN')",
      [hash],
    );
    const staff = [];
    for (let i = 0; i < 3; i++) {
      const uid = id();
      staff.push(uid);
      await c.query(
        "INSERT INTO users(id,name,email,password_hash,role,centre_id) VALUES($1,$2,$3,$4,'STAFF',$5)",
        [
          uid,
          ["Rohan Mehta", "Priya Nair", "Dev Sharma"][i],
          i === 0 ? "staff@motive.test" : `staff${i + 1}@motive.test`,
          hash,
          centres[i].id,
        ],
      );
    }
    const customers = [];
    for (let i = 0; i < 10; i++) {
      const uid = id();
      customers.push(uid);
      await c.query(
        "INSERT INTO users(id,name,email,password_hash,role) VALUES($1,$2,$3,$4,'CUSTOMER')",
        [
          uid,
          [
            "Aarav Sharma",
            "Ananya Rao",
            "Vikram Das",
            "Isha Kapoor",
            "Arjun Patel",
            "Neha Singh",
            "Kabir Shah",
            "Diya Menon",
            "Ravi Kumar",
            "Meera Joshi",
          ][i],
          i === 0 ? "customer@motive.test" : `customer${i + 1}@motive.test`,
          hash,
        ],
      );
    }
    const types = [];
    for (const t of [
      ["OIL", "Oil & filter change", "Engine oil and filter replacement"],
      ["BRAKES", "Brake service", "Brake inspection and replacement"],
      ["TYRES", "Tyre care", "Rotation, balancing and alignment"],
      ["BATTERY", "Battery check", "Battery inspection and charging"],
      ["GENERAL", "General service", "Routine vehicle check and maintenance"],
      ["AC", "AC service", "Air conditioning inspection and maintenance"],
    ]) {
      const tid = id();
      types.push(tid);
      await c.query(
        "INSERT INTO service_types(id,code,name,description) VALUES($1,$2,$3,$4)",
        [tid, ...t],
      );
    }
    for (const f of [
      ["BRAKE_NOISE", "Brake noise", "brakes"],
      ["BATTERY_WEAK", "Weak battery", "battery"],
      ["TYRE_WEAR", "Uneven tyre wear", "tyres"],
      ["OIL_LEAK", "Oil leak", "engine"],
      ["AC_COOLING", "Reduced AC cooling", "air conditioning"],
    ])
      await c.query(
        "INSERT INTO fault_codes(code,label,component) VALUES($1,$2,$3)",
        f,
      );
    const vehicles = [];
    for (let i = 0; i < 15; i++) {
      const vid = id(),
        owner = i < 3 ? customers[0] : customers[1 + ((i - 3) % 9)];
      const specs =
        i === 0
          ? ["Hyundai", "Creta", 2022, 29700]
          : i === 1
            ? ["Maruti Suzuki", "Baleno", 2023, 18200]
            : i === 2
              ? ["Honda", "City", 2020, 42600]
              : ["Tata", "Nexon", 2021 + (i % 4), 20000 + i * 1300];
      vehicles.push({ id: vid, owner, km: Number(specs[3]) });
      await c.query(
        "INSERT INTO vehicles(id,owner_id,registration,make,model,model_year,current_km,mileage_updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          vid,
          owner,
          `KA${String(i + 1).padStart(2, "0")}MN${1200 + i}`,
          ...specs,
          i === 2 ? day(-42) : day(-2),
        ],
      );
    }
    const docs = [];
    for (let i = 0; i < 40; i++) {
      const vehicle = vehicles[i % 15],
        ci = i % 3,
        ago = 15 + i * 4,
        slot = id(),
        booking = id(),
        record = id(),
        service = i % 6,
        completed = day(-ago, 11),
        km = Math.max(0, vehicle.km - 1500 - i * 70);
      await c.query(
        "INSERT INTO service_slots(id,centre_id,starts_at,ends_at,capacity) VALUES($1,$2,$3,$4,3)",
        [slot, centres[ci].id, day(-ago), completed],
      );
      await c.query(
        "INSERT INTO bookings(id,vehicle_id,slot_id,requested_service_type_id,complaint,status,request_key,created_at) VALUES($1,$2,$3,$4,$5,'COMPLETED',$6,$7)",
        [
          booking,
          vehicle.id,
          slot,
          types[service],
          "Scheduled maintenance and inspection",
          id(),
          day(-ago - 2),
        ],
      );
      await c.query(
        "INSERT INTO service_records(id,booking_id,completed_by,completed_at,odometer_km,summary) VALUES($1,$2,$3,$4,$5,$6)",
        [
          record,
          booking,
          staff[ci],
          completed,
          km,
          "Completed routine maintenance. Vehicle checked and returned to customer.",
        ],
      );
      await c.query(
        "INSERT INTO service_items(record_id,service_type_id,description,quantity,unit_price,fault_code) VALUES($1,$2,$3,1,$4,$5)",
        [
          record,
          types[service],
          [
            "Engine oil and filter replaced",
            "Brake pads inspected and serviced",
            "Tyres balanced and rotated",
            "Battery terminals cleaned and tested",
            "Multi-point vehicle inspection",
            "AC filter and cooling serviced",
          ][service],
          [3200, 2400, 1200, 750, 1800, 1600][service],
          i % 5 === 0 ? "BRAKE_NOISE" : null,
        ],
      );
      docs.push({
        booking_id: booking,
        vehicle_id: vehicle.id,
        centre_id: centres[ci].id,
        revision: 1,
        items: [
          {
            component: "brakes",
            result: i % 4 === 0 ? "FAIL" : "PASS",
            comment:
              i % 4 === 0
                ? "Pad wear noted during inspection."
                : "Within normal range.",
            measurements: [],
          },
          {
            component: "tyres",
            result: i % 3 === 0 ? "ATTENTION" : "PASS",
            comment: "Pressure and tread checked.",
            measurements: [],
          },
        ],
        diagnostic_notes: "Routine inspection completed.",
        updated_by: staff[ci],
        created_at: completed,
        updated_at: completed,
      });
    }
    // Purpose-built evidence for explainable maintenance and recurring-fault demonstrations.
    for (let i = 0; i < 2; i++) {
      const slot = id(),
        bid = id(),
        rid = id(),
        date = day(-20 - i * 35);
      await c.query(
        "INSERT INTO service_slots(id,centre_id,starts_at,ends_at,capacity) VALUES($1,$2,$3,$4,3)",
        [slot, centres[0].id, date, new Date(date.getTime() + 3600000)],
      );
      await c.query(
        "INSERT INTO bookings(id,vehicle_id,slot_id,requested_service_type_id,complaint,status,request_key) VALUES($1,$2,$3,$4,'Recurring brake noise','COMPLETED',$5)",
        [bid, vehicles[0].id, slot, types[1], id()],
      );
      await c.query(
        "INSERT INTO service_records(id,booking_id,completed_by,completed_at,odometer_km,summary) VALUES($1,$2,$3,$4,$5,$6)",
        [
          rid,
          bid,
          staff[0],
          date,
          28000 - i * 1700,
          "Brake noise investigated and pads serviced.",
        ],
      );
      await c.query(
        "INSERT INTO service_items(record_id,service_type_id,description,quantity,unit_price,fault_code) VALUES($1,$2,'Brake inspection',1,950,'BRAKE_NOISE')",
        [rid, types[1]],
      );
    }
    for (let i = 0; i < 3; i++) {
      await c.query(
        "INSERT INTO maintenance_rules(vehicle_id,service_type_id,interval_months,interval_km,baseline_date,baseline_km) VALUES($1,$2,$3,$4,$5,$6)",
        [
          vehicles[i].id,
          types[0],
          6,
          5000,
          day(-150).toISOString().slice(0, 10),
          vehicles[i].km - 6500,
        ],
      );
      await c.query(
        "INSERT INTO maintenance_rules(vehicle_id,service_type_id,interval_months,interval_km,baseline_date,baseline_km) VALUES($1,$2,6,10000,$3,$4)",
        [
          vehicles[i].id,
          types[2],
          day(-160).toISOString().slice(0, 10),
          vehicles[i].km - 9700,
        ],
      );
    }
    await c.query(
      "INSERT INTO maintenance_rules(vehicle_id,service_type_id,interval_months) VALUES($1,$2,12)",
      [vehicles[1].id, types[3]],
    );
    // A currently in-progress job and a confirmed past arrival for a live staff demo.
    for (let i = 0; i < 2; i++) {
      const sid = id(),
        bid = id(),
        start = day(-1, 14 + i);
      await c.query(
        "INSERT INTO service_slots(id,centre_id,starts_at,ends_at,capacity) VALUES($1,$2,$3,$4,3)",
        [sid, centres[0].id, start, new Date(start.getTime() + 3600000)],
      );
      await c.query(
        "INSERT INTO bookings(id,vehicle_id,slot_id,requested_service_type_id,complaint,status,request_key) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          bid,
          vehicles[i].id,
          sid,
          types[0],
          i === 0
            ? "Oil change and recurring brake noise"
            : "General service and tyre inspection",
          i === 0 ? "IN_PROGRESS" : "CONFIRMED",
          id(),
        ],
      );
    }
    await mongo.db("motive").collection("job_inspections").insertMany(docs);
    console.log(
      "Seeded 3 centres, 14 users, 15 vehicles, 42 completed services, inspection records, and live jobs.",
    );
  }
  // Extend future availability on reruns without erasing work.
  const centres = (await c.query("SELECT id FROM service_centres")).rows;
  for (const centre of centres)
    for (let d = 1; d <= 7; d++)
      for (const h of [9, 10, 11, 14, 15, 16, 17]) {
        const start = day(d, h);
        await c.query(
          "INSERT INTO service_slots(centre_id,starts_at,ends_at,capacity) VALUES($1,$2,$3,3) ON CONFLICT(centre_id,starts_at) DO NOTHING",
          [centre.id, start, new Date(start.getTime() + 3600000)],
        );
      }
  await c.query("COMMIT");
} catch (e) {
  await c.query("ROLLBACK");
  throw e;
} finally {
  c.release();
  await pool.end();
  await mongo.close();
}
