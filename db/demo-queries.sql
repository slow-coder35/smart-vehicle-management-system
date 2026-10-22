-- Run read-only queries using your application connection, or in psql.
-- DDL exercises are isolated from application tables and require the migration owner.
BEGIN;
CREATE SCHEMA IF NOT EXISTS demonstration;
CREATE TABLE demonstration.ddl_example(id integer PRIMARY KEY, label text NOT NULL);
ALTER TABLE demonstration.ddl_example ADD COLUMN created_at timestamptz DEFAULT now();
INSERT INTO demonstration.ddl_example(id,label) VALUES(1,'Demonstration row');
UPDATE demonstration.ddl_example SET label='Updated demonstration' WHERE id=1;
SELECT * FROM demonstration.ddl_example;
DELETE FROM demonstration.ddl_example WHERE id=1;
DROP TABLE demonstration.ddl_example;
DROP SCHEMA demonstration;
ROLLBACK;

-- JOIN and ORDER BY: connected service history.
SELECT v.registration,h.centre_name,h.completed_at,h.summary,h.total
FROM vehicle_service_history h JOIN vehicles v ON v.id=h.vehicle_id
ORDER BY h.completed_at DESC LIMIT 20;

-- GROUP BY, SUM, COUNT: spending by vehicle.
SELECT v.registration,count(*) completed_services,sum(h.total) recorded_charges
FROM vehicle_service_history h JOIN vehicles v ON v.id=h.vehicle_id
GROUP BY v.id,v.registration ORDER BY recorded_charges DESC;

-- HAVING and distinct jobs: repeated fault categories within 180 days.
SELECT v.registration,f.label,count(DISTINCT r.id) occurrences
FROM service_items i JOIN fault_codes f ON f.code=i.fault_code
JOIN service_records r ON r.id=i.record_id JOIN bookings b ON b.id=r.booking_id
JOIN vehicles v ON v.id=b.vehicle_id
WHERE r.completed_at>=now()-interval '180 days'
GROUP BY v.id,v.registration,f.code,f.label HAVING count(DISTINCT r.id)>=2;

-- Correlated subquery: configured services with no completed matching history.
SELECT v.registration,st.name
FROM maintenance_rules mr JOIN vehicles v ON v.id=mr.vehicle_id JOIN service_types st ON st.id=mr.service_type_id
WHERE NOT EXISTS (SELECT 1 FROM service_records r JOIN bookings b ON b.id=r.booking_id
 JOIN service_items i ON i.record_id=r.id WHERE b.vehicle_id=v.id AND i.service_type_id=mr.service_type_id);

-- View and trigger evidence.
SELECT * FROM centre_booking_summary ORDER BY service_day DESC LIMIT 20;
SELECT h.booking_id,h.from_status,h.to_status,u.name actor,h.changed_at
FROM booking_status_history h JOIN users u ON u.id=h.actor_id ORDER BY h.changed_at DESC LIMIT 20;

-- Index usage: small data sets may legitimately use a sequential scan.
EXPLAIN ANALYZE SELECT * FROM bookings WHERE slot_id=(SELECT id FROM service_slots LIMIT 1) AND status<>'CANCELLED';

-- Protected business mutations (replace placeholder UUIDs with real values):
-- SELECT * FROM reserve_booking(actor,vehicle,slot,service,'Reason',request_uuid);
-- SELECT * FROM transition_booking(actor,booking,'IN_PROGRESS');
-- SELECT * FROM complete_service(actor,booking,mileage,'Summary',items_json);
-- tests/integration/database.test.ts demonstrates rollback and concurrent reservations.
