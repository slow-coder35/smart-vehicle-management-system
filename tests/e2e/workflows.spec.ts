import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import pg from "pg";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { MongoClient } from "mongodb";
const origin = process.env.APP_ORIGIN || "http://localhost:3000";
const demo = process.env.DEMO_PASSWORD!;
async function login(page: Page, role = "customer") {
  await page.goto("/");
  await page.getByLabel("Email address").fill(`${role}@motive.test`);
  await page.getByLabel("Password", { exact: true }).fill(demo);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Hello,/ })).toBeVisible();
}
async function auth(request: APIRequestContext, role = "customer") {
  const r = await request.post("/api/auth/login", {
    headers: { origin },
    data: { email: `${role}@motive.test`, password: demo },
  });
  expect(r.ok()).toBeTruthy();
}
test("customer garage, instant booking, history, maintenance, and mobile navigation", async ({
  page,
}) => {
  await login(page);
  await expect(page.getByText("Vehicles in your garage")).toBeVisible();
  await page.screenshot({
    path: "output/screenshots/customer-overview.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "My garage", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your garage." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Add vehicle", exact: true })
    .first()
    .click();
  const registration = `E2E${Date.now().toString().slice(-9)}`;
  await page.getByLabel("Registration number").fill(registration);
  await page.getByLabel("Make", { exact: true }).fill("Toyota");
  await page.getByLabel("Model", { exact: true }).fill("Glanza");
  await page.getByLabel("Current mileage (km)").fill("15000");
  await page
    .getByRole("button", { name: "Add vehicle", exact: true })
    .last()
    .click();
  await expect(page.getByText(registration, { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Book a service", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Book a service." }),
  ).toBeVisible();
  await page
    .getByLabel("Vehicle", { exact: true })
    .selectOption({ label: `Toyota Glanza · ${registration}` });
  await page.getByRole("button", { name: /Motive Central/ }).click();
  await page
    .getByRole("button", { name: /9:00.*spaces left/i })
    .first()
    .click();
  await page
    .getByLabel("What should the team know?")
    .fill("Browser test routine maintenance");
  await page
    .getByRole("button", { name: "Confirm booking", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your next service is booked." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "View my bookings", exact: true })
    .click();
  const row = page.getByRole("row").filter({ hasText: registration });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Details" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("button", { name: "Cancel booking", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm cancellation", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByText("Cancelled", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByRole("button", { name: "Service history", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Service history." }),
  ).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "Completed" }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Maintenance", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Stay ahead of maintenance." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Patterns worth a closer look" }),
  ).toBeVisible();
  await page.screenshot({
    path: "output/screenshots/maintenance.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Insights & spending", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your care, in perspective." }),
  ).toBeVisible();
  await expect(
    page.getByText("Recorded service charges", { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Hello,/ })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "output/screenshots/mobile-overview.png",
    fullPage: true,
  });
});
test("staff inspection, measurements, atomic completion, and customer history", async ({
  page,
}) => {
  const admin = new pg.Pool({
    connectionString: process.env.DATABASE_ADMIN_URL,
  });
  const ids = {
    vehicle: randomUUID(),
    slot: randomUUID(),
    booking: randomUUID(),
  };
  let recordId: string | undefined;
  const c = (
    await admin.query(
      "SELECT u.id staff,u.centre_id,c.id customer FROM users u CROSS JOIN users c WHERE u.email='staff@motive.test' AND c.email='customer@motive.test'",
    )
  ).rows[0];
  const service = (
    await admin.query("SELECT id FROM service_types WHERE code='OIL'")
  ).rows[0].id;
  const registration = `JOB${Date.now().toString().slice(-9)}`;
  const start = new Date("2025-01-01T10:00:00+05:30");
  await admin.query(
    "INSERT INTO vehicles(id,owner_id,registration,make,model,model_year,current_km) VALUES($1,$2,$3,'Test','Service Car',2024,15000)",
    [ids.vehicle, c.customer, registration],
  );
  await admin.query(
    "INSERT INTO service_slots(id,centre_id,starts_at,ends_at,capacity) VALUES($1,$2,$3,$4,3)",
    [ids.slot, c.centre_id, start, new Date(+start + 3600000)],
  );
  await admin.query(
    "INSERT INTO bookings(id,vehicle_id,slot_id,requested_service_type_id,complaint,request_key) VALUES($1,$2,$3,$4,'Browser completion test',$5)",
    [ids.booking, ids.vehicle, ids.slot, service, randomUUID()],
  );
  try {
    await login(page, "staff");
    await page.getByRole("button", { name: "Work queue", exact: true }).click();
    await page.getByLabel("Filter booking status").selectOption("CONFIRMED");
    const row = page.getByRole("row").filter({ hasText: registration });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Details" }).click();
    await page
      .getByRole("button", { name: "Start service", exact: true })
      .click();
    await expect(
      page.getByRole("dialog").getByText("In progress", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Inspection", exact: true }).click();
    await page.getByLabel("Component 1", { exact: true }).fill("brakes");
    await page.getByLabel("Result", { exact: true }).selectOption("ATTENTION");
    await page
      .getByLabel("Notes", { exact: true })
      .fill("Slight wear observed");
    await page
      .getByRole("button", { name: "Add measurement", exact: true })
      .click();
    await page.getByLabel("Measurement name").fill("pad thickness");
    await page.getByLabel("Measurement value").fill("3.5");
    await page.getByLabel("Measurement unit").fill("mm");
    await page
      .getByRole("button", { name: "Save inspection", exact: true })
      .click();
    await expect(page.getByRole("dialog").getByRole("status")).toContainText(
      "Inspection saved.",
    );
    await page
      .getByRole("button", { name: "Complete service", exact: true })
      .click();
    await page.getByLabel("Completion mileage (km)").fill("15100");
    await page
      .getByLabel("Work summary")
      .fill("Oil and filter changed. Brakes inspected.");
    await page
      .getByLabel("Item description")
      .fill("Engine oil and filter replacement");
    await page.getByLabel("Unit price (₹)").fill("2300.50");
    await page
      .getByRole("button", { name: "Complete & save service", exact: true })
      .click();
    await expect(
      page.getByRole("dialog").getByText("Completed", { exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("dialog")
        .getByText("Oil and filter changed. Brakes inspected.", {
          exact: true,
        }),
    ).toBeVisible();
    await expect(page.getByRole("dialog").locator(".detail-amount")).toHaveText(
      "₹2,300.50",
    );
    await page.screenshot({
      path: "output/screenshots/staff-completed-job.png",
      fullPage: true,
    });
    recordId = (
      await admin.query("SELECT id FROM service_records WHERE booking_id=$1", [
        ids.booking,
      ])
    ).rows[0].id;
    expect(
      (
        await admin.query("SELECT current_km FROM vehicles WHERE id=$1", [
          ids.vehicle,
        ])
      ).rows[0].current_km,
    ).toBe(15100);
  } finally {
    const m = new MongoClient(process.env.MONGODB_ADMIN_URI!);
    await m.connect();
    await m
      .db("motive")
      .collection("job_inspections")
      .deleteMany({ booking_id: ids.booking });
    await m.close();
    await admin.query(
      "DELETE FROM service_items WHERE record_id IN(SELECT id FROM service_records WHERE booking_id=$1)",
      [ids.booking],
    );
    await admin.query("DELETE FROM service_records WHERE booking_id=$1", [
      ids.booking,
    ]);
    await admin.query(
      "DELETE FROM booking_status_history WHERE booking_id=$1",
      [ids.booking],
    );
    await admin.query("DELETE FROM bookings WHERE id=$1", [ids.booking]);
    await admin.query("DELETE FROM service_slots WHERE id=$1", [ids.slot]);
    await admin.query("DELETE FROM vehicles WHERE id=$1", [ids.vehicle]);
    await admin.end();
  }
});
test("administrator creates a centre and staff account then revokes staff access", async ({
  page,
}) => {
  const admin = new pg.Pool({
    connectionString: process.env.DATABASE_ADMIN_URL,
  });
  const name = `E2E Centre ${Date.now()}`,
    email = `e2e-${Date.now()}@test.invalid`;
  try {
    await login(page, "admin");
    await page
      .getByRole("button", { name: "Service centres", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Add service centre", exact: true })
      .click();
    await page.getByLabel("Centre name").fill(name);
    await page.getByLabel("Street address").fill("18 Test Road");
    await page.getByLabel("City", { exact: true }).fill("Bengaluru");
    await page.getByLabel("Phone", { exact: true }).fill("9876543210");
    await page
      .getByRole("button", { name: "Create centre", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Team members", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Add team member", exact: true })
      .click();
    await page.getByLabel("Full name").fill("E2E Specialist");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Initial password").fill("TestSpecialist2026!");
    await page
      .getByLabel("Service centre", { exact: true })
      .selectOption({ label: name });
    await page
      .getByRole("button", { name: "Create staff account", exact: true })
      .click();
    const row = page.getByRole("row").filter({ hasText: email });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Deactivate", exact: true }).click();
    await page
      .getByRole("button", { name: "Confirm change", exact: true })
      .click();
    await expect(row.getByText("Inactive", { exact: true })).toBeVisible();
    await page.screenshot({
      path: "output/screenshots/admin-team.png",
      fullPage: true,
    });
  } finally {
    await admin.query(
      "DELETE FROM sessions WHERE user_id IN(SELECT id FROM users WHERE email=$1)",
      [email],
    );
    await admin.query("DELETE FROM users WHERE email=$1", [email]);
    await admin.query("DELETE FROM service_centres WHERE name=$1", [name]);
    await admin.end();
  }
});
test("API enforces ownership, roles, CSRF origin, and password hashing", async ({
  request,
}) => {
  await auth(request);
  expect((await request.get("/api/admin/centres")).status()).toBe(403);
  expect((await request.post("/api/vehicles", { data: {} })).status()).toBe(
    403,
  );
  const admin = new pg.Pool({
    connectionString: process.env.DATABASE_ADMIN_URL,
  });
  try {
    const foreign = (
      await admin.query(
        "SELECT v.id FROM vehicles v JOIN users u ON u.id=v.owner_id WHERE u.email='customer2@motive.test' LIMIT 1",
      )
    ).rows[0];
    expect((await request.get(`/api/vehicles/${foreign.id}`)).status()).toBe(
      404,
    );
    const r = await request.post("/api/auth/register", {
      headers: { origin },
      data: {
        name: "Bad Registration",
        email: "bad@test.invalid",
        password: "ValidPassword2026!",
        role: "ADMIN",
      },
    });
    expect(r.status()).toBe(400);
    const [hash] = (
      await admin.query(
        "SELECT password_hash FROM users WHERE email='customer@motive.test'",
      )
    ).rows;
    expect(hash.password_hash).not.toBe(demo);
    expect(await bcrypt.compare(demo, hash.password_hash)).toBeTruthy();
    await auth(request, "staff");
    const booking = (
      await admin.query(
        "SELECT b.id FROM bookings b JOIN service_slots s ON s.id=b.slot_id JOIN service_centres c ON c.id=s.centre_id WHERE c.name='Greenline Auto Care' LIMIT 1",
      )
    ).rows[0];
    expect((await request.get(`/api/bookings/${booking.id}`)).status()).toBe(
      404,
    );
    await auth(request, "customer");
    await request.post("/api/auth/logout", { headers: { origin }, data: {} });
    expect((await request.get("/api/auth/me")).status()).toBe(401);
  } finally {
    await admin.end();
  }
});

// Remove only synthetic vehicles produced by this browser suite.
test.afterAll(async () => {
  const db = new pg.Pool({ connectionString: process.env.DATABASE_ADMIN_URL });
  try {
    const vids = (
      await db.query(
        "SELECT v.id FROM vehicles v JOIN users u ON u.id=v.owner_id WHERE u.email='customer@motive.test' AND v.registration ~ '^E2E[0-9]+$' AND v.make='Toyota' AND v.model='Glanza'",
      )
    ).rows.map((v) => v.id);
    await db.query(
      "DELETE FROM booking_status_history WHERE booking_id IN(SELECT id FROM bookings WHERE vehicle_id=ANY($1::uuid[]))",
      [vids],
    );
    await db.query("DELETE FROM bookings WHERE vehicle_id=ANY($1::uuid[])", [
      vids,
    ]);
    await db.query("DELETE FROM vehicles WHERE id=ANY($1::uuid[])", [vids]);
  } finally {
    await db.end();
  }
});

test("vehicle edits, mileage validation, maintenance configuration and slot lifecycle APIs", async ({
  request,
}) => {
  const db = new pg.Pool({ connectionString: process.env.DATABASE_ADMIN_URL });
  let vehicle: string | undefined, slot: string | undefined;
  try {
    await auth(request);
    const v = await request.post("/api/vehicles", {
      headers: { origin },
      data: {
        registration: `API${Date.now().toString().slice(-10)}`,
        make: "Tata",
        model: "Tiago",
        modelYear: 2024,
        currentKm: 15000,
      },
    });
    expect(v.status()).toBe(201);
    vehicle = (await v.json()).data.id;
    const edited = await request.patch(`/api/vehicles/${vehicle}`, {
      headers: { origin },
      data: { make: "Tata", model: "Tiago EV", modelYear: 2024 },
    });
    expect(edited.status()).toBe(200);
    expect((await edited.json()).data.model).toBe("Tiago EV");
    expect(
      (
        await request.patch(`/api/vehicles/${vehicle}/mileage`, {
          headers: { origin },
          data: { currentKm: 15500 },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await request.patch(`/api/vehicles/${vehicle}/mileage`, {
          headers: { origin },
          data: { currentKm: 14000 },
        })
      ).status(),
    ).toBe(409);
    const catalogue = (await (await request.get("/api/catalogue")).json()).data;
    expect(
      (
        await request.put(`/api/vehicles/${vehicle}/maintenance-rules`, {
          headers: { origin },
          data: {
            serviceTypeId: catalogue.services[0].id,
            intervalMonths: null,
            intervalKm: 5000,
            baselineDate: null,
            baselineKm: 11000,
          },
        })
      ).status(),
    ).toBe(200);
    const rules = (
      await (await request.get(`/api/vehicles/${vehicle}/maintenance`)).json()
    ).data.rules;
    expect(rules[0].status).toBe("DUE_SOON");
    expect(rules[0].kmRemaining).toBe(500);
    await auth(request, "staff");
    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(Date.now() + 12 * 86400000));
    const made = await request.post("/api/slots", {
      headers: { origin },
      data: {
        startsAt: new Date(`${day}T10:00:00+05:30`).toISOString(),
        capacity: 1,
      },
    });
    expect(made.status()).toBe(201);
    slot = (await made.json()).data.id;
    expect(
      (
        await request.patch(`/api/slots/${slot}`, {
          headers: { origin },
          data: { capacity: 4 },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await request.delete(`/api/slots/${slot}`, { headers: { origin } })
      ).status(),
    ).toBe(200);
    slot = undefined;
  } finally {
    if (slot) await db.query("DELETE FROM service_slots WHERE id=$1", [slot]);
    if (vehicle) {
      await db.query("DELETE FROM maintenance_rules WHERE vehicle_id=$1", [
        vehicle,
      ]);
      await db.query("DELETE FROM vehicles WHERE id=$1", [vehicle]);
    }
    await db.end();
  }
});
