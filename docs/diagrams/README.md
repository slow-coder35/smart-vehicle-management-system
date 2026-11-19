# Database diagrams

Generated from the implemented PostgreSQL migration (`db/migrations/001_core.sql`) and checked against the MongoDB validator in `scripts/migrate.ts` and inspection writes in `app/api/[...path]/route.ts`.

- **ER diagram:** [SVG](er-diagram.svg) · [PNG](er-diagram.png). Entities and relationship cardinalities.
- **Relational schema:** [SVG](relational-schema.svg) · [PNG](relational-schema.png). All application-table columns, types, primary keys, foreign keys, and individual unique keys.
- **Editable sources:** Graphviz `.dot` files and `relational-schema.mmd` (Mermaid, SQL tables only).

SVG files remain sharp when enlarged or inserted into a report.

## Legend

PK = primary key; FK = PostgreSQL foreign key; UK = individual unique key; REF = application-managed cross-database reference. `NULL` marks a nullable SQL column. `1` means exactly one, `0..1` means optional one, and `0..N` means zero or many. On an ER edge, the first multiplicity is the number of parent records per child; the second is the number of child records per parent. Solid arrows point from the referenced parent to its referencing child. Dashed arrows connect PostgreSQL identities to MongoDB documents; they are not SQL foreign keys.

## Important constraints and interpretation

- The 12 PostgreSQL application tables share one `users` table; CUSTOMER, STAFF, and ADMIN are roles, not separate entities.
- `users.centre_id` is required for STAFF and must be null for CUSTOMER and ADMIN. Only customers can own vehicles, and only staff of the booking's centre can complete a service through the application routines.
- One booking can have zero or one service record, enforced by UNIQUE(`service_records.booking_id`). The completion operation creates that record when the booking becomes COMPLETED.
- One booking can have zero or one MongoDB inspection document, enforced by a unique index on `job_inspections.booking_id`.
- Composite unique constraints: `service_slots(centre_id, starts_at)` and `maintenance_rules(vehicle_id, service_type_id)`.
- A partial unique index allows only one IN_PROGRESS booking per vehicle. Booking capacity is enforced transactionally; a slot's relationship to bookings is still one-to-many.
- SQL foreign keys alone permit zero service items per record; the service-completion routine requires 1–50 items. Inspection items are embedded MongoDB objects (1–50); measurements are embedded arrays (0–20 per item), not extra SQL tables.
- A maintenance rule requires a month interval, a kilometre interval, or both. Its baseline fields are optional.
- Derived views (`service_charge_totals`, `vehicle_service_history`, `centre_booking_summary`) are not independent entities. The migration tool's `schema_migrations` bookkeeping table is also excluded from these application diagrams.
- The MongoDB `_id` is its document identifier; PK is used as an analogous diagram label.

## Regenerate

With Python 3 and Graphviz installed, run from the repository:

```sh
python3 scripts/generate-diagrams.py
```
