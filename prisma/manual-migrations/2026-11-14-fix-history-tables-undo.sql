-- UNDO for 2026-11-14-fix-history-tables.sql. Run only to go back on that fix.
--
-- Puts back the 8 history trigger functions exactly as they were before it (read from the database
-- on 14/11/2026, with the COALESCE(NEW.x, OLD.x) problem), then removes the changed_at/changed_by
-- columns it added to 6 tables, and everything recorded in them.
--
-- AFTER RUNNING: `npx prisma db pull` + `npx prisma generate`.

BEGIN;

-- log_booking_changes
CREATE OR REPLACE FUNCTION public.log_booking_changes()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$BEGIN
  INSERT INTO public.bookings_history (
    id, booking_id, client_id, therapist_id, start_time, end_time,
    service_id, notes, status, created_at, updated_at, price,
    deleted_at, change_type, therapist_requested
  )
  VALUES (
    gen_random_uuid(),
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.client_id, OLD.client_id),
    COALESCE(NEW.therapist_id, OLD.therapist_id),
    COALESCE(NEW.start_time, OLD.start_time),
    COALESCE(NEW.end_time, OLD.end_time),
    COALESCE(NEW.service_id, OLD.service_id),
    COALESCE(NEW.notes, OLD.notes),
    COALESCE(NEW.status, OLD.status),
    COALESCE(NEW.created_at, OLD.created_at),
    COALESCE(NEW.updated_at, OLD.updated_at),
    COALESCE(NEW.price, OLD.price),
    COALESCE(NEW.deleted_at, OLD.deleted_at),
    TG_OP::change_type,
    COALESCE(NEW.therapist_requested, OLD.therapist_requested)
  );
  RETURN NULL;
END;$function$;

-- log_client_changes
CREATE OR REPLACE FUNCTION public.log_client_changes()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  insert into public.clients_history (
    client_id,
    client_name,
    client_surname,
    client_email,
    client_phone,
    client_notes,
    created_at,
    updated_at,
    deleted_at,
    change_type
  )
  values (
    coalesce(new.id, old.id),
    coalesce(new.client_name, old.client_name),
    coalesce(new.client_surname, old.client_surname),
    coalesce(new.client_email, old.client_email),
    coalesce(new.client_phone, old.client_phone),
    coalesce(new.client_notes, old.client_notes),
    coalesce(new.created_at, old.created_at),
    coalesce(new.updated_at, old.updated_at),
    coalesce(new.deleted_at, old.deleted_at),
    tg_op::public.change_type
  );

  return null;
end;
$function$;

-- log_therapist_changes
CREATE OR REPLACE FUNCTION public.log_therapist_changes()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  insert into public.therapists_history (
    therapist_id,
    nickname,
    name,
    surname,
    email,
    phone,
    notes,
    active,
    off_days,
    created_at,
    deleted_at,
    change_type
  )
  values (
    coalesce(new.id, old.id),
    coalesce(new.nickname, old.nickname),
    coalesce(new.name, old.name),
    coalesce(new.surname, old.surname),
    coalesce(new.email, old.email),
    coalesce(new.phone, old.phone),
    coalesce(new.notes, old.notes),
    coalesce(new.active, old.active),
    coalesce(new.off_days, old.off_days),
    coalesce(new.created_at, old.created_at),
    coalesce(new.deleted_at, old.deleted_at),
    tg_op::public.change_type
  );

  return null;
end;
$function$;

-- log_services_details_changes
CREATE OR REPLACE FUNCTION public.log_services_details_changes()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO public.services_details_history (
    service_details_id,
    service_name_id,
    service_duration_id,
    price,
    notes,
    created_at,
    deleted_at,
    change_type
  )
  VALUES (
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.service_name_id, OLD.service_name_id),
    COALESCE(NEW.service_duration_id, OLD.service_duration_id),
    COALESCE(NEW.price, OLD.price),
    COALESCE(NEW.notes, OLD.notes),
    COALESCE(NEW.created_at, OLD.created_at),
    COALESCE(NEW.deleted_at, OLD.deleted_at),
    TG_OP::public.change_type
  );

  RETURN NULL;
END;
$function$;

