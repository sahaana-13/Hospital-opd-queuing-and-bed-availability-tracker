# Hospital OPD Queuing & Bed Availability Tracker — Backend

A production-quality REST + real-time backend for managing OPD (Out-Patient
Department) queues and hospital bed availability. Built with Node.js,
Express, MongoDB/Mongoose, JWT auth, and Socket.IO.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Project Setup](#project-setup)
3. [Environment Variables](#environment-variables)
4. [Folder Structure](#folder-structure)
5. [Running the Seed Script](#running-the-seed-script)
6. [Authentication & Roles](#authentication--roles)
7. [API Documentation](#api-documentation)
8. [Socket.IO Events](#socketio-events)
9. [Testing Guide](#testing-guide)

---

## Tech Stack

- Node.js + Express.js (ES Modules)
- MongoDB + Mongoose
- JWT authentication, bcryptjs password hashing
- Socket.IO for real-time queue/bed/notification events
- helmet, cors, express-rate-limit, morgan, cookie-parser
- express-validator for request validation

---

## Project Setup

**Prerequisites:** Node.js ≥ 18, MongoDB running locally or a connection string
to a hosted instance (e.g. MongoDB Atlas).

> ⚠️ **Replica set required.** Several write paths (booking a token,
> cancelling a token, admin creating a doctor) use MongoDB multi-document
> transactions for correctness under concurrency. Standalone `mongod`
> instances do **not** support transactions. For local development, start
> Mongo as a single-node replica set:
> ```bash
> mongod --replSet rs0 --dbpath /path/to/your/data
> # then, in a mongo shell, run once:
> rs.initiate()
> ```
> MongoDB Atlas clusters are replica sets by default — no extra setup needed
> there.

```bash
cd backend
npm install
cp .env.example .env
# edit .env: set MONGO_URI and a real JWT_SECRET
npm run dev
```

The server starts on `http://localhost:5000` (or your configured `PORT`).
Confirm it's alive:

```bash
curl http://localhost:5000/api/health
# { "success": true, "message": "Server is healthy" }
```

---

## Environment Variables

See `.env.example`:

```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/hospital_opd_tracker
JWT_SECRET=replace_this_with_a_long_random_secret_string
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:3000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=200
```

Never commit a real `.env` file — it's already in `.gitignore`.

---

## Folder Structure

```text
backend/
├── config/db.js                  MongoDB connection
├── controllers/                  Route handler logic
│   ├── authController.js
│   ├── doctorController.js
│   ├── queueController.js        Core booking + queue lifecycle + patient history
│   ├── bedController.js          Wards + beds
│   ├── departmentController.js
│   ├── adminController.js        Dashboard, user mgmt, oversight
│   └── notificationController.js
├── middleware/
│   ├── authMiddleware.js         JWT verification (`protect`)
│   ├── roleMiddleware.js         Role gating (`authorize(...roles)`)
│   ├── errorMiddleware.js        Centralized error formatting
│   └── notFoundMiddleware.js
├── models/                       Mongoose schemas
│   ├── User.js Department.js Doctor.js Appointment.js
│   ├── QueueToken.js Counter.js Ward.js Bed.js Notification.js
├── routes/                       Express routers, one per resource
├── utils/
│   ├── generateToken.js          JWT signing
│   ├── generateQueueToken.js     Atomic per-dept-per-day token numbers
│   ├── calculateWaitTime.js      peopleAhead × avgConsultationTime
│   ├── notify.js                 Persist + live-push a notification
│   ├── validationHandler.js      express-validator error formatting
│   └── apiResponse.js            sendSuccess / ApiError helpers
├── sockets/socketHandler.js      Socket.IO connection, rooms, emitters
├── seed/seedData.js              Demo data generator
├── .env.example
├── .gitignore
├── package.json
└── server.js
```

---

## Running the Seed Script

```bash
npm run seed
```

This **clears all collections** and creates:

- 1 admin account
- 5 departments (General Medicine, Cardiology, Orthopedics, Pediatrics,
  Dermatology)
- 5 doctors (one per department above), each with a linked login
- 4 wards (General Ward, ICU, Emergency, Private Ward) with realistic bed
  counts and a mix of AVAILABLE/OCCUPIED/CLEANING statuses
- 6 demo patients
- 3 sample active queue tokens booked with the General Medicine doctor

All login credentials are printed to the terminal at the end of the run.
**These are development-only credentials** (`password123` for every seeded
account) — never reuse a database seeded with this script in production.

---

## Authentication & Roles

Every protected route expects:

```
Authorization: Bearer <JWT>
```

Three roles: `PATIENT`, `DOCTOR`, `ADMIN`. `POST /api/auth/register` always
creates a `PATIENT` — doctor and admin accounts are provisioned by an admin
(`POST /api/doctors`, or directly in the seed script for the initial admin).

---

## API Documentation

All responses follow:

```json
// success
{ "success": true, "message": "...", "data": { ... } }
// error
{ "success": false, "message": "...", "error": "..." }
```

### Auth — `/api/auth`

| Method | Endpoint | Auth | Role | Body | Notes |
|---|---|---|---|---|---|
| POST | `/register` | Public | — | `name, email, password, phone, age?, gender?` | Always creates a PATIENT |
| POST | `/login` | Public | — | `email, password` | Works for any role |
| GET | `/me` | Required | any | — | Current user profile |

### Departments — `/api/departments`

| Method | Endpoint | Auth | Role | Body |
|---|---|---|---|---|
| GET | `/` | Required | any | — (`?includeInactive=true`, admin only) |
| GET | `/:id` | Required | any | — |
| POST | `/` | Required | ADMIN | `name, description?` |
| PATCH | `/:id` | Required | ADMIN | `name?, description?, isActive?` |
| DELETE | `/:id` | Required | ADMIN | — (soft delete: sets `isActive:false`) |

### Doctors — `/api/doctors` and `/api/doctor` (same router, two mounts)

| Method | Endpoint | Auth | Role | Body |
|---|---|---|---|---|
| GET | `/api/doctors` | Required | any | — (`?department=`, `?available=true`) |
| GET | `/api/doctors/:id` | Required | any | — |
| GET | `/api/doctor/profile/me` | Required | DOCTOR | — own profile |
| POST | `/api/doctors` | Required | ADMIN | `name, email, password, phone, department, specialization, licenseNumber, experience?, consultationRoom?, averageConsultationTime?` — creates User+Doctor together |
| PATCH | `/api/doctors/:id` | Required | ADMIN | `department?, specialization?, experience?, consultationRoom?, isAvailable?, averageConsultationTime?` |

### Doctor Queue Operations — `/api/doctor`

| Method | Endpoint | Auth | Role | Body |
|---|---|---|---|---|
| GET | `/queue` | Required | DOCTOR | — today's WAITING/SERVING tokens |
| GET | `/stats` | Required | DOCTOR | — today's waiting/serving/completed/skipped/cancelled counts |
| POST | `/call-next` | Required | DOCTOR | — moves earliest WAITING → SERVING |
| POST | `/:tokenId/complete` | Required | DOCTOR | — SERVING → COMPLETED |
| POST | `/:tokenId/skip` | Required | DOCTOR | — WAITING → SKIPPED |

### Queue (Patient-facing) — `/api/queue`

| Method | Endpoint | Auth | Role | Body |
|---|---|---|---|---|
| POST | `/book` | Required | PATIENT | `doctorId` |
| GET | `/my-token` | Required | PATIENT | — active token, if any |
| GET | `/history` | Required | PATIENT | — full appointment history |
| POST | `/cancel/:tokenId` | Required | PATIENT | — only own, only WAITING |
| GET | `/:tokenId/status` | Required | any | — live position + wait time |
| GET | `/:departmentId` | Required | any | — today's queue board for a department |

**Possible errors across queue endpoints:** `400` invalid ID / bad state
transition, `403` not your token, `404` not found, `409` duplicate active
appointment or race-lost call-next.

### Beds & Wards — `/api/beds`

| Method | Endpoint | Auth | Role | Body |
|---|---|---|---|---|
| GET | `/wards` | Required | any | — |
| POST | `/wards` | Required | ADMIN | `name, type, totalBeds?` |
| GET | `/availability` | Required | any | — per-ward summary |
| GET | `/` | Required | any | — (`?ward=`, `?status=`) |
| POST | `/` | Required | ADMIN | `bedNumber, ward` |
| GET | `/:id` | Required | any | — |
| PATCH | `/:id/status` | Required | ADMIN | `status, patient?` (patient required when → OCCUPIED) |

Valid status transitions: `AVAILABLE→{RESERVED,OCCUPIED,MAINTENANCE}`,
`RESERVED→{OCCUPIED,AVAILABLE,MAINTENANCE}`, `OCCUPIED→{CLEANING,MAINTENANCE}`,
`CLEANING→{AVAILABLE,MAINTENANCE}`, `MAINTENANCE→{AVAILABLE}`.

### Admin — `/api/admin` (all routes ADMIN-only)

| Method | Endpoint | Body |
|---|---|---|
| GET | `/dashboard` | — hospital-wide stats + department/bed breakdowns |
| GET | `/appointments` | — (`?status=`, `?department=`, `?date=`) |
| GET | `/queues` | — today's queues, grouped by department |
| GET | `/users` | — (`?role=`) |
| GET | `/users/:id` | — |
| PATCH | `/users/:id/status` | `isActive: boolean` |

### Notifications — `/api/notifications`

| Method | Endpoint | Body |
|---|---|---|
| GET | `/` | — (`?unreadOnly=true`) |
| PATCH | `/read-all` | — |
| PATCH | `/:id/read` | — |

---

## Socket.IO Events

Connect with an optional JWT for personal notifications:

```js
import { io } from "socket.io-client";
const socket = io("http://localhost:5000", { auth: { token: "<JWT>" } });
```

**Client → Server**
| Event | Payload | Effect |
|---|---|---|
| `subscribe:department` | `departmentId` | joins `department:<id>` room |
| `subscribe:ward` | `wardId` | joins `ward:<id>` room |
| `unsubscribe:department` | `departmentId` | leaves the room |
| `unsubscribe:ward` | `wardId` | leaves the room |

**Server → Client**
| Event | Room | Payload | Fired when |
|---|---|---|---|
| `queue:updated` | `department:<id>` | `{ departmentId, tokenNumber, status, reason }` | book/cancel/call-next/complete/skip |
| `bed:updated` | `ward:<id>` | `{ wardId, bedId, status }` | bed status changes |
| `notification:new` | `user:<id>` (auto-joined if JWT valid) | the created Notification document | booking confirmed, your turn, approaching, etc. |

---

## Testing Guide

Below is a minimal manual test flow using `curl`. Import these into Postman
as a collection, or run them in sequence in a terminal. Replace
`<...TOKEN>` / `<...ID>` placeholders with real values from prior responses.

### 1. Authentication

```bash
# Register a patient
curl -X POST localhost:5000/api/auth/register -H "Content-Type: application/json" \
  -d '{"name":"Test Patient","email":"test@example.com","password":"password123","phone":"9876543210","age":25,"gender":"Male"}'

# Login as the seeded admin
curl -X POST localhost:5000/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"admin@hospital.com","password":"password123"}'

# Get current user
curl localhost:5000/api/auth/me -H "Authorization: Bearer <TOKEN>"
```

### 2. Patient flow

```bash
# View departments
curl localhost:5000/api/departments -H "Authorization: Bearer <PATIENT_TOKEN>"

# View doctors in a department
curl "localhost:5000/api/doctors?department=<DEPT_ID>" -H "Authorization: Bearer <PATIENT_TOKEN>"

# Book a token
curl -X POST localhost:5000/api/queue/book -H "Authorization: Bearer <PATIENT_TOKEN>" \
  -H "Content-Type: application/json" -d '{"doctorId":"<DOCTOR_ID>"}'

# View my active token
curl localhost:5000/api/queue/my-token -H "Authorization: Bearer <PATIENT_TOKEN>"

# Cancel it
curl -X POST localhost:5000/api/queue/cancel/<TOKEN_ID> -H "Authorization: Bearer <PATIENT_TOKEN>"

# View bed availability
curl localhost:5000/api/beds/availability -H "Authorization: Bearer <PATIENT_TOKEN>"
```

### 3. Doctor flow

```bash
curl localhost:5000/api/doctor/queue -H "Authorization: Bearer <DOCTOR_TOKEN>"
curl -X POST localhost:5000/api/doctor/call-next -H "Authorization: Bearer <DOCTOR_TOKEN>"
curl -X POST localhost:5000/api/doctor/<TOKEN_ID>/complete -H "Authorization: Bearer <DOCTOR_TOKEN>"
curl -X POST localhost:5000/api/doctor/<TOKEN_ID>/skip -H "Authorization: Bearer <DOCTOR_TOKEN>"
```

### 4. Admin flow

```bash
curl localhost:5000/api/admin/dashboard -H "Authorization: Bearer <ADMIN_TOKEN>"

curl -X POST localhost:5000/api/departments -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" -d '{"name":"Neurology"}'

curl -X POST localhost:5000/api/doctors -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Dr. New","email":"dr.new@hospital.com","password":"password123","phone":"9333333333","department":"<DEPT_ID>","specialization":"Neurologist","licenseNumber":"LIC-2001"}'

curl -X POST localhost:5000/api/beds/wards -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" -d '{"name":"NICU","type":"ICU","totalBeds":0}'

curl -X POST localhost:5000/api/beds -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" -d '{"bedNumber":"N-1","ward":"<WARD_ID>"}'

curl -X PATCH localhost:5000/api/beds/<BED_ID>/status -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" -d '{"status":"OCCUPIED","patient":"<PATIENT_USER_ID>"}'
```

### 5. Real-time (Socket.IO)

```js
import { io } from "socket.io-client";
const socket = io("http://localhost:5000", { auth: { token: "<PATIENT_TOKEN>" } });
socket.emit("subscribe:department", "<DEPARTMENT_ID>");
socket.on("queue:updated", console.log);
socket.on("notification:new", console.log);
```
Trigger a `call-next` from the doctor flow above and confirm both events
arrive.

### 6. Role enforcement (should all fail)

```bash
# Patient hitting an admin-only route → 403
curl localhost:5000/api/admin/dashboard -H "Authorization: Bearer <PATIENT_TOKEN>"

# Doctor hitting an admin-only route → 403
curl -X POST localhost:5000/api/departments -H "Authorization: Bearer <DOCTOR_TOKEN>" \
  -H "Content-Type: application/json" -d '{"name":"Test"}'

# No token at all → 401
curl localhost:5000/api/auth/me
```
