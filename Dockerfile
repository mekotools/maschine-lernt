# Maschine lernt — Auslieferung als fertiges Abbild.
#
# Zwei Stufen, wie in der Hausordnung: bauen, dann ausliefern. In der Baustufe
# werden die Netzgewichte geholt und gegen scripts/gewichte.sha256 geprueft —
# damit steht fest, dass wir genau die festgeschriebenen Dateien ausliefern.
# Zur Laufzeit gibt es keine fremden Aufrufe mehr.

FROM node:22-bookworm-slim AS bau
WORKDIR /bau
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run vorbereiten \
 && npm run build \
 && test -s dist/index.html \
 && test -s dist/modelle/mobilenet/model.json \
 && test -s dist/modelle/pose/pose_landmarker_lite.task \
 && test -s dist/mediapipe/wasm/vision_wasm_internal.wasm

FROM nginx:1.27-alpine
COPY --from=bau /bau/dist/ /usr/share/nginx/html/
RUN printf '%s\n' \
    'server {' \
    '    listen 80;' \
    '    root /usr/share/nginx/html;' \
    '    index index.html;' \
    '    gzip on;' \
    '    gzip_vary on;' \
    '    gzip_min_length 1024;' \
    '    gzip_types text/plain text/css application/javascript application/json application/octet-stream;' \
    '    location = /gesundheit { return 200 "ok\n"; }' \
    '    location / { try_files $uri $uri/ /index.html; }' \
    '}' > /etc/nginx/conf.d/default.conf
EXPOSE 80