-- log_services_durations_changes
CREATE OR REPLACE FUNCTION public.log_services_durations_changes()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO public.services_durations_history (
    service_duration_id,
    duration,
    notes,
    created_at,
    deleted_at,
    change_type
  )
  VALUES (
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.duration, OLD.duration),
    COALESCE(NEW.notes, OLD.notes),
    COALESCE(NEW.created_at, OLD.created_at),
    COALESCE(NEW.deleted_at, OLD.deleted_at),
    TG_OP::public.change_type
  );

  RETURN NULL;
END;
$function$;

-- log_services_names_changes
CREATE OR REPLACE FUNCTION public.log_services_names_changes()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO public.services_names_history (
    service_name_id,
    name,
    short_name,
    notes,
    created_at,
    deleted_at,
    change_type
  )
  VALUES (
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.name, OLD.name),
    COALESCE(NEW.short_name, OLD.short_name),
    COALESCE(NEW.notes, OLD.notes),
    COALESCE(NEW.created_at, OLD.created_at),
    COALESCE(NEW.deleted_at, OLD.deleted_at),
    TG_OP::public.change_type
  );

  RETURN NULL;
END;
$function$;

-- log_voucher_changes
CREATE OR REPLACE FUNCTION public.log_voucher_changes()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$BEGIN
  INSERT INTO public.vouchers_history (
    id,
    voucher_id,
    buyer_id,
    recipient_id,
    code,
    balance,
    notes,
    source,
    external_reference,
    created_at,
    updated_at,
    expiration_date,
    deleted_at,
    change_type,
    changed_at,
    changed_by
  )
  VALUES (
    gen_random_uuid(),
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.buyer_id, OLD.buyer_id),
    COALESCE(NEW.recipient_id, OLD.recipient_id),
    COALESCE(NEW.code, OLD.code),
    COALESCE(NEW.balance, OLD.balance),
    COALESCE(NEW.notes, OLD.notes),
    COALESCE(NEW.source, OLD.source),
    COALESCE(NEW.external_reference, OLD.external_reference),
    COALESCE(NEW.created_at, OLD.created_at),
    COALESCE(NEW.updated_at, OLD.updated_at),
    COALESCE(NEW.expiration_date, OLD.expiration_date),
    COALESCE(NEW.deleted_at, OLD.deleted_at),
    TG_OP::change_type,
    now(),
    coalesce(nullif(current_setting('app.user_id', true), '')::uuid, auth.uid())
  );

  RETURN NULL;
END;$function$;

-- log_voucher_uses_changes
CREATE OR REPLACE FUNCTION public.log_voucher_uses_changes()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$BEGIN
  INSERT INTO public.voucher_uses_history (
    id,
    voucher_event_id,
    voucher_id,
    booking_id,
    recipient_id,
    amount,
    notes,
    code,
    created_at,
    updated_at,
    performed_by,
    deleted_at,
    change_type,
    changed_at,
    changed_by
  )
  VALUES (
    gen_random_uuid(),
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.voucher_id, OLD.voucher_id),
    COALESCE(NEW.booking_id, OLD.booking_id),
    COALESCE(NEW.recipient_id, OLD.recipient_id),
    COALESCE(NEW.amount, OLD.amount),
    COALESCE(NEW.notes, OLD.notes),
    COALESCE(NEW.code, OLD.code),
    COALESCE(NEW.created_at, OLD.created_at),
    COALESCE(NEW.updated_at, OLD.updated_at),
    COALESCE(NEW.performed_by, OLD.performed_by),
    COALESCE(NEW.deleted_at, OLD.deleted_at),
    TG_OP::change_type,
    now(),
    coalesce(nullif(current_setting('app.user_id', true), '')::uuid, auth.uid())
  );

  RETURN NULL;
END;$function$;

ALTER TABLE public.bookings_history           DROP COLUMN changed_at, DROP COLUMN changed_by;
ALTER TABLE public.clients_history            DROP COLUMN changed_at, DROP COLUMN changed_by;
ALTER TABLE public.therapists_history         DROP COLUMN changed_at, DROP COLUMN changed_by;
ALTER TABLE public.services_details_history   DROP COLUMN changed_at, DROP COLUMN changed_by;
ALTER TABLE public.services_durations_history DROP COLUMN changed_at, DROP COLUMN changed_by;
ALTER TABLE public.services_names_history     DROP COLUMN changed_at, DROP COLUMN changed_by;

COMMIT;
