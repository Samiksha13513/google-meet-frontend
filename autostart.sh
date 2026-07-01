#!/bin/bash

set -e

echo "==================================="
echo " Starting Google Meet Deployment"
echo "==================================="

# --------------------------
# Backend
# --------------------------
echo ""
echo "Deploying Backend..."

cd /home/ubuntu/google-meet/backend

git checkout main
git pull origin main

npm install

# Restart if exists, otherwise start
if pm2 describe backend > /dev/null; then
    pm2 restart backend
else
    pm2 start server.js --name backend
fi

# --------------------------
# Frontend
# --------------------------
echo ""
echo "Deploying Frontend..."

cd /home/ubuntu/google-meet-frontend

git checkout dev

git pull origin dev

npm install

# Restart if exists, otherwise start
if pm2 describe frontend > /dev/null; then
    pm2 restart frontend
else
    pm2 start npm --name frontend -- start
fi

# --------------------------
# Save PM2
# --------------------------
pm2 save

echo ""
echo "==================================="
echo " Deployment Completed Successfully"
echo "==================================="

pm2 list