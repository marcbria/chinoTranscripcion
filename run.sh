#!/bin/bash
# run.sh — Script de arranque y utilidades para chinotrans

set -e

show_help() {
    cat <<EOF
Uso: ./run.sh <comando>

Comandos:
  dev       Arranca en modo desarrollo (solo compose.yml, puerto 8080)
  prod      Arranca en modo producción (compose.yml + compose.traefik.yml, vía Traefik)
  down      Detiene y elimina los contenedores de ambos entornos
  logs      Muestra los logs en primer plano (dev)
  logs-prod Muestra los logs en primer plano (prod)
  rebuild   Reconstruye la imagen sin caché y reinicia (dev)
  rebuild-prod Reconstruye la imagen sin caché y reinicia (prod)
  config    Muestra la configuración fusionada (dev)
  config-prod Muestra la configuración fusionada (prod)
  help      Muestra esta ayuda

Ejemplos:
  ./run.sh dev
  ./run.sh prod
  ./run.sh rebuild-prod
EOF
}

CMD="$1"

case "$CMD" in
    dev)
        echo "Arrancando entorno de desarrollo (http://localhost:8080)..."
        docker compose down
        docker compose up -d --build
        echo "Mostrando logs (Ctrl+C para salir sin detener)..."
        docker compose logs -f
        ;;

    prod)
        echo "Arrancando entorno de producción (vía Traefik)..."
        docker compose -f compose.yml -f compose.traefik.yml down
        docker compose -f compose.yml -f compose.traefik.yml up -d --build
        echo "Mostrando logs (Ctrl+C para salir sin detener)..."
        docker compose -f compose.yml -f compose.traefik.yml logs -f
        ;;

    down)
        echo "Deteniendo entorno dev..."
        docker compose down || true
        echo "Deteniendo entorno prod..."
        docker compose -f compose.yml -f compose.traefik.yml down || true
        ;;

    logs)
        docker compose logs -f
        ;;

    logs-prod)
        docker compose -f compose.yml -f compose.traefik.yml logs -f
        ;;

    rebuild)
        echo "Reconstruyendo entorno dev sin caché..."
        docker compose down
        docker compose build --no-cache app
        docker compose up -d
        ;;

    rebuild-prod)
        echo "Reconstruyendo entorno prod sin caché..."
        docker compose -f compose.yml -f compose.traefik.yml down
        docker compose -f compose.yml -f compose.traefik.yml build --no-cache app
        docker compose -f compose.yml -f compose.traefik.yml up -d
        ;;

    config)
        docker compose config
        ;;

    config-prod)
        docker compose -f compose.yml -f compose.traefik.yml config
        ;;

    help|"")
        show_help
        ;;

    *)
        echo "Comando desconocido: $CMD"
        show_help
        exit 1
        ;;
esac
