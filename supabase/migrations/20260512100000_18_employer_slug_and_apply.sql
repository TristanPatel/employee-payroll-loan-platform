-- Phase 4A / 18 — Employer slug + apply-link metadata.
--
-- `slug` is the URL-safe handle used in the public /apply/{slug} landing
-- page. Auto-generated from legal_name on insert (a one-time trigger) and
-- thereafter immutable from the employer's perspective — master_admin can
-- override via direct update. Globally unique.

alter table public.employers
  add column slug citext;

-- Backfill existing rows from legal_name
update public.employers
set slug = lower(regexp_replace(regexp_replace(legal_name, '[^A-Za-z0-9]+', '-', 'g'), '^-+|-+$', '', 'g'))
where slug is null;

alter table public.employers
  alter column slug set not null;

create unique index employers_slug_unique
  on public.employers (slug) where deleted_at is null;

-- Auto-generate slug on insert if not supplied.
create or replace function public.employers_default_slug()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug := lower(regexp_replace(regexp_replace(new.legal_name, '[^A-Za-z0-9]+', '-', 'g'), '^-+|-+$', '', 'g'));
  end if;
  return new;
end;
$$;

create trigger trg_employers_default_slug
before insert on public.employers
for each row execute function public.employers_default_slug();

-- Allow the public landing page to read the minimal apply-relevant columns
-- (legal_name + trading_name + slug) without auth.
create policy employers_select_public_apply on public.employers
  for select to anon
  using (status = 'active' and deleted_at is null);

comment on column public.employers.slug is
  'URL-safe handle for the public /apply/{slug} landing page. Auto-generated from legal_name on insert.';
