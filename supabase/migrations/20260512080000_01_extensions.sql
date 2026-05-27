-- Phase 1 / 01 — Core extensions.
-- Postgres extensions used across the schema.

create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists "citext";
