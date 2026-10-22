CREATE TABLE service_centres (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 120),
 address text NOT NULL CHECK(length(trim(address)) BETWEEN 3 AND 300), city text NOT NULL CHECK(length(trim(city)) BETWEEN 2 AND 100),
 phone text NOT NULL CHECK(length(phone) BETWEEN 6 AND 30), active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 100),
 email text UNIQUE NOT NULL CHECK(email = lower(trim(email)) AND email LIKE '%@%'), password_hash text NOT NULL CHECK(password_hash LIKE '$2%'),
 role text NOT NULL CHECK(role IN ('CUSTOMER','STAFF','ADMIN')), centre_id uuid REFERENCES service_centres(id), active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), CHECK((role='STAFF' AND centre_id IS NOT NULL) OR (role<>'STAFF' AND centre_id IS NULL))
);
CREATE TABLE sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash text UNIQUE NOT NULL, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);
CREATE TABLE vehicles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES users(id), registration text NOT NULL UNIQUE CHECK(registration ~ '^[A-Z0-9-]{4,20}$'),
 make text NOT NULL CHECK(length(trim(make)) BETWEEN 1 AND 60), model text NOT NULL CHECK(length(trim(model)) BETWEEN 1 AND 60),
 model_year integer NOT NULL CHECK(model_year BETWEEN 1900 AND 2100), current_km integer NOT NULL CHECK(current_km>=0),
 mileage_updated_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX vehicles_owner_idx ON vehicles(owner_id);
CREATE TABLE service_types (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text UNIQUE NOT NULL, name text NOT NULL, description text NOT NULL);
CREATE TABLE fault_codes (code text PRIMARY KEY, label text NOT NULL, component text NOT NULL);
CREATE TABLE service_slots (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), centre_id uuid NOT NULL REFERENCES service_centres(id), starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
 capacity integer NOT NULL CHECK(capacity BETWEEN 1 AND 20), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(centre_id, starts_at),
 CHECK(ends_at=starts_at+interval '1 hour'), CHECK(extract(minute FROM starts_at AT TIME ZONE 'Asia/Kolkata')=0 AND extract(second FROM starts_at)=0),
 CHECK(extract(hour FROM starts_at AT TIME ZONE 'Asia/Kolkata') BETWEEN 9 AND 17)
);
CREATE TABLE bookings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), vehicle_id uuid NOT NULL REFERENCES vehicles(id), slot_id uuid NOT NULL REFERENCES service_slots(id),
 requested_service_type_id uuid NOT NULL REFERENCES service_types(id), complaint text NOT NULL CHECK(length(complaint) BETWEEN 1 AND 2000),
 status text NOT NULL DEFAULT 'CONFIRMED' CHECK(status IN ('CONFIRMED','IN_PROGRESS','COMPLETED','CANCELLED','NO_SHOW')),
 request_key uuid UNIQUE NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bookings_slot_idx ON bookings(slot_id,status);
CREATE INDEX bookings_vehicle_idx ON bookings(vehicle_id,status);
CREATE UNIQUE INDEX one_in_progress_per_vehicle ON bookings(vehicle_id) WHERE status='IN_PROGRESS';
CREATE TABLE service_records (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), booking_id uuid UNIQUE NOT NULL REFERENCES bookings(id), completed_by uuid NOT NULL REFERENCES users(id),
 completed_at timestamptz NOT NULL DEFAULT now(), odometer_km integer NOT NULL CHECK(odometer_km>=0), summary text NOT NULL CHECK(length(trim(summary)) BETWEEN 1 AND 5000)
);
CREATE INDEX records_date_idx ON service_records(completed_at);
CREATE TABLE service_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), record_id uuid NOT NULL REFERENCES service_records(id), service_type_id uuid NOT NULL REFERENCES service_types(id),
 description text NOT NULL CHECK(length(trim(description)) BETWEEN 1 AND 500), quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 100),
 unit_price numeric(12,2) NOT NULL CHECK(unit_price BETWEEN 0 AND 1000000), fault_code text REFERENCES fault_codes(code)
);
CREATE INDEX items_record_type_idx ON service_items(record_id,service_type_id);
CREATE INDEX items_fault_idx ON service_items(fault_code,record_id);
CREATE TABLE maintenance_rules (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), vehicle_id uuid NOT NULL REFERENCES vehicles(id), service_type_id uuid NOT NULL REFERENCES service_types(id),
 interval_months integer CHECK(interval_months BETWEEN 1 AND 120), interval_km integer CHECK(interval_km BETWEEN 1 AND 1000000),
 baseline_date date, baseline_km integer CHECK(baseline_km>=0), UNIQUE(vehicle_id,service_type_id), CHECK(interval_months IS NOT NULL OR interval_km IS NOT NULL)
);
CREATE TABLE booking_status_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), booking_id uuid NOT NULL REFERENCES bookings(id), from_status text, to_status text NOT NULL,
 actor_id uuid NOT NULL REFERENCES users(id), changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX history_booking_idx ON booking_status_history(booking_id,changed_at);

