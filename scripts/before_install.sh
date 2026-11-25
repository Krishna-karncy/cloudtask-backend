#!/bin/bash
# Backup existing production .env file
if [ -f /home/ubuntu/cloudtask-backend/.env ]; then
    cp /home/ubuntu/cloudtask-backend/.env /home/ubuntu/.env.backup
fi
