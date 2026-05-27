-- Phase 1 / 08 — Statutory tax settings.
-- Master_admin can edit PAYE bands, NAPSA cap, NHIMA rate from /admin/settings.
-- Effective_from / effective_to give a history so prior bands are recoverable
-- when re-running an old computation.

create table public.tax_settings (
  id uuid primary key default gen_random_uuid(),
  effective_from date not null,
  effective_to date,

  paye_bands jsonb not null, -- [{upTo: 4500, marginalRate: 0}, ...]
  napsa_rate numeric(6,4) not null default 0.0500,
  napsa_ceiling_ngwee bigint not null default 154020, -- K1,540.20
  nhima_rate numeric(6,4) not null default 0.0100,
  nhima_basis text not null default 'basic',          -- 'basic' or 'gross'

  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  deleted_at timestamptz,

  constraint tax_settings_effective_dates check (effective_to is null or effective_to > effective_from),
  constraint tax_settings_nhima_basis_valid check (nhima_basis in ('basic','gross')),
  constraint tax_settings_rates_nonneg check (napsa_rate >= 0 and nhima_rate >= 0 and napsa_ceiling_ngwee >= 0)
);

create unique index tax_settings_current_unique
  on public.tax_settings (effective_from) where deleted_at is null;

create trigger trg_tax_settings_touch before update on public.tax_settings
for each row execute function public.touch_updated_at();

comment on table public.tax_settings is
  'Versioned PAYE / NAPSA / NHIMA configuration. Resolve current row via WHERE effective_from <= today AND (effective_to IS NULL OR effective_to > today).';