CREATE FUNCTION protect_vehicle() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=NEW.owner_id AND role='CUSTOMER') THEN RAISE EXCEPTION 'Vehicle owner must be a customer' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' AND (NEW.owner_id<>OLD.owner_id OR NEW.current_km<OLD.current_km) THEN RAISE EXCEPTION 'Ownership cannot change and mileage cannot decrease' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER vehicle_integrity BEFORE INSERT OR UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION protect_vehicle();
CREATE FUNCTION protect_slot() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.bookings WHERE slot_id=OLD.id) THEN RAISE EXCEPTION 'Referenced slots cannot be changed or deleted' USING ERRCODE='23514'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 IF NEW.centre_id<>OLD.centre_id OR NEW.starts_at<>OLD.starts_at OR NEW.ends_at<>OLD.ends_at THEN RAISE EXCEPTION 'Slot times and centre are immutable' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER slot_integrity BEFORE UPDATE OR DELETE ON service_slots FOR EACH ROW EXECUTE FUNCTION protect_slot();
CREATE FUNCTION protect_rule() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE km integer;
BEGIN
 SELECT current_km INTO km FROM public.vehicles WHERE id=NEW.vehicle_id FOR UPDATE;
 IF NEW.baseline_date>(now() AT TIME ZONE 'Asia/Kolkata')::date OR NEW.baseline_km>km THEN RAISE EXCEPTION 'Baseline cannot exceed current date or mileage' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER rule_integrity BEFORE INSERT OR UPDATE ON maintenance_rules FOR EACH ROW EXECUTE FUNCTION protect_rule();
CREATE FUNCTION audit_booking() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE actor uuid;
BEGIN
 actor:=COALESCE(NULLIF(current_setting('motive.actor',true),'')::uuid,(SELECT owner_id FROM public.vehicles WHERE id=NEW.vehicle_id));
 IF TG_OP='UPDATE' AND NEW.status<>OLD.status THEN
  IF NOT ((OLD.status='CONFIRMED' AND NEW.status IN ('IN_PROGRESS','CANCELLED','NO_SHOW')) OR (OLD.status='IN_PROGRESS' AND NEW.status='COMPLETED')) THEN
   RAISE EXCEPTION 'Invalid booking transition' USING ERRCODE='23514';
  END IF;
 END IF;
 IF TG_OP='INSERT' THEN INSERT INTO public.booking_status_history(booking_id,to_status,actor_id) VALUES(NEW.id,NEW.status,actor);
 ELSIF OLD.status<>NEW.status THEN INSERT INTO public.booking_status_history(booking_id,from_status,to_status,actor_id) VALUES(NEW.id,OLD.status,NEW.status,actor); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER booking_audit AFTER INSERT OR UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION audit_booking();

CREATE FUNCTION reserve_booking(p_actor uuid,p_vehicle uuid,p_slot uuid,p_service uuid,p_complaint text,p_key uuid) RETURNS public.bookings LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v public.vehicles; s public.service_slots; existing public.bookings; result public.bookings; occupied integer;
BEGIN
 SELECT * INTO v FROM public.vehicles WHERE id=p_vehicle FOR UPDATE;
 IF v.id IS NULL OR v.owner_id<>p_actor OR NOT EXISTS(SELECT 1 FROM public.users WHERE id=p_actor AND active AND role='CUSTOMER') THEN RAISE EXCEPTION 'Vehicle not found or access denied' USING ERRCODE='42501'; END IF;
 SELECT * INTO existing FROM public.bookings WHERE request_key=p_key;
 IF existing.id IS NOT NULL THEN
  IF existing.vehicle_id<>p_vehicle OR existing.slot_id<>p_slot OR existing.requested_service_type_id<>p_service OR existing.complaint<>p_complaint THEN RAISE EXCEPTION 'Request key already used for different inputs' USING ERRCODE='P0001'; END IF;
  RETURN existing;
 END IF;
 SELECT * INTO s FROM public.service_slots WHERE id=p_slot;
 IF s.id IS NULL THEN RAISE EXCEPTION 'Slot not found' USING ERRCODE='P0001'; END IF;
 PERFORM 1 FROM public.service_centres WHERE id=s.centre_id AND active FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Centre is inactive' USING ERRCODE='P0001'; END IF;
 SELECT * INTO s FROM public.service_slots WHERE id=p_slot FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Slot no longer available' USING ERRCODE='P0001'; END IF;
 IF s.starts_at<=now() THEN RAISE EXCEPTION 'This slot has already started' USING ERRCODE='P0001'; END IF;
 IF EXISTS(SELECT 1 FROM public.bookings b JOIN public.service_slots x ON x.id=b.slot_id WHERE b.vehicle_id=p_vehicle AND b.status IN ('CONFIRMED','IN_PROGRESS') AND x.starts_at=s.starts_at) THEN RAISE EXCEPTION 'Vehicle already booked for this arrival window' USING ERRCODE='P0001'; END IF;
 SELECT count(*) INTO occupied FROM public.bookings WHERE slot_id=p_slot AND status<>'CANCELLED';
 IF occupied>=s.capacity THEN RAISE EXCEPTION 'Slot is full. Please choose another time.' USING ERRCODE='P0001'; END IF;
 PERFORM set_config('motive.actor',p_actor::text,true);
 INSERT INTO public.bookings(vehicle_id,slot_id,requested_service_type_id,complaint,request_key) VALUES(p_vehicle,p_slot,p_service,p_complaint,p_key) RETURNING * INTO result;
 RETURN result;
