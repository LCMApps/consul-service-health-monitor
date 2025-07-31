FROM node:16.14.0-bullseye

EXPOSE 3000
EXPOSE 9229

WORKDIR /app

COPY . /app

RUN set -eux; \
    npm install ;

ENTRYPOINT ["/app/entrypoint.sh"]
