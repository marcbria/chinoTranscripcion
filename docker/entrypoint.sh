#!/bin/sh
# ─────────────────────────────────────────────────────────────
# entrypoint.sh — Prepara /srv/public-rw y arranca Nginx.
#
#   1. Copia /srv/public (RO) a /srv/public-rw (RW).
#   2. Sustituye __BASE_PATH__ por BASE_PATH.
#   3. Sustituye __CSS_HASH__, __JS_HASH__ y __THEME_HASH__ por
#      el hash corto de cada asset (cache-busting).
#   4. Verifica que no queden placeholders.
#   5. Arranca Nginx.
#
# Notas:
#   - Alpine usa BusyBox grep, que NO soporta --include.
#     Usamos find + grep por fichero.
#   - BusyBox sed -i falla con múltiples ficheros; iteramos 1 a 1.
# ─────────────────────────────────────────────────────────────
set -e

: "${BASE_PATH:=/}"

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

rm -rf /srv/public-rw
mkdir -p /srv/public-rw
cp -a /srv/public/. /srv/public-rw/

hash_file() {
    f="$1"
    if [ -f "$f" ]; then
        if command -v md5sum >/dev/null 2>&1; then
            md5sum "$f" | cut -c1-8
        else
            cksum "$f" | awk '{print $1}'
        fi
    else
        echo "0"
    fi
}

CSS_HASH=$(hash_file /srv/public-rw/styles.css)
JS_HASH=$(hash_file /srv/public-rw/app.js)
THEME_HASH=$(hash_file /srv/public-rw/theme/uab/css/header-styles.css)

echo "[entrypoint] assets hash: css=${CSS_HASH} js=${JS_HASH} theme=${THEME_HASH}"

# Sustitución: fichero a fichero para evitar el bug de BusyBox sed -i.
find /srv/public-rw -name '*.html' -type f | while IFS= read -r f; do
    sed -i \
        -e "s|__BASE_PATH__|${BASE_PATH}|g" \
        -e "s|__CSS_HASH__|${CSS_HASH}|g" \
        -e "s|__JS_HASH__|${JS_HASH}|g" \
        -e "s|__THEME_HASH__|${THEME_HASH}|g" \
        "$f"
done

# Verificación: BusyBox grep NO soporta --include. Usamos find + grep -l.
REMAINING=$(find /srv/public-rw -name '*.html' -type f -exec grep -lE '__[A-Z_]+__' {} \; 2>/dev/null || true)
if [ -n "$REMAINING" ]; then
    echo "[entrypoint] ERROR: quedan placeholders sin sustituir en:" >&2
    echo "$REMAINING" >&2
    exit 1
fi

echo "[entrypoint] placeholders sustituidos correctamente."

exec nginx -g 'daemon off;'
