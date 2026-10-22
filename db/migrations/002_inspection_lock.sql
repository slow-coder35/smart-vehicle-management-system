-- A controlled lock function lets the runtime serialize inspections without granting
-- direct UPDATE on protected booking rows (SELECT FOR UPDATE requires UPDATE rights).
CREATE FUNCTION lock_inspection_job(p_actor uuid,p_booking uuid) RETURNS public.bookings
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE b public.bookings; centre uuid;
BEGIN
 SELECT * INTO b FROM public.bookings WHERE id=p_booking;
 IF b.id IS NULL THEN RAISE EXCEPTION 'Booking not found' USING ERRCODE='P0001'; END IF;
 PERFORM 1 FROM public.vehicles WHERE id=b.vehicle_id FOR UPDATE;
 SELECT * INTO b FROM public.bookings WHERE id=p_booking FOR UPDATE;
 SELECT centre_id INTO centre FROM public.service_slots WHERE id=b.slot_id;
 IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=p_actor AND active AND role='STAFF' AND centre_id=centre) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 IF b.status<>'IN_PROGRESS' THEN RAISE EXCEPTION 'Only in-progress inspections can be edited' USING ERRCODE='P0001'; END IF;
 RETURN b;
END $$;
REVOKE ALL ON FUNCTION lock_inspection_job(uuid,uuid) FROM PUBLIC;
