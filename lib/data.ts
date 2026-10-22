import { query, inspections } from "./db";
import type { User } from "./types";
import { calculateMaintenance } from "./maintenance";
export const vehicleScope = (u: User) => (u.role === "CUSTOMER" ? u.id : null);
export async function maintenance(user: User, vehicleId?: string) {
  const rules = await query(
    `SELECT mr.*,mr.baseline_date::text baseline_date,st.name service_name,st.code service_code,v.registration,v.make,v.model,v.current_km,v.mileage_updated_at,
 (last_service.completed_at AT TIME ZONE 'Asia/Kolkata')::date::text last_date,last_service.odometer_km last_km,last_service.record_id
 FROM maintenance_rules mr JOIN vehicles v ON v.id=mr.vehicle_id JOIN service_types st ON st.id=mr.service_type_id
 LEFT JOIN LATERAL(SELECT r.completed_at,r.odometer_km,r.id record_id FROM service_records r JOIN bookings b ON b.id=r.booking_id
 WHERE b.vehicle_id=v.id AND EXISTS(SELECT 1 FROM service_items i WHERE i.record_id=r.id AND i.service_type_id=mr.service_type_id) ORDER BY r.completed_at DESC LIMIT 1)last_service ON true
 WHERE v.owner_id=$1 AND ($2::uuid IS NULL OR v.id=$2) ORDER BY v.created_at,st.name`,
    [user.id, vehicleId ?? null],
  );
  return rules.map((r) => {
    const baselineDate =
      r.last_date ??
      (r.baseline_date
        ? new Date(r.baseline_date).toISOString().slice(0, 10)
        : null);
    const baselineKm = r.last_km ?? r.baseline_km;
    return {
      ...r,
      baselineDate,
      baselineKm,
      baselineSource: r.record_id ? "completed_service" : "initial_baseline",
      ...calculateMaintenance({
        intervalMonths: r.interval_months,
        intervalKm: r.interval_km,
        baselineDate,
        baselineKm,
        currentKm: r.current_km,
        mileageUpdatedAt: new Date(r.mileage_updated_at).toISOString(),
      }),
    };
  });
}
export async function recurringFaults(user: User, vehicleId?: string) {
  return query(
    `SELECT v.id vehicle_id,v.registration,f.code,f.label,count(DISTINCT r.id)::int occurrences,max(r.completed_at) latest_occurrence,
 jsonb_agg(DISTINCT jsonb_build_object('recordId',r.id,'bookingId',r.booking_id,'date',r.completed_at)) evidence
 FROM service_items i JOIN fault_codes f ON f.code=i.fault_code JOIN service_records r ON r.id=i.record_id JOIN bookings b ON b.id=r.booking_id JOIN vehicles v ON v.id=b.vehicle_id
 WHERE v.owner_id=$1 AND ($2::uuid IS NULL OR v.id=$2) AND r.completed_at>=now()-interval '180 days' GROUP BY v.id,v.registration,f.code,f.label HAVING count(DISTINCT r.id)>=2 ORDER BY latest_occurrence DESC`,
    [user.id, vehicleId ?? null],
  );
}
export async function reports(user: User, from?: string, to?: string) {
  const scope = [
    user.role === "CUSTOMER" ? user.id : null,
    user.role === "STAFF" ? user.centre_id : null,
    from ?? null,
    to ?? null,
  ];
  const filter = `($1::uuid IS NULL OR v.owner_id=$1) AND ($2::uuid IS NULL OR s.centre_id=$2)`;
  const range = `r.completed_at>=COALESCE(($3::date::timestamp AT TIME ZONE 'Asia/Kolkata'),now()-interval '6 months') AND r.completed_at<COALESCE((($4::date+1)::timestamp AT TIME ZONE 'Asia/Kolkata'),now()+interval '1 day')`;
  const [monthly, categories, centres, statuses, totals, vehicleSpending] =
    await Promise.all([
      query(
        `SELECT to_char(r.completed_at AT TIME ZONE 'Asia/Kolkata','YYYY-MM') AS report_month,sum(i.quantity*i.unit_price)::numeric(14,2) total FROM service_records r JOIN service_items i ON i.record_id=r.id JOIN bookings b ON b.id=r.booking_id JOIN service_slots s ON s.id=b.slot_id JOIN vehicles v ON v.id=b.vehicle_id WHERE ${filter} AND ${range} GROUP BY report_month ORDER BY report_month`,
        scope,
      ),
      query(
        `SELECT st.name,sum(i.quantity*i.unit_price)::numeric(14,2) total FROM service_items i JOIN service_types st ON st.id=i.service_type_id JOIN service_records r ON r.id=i.record_id JOIN bookings b ON b.id=r.booking_id JOIN service_slots s ON s.id=b.slot_id JOIN vehicles v ON v.id=b.vehicle_id WHERE ${filter} AND ${range} GROUP BY st.id,st.name ORDER BY total DESC`,
        scope,
      ),
      query(
        `SELECT c.name,c.id,count(DISTINCT r.id)::int completed,sum(i.quantity*i.unit_price)::numeric(14,2) total FROM service_centres c JOIN service_slots s ON s.centre_id=c.id JOIN bookings b ON b.slot_id=s.id JOIN vehicles v ON v.id=b.vehicle_id JOIN service_records r ON r.booking_id=b.id JOIN service_items i ON i.record_id=r.id WHERE ${filter} AND ${range} GROUP BY c.id,c.name ORDER BY total DESC`,
        scope,
      ),
      query(
        `SELECT b.status,count(*)::int count FROM bookings b JOIN service_slots s ON s.id=b.slot_id JOIN vehicles v ON v.id=b.vehicle_id WHERE ${filter} AND s.starts_at>=COALESCE(($3::date::timestamp AT TIME ZONE 'Asia/Kolkata'),now()-interval '6 months') AND s.starts_at<COALESCE((($4::date+1)::timestamp AT TIME ZONE 'Asia/Kolkata'),now()+interval '30 days') GROUP BY b.status`,
        scope,
      ),
      query(
        `SELECT count(DISTINCT r.id)::int completed,COALESCE(sum(i.quantity*i.unit_price),0)::numeric(14,2) charges FROM service_records r JOIN service_items i ON i.record_id=r.id JOIN bookings b ON b.id=r.booking_id JOIN service_slots s ON s.id=b.slot_id JOIN vehicles v ON v.id=b.vehicle_id WHERE ${filter} AND ${range}`,
        scope,
      ),
      query(
        `SELECT v.id,v.registration,v.make,v.model,count(DISTINCT r.id)::int completed,sum(i.quantity*i.unit_price)::numeric(14,2) total FROM service_records r JOIN service_items i ON i.record_id=r.id JOIN bookings b ON b.id=r.booking_id JOIN service_slots s ON s.id=b.slot_id JOIN vehicles v ON v.id=b.vehicle_id WHERE ${filter} AND ${range} GROUP BY v.id,v.registration,v.make,v.model ORDER BY total DESC`,
        scope,
      ),
    ]);
  let failedComponents: unknown[] = [];
  let inspectionAnalyticsAvailable = true;
  if (user.role !== "CUSTOMER")
    try {
      const col = await inspections();
      const match: Record<string, unknown> = {};
      if (user.role === "STAFF") match.centre_id = user.centre_id;
      if (from || to) {
        const period: Record<string, Date> = {};
        if (from) period.$gte = new Date(`${from}T00:00:00+05:30`);
        if (to)
          period.$lt = new Date(
            new Date(`${to}T00:00:00+05:30`).getTime() + 86400000,
          );
        match.updated_at = period;
      }
      failedComponents = await col
        .aggregate(
          [
            { $match: match },
            { $unwind: "$items" },
            { $match: { "items.result": "FAIL" } },
            { $group: { _id: "$items.component", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 8 },
          ],
          { maxTimeMS: 2000 },
        )
        .toArray();
    } catch {
      inspectionAnalyticsAvailable = false;
    }
  return {
    monthly: monthly.map((r) => ({ ...r, month: r.report_month })),
    categories,
    centres,
    statuses,
    vehicleSpending,
    totals: totals[0],
    failedComponents,
    inspectionAnalyticsAvailable,
  };
}
export const bookingSelect = `SELECT b.*,v.registration,v.make,v.model,v.current_km,v.owner_id,u.name customer_name,c.name centre_name,s.centre_id,s.starts_at,s.ends_at,s.capacity,st.name service_name,r.id record_id,r.summary,r.odometer_km,r.completed_at,t.total FROM bookings b JOIN vehicles v ON v.id=b.vehicle_id JOIN users u ON u.id=v.owner_id JOIN service_slots s ON s.id=b.slot_id JOIN service_centres c ON c.id=s.centre_id JOIN service_types st ON st.id=b.requested_service_type_id LEFT JOIN service_records r ON r.booking_id=b.id LEFT JOIN service_charge_totals t ON t.record_id=r.id`;
