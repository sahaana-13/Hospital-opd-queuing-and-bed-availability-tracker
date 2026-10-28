# Hospital OPD Queuing and Bed Availability Tracker

A MERN full-stack demonstration application for OPD token management, transparent queue estimates, ward/bed availability, role-based operations, notifications, and reports. It intentionally does not implement billing, pharmacy, laboratory, insurance, procurement, or full medical records.

## Technology
- Frontend: React 18, Vite, React Router, Axios, Lucide React, Recharts, Socket.IO client, ordinary CSS
- Backend: Node.js, Express, Mongoose, MongoDB, JWT, bcryptjs, Socket.IO, Helmet, CORS, express-rate-limit
- Authentication: bearer JWT held in `sessionStorage` in this demo; logout clears the browser token. For production, consider short-lived access tokens plus refresh-token rotation in secure HttpOnly cookies.

## Prerequisites
- Node.js 20+ and npm
- MongoDB local server, or a MongoDB Atlas cluster with network access configured

## Setup (Windows PowerShell)
1. Copy `server/.env.example` to `server/.env` and set `MONGO_URI` and a long random `JWT_SECRET`. Copy `client/.env.example` to `client/.env`.
2. From the project root run:
   ```powershell
   npm install
   npm install --prefix server
   npm install --prefix client
   ```
3. Start MongoDB locally or configure Atlas (instructions below).
4. Seed fictional demo data: `npm run seed`
5. Start both applications: `npm run dev`
6. Open `http://localhost:5173`. API health: `http://localhost:5000/api/health`.

You can also run `npm run dev --prefix server` and `npm run dev --prefix client` in separate terminals.

## MongoDB setup
### Local
Install MongoDB Community Server and start the MongoDB service. The example URI is `mongodb://127.0.0.1:27017/hospital_opd_tracker`. This container does not include `mongod`/`mongosh`, so a local database must be installed separately if using this environment.
### Atlas
1. Create a cluster and a database user in Atlas Database Access.
2. In Network Access, add your current public IP. Avoid `0.0.0.0/0` as a default.
3. Copy the application connection string and replace the placeholders locally in `server/.env`. URL-encode reserved characters in the database username/password (for example `@` becomes `%40`). Never commit `.env` or paste credentials into chat.
4. Campus networks and mobile hotspots/firewalls can block outbound TCP port 27017. If TLS or connection timeouts occur, test from a permitted network; do not disable TLS verification or expose the database broadly as a workaround.

## Demo accounts
All seeded demo accounts use `DemoPass123!` (development only; change before any shared deployment).
- Admin: `admin@hospital.demo`
- Receptionists: `reception1@hospital.demo`, `reception2@hospital.demo`
- Doctors: `arjun@hospital.demo`, `meera@hospital.demo`, `kavin@hospital.demo`
- Patients: `patient1@hospital.demo` through `patient6@hospital.demo`

Public registration always creates a PATIENT. Staff and admin accounts can only be created through the authenticated admin API. Seed is idempotent and upserts named demo records; do not run this script against production data.

## Roles and permissions
- **ADMIN:** dashboards, departments, staff accounts, patients, queue operations, wards/beds, reports, notifications.
- **RECEPTIONIST:** patient registration/search, queue creation and status control, wards/beds, reports.
- **DOCTOR:** queues only for assigned departments, token status changes for those departments, own notifications.
- **PATIENT:** own profile, own tokens/estimates, own notifications, aggregate/bed availability.

All protected operations are checked in Express. Patient endpoints scope token/notification records to the authenticated user. Socket connections require a valid JWT; private notifications use per-user rooms, and doctor department rooms are limited to assigned departments. Bed updates are currently emitted as aggregate invalidation events and do not include patient details.

