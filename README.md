# MedAlert — Clinic Medication Management System
**CPIT 455 Project**

A 3-tier client-server web application for managing medication schedules, dose administration, and clinical alerts.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React.js 18, React Router v6, Axios |
| Backend | Node.js 20, Express 4 |
| Database | PostgreSQL 15 |
| Auth | Firebase Authentication |
| Push Alerts | Firebase Cloud Messaging (FCM) |
| Email Alerts | SendGrid |
| Process Manager | PM2 |

---

## Prerequisites

- Node.js >= 20
- PostgreSQL >= 15
- A Firebase project with **Authentication** and **Cloud Messaging** enabled
- A SendGrid account with a verified sender
- PM2 (`npm install -g pm2`)

---

## Setup

### 1. Clone & Install

```bash
git clone <repo-url>
cd "MedAlert - CPIT 455"

# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 2. Database (Supabase)

1. Create a free project at [supabase.com](https://supabase.com)
2. In the Supabase dashboard go to **SQL Editor** and run `schema.sql` (paste the full file contents)
3. Also run `backend/migrations/001_queued_alerts.sql` the same way
4. Copy your connection string from **Project Settings → Database → Connection string → URI** and paste it into `backend/.env` as `DATABASE_URL`

### 3. Environment Variables

**Backend** — copy and fill in `backend/.env`:

```bash
cp backend/.env.example backend/.env
```

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Supabase connection string (Project Settings → Database → URI) |
| `FIREBASE_SERVICE_ACCOUNT` | Path to Firebase Admin SDK JSON key |
| `SENDGRID_API_KEY` | SendGrid API key |
| `SENDGRID_FROM_EMAIL` | Verified sender address |
| `JWT_SECRET` | Random secret (≥32 chars) for session signing |
| `PORT` | API port (default 5000) |
| `NODE_ENV` | `development` or `production` |
| `FRONTEND_URL` | Frontend origin for CORS |
| `ALERT_GRACE_MINUTES` | Minutes after scheduled time before marking missed (default 15) |

**Frontend** — copy and fill in `frontend/.env`:

```bash
cp frontend/.env.example frontend/.env
```

| Variable | Description |
|----------|-------------|
| `REACT_APP_API_URL` | Backend API base URL |
| `REACT_APP_FIREBASE_*` | Firebase web config values |
| `REACT_APP_FIREBASE_VAPID_KEY` | VAPID key for FCM web push |

### 4. Firebase Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Email/Password** authentication
3. Download the **Admin SDK service account** JSON → place it at the path set in `FIREBASE_SERVICE_ACCOUNT`
4. In **Project Settings → Cloud Messaging**, generate a **Web Push certificate** and copy the VAPID key

### 5. SendGrid Setup

1. Create a SendGrid account and verify a sender email
2. Create an API key with **Mail Send** permission
3. Set `SENDGRID_API_KEY` and `SENDGRID_FROM_EMAIL` in `backend/.env`

### 6. Run in Development

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm start
```

### 7. Run in Production (PM2)

```bash
cd backend
npm run build          # optional if using Babel
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## User Roles

| Role | Capabilities |
|------|-------------|
| **Nurse** | View assigned patients, mark doses administered, receive push/email alerts |
| **Doctor** | View patient medication history and dose logs (read-only) |
| **Admin** | Full CRUD on users, patients, medications; 2FA (TOTP) required at login |

> Roles are strictly isolated — a nurse cannot access doctor views and vice versa.

---

## Alert Engine

The backend runs a **cron job every minute** that:
1. Queries `dose_schedules` for entries past their scheduled time by more than `ALERT_GRACE_MINUTES`
2. Marks them as `missed`
3. Sends a **push notification** (FCM) + **email** (SendGrid) to the assigned nurse
4. Logs every alert in `alert_logs`

---

## Safety Constraints

- Dose submissions are rejected if `actual_dosage > medication.max_dose`
- Deleting a medication requires a **double-confirmation** token
- If PostgreSQL is unreachable, the API returns 503 and halts dose logging — no silent failures
- All exceptions are caught, logged, and surfaced as structured JSON errors

---

## Project Structure

```
MedAlert - CPIT 455/
├── backend/
│   ├── src/
│   │   ├── config/          # DB + Firebase init
│   │   ├── controllers/     # Route handlers
│   │   ├── jobs/            # Cron: missed-dose checker
│   │   ├── middleware/      # Auth, rate-limit, validation, error handler
│   │   ├── routes/          # Express routers
│   │   ├── services/        # alertService, auditService
│   │   └── utils/           # logger, validators
│   ├── app.js
│   ├── server.js
│   └── ecosystem.config.js  # PM2 config
├── frontend/
│   ├── public/
│   │   └── firebase-messaging-sw.js
│   └── src/
│       ├── components/      # Reusable UI components
│       ├── contexts/        # AuthContext
│       ├── hooks/           # useAuth, useNotifications
│       ├── pages/           # Role-based page views
│       └── services/        # Axios API client
├── schema.sql
└── README.md
```

---

## Daily Backup

Add this cron entry on the server (adjust paths):

```cron
0 2 * * * pg_dump medalert | gzip > /backups/medalert_$(date +\%F).sql.gz
```

---

## License

Academic project — CPIT 455, King Abdulaziz University.
