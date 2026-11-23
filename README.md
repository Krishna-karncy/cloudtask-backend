# CloudTask Manager – Tier 2: Application Layer (Node.js Express)

Production-grade Node.js Express REST API connected to an **AWS RDS PostgreSQL** database (Tier 3) and serving API requests routed via **AWS CloudFront** from a React SPA (Tier 1).

- **Production Health Endpoint:** `https://app.ucmcmcm.fun/health`
- **Production API Endpoint:** `https://app.ucmcmcm.fun/api/tasks`
- **Architecture Guide:** See [3-Tier Architecture Guide](../README.md) for complete cloud infrastructure details.

## 🚀 Local Run
```bash
npm install
npm start
```

## ☁️ EC2 Production Run
```bash
pm2 start server.js --name "cloudtask-api"
pm2 save
```
