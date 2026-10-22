import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool, query, inspections } from "@/lib/db";
import {
  ApiError,
  userFromRequest,
  requireRole,
  createSession,
  hashToken,
  assertOrigin,
  limitAuth,
} from "@/lib/auth";
import {
  vehicleSchema,
  centreSchema,
  password,
  email,
  uuid,
  inspectionSchema,
  ruleSchema,
  itemSchema,
} from "@/lib/validation";
import {
  maintenance,
  recurringFaults,
  reports,
  bookingSelect,
} from "@/lib/data";
import type { User } from "@/lib/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
const ok = (data: unknown, status = 200, headers?: HeadersInit) =>
  NextResponse.json({ data }, { status, headers });
async function body(req: Request) {
  const s = await req.text();
  if (new TextEncoder().encode(s).length > 262144)
    throw new ApiError(400, "Request is too large.");
  try {
    return JSON.parse(s);
  } catch {
    throw new ApiError(400, "Invalid JSON body.");
  }
}
async function ownVehicle(u: User, id: string) {
  uuid.parse(id);
  const r = await query("SELECT * FROM vehicles WHERE id=$1 AND owner_id=$2", [
    id,
    u.id,
  ]);
  if (!r[0]) throw new ApiError(404, "Vehicle not found.");
  return r[0];
}
async function ownBooking(u: User, id: string) {
  uuid.parse(id);
  const rows = await query(
    `${bookingSelect} WHERE b.id=$1 AND (($2='CUSTOMER' AND v.owner_id=$3) OR ($2='STAFF' AND s.centre_id=$4))`,
    [id, u.role, u.id, u.centre_id],
  );
  if (!rows[0]) throw new ApiError(404, "Booking not found.");
  return rows[0];
}
const list = (
  items: unknown[],
  total: number,
  page: number,
  pageSize: number,
) => ({ items, total, page, pageSize });
async function handle(req: Request, ctx: Context) {
  try {
    assertOrigin(req);
    const { path } = await ctx.params;
    const key = path.join("/"),
      method = req.method,
      url = new URL(req.url);
    const get = (k: string) => url.searchParams.get(k);
    const page = Math.max(1, Math.min(100000, Number(get("page")) || 1));
    const pageSize = Math.max(1, Math.min(100, Number(get("pageSize")) || 20));
    const offset = (page - 1) * pageSize;
    if (key === "auth/register" && method === "POST") {
      const v = z
        .object({ name: z.string().trim().min(2).max(100), email, password })
        .strict()
        .parse(await body(req));
      limitAuth(`register:${v.email}`);
      const [u] = await query(
        "INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'CUSTOMER') RETURNING id,name,email,role,centre_id",
        [v.name, v.email, await bcrypt.hash(v.password, 12)],
      );
      return ok(u, 201, { "Set-Cookie": await createSession(u.id) });
    }
    if (key === "auth/login" && method === "POST") {
      const v = z
        .object({ email, password: z.string().min(1).max(200) })
        .strict()
        .parse(await body(req));
      limitAuth(`login:${v.email}`);
      const [u] = await query("SELECT * FROM users WHERE email=$1 AND active", [
        v.email,
      ]);
      const valid = await bcrypt.compare(
        v.password,
        u?.password_hash ??
          "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYwD3VpC2bkzVbLz8YQL7Rm1EbVW7DOu",
      );
      if (!u || !valid)
        throw new ApiError(
          401,
          "Email or password is incorrect.",
          "INVALID_CREDENTIALS",
        );
      return ok(
        {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          centre_id: u.centre_id,
        },
        200,
        { "Set-Cookie": await createSession(u.id) },
      );
    }
    const u = await userFromRequest(req);
    if (!u)
      throw new ApiError(401, "Please sign in to continue.", "UNAUTHENTICATED");
    if (key === "auth/me" && method === "GET") return ok(u);
    if (key === "auth/logout" && method === "POST") {
      const token = req.headers
        .get("cookie")
        ?.match(/(?:^|;\s*)motive_session=([a-f0-9]{64})/)?.[1];
      if (token)
        await query("DELETE FROM sessions WHERE token_hash=$1", [
          hashToken(token),
        ]);
      return ok({ signedOut: true }, 200, {
        "Set-Cookie":
          "motive_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
      });
    }
    if (key === "catalogue" && method === "GET") {
      const [services, faults] = await Promise.all([
        query("SELECT * FROM service_types ORDER BY name"),
        query("SELECT * FROM fault_codes ORDER BY label"),
      ]);
      return ok({ services, faults });
    }
    if (key === "dashboard" && method === "GET") {
      const [stats] = await query(
        `SELECT (SELECT count(*)::int FROM vehicles WHERE ($1::uuid IS NULL OR owner_id=$1)) vehicles,(SELECT count(*)::int FROM service_centres WHERE active) centres,(SELECT count(*)::int FROM users WHERE role='STAFF' AND active) staff`,
        [u.role === "CUSTOMER" ? u.id : null],
      );
      const bookings = await query(
        `${bookingSelect} WHERE (($1='CUSTOMER' AND v.owner_id=$2) OR ($1='STAFF' AND s.centre_id=$3) OR $1='ADMIN') ORDER BY CASE WHEN b.status='IN_PROGRESS' THEN 0 WHEN b.status='CONFIRMED' THEN 1 ELSE 2 END,s.starts_at DESC LIMIT 5`,
        [u.role, u.id, u.centre_id],
      );
      const [m, f] =
        u.role === "CUSTOMER"
          ? await Promise.all([maintenance(u), recurringFaults(u)])
          : [[], []];
      const report = await reports(u);
      return ok({ stats, bookings, maintenance: m, faults: f, report });
    }
    if (key === "reports" && method === "GET") {
      const from = get("from") || undefined,
        to = get("to") || undefined;
      if (from) z.iso.date().parse(from);
      if (to) z.iso.date().parse(to);
      if (from && to && from > to)
        throw new ApiError(400, "Start date must not follow end date.");
      return ok(await reports(u, from, to));
    }
    if (path[0] === "vehicles") {
      requireRole(u, "CUSTOMER");
      if (path.length === 1 && method === "GET") {
        const rows = await query(
          "SELECT *,count(*) OVER()::int full_count FROM vehicles WHERE owner_id=$1 ORDER BY created_at LIMIT $2 OFFSET $3",
          [u.id, pageSize, offset],
        );
        return ok(list(rows, rows[0]?.full_count ?? 0, page, pageSize));
      }
      if (path.length === 1 && method === "POST") {
        const v = vehicleSchema.parse(await body(req));
        const [r] = await query(
          "INSERT INTO vehicles(owner_id,registration,make,model,model_year,current_km) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
          [u.id, v.registration, v.make, v.model, v.modelYear, v.currentKm],
        );
        return ok(r, 201);
      }
      const v = await ownVehicle(u, path[1]);
      if (path.length === 2 && method === "GET") return ok(v);
      if (path.length === 2 && method === "PATCH") {
        const input = z
          .object({
            make: z.string().trim().min(1).max(60),
            model: z.string().trim().min(1).max(60),
            modelYear: z.number().int().min(1900).max(2100),
          })
          .strict()
          .parse(await body(req));
        return ok(
          (
            await query(
              "UPDATE vehicles SET make=$1,model=$2,model_year=$3 WHERE id=$4 RETURNING *",
              [input.make, input.model, input.modelYear, v.id],
            )
          )[0],
        );
      }
      if (path[2] === "mileage" && method === "PATCH") {
        const input = z
          .object({ currentKm: z.number().int().min(0).max(2147483647) })
          .strict()
          .parse(await body(req));
        return ok(
          (
            await query("SELECT * FROM update_vehicle_mileage($1,$2,$3)", [
              u.id,
              v.id,
              input.currentKm,
            ])
          )[0],
        );
      }
      if (path[2] === "maintenance-rules" && method === "GET")
        return ok(await maintenance(u, v.id));
      if (path[2] === "maintenance-rules" && method === "PUT") {
        const r = ruleSchema.parse(await body(req));
        return ok(
          (
            await query(
              "SELECT * FROM save_maintenance_rule($1,$2,$3,$4,$5,$6,$7)",
              [
                u.id,
                v.id,
                r.serviceTypeId,
                r.intervalMonths,
                r.intervalKm,
                r.baselineDate,
                r.baselineKm,
              ],
            )
          )[0],
        );
      }
      if (path[2] === "maintenance" && method === "GET")
        return ok({
          rules: await maintenance(u, v.id),
          faults: await recurringFaults(u, v.id),
        });
      if (path[2] === "history" && method === "GET") {
        const rows = await query(
          `${bookingSelect} WHERE b.vehicle_id=$1 AND b.status='COMPLETED' ORDER BY r.completed_at DESC`,
          [v.id],
        );
        return ok(rows);
      }
    }
    if (key === "maintenance" && method === "GET") {
      requireRole(u, "CUSTOMER");
      return ok({
        rules: await maintenance(u),
        faults: await recurringFaults(u),
      });
    }
    if (key === "centres" && method === "GET")
      return ok(
        await query(
          "SELECT * FROM service_centres WHERE active AND ($1::text IS NULL OR name ILIKE $1 OR city ILIKE $1) ORDER BY name",
          [get("search") ? `%${get("search")!.slice(0, 100)}%` : null],
        ),
      );
    if (path[0] === "centres" && path[2] === "slots" && method === "GET") {
      uuid.parse(path[1]);
      const date = get("date");
      if (date) z.iso.date().parse(date);
      return ok(
        await query(
          `SELECT s.*,s.capacity-count(b.id) FILTER(WHERE b.status<>'CANCELLED')::int remaining FROM service_slots s JOIN service_centres c ON c.id=s.centre_id LEFT JOIN bookings b ON b.slot_id=s.id WHERE s.centre_id=$1 AND c.active AND s.starts_at>now() AND ($2::date IS NULL OR (s.starts_at AT TIME ZONE 'Asia/Kolkata')::date=$2) GROUP BY s.id ORDER BY s.starts_at`,
          [path[1], date],
        ),
      );
    }
    if (path[0] === "slots") {
      requireRole(u, "STAFF");
      if (path.length === 1 && method === "GET")
        return ok(
          await query(
            `SELECT s.*,s.capacity-count(b.id) FILTER(WHERE b.status<>'CANCELLED')::int remaining,count(b.id)::int booking_count FROM service_slots s LEFT JOIN bookings b ON b.slot_id=s.id WHERE s.centre_id=$1 AND s.starts_at>now() GROUP BY s.id ORDER BY s.starts_at`,
            [u.centre_id],
          ),
        );
      if (path.length === 1 && method === "POST") {
        const v = z
          .object({
            startsAt: z.iso.datetime({ offset: true }),
            capacity: z.number().int().min(1).max(20),
          })
          .strict()
          .parse(await body(req));
        return ok(
          (
            await query("SELECT * FROM publish_slot($1,$2,$3)", [
              u.id,
              v.startsAt,
              v.capacity,
            ])
          )[0],
          201,
        );
      }
      uuid.parse(path[1]);
      const [s] = await query(
        "SELECT * FROM service_slots WHERE id=$1 AND centre_id=$2 AND starts_at>now()",
        [path[1], u.centre_id],
      );
      if (!s) throw new ApiError(404, "Future slot not found.");
      if (method === "DELETE") {
        await query("DELETE FROM service_slots WHERE id=$1 AND centre_id=$2", [
          s.id,
          u.centre_id,
        ]);
        return ok({ deleted: true });
      }
      if (method === "PATCH") {
        const v = z
          .object({ capacity: z.number().int().min(1).max(20) })
          .strict()
          .parse(await body(req));
        return ok(
          (
            await query(
              "UPDATE service_slots SET capacity=$1 WHERE id=$2 RETURNING *",
              [v.capacity, s.id],
            )
          )[0],
        );
      }
    }
    if (path[0] === "bookings") {
      requireRole(u, "CUSTOMER", "STAFF");
      if (path.length === 1 && method === "GET") {
        const status = get("status");
        if (status)
          z.enum([
            "CONFIRMED",
            "IN_PROGRESS",
            "COMPLETED",
            "CANCELLED",
            "NO_SHOW",
          ]).parse(status);
        const date = get("date");
        if (date) z.iso.date().parse(date);
        const rows = await query(
          `${bookingSelect.replace("SELECT b.*", "SELECT b.*,count(*) OVER()::int full_count")} WHERE (($1='CUSTOMER' AND v.owner_id=$2) OR ($1='STAFF' AND s.centre_id=$3)) AND ($4::text IS NULL OR b.status=$4) AND ($5::date IS NULL OR (s.starts_at AT TIME ZONE 'Asia/Kolkata')::date=$5) ORDER BY CASE WHEN b.status='IN_PROGRESS' THEN 0 WHEN b.status='CONFIRMED' THEN 1 ELSE 2 END,s.starts_at DESC LIMIT $6 OFFSET $7`,
          [u.role, u.id, u.centre_id, status, date, pageSize, offset],
        );
        return ok(list(rows, rows[0]?.full_count ?? 0, page, pageSize));
      }
      if (path.length === 1 && method === "POST") {
        requireRole(u, "CUSTOMER");
        const v = z
          .object({
            vehicleId: uuid,
            slotId: uuid,
            serviceTypeId: uuid,
            complaint: z.string().trim().min(1).max(2000),
            requestKey: uuid,
          })
          .strict()
          .parse(await body(req));
        return ok(
          (
            await query("SELECT * FROM reserve_booking($1,$2,$3,$4,$5,$6)", [
              u.id,
              v.vehicleId,
              v.slotId,
              v.serviceTypeId,
              v.complaint,
              v.requestKey,
            ])
          )[0],
          201,
        );
      }
      const b = await ownBooking(u, path[1]);
      if (path.length === 2 && method === "GET") {
        const [history, items] = await Promise.all([
          query(
            "SELECT h.*,u.name actor_name FROM booking_status_history h JOIN users u ON u.id=h.actor_id WHERE h.booking_id=$1 ORDER BY h.changed_at",
            [b.id],
          ),
          query(
            "SELECT i.*,st.name service_name,f.label fault_label FROM service_items i JOIN service_types st ON st.id=i.service_type_id LEFT JOIN fault_codes f ON f.code=i.fault_code WHERE i.record_id=$1",
            [b.record_id],
          ),
        ]);
        return ok({ ...b, history, items });
      }
      if (
        ["cancel", "start", "no-show"].includes(path[2]) &&
        method === "POST"
      ) {
        const target = {
          cancel: "CANCELLED",
          start: "IN_PROGRESS",
          "no-show": "NO_SHOW",
        }[path[2]];
        return ok(
          (
            await query("SELECT * FROM transition_booking($1,$2,$3)", [
              u.id,
              b.id,
              target,
            ])
          )[0],
        );
      }
      if (path[2] === "complete" && method === "POST") {
        requireRole(u, "STAFF");
        const v = z
          .object({
            odometerKm: z.number().int().min(0).max(2147483647),
            summary: z.string().trim().min(1).max(5000),
            items: z.array(itemSchema).min(1).max(50),
          })
          .strict()
          .parse(await body(req));
        return ok(
          (
            await query(
              "SELECT * FROM complete_service($1,$2,$3,$4,$5::jsonb)",
              [u.id, b.id, v.odometerKm, v.summary, JSON.stringify(v.items)],
            )
          )[0],
        );
      }
      if (path[2] === "inspection" && method === "GET") {
        if (u.role === "CUSTOMER" && b.status !== "COMPLETED")
          throw new ApiError(404, "Inspection is available after completion.");
        try {
          return ok(await (await inspections()).findOne({ booking_id: b.id }));
        } catch {
          throw new ApiError(
            503,
            "Inspection storage is unavailable. Please retry.",
            "INSPECTION_UNAVAILABLE",
          );
        }
      }
      if (path[2] === "inspection" && method === "PUT") {
        requireRole(u, "STAFF");
        const v = inspectionSchema.parse(await body(req));
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          await client.query("SELECT * FROM lock_inspection_job($1,$2)", [
            u.id,
            b.id,
          ]);
          const col = await inspections();
          const now = new Date();
          const data = {
            booking_id: b.id,
            vehicle_id: b.vehicle_id,
            centre_id: b.centre_id,
            items: v.items,
            diagnostic_notes: v.diagnosticNotes,
            updated_by: u.id,
            updated_at: now,
          };
          let doc;
          if (v.revision === 0) {
            await col.insertOne({ ...data, revision: 1, created_at: now });
            doc = await col.findOne({ booking_id: b.id });
          } else {
            doc = await col.findOneAndUpdate(
              { booking_id: b.id, revision: v.revision },
              { $set: data, $inc: { revision: 1 } },
              { returnDocument: "after", maxTimeMS: 2500 },
            );
            if (!doc)
              throw new ApiError(
                409,
                "Inspection changed elsewhere. Reload it before saving.",
                "REVISION_CONFLICT",
              );
          }
          await client.query("COMMIT");
          return ok(doc);
        } catch (e) {
          await client.query("ROLLBACK");
          if (e instanceof ApiError) throw e;
          if ((e as { code?: string }).code === "P0001")
            throw new ApiError(409, (e as Error).message);
          if ((e as { code?: number }).code === 11000)
            throw new ApiError(
              409,
              "Inspection already exists. Reload the latest revision.",
            );
          console.error(
            "Inspection write failed",
            (e as { code?: unknown }).code,
          );
          throw new ApiError(
            503,
            "Inspection save could not be confirmed. Reload before retrying.",
            "INSPECTION_UNAVAILABLE",
          );
        } finally {
          client.release();
        }
      }
    }
    if (path[0] === "admin") {
      requireRole(u, "ADMIN");
      if (key === "admin/centres" && method === "GET")
        return ok(
          await query(
            "SELECT c.*,(SELECT count(*)::int FROM bookings b JOIN service_slots s ON s.id=b.slot_id WHERE s.centre_id=c.id AND b.status IN ('CONFIRMED','IN_PROGRESS')) outstanding_bookings FROM service_centres c ORDER BY c.name",
          ),
        );
      if (key === "admin/centres" && method === "POST") {
        const v = centreSchema.parse(await body(req));
        return ok(
          (
            await query(
              "INSERT INTO service_centres(name,address,city,phone,active) VALUES($1,$2,$3,$4,$5) RETURNING *",
              [v.name, v.address, v.city, v.phone, v.active ?? true],
            )
          )[0],
          201,
        );
      }
      if (path[1] === "centres" && path.length === 3 && method === "PATCH") {
        uuid.parse(path[2]);
        const v = centreSchema.partial().parse(await body(req));
        const [r] = await query(
          "UPDATE service_centres SET name=COALESCE($1,name),address=COALESCE($2,address),city=COALESCE($3,city),phone=COALESCE($4,phone),active=COALESCE($5,active) WHERE id=$6 RETURNING *",
          [v.name, v.address, v.city, v.phone, v.active, path[2]],
        );
        if (!r) throw new ApiError(404, "Centre not found.");
        return ok(r);
      }
      if (key === "admin/staff" && method === "GET")
        return ok(
          await query(
            "SELECT u.id,u.name,u.email,u.centre_id,u.active,c.name centre_name FROM users u JOIN service_centres c ON c.id=u.centre_id WHERE u.role='STAFF' ORDER BY u.name",
          ),
        );
      if (key === "admin/staff" && method === "POST") {
        const v = z
          .object({
            name: z.string().trim().min(2).max(100),
            email,
            password,
            centreId: uuid,
          })
          .strict()
          .parse(await body(req));
        return ok(
          (
            await query(
              "INSERT INTO users(name,email,password_hash,role,centre_id) VALUES($1,$2,$3,'STAFF',$4) RETURNING id,name,email,role,centre_id,active",
              [v.name, v.email, await bcrypt.hash(v.password, 12), v.centreId],
            )
          )[0],
          201,
        );
      }
      if (path[1] === "staff" && path.length === 3 && method === "PATCH") {
        uuid.parse(path[2]);
        const v = z
          .object({
            name: z.string().trim().min(2).max(100).optional(),
            active: z.boolean().optional(),
          })
          .strict()
          .parse(await body(req));
        const [r] = await query(
          "UPDATE users SET name=COALESCE($1,name),active=COALESCE($2,active) WHERE id=$3 AND role='STAFF' RETURNING id,name,email,centre_id,active",
          [v.name, v.active, path[2]],
        );
        if (!r) throw new ApiError(404, "Staff account not found.");
        return ok(r);
      }
    }
    throw new ApiError(404, "Endpoint not found.");
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: error.issues[0]?.message ?? "Invalid input.",
            fields: error.flatten().fieldErrors,
          },
        },
        { status: 400 },
      );
    if (error instanceof ApiError)
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    const e = error as { code?: string; message?: string };
    if (["23505", "23503", "23514", "P0001", "42501"].includes(e.code ?? "")) {
      const message =
        e.code === "23505"
          ? "This entry already exists or conflicts with another booking."
          : e.code === "23503"
            ? "A referenced record is missing or still in use."
            : e.code === "42501"
              ? "Access denied."
              : e.code === "P0001"
                ? e.message!
                : e.message?.startsWith("new row")
                  ? "One or more values violate database rules."
                  : (e.message ?? "Invalid database values.");
      return NextResponse.json(
        { error: { code: "DATA_CONFLICT", message } },
        { status: e.code === "42501" ? 403 : 409 },
      );
    }
    console.error(
      "API failure",
      e.code ?? "UNEXPECTED",
      e.message?.replace(/postgres(?:ql)?:\/\/\S+/g, "[redacted]"),
    );
    return NextResponse.json(
      {
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "The service is temporarily unavailable. Please retry.",
        },
      },
      { status: 503 },
    );
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
