export type Role = "CUSTOMER" | "STAFF" | "ADMIN";
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  centre_id: string | null;
  centre_name?: string;
}
export interface Vehicle {
  id: string;
  owner_id: string;
  registration: string;
  make: string;
  model: string;
  model_year: number;
  current_km: number;
  mileage_updated_at: string;
}
export interface MaintenanceInput {
  intervalMonths: number | null;
  intervalKm: number | null;
  baselineDate: string | null;
  baselineKm: number | null;
  currentKm: number;
  mileageUpdatedAt: string;
}
