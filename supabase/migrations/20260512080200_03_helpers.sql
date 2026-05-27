-- Phase 1 / 03 — Trigger helpers.
-- Generic `updated_at` toucher applied to every table in 14_triggers.

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.touch_updated_at() is
  'Sets updated_at = now() on row update. Apply via BEFORE UPDATE trigger.';
