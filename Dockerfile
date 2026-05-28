# Railway / Docker build for the @eplp/web Next.js app in this pnpm monorepo.
# Single image: install the whole workspace, build the web app, run `next start`.
# Kept deliberately simple (full node_modules, no standalone tracing) because
# it mirrors exactly what we verified locally: install → next build → next start.
#
# NOTE: temporarily on --no-frozen-lockfile because the git transport was
# down and the 502 KB pnpm-lock.yaml couldn't be pushed via the API. The
# lockfile is regenerated in-image from package.json. Restore the committed
# lockfile + --frozen-lockfile once git push works again.

FROM node:20-bookworm-slim AS base
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

# ---- install dependencies -------------------------------------------------
FROM base AS deps
COPY pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/web/package.json        apps/web/package.json
COPY apps/mobile/package.json     apps/mobile/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/ui/package.json     packages/ui/package.json
RUN pnpm install --no-frozen-lockfile

# ---- build the web app ----------------------------------------------------
FROM deps AS build
COPY . .
# NEXT_PUBLIC_* values are inlined into the client bundle at build time.
# The anon key is public by design (RLS enforces access), so it is safe to
# bake in. Railway can override these as build args / service variables.
ARG NEXT_PUBLIC_SUPABASE_URL="https://slmrpvlhttgrhoinpfwa.supabase.co"
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsbXJwdmxodHRncmhvaW5wZndhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1NzQ2OTcsImV4cCI6MjA5NDE1MDY5N30.vjXF7z6XnpouAlbhk5672YVLBKelnnXlRTKEecFEorY"
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NODE_ENV=production
RUN pnpm --filter @eplp/web build

# ---- runtime --------------------------------------------------------------
FROM build AS runner
ENV NODE_ENV=production \
    PORT=3000
EXPOSE 3000
# Bind to 0.0.0.0 and Railway's injected $PORT.
CMD ["sh", "-c", "cd /app/apps/web && pnpm exec next start -H 0.0.0.0 -p ${PORT:-3000}"]
