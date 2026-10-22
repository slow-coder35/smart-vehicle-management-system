import type { MaintenanceInput } from "./types";
export function localDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function addMonths(date: string, months: number): string {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(d, last)),
  )
    .toISOString()
    .slice(0, 10);
}
export function calculateMaintenance(
  input: MaintenanceInput,
  now: Date = new Date(),
) {
  const dueDate =
    input.intervalMonths && input.baselineDate
      ? addMonths(input.baselineDate, input.intervalMonths)
      : null;
  const dueKm =
    input.intervalKm && input.baselineKm !== null
      ? input.baselineKm + input.intervalKm
      : null;
  const daysRemaining = dueDate
    ? Math.round((Date.parse(dueDate) - Date.parse(localDate(now))) / 86400000)
    : null;
  const kmRemaining = dueKm !== null ? dueKm - input.currentKm : null;
  const missingDate = !!input.intervalMonths && !dueDate,
    missingMileage = !!input.intervalKm && dueKm === null;
  const status =
    (daysRemaining !== null && daysRemaining <= 0) ||
    (kmRemaining !== null && kmRemaining <= 0)
      ? "DUE"
      : (daysRemaining !== null && daysRemaining <= 30) ||
          (kmRemaining !== null && kmRemaining <= 500)
        ? "DUE_SOON"
        : missingDate || missingMileage
          ? "INSUFFICIENT_HISTORY"
          : "UP_TO_DATE";
  return {
    status,
    dueDate,
    dueKm,
    daysRemaining,
    kmRemaining,
    missingDate,
    missingMileage,
    mileageStale:
      now.getTime() - Date.parse(input.mileageUpdatedAt) > 30 * 86400000,
  };
}
