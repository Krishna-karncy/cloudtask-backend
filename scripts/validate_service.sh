#!/bin/bash
# Wait for Express server to settle
sleep 3

# Verify health check endpoint responds with 200 OK
curl -f http://localhost:5000/health || exit 1
