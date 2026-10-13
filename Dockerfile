FROM nginx:1.27-alpine

# Copiem la configuració personalitzada
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Creem els directoris on es muntaran els volums (buits a la imatge)
RUN mkdir -p /srv/public /srv/content

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
