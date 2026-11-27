# CloudTask Manager – Backend & Database Infrastructure (Tier 2 & Tier 3)

[![Live API](https://img.shields.io/badge/Live%20API-app.ucmcmcm.fun%2Fhealth-2ea44f?style=for-the-badge&logo=googlechrome&logoColor=white)](https://app.ucmcmcm.fun/health)
[![Node.js](https://img.shields.io/badge/Backend-Node.js%20Express-339933?style=for-the-badge&logo=nodedotjs)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/Database-AWS%20RDS%20Postgres-4169e1?style=for-the-badge&logo=postgresql)](https://aws.amazon.com/rds/postgresql/)

A production-grade Node.js Express REST API running on an **AWS EC2 Ubuntu 24.04** instance managed with **PM2** and **Nginx**, persisting data to a private **AWS RDS PostgreSQL** instance with **VPC Security Group Chaining**, and serving requests securely via **AWS CloudFront Multi-Origin CDN** at **`https://app.ucmcmcm.fun`**.

Frontend Repository: [cloudtask-frontend](https://github.com/Krishna-karncy/cloudtask-frontend)

---

## 🏗️ End-to-End 3-Tier Architecture Overview

```text
══════════════════════════════════════════════════════════════════════════════
 TIER 1: PRESENTATION TIER (Custom Domain & Global Edge Delivery)
 ────────────────────────────────────────────────────────────────────────────
 [ Public Internet Users: https://app.ucmcmcm.fun ]
        │
        ▼ (DNS Resolution via Google Cloud DNS)
 [ CNAME Record: app.ucmcmcm.fun ──► d2qlk5d5crskbp.cloudfront.net ]
        │
        ▼ HTTPS (TLS 1.3 Termination via AWS Certificate Manager in us-east-1)
 [ AWS CloudFront Distribution (Multi-Origin) ]
        │
        ├──────────────────────────────────────────────┐
        │ Default Behavior (/*)                        │ Path Behaviors (/api/*, /health)
        ▼ Origin: S3                                   ▼ Origin: EC2
 ┌──────────────────────────────┐              ┌──────────────────────────────┐
 │ AWS S3 Bucket                │              │ TIER 2: APPLICATION TIER     │
 │ (cloudtask-frontend-...)     │              │ [ AWS EC2 Ubuntu 24.04 ]     │
 │ - React SPA Static Bundle    │              │ - Nginx Reverse Proxy (80)   │
 │ - Origin Access Control (OAC)│              │ - Node.js Express (5000/PM2) │
 └──────────────────────────────┘              └──────────────┬───────────────┘
══════════════════════════════════════════════════════════════┼───────────────
                                                              │
                                                              │ Private Encrypted SQL
                                                              │ (Port 5432 / TLS)
                                                              ▼
══════════════════════════════════════════════════════════════════════════════
 TIER 3: DATA STORAGE TIER (Persistence & Backups)
 ────────────────────────────────────────────────────────────────────────────
 [ AWS RDS Managed PostgreSQL Database (cloudtask-db) ]
   - Engine: PostgreSQL 16.x (Free Tier)
   - Public Access: NO (Isolated in private VPC)
   - Security Group Chaining: Port 5432 allowed strictly from EC2 SG ID
══════════════════════════════════════════════════════════════════════════════
```

---

## 🔒 Security Architecture: VPC Security Group Chaining

To ensure database isolation, **AWS RDS does not accept connections from the public Internet**:

```
[ Internet ] ──(BLOCKED)──► [ AWS RDS PostgreSQL (Port 5432) ]
                                   ▲
                                   │ Allowed ONLY from SG: cloudtask-app-sg
                            [ AWS EC2 Instance ]
```

1. **`cloudtask-app-sg` (EC2 Security Group):**
   - Inbound: Port 22 (SSH from `My IP`), Port 80 (HTTP from `0.0.0.0/0` for CloudFront).
2. **`cloudtask-rds-sg` (RDS Security Group):**
   - Inbound: Port 5432 (PostgreSQL) strictly from Source: `cloudtask-app-sg` (Security Group ID reference).

---

## 🚀 Local Development

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start with live reloading
npm run dev
```

---

## ☁️ Step-by-Step Production Deployment Guide

### Step 1: Provision AWS RDS PostgreSQL
1. Open the **AWS RDS Console** ➔ Click **Create database**.
2. **Engine:** PostgreSQL (Version 16.x).
3. **Template:** Free Tier.
4. **DB instance identifier:** `cloudtask-db`.
5. **Master username:** `postgres`, set a strong password.
6. **Public access:** Select **No** (Keeps database private).
7. **VPC security group:** Choose `Create new` ➔ Name: `cloudtask-rds-sg`.
8. **Initial database name:** `cloud_db`.
9. Click **Create database**.

---

### Step 2: Provision AWS EC2 Application Server
1. Launch an Ubuntu 24.04 LTS instance (`t2.micro`).
2. Attach Security Group `cloudtask-app-sg`:
   - SSH (Port 22) from your IP.
   - HTTP (Port 80) from anywhere (`0.0.0.0/0`).
3. **Configure Security Group Chaining:**
   - Go to EC2 ➔ Security Groups ➔ Select `cloudtask-rds-sg`.
   - Edit Inbound Rules: Add rule for **PostgreSQL (5432)** with Source set to the **Security Group ID** of `cloudtask-app-sg`.

---

### Step 3: Install Node.js, PM2 & Nginx on EC2
```bash
# Connect via SSH
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>

# Install Node.js 20 and Nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx
sudo npm install -g pm2
```

---

### Step 4: Clone & Run Application via PM2
```bash
# Clone backend
cd ~
git clone git@github.com:Krishna-karncy/cloudtask-backend.git
cd cloudtask-backend
npm install --omit=dev

# Create production .env
cat << 'EOF' > .env
PORT=5000
NODE_ENV=production
DB_HOST=<YOUR_RDS_ENDPOINT>
DB_PORT=5432
DB_NAME=cloud_db
DB_USER=postgres
DB_PASSWORD=<YOUR_RDS_PASSWORD>
ALLOWED_ORIGIN=*
EOF

# Start with PM2 daemon
pm2 start server.js --name "cloudtask-api"
pm2 save
pm2 startup
```

---

### Step 5: Configure Nginx Reverse Proxy & Origin Cloaking
To prevent malicious internet actors from directly pinging or attacking your EC2 public IP, configure **Origin Cloaking** using a secret handshake header (`X-Origin-Verify`):

Edit `/etc/nginx/sites-available/default`:
```nginx
server {
    listen 80 default_server;
    server_name _;

    # Origin Cloaking: Reject direct IP access that bypasses CloudFront
    if ($http_x_origin_verify != "CloudTaskSecure2026!OriginToken") {
        return 403 "Direct IP access is forbidden. Please use the official domain.";
    }

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
Reload Nginx:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

### Step 6: Route Traffic through CloudFront & Custom Domain
In AWS CloudFront:
1. Add an Origin for your EC2 instance (`Port 80, HTTP only`).
2. In Origin settings, add a Custom Header:
   - **Header Name:** `X-Origin-Verify`
   - **Header Value:** `CloudTaskSecure2026!OriginToken`
3. Add Path Behaviors:
   - `/api/*` ➔ Routed to EC2 with `CachingDisabled`.
   - `/health` ➔ Routed to EC2 with `CachingDisabled`.
4. Custom Domain **`app.ucmcmcm.fun`** routes requests to CloudFront via Google Cloud DNS, and CloudFront securely terminates HTTPS using an AWS ACM certificate (`us-east-1`).

---

## 🌐 Dedicated Backend Domain Roadmap (`api.ucmcmcm.fun`)

To give third-party integrations (webhooks like Stripe, mobile apps, partner developers) a clean, dedicated API domain while keeping the EC2 instance completely cloaked:

```text
[ Third Parties / Mobile Apps / Webhooks ]
                   │
                   ▼ (https://api.ucmcmcm.fun)
       [ Google Cloud DNS (CNAME: api) ]
                   │
                   ▼ (HTTPS Edge Termination - ACM us-east-1)
       [ AWS CloudFront API Distribution ]
       - Default Behavior (/*) ➔ EC2 (CachingDisabled)
       - Custom Header: X-Origin-Verify: CloudTaskSecure2026!OriginToken
                   │
                   ▼ (HTTP Port 80 - Validated Secret)
            [ AWS EC2 Ubuntu Nginx ]
                   │
                   ▼ (Port 5000)
            [ Node.js Express API ]
```

### Steps to Activate in Google Cloud DNS (When Admin is Available):
1. **Request Certificate in AWS ACM (`us-east-1`):**
   - Domain: `api.ucmcmcm.fun` (or wildcard `*.ucmcmcm.fun`).
   - Method: **DNS Validation**.
2. **Add Validation CNAME in Google Cloud DNS:**
   - Name: `_xxxx...api.ucmcmcm.fun.` ➔ Target: `_xxxx.acm-validations.aws.`
3. **Create Dedicated CloudFront API Distribution:**
   - Origin: EC2 Public IP (`Port 80, HTTP only`).
   - Custom Header: `X-Origin-Verify: CloudTaskSecure2026!OriginToken`.
   - Default Behavior (`/*`): Allowed Methods `GET..DELETE`, Cache Policy `CachingDisabled`.
   - Alternate Domain (CNAME): `api.ucmcmcm.fun` + attach ACM certificate.
4. **Add Routing CNAME in Google Cloud DNS:**
   - Name: `api` ➔ Target: `<NEW_CLOUDFRONT_DOMAIN>.cloudfront.net.`

---

## ⚡ Automated CI/CD Pipelines

This backend repository supports both **GitHub Actions** (active in production) and **AWS CodeDeploy**:

### Method 1: GitHub Actions (Active Production Pipeline)
Deploys automatically on every push to `main` via `.github/workflows/deploy.yml`:
* **Trigger:** Push to `main` or manual trigger via GitHub Actions UI.
* **Runner:** `ubuntu-latest`.
* **Action:** `appleboy/ssh-action@v1.0.3` using GitHub Secrets (`EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY`).
* **Zero-Downtime Deployment Command:**
  ```bash
  cd ~/cloudtask-backend
  git pull origin main
  npm install --omit=dev
  pm2 reload cloudtask-api --update-env
  ```
* **Status Verification:** The workflow outputs `pm2 status` and completes in ~20-30 seconds.

### Method 2: AWS CodeDeploy Architecture (`appspec.yml`)
For AWS-native deployments without open SSH ports:
* **Configuration:** `appspec.yml` and `scripts/` directory.
* **Agent:** AWS CodeDeploy Agent running on Ubuntu 24.04 LTS EC2.
* **Lifecycle Hooks:**
  1. `BeforeInstall` (`scripts/before_install.sh`): Safely backs up the production `.env` file containing database credentials to `/home/ubuntu/.env.backup`.
  2. `AfterInstall` (`scripts/after_install.sh`): Restores `.env` into the release directory and executes `npm install --omit=dev`.
  3. `ApplicationStart` (`scripts/start_server.sh`): Zero-downtime process reload via `pm2 reload cloudtask-api --update-env`.
  4. `ValidateService` (`scripts/validate_service.sh`): Queries `http://localhost:5000/health`. If health check fails, CodeDeploy automatically rolls back to the previous stable release.
* **Ubuntu 24.04 Compatibility Fix:** The standard CodeDeploy deb package requires patching the Debian control file for Ruby 3.3 via `dpkg-deb -R`, adjusting dependencies to `ruby3.3 | ruby`, and repacking with `dpkg-deb -b`.
* **Note on AWS Account Tiers:** AWS CodeDeploy on new/free accounts requires complete billing and identity plan verification to unlock console application creation.

### Method 3: GitLab CI/CD for Backend
In GitLab CI/CD, the backend deploys differently from the frontend:
* **The Difference:** Frontend deploys static files via AWS CLI to S3, whereas Backend targets a Linux virtual machine (EC2) running Node.js and PM2.
* **Approach A (SSH Runner):** The GitLab runner executes inside an `alpine` Docker container, sets up an `ssh-agent` with the private `.pem` key stored in GitLab CI/CD Variables (`$EC2_SSH_KEY`), and commands EC2 over SSH:
  ```yaml
  deploy_backend:
    stage: deploy
    image: alpine:latest
    before_script:
      - apk add --no-cache openssh-client
      - eval $(ssh-agent -s)
      - echo "$EC2_SSH_KEY" | tr -d '\r' | ssh-add -
      - mkdir -p ~/.ssh && chmod 700 ~/.ssh
      - ssh-keyscan -H $EC2_HOST >> ~/.ssh/known_hosts
    script:
      - ssh $EC2_USER@$EC2_HOST "cd ~/cloudtask-backend && git pull origin main && npm install --omit=dev && pm2 reload cloudtask-api --update-env"
    rules:
      - if: $CI_COMMIT_BRANCH == "main"
  ```
* **Approach B (Self-Hosted GitLab Runner on EC2):** Install the `gitlab-runner` service directly on the EC2 instance. The job executes natively on the VM shell with zero open SSH ports needed.

### Method 4: Jenkins for Backend (`Jenkinsfile`)
- **Configuration:** `Jenkinsfile` in repository root.
- **Engine:** Declarative Pipeline running on self-hosted Jenkins.
- **Stages:**
  1. `Checkout`: Pulls backend code from GitHub.
  2. `Deploy to EC2`: Connects via SSH (`ssh -i key.pem ubuntu@EC2_HOST`) and triggers zero-downtime reload:
     ```bash
     cd ~/cloudtask-backend && git pull origin main && npm install --omit=dev && pm2 reload cloudtask-api --update-env
     ```
  3. `Verify Health`: Asserts service health endpoint returns HTTP 200 (`curl -f http://EC2_HOST/health`).

---

## 📡 Live API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `https://app.ucmcmcm.fun/health` | Service health & RDS database connectivity status |
| `GET` | `https://app.ucmcmcm.fun/api/tasks` | Retrieve all tasks from RDS PostgreSQL |
| `POST` | `https://app.ucmcmcm.fun/api/tasks` | Create a new task in RDS PostgreSQL |
| `PUT` | `https://app.ucmcmcm.fun/api/tasks/:id` | Update task status or details |
| `DELETE` | `https://app.ucmcmcm.fun/api/tasks/:id` | Delete a task |

---

## 🔍 Troubleshooting Cheat Sheet

| Symptom | Root Cause | Solution |
| :--- | :--- | :--- |
| **`ETIMEDOUT` to RDS** | Security group chaining missing. | Ensure `cloudtask-rds-sg` has an inbound rule allowing port 5432 specifically from `cloudtask-app-sg`. |
| **`502 Bad Gateway`** | Node.js process crashed or stopped. | Run `pm2 status` and inspect logs using `pm2 logs cloudtask-api`. |
| **`no pg_hba.conf entry ... no encryption`** | AWS RDS requires SSL connections. | Ensure `pg.Pool` configuration includes `ssl: { rejectUnauthorized: false }`. |
| **API requests blocked in browser** | Mixed content (HTTP calls from HTTPS site). | Route `/api/*` through CloudFront so API and frontend share the custom HTTPS domain. |
| **`504 Gateway Timeout` on `/api/*`** | EC2 stopped/restarted and dynamic IP changed. | Attach an **AWS Elastic IP** to the EC2 instance so its IP remains static permanently. |
