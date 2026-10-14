#!/bin/sh
# ─────────────────────────────────────────────────────────────
# entrypoint.sh — Sustituye el placeholder __BASE_PATH__ en el
# HTML estático por el valor de la variable de entorno BASE_PATH,
# y arranca Nginx.
#
# El directorio /srv/public está montado como :ro desde el host,
# así que copiamos su contenido a /srv/public-rw (escribible) y
# servimos desde ahí. Nginx apunta a /srv/public-rw.
# ─────────────────────────────────────────────────────────────
set -e

: "${BASE_PATH:=/}"

# Normalizar: nos aseguramos de que empieza y termina con "/"
case "$BASE_PATH" in
    /*) ;;
    *)  BASE_PATH="/$BASE_PATH" ;;
esac
case "$BASE_PATH" in
    */) ;;
    *)  BASE_PATH="$BASE_PATH/" ;;
esac

echo "[entrypoint] BASE_URL=${BASE_URL:-<no definido>}"
echo "[entrypoint] BASE_PATH=${BASE_PATH}"

# Copiamos el contenido de /srv/public (RO) a /srv/public-rw (RW)
# para poder reescribir el HTML sin tocar el original del host.
rm -rf /srv/public-rw
mkdir -p /srv/public-rw
cp -a /srv/public/. /srv/public-rw/

# Sustituimos el placeholder en todos los HTML
find /srv/public-rw -name '*.html' -type f -exec \
    sed -i "s|__BASE_PATH__|${BASE_PATH}|g" {} +

# Arrancamos Nginx en primer plano
exec nginx -g 'daemon off;'
