#!/bin/bash
# Deploy completo del VPS productivo de Siliba.
#
# Instalar una vez:
#   sudo cp /home/siliba/scripts/deploy.sh /usr/local/bin/deploy-siliba
#   sudo chmod +x /usr/local/bin/deploy-siliba
#
# Despues correr desde cualquier directorio:
#   deploy-siliba
#
# Hace en orden: git pull, prisma migrate, prisma generate, build con
# turbo (cache), reload PM2, kill al next-server huerfano que PM2 no
# mata solo, status final.
#
# `set -e` aborta el script al primer error. Si algun paso truena,
# diagnostica antes de relanzar.

set -e

cd /home/siliba

echo "1/6 git pull origin redesign"
git pull origin redesign

echo "2/6 prisma migrate deploy"
cd apps/api && npx prisma migrate deploy

echo "3/6 prisma generate"
npx prisma generate

echo "4/6 build (nice -n 19 para no afectar otros sitios del VPS)"
cd /home/siliba && nice -n 19 npm run build

echo "5/6 pm2 reload (con --update-env para refrescar .env)"
# --update-env asegura que se carguen variables nuevas del .env. Sin esto
# PM2 mantiene el env que tenia cuando arranco originalmente y los cambios
# en .env quedan dormidos hasta el proximo pm2 start full.
pm2 reload siliba-api siliba-web --update-env

echo "6/6 pkill next-server huerfano y esperar respawn"
# PM2 reload reporta exito en siliba-web pero NO mata el next-server hijo
# (bug conocido). El pkill fuerza la muerte del proceso real; PM2 detecta
# que murio y lo respawnea con auto-restart, esta vez con env actualizado.
pkill -f "next-server" || true
sleep 5

pm2 status