END $$;

CREATE FUNCTION transition_booking(p_actor uuid,p_booking uuid,p_target text) RETURNS public.bookings LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE b public.bookings; s public.service_slots; v public.vehicles; u public.users;
BEGIN
 SELECT * INTO b FROM public.bookings WHERE id=p_booking;
 IF b.id IS NULL THEN RAISE EXCEPTION 'Booking not found' USING ERRCODE='P0001'; END IF;
 SELECT * INTO v FROM public.vehicles WHERE id=b.vehicle_id FOR UPDATE;
 SELECT * INTO s FROM public.service_slots WHERE id=b.slot_id FOR UPDATE;
 SELECT * INTO b FROM public.bookings WHERE id=p_booking FOR UPDATE;
 SELECT * INTO u FROM public.users WHERE id=p_actor AND active;
 IF u.id IS NULL OR NOT ((u.role='CUSTOMER' AND v.owner_id=p_actor AND p_target='CANCELLED') OR (u.role='STAFF' AND u.centre_id=s.centre_id)) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 IF b.status='CANCELLED' AND p_target='CANCELLED' THEN RETURN b; END IF;
 IF b.status<>'CONFIRMED' OR p_target NOT IN ('IN_PROGRESS','CANCELLED','NO_SHOW') THEN RAISE EXCEPTION 'Invalid booking transition' USING ERRCODE='P0001'; END IF;
 IF p_target='CANCELLED' AND s.starts_at<=now() THEN RAISE EXCEPTION 'Cancellation is only available before the arrival time' USING ERRCODE='P0001'; END IF;
 IF p_target='IN_PROGRESS' AND s.starts_at>now() THEN RAISE EXCEPTION 'Job can only start at or after arrival time' USING ERRCODE='P0001'; END IF;
 IF p_target='NO_SHOW' AND now()<s.starts_at+interval '30 minutes' THEN RAISE EXCEPTION 'Please wait until 30 minutes after arrival time' USING ERRCODE='P0001'; END IF;
 PERFORM set_config('motive.actor',p_actor::text,true);
 UPDATE public.bookings SET status=p_target,updated_at=now() WHERE id=p_booking RETURNING * INTO b;
 RETURN b;
END $$;

