#!/bin/bash
# Restore .env file if it exists
if [ -f /home/ubuntu/.env.backup ]; then
    cp /home/ubuntu/.env.backup /home/ubuntu/cloudtask-backend/.env
fi

cd /home/ubuntu/cloudtask-backend
# Install production dependencies
npm install --omit=dev
