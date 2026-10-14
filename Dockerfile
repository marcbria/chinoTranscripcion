FROM nginx:1.27-alpine

# Configuración de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Directorios de trabajo
RUN mkdir -p /srv/public /srv/public-rw /srv/content

# Script de arranque que sustituye __BASE_PATH__
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
