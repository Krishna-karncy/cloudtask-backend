#!/bin/bash
cd /home/ubuntu/cloudtask-backend

# Reload or start with PM2 with zero downtime
pm2 reload cloudtask-api --update-env || pm2 start server.js --name "cloudtask-api"
pm2 save