## Queue rules
- Tokens are numbered per department and local service date, e.g. `GEN-001`. The backend sequence is used for ordering. A unique compound index protects department/date/sequence uniqueness. Token creation includes collision retries, but this initial implementation's `find latest + 1` allocator is not a fully atomic counter under heavy concurrent load; production hardening should use a MongoDB counter document updated atomically inside a transaction.
- Duplicate active tokens for the same patient/department/date are rejected (`WAITING`, `CALLED`, `IN_CONSULTATION`).
- Legal transitions: `WAITING -> CALLED | SKIPPED | CANCELLED`; `CALLED -> IN_CONSULTATION | WAITING | SKIPPED | CANCELLED`; `IN_CONSULTATION -> COMPLETED`; `SKIPPED -> WAITING | CANCELLED`; terminal `COMPLETED` and `CANCELLED` cannot transition back. Cancellation requires a reason.
- Queue estimates count earlier `WAITING` and `CALLED` tokens multiplied by the department's configured default consultation minutes. It is a transparent estimate, not an AI prediction or guarantee.
- Current service date uses the server's local timezone. Configure the server timezone to match hospital operations.

## Bed rules
Statuses: `AVAILABLE`, `OCCUPIED`, `RESERVED`, `MAINTENANCE`, `UNAVAILABLE`. Ward capacity and summary counts are derived from Bed records. Patients receive no staff notes or updater identity. Bed availability does not guarantee admission. There is intentionally no admission/discharge workflow.

## API overview
All paths below are prefixed by `/api`; protected routes require `Authorization: Bearer <JWT>`.
- Auth: `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- Patients: `GET /patients`, `GET /patients/:id`, `POST /patients`, `PUT /patients/:id`
- Departments: `GET /departments`, `GET /departments/:id`, `POST /departments`, `PUT /departments/:id`, `PATCH /departments/:id/status`
- Queue: `GET /queue`, `GET /queue/:id`, `POST /queue/tokens`, `GET /queue/my-tokens`, `PATCH /queue/:id/status`, `GET /queue/departments/:departmentId/current`, `POST /queue/departments/:departmentId/next`, `GET /queue/:id/estimate`
- Wards/beds: `GET /wards`, `GET /wards/:id`, `POST /wards`, `PUT /wards/:id`, `GET /beds`, `GET /beds/:id`, `POST /beds`, `PUT /beds/:id`, `PATCH /beds/:id/status`, `GET /beds/availability/summary`
- Staff: `GET /staff`, `GET /staff/:id`, `POST /staff`, `PUT /staff/:id`, `PATCH /staff/:id/status`
- Notifications: `GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`
- Dashboards/reports: `GET /dashboard/admin`, `/dashboard/staff`, `/dashboard/doctor`, `/dashboard/patient`, `GET /reports/queues?start=YYYY-MM-DD&end=YYYY-MM-DD&departmentId=...`, `GET /reports/beds`
- Health: `GET /health`

## Socket events
Client sends `queue:subscribe` with a department ID (authorized role/assignment checked), and may send `queue:unsubscribe`. Server emits `queue:updated` to permitted department rooms, `notification:new` to a user's private room, and `beds:updated` as an aggregate refresh signal. REST remains the source of truth.

## Test procedure
1. Start MongoDB and set `server/.env`.
2. Run `npm install --prefix server` and `npm test --prefix server` for business-rule unit checks.
3. Run `npm run seed`; verify `GET /api/health` and login with an admin demo account.
4. Register a new patient; verify their role is PATIENT regardless of submitted role fields.
5. As reception, create a patient and a token; verify token number and estimate, then call the next token, move it to consultation, and complete it. Try an invalid transition and verify a 409 response.
6. As a patient, verify own tokens and notifications are visible; attempt another patient's token ID and verify a 403 response.
7. As admin, create a ward and beds in different states; compare `/api/beds/availability/summary` with the bed list. Verify a patient cannot update a bed.
8. Open two browser sessions and verify queue/notification/bed events update permitted views.
9. Run `npm run build --prefix client` to verify the production frontend build.

## Current limitations
- The UI includes functional auth, dashboard views, list/search/filter screens, patient/department/ward/bed/staff create forms, and notification read actions. Inline queue status controls, full edit dialogs, richer report filters, profile editing, and dedicated detail routes remain to be expanded; they are not claimed as complete.
- `GET /staff/:id` currently returns the staff list rather than a single record.
- Bed change events are broad invalidation signals, not sensitive payloads; clients should refresh permitted REST views.
- Token sequence allocation is collision-retried but should be upgraded to an atomic counter/transaction for high concurrency.
- This is an educational demonstration, not a certified clinical system. Do not use real patient data or deploy without security review, audit policy, retention controls, backup strategy, and production token/session hardening.