CREATE FUNCTION complete_service(p_actor uuid,p_booking uuid,p_km integer,p_summary text,p_items jsonb) RETURNS public.service_records LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE b public.bookings; s public.service_slots; v public.vehicles; result public.service_records; item jsonb;
BEGIN
 SELECT * INTO b FROM public.bookings WHERE id=p_booking;
 IF b.id IS NULL THEN RAISE EXCEPTION 'Booking not found' USING ERRCODE='P0001'; END IF;
 SELECT * INTO v FROM public.vehicles WHERE id=b.vehicle_id FOR UPDATE;
 SELECT * INTO b FROM public.bookings WHERE id=p_booking FOR UPDATE;
 SELECT * INTO s FROM public.service_slots WHERE id=b.slot_id;
 IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=p_actor AND active AND role='STAFF' AND centre_id=s.centre_id) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 IF b.status='COMPLETED' THEN SELECT * INTO result FROM public.service_records WHERE booking_id=p_booking; RETURN result; END IF;
 IF b.status<>'IN_PROGRESS' THEN RAISE EXCEPTION 'Start the job before completing it' USING ERRCODE='P0001'; END IF;
 IF p_km IS NULL OR p_km<v.current_km THEN RAISE EXCEPTION 'Mileage cannot be lower than the current vehicle reading' USING ERRCODE='P0001'; END IF;
 IF p_items IS NULL OR jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Enter between 1 and 50 service items' USING ERRCODE='23514'; END IF;
 INSERT INTO public.service_records(booking_id,completed_by,odometer_km,summary) VALUES(p_booking,p_actor,p_km,p_summary) RETURNING * INTO result;
 FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
  INSERT INTO public.service_items(record_id,service_type_id,description,quantity,unit_price,fault_code)
  VALUES(result.id,(item->>'serviceTypeId')::uuid,item->>'description',(item->>'quantity')::integer,(item->>'unitPrice')::numeric,NULLIF(item->>'faultCode',''));
 END LOOP;
 UPDATE public.vehicles SET current_km=p_km,mileage_updated_at=now() WHERE id=v.id;
 PERFORM set_config('motive.actor',p_actor::text,true);
 UPDATE public.bookings SET status='COMPLETED',updated_at=now() WHERE id=p_booking;
 RETURN result;
END $$;
CREATE FUNCTION update_vehicle_mileage(p_actor uuid,p_vehicle uuid,p_km integer) RETURNS public.vehicles LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v public.vehicles;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=p_actor AND active AND role='CUSTOMER') THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 SELECT * INTO v FROM public.vehicles WHERE id=p_vehicle AND owner_id=p_actor FOR UPDATE;
 IF v.id IS NULL THEN RAISE EXCEPTION 'Vehicle not found' USING ERRCODE='42501'; END IF;
 UPDATE public.vehicles SET current_km=p_km,mileage_updated_at=now() WHERE id=p_vehicle RETURNING * INTO v;
 RETURN v;
END $$;
CREATE FUNCTION publish_slot(p_actor uuid,p_start timestamptz,p_capacity integer) RETURNS public.service_slots LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE c uuid; s public.service_slots;
BEGIN
 SELECT centre_id INTO c FROM public.users WHERE id=p_actor AND active AND role='STAFF';
 IF c IS NULL THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.service_centres WHERE id=c AND active FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Centre is inactive' USING ERRCODE='P0001'; END IF;
 IF p_start<=now() OR p_start>now()+interval '30 days' THEN RAISE EXCEPTION 'Choose a future slot within 30 days' USING ERRCODE='P0001'; END IF;
 INSERT INTO public.service_slots(centre_id,starts_at,ends_at,capacity) VALUES(c,p_start,p_start+interval '1 hour',p_capacity) RETURNING * INTO s;
 RETURN s;
END $$;
CREATE FUNCTION save_maintenance_rule(p_actor uuid,p_vehicle uuid,p_service uuid,p_months integer,p_km integer,p_date date,p_baseline integer) RETURNS public.maintenance_rules LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE result public.maintenance_rules;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=p_actor AND active AND role='CUSTOMER') OR NOT EXISTS(SELECT 1 FROM public.vehicles WHERE id=p_vehicle AND owner_id=p_actor) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 INSERT INTO public.maintenance_rules(vehicle_id,service_type_id,interval_months,interval_km,baseline_date,baseline_km) VALUES(p_vehicle,p_service,p_months,p_km,p_date,p_baseline)
 ON CONFLICT(vehicle_id,service_type_id) DO UPDATE SET interval_months=EXCLUDED.interval_months,interval_km=EXCLUDED.interval_km,baseline_date=EXCLUDED.baseline_date,baseline_km=EXCLUDED.baseline_km RETURNING * INTO result;
 RETURN result;
END $$;
CREATE VIEW service_charge_totals AS SELECT r.id record_id,COALESCE(sum(i.quantity*i.unit_price),0)::numeric(14,2) total FROM service_records r LEFT JOIN service_items i ON i.record_id=r.id GROUP BY r.id;
CREATE VIEW vehicle_service_history AS
 SELECT r.*,b.vehicle_id,b.slot_id,s.centre_id,c.name centre_name,t.total FROM service_records r JOIN bookings b ON b.id=r.booking_id JOIN service_slots s ON s.id=b.slot_id JOIN service_centres c ON c.id=s.centre_id JOIN service_charge_totals t ON t.record_id=r.id;
CREATE VIEW centre_booking_summary AS SELECT s.centre_id,(s.starts_at AT TIME ZONE 'Asia/Kolkata')::date service_day,b.status,count(*)::integer bookings FROM bookings b JOIN service_slots s ON s.id=b.slot_id GROUP BY s.centre_id,service_day,b.status;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
