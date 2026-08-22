# Web tier: build the dashboard, then serve it with Caddy.
# Caddy also reverse-proxies /api to the backend container, so the browser
# only ever talks to one origin (no CORS, no API host baked into the bundle).

FROM node:22-slim AS build
WORKDIR /build
COPY package.json package-lock.json* ./
# `npm ci` needs a lockfile; fall back to install if one isn't committed.
RUN npm ci || npm install
COPY . .
# VITE_API_BASE_URL is intentionally left unset: liveApi.js then uses relative
# /api paths, which Caddy proxies to the backend on the same origin.
RUN npm run build

FROM caddy:2-alpine
COPY --from=build /build/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
EXPOSE 80 443
