# Fulmile — Full User Manual

> **Version 1.0** · Smart Fleet Operations Management Platform  
> **Platform Stack:** React.js · Node.js / Express · PostgreSQL · Socket.io

---

## Table of Contents

1. [Introduction & System Overview](#1-introduction--system-overview)
2. [System Requirements & Installation](#2-system-requirements--installation)
   - [2.1 Prerequisites](#21-prerequisites)
   - [2.2 Database Setup](#22-database-setup)
   - [2.3 Backend Setup](#23-backend-setup)
   - [2.4 Frontend Setup](#24-frontend-setup)
   - [2.5 Environment Variables Reference](#25-environment-variables-reference)
3. [Architecture Overview](#3-architecture-overview)
4. [User Roles & Access Control](#4-user-roles--access-control)
5. [Getting Started — Registration & Login](#5-getting-started--registration--login)
   - [5.1 Registering an Account](#51-registering-an-account)
   - [5.2 Logging In](#52-logging-in)
   - [5.3 Logging Out](#53-logging-out)
6. [Navigation Bar](#6-navigation-bar)
7. [Dashboard — Operations Command Center](#7-dashboard--operations-command-center)
   - [7.1 KPI Cards](#71-kpi-cards)
   - [7.2 Operations Overview Panel](#72-operations-overview-panel)
   - [7.3 Role-Specific Quick Actions](#73-role-specific-quick-actions)
   - [7.4 Real-Time WebSocket Connection](#74-real-time-websocket-connection)
8. [Vehicle Registry](#8-vehicle-registry)
   - [8.1 Viewing the Fleet](#81-viewing-the-fleet)
   - [8.2 Adding a New Vehicle](#82-adding-a-new-vehicle)
   - [8.3 Removing a Vehicle](#83-removing-a-vehicle)
   - [8.4 Vehicle Status Lifecycle](#84-vehicle-status-lifecycle)
9. [Driver Registry](#9-driver-registry)
   - [9.1 Viewing Drivers](#91-viewing-drivers)
   - [9.2 Adding a New Driver](#92-adding-a-new-driver)
   - [9.3 Removing a Driver](#93-removing-a-driver)
   - [9.4 License Expiry Monitoring](#94-license-expiry-monitoring)
10. [Dispatch & Trips — The Trip Lifecycle](#10-dispatch--trips--the-trip-lifecycle)
    - [10.1 Trip Lifecycle State Machine](#101-trip-lifecycle-state-machine)
    - [10.2 Creating a Dispatch (Draft)](#102-creating-a-dispatch-draft)
    - [10.3 Dispatching a Trip](#103-dispatching-a-trip)
    - [10.4 Live GPS Tracking (Go Live)](#104-live-gps-tracking-go-live)
    - [10.5 Manual Location Checkpoint](#105-manual-location-checkpoint)
    - [10.6 Sharing Spare Capacity on a Route](#106-sharing-spare-capacity-on-a-route)
    - [10.7 Generating a Shipper Tracking Link](#107-generating-a-shipper-tracking-link)
    - [10.8 Completing a Trip](#108-completing-a-trip)
    - [10.9 Cancelling a Trip](#109-cancelling-a-trip)
11. [Maintenance Center](#11-maintenance-center)
    - [11.1 Viewing Maintenance Logs](#111-viewing-maintenance-logs)
    - [11.2 Scheduling a Maintenance File](#112-scheduling-a-maintenance-file)
    - [11.3 Closing a Maintenance File](#113-closing-a-maintenance-file)
12. [Fleet Transactions — Fuel & Expenses](#12-fleet-transactions--fuel--expenses)
    - [12.1 Fuel Register](#121-fuel-register)
    - [12.2 Expense Register](#122-expense-register)
13. [Fleet Analytics & Reports](#13-fleet-analytics--reports)
    - [13.1 Vehicle Allocation Chart (Pie)](#131-vehicle-allocation-chart-pie)
    - [13.2 Fuel Economy Chart (Bar)](#132-fuel-economy-chart-bar)
    - [13.3 Operating Cost Breakdown (Stacked Bar)](#133-operating-cost-breakdown-stacked-bar)
    - [13.4 ROI Ledger Table](#134-roi-ledger-table)
    - [13.5 Exporting a CSV Report](#135-exporting-a-csv-report)
14. [Shared Cargo Marketplace](#14-shared-cargo-marketplace)
    - [14.1 Searching for Shared Space](#141-searching-for-shared-space)
    - [14.2 Booking a Shared Slot](#142-booking-a-shared-slot)
15. [Public Shipment Tracker](#15-public-shipment-tracker)
    - [15.1 Accessing the Tracker](#151-accessing-the-tracker)
    - [15.2 What the Tracker Shows](#152-what-the-tracker-shows)
    - [15.3 Live GPS Updates](#153-live-gps-updates)
16. [Business Rules & Automated Gating](#16-business-rules--automated-gating)
17. [API Reference](#17-api-reference)
18. [Role-by-Role Daily Workflows](#18-role-by-role-daily-workflows)
19. [Status Glossary](#19-status-glossary)
20. [Troubleshooting & FAQ](#20-troubleshooting--faq)

---

## 1. Introduction & System Overview

**Fulmile** is a centralized, real-time fleet operations management platform built for logistics companies. It solves four critical operational challenges simultaneously:

| Challenge | Fulmile Solution |
|-----------|---------------------|
| 🗺 "Where is my cargo?" | Live GPS streaming via Socket.io + interactive Leaflet maps |
| 🚛 Empty miles / underused trucks | Shared Capacity Marketplace — publish spare truck space for co-loading |
| ⚠️ Compliance & safety risks | Automated dispatch gating — blocks expired licenses, bad safety scores, and in-shop vehicles |
| 💰 Disjointed financial tracking | Centralized analytics computing Vehicle ROI, fuel efficiency, and maintenance burn rates |

### Core Modules at a Glance

| Module | Route | Description |
|--------|-------|-------------|
| Dashboard | `/dashboard` | Real-time KPI command center |
| Vehicle Registry | `/vehicles` | Fleet registration and status management |
| Driver Registry | `/drivers` | Driver profiles, license compliance, safety scores |
| Trips & Dispatch | `/trips` | Full trip lifecycle from draft to delivery |
| Maintenance Center | `/maintenance` | Work orders and service scheduling |
| Fuel & Expenses | `/fuel-logs` | Fuel fill-up and operational expense ledger |
| Analytics & Reports | `/reports` | Charts, ROI ledger, and CSV export |
| Shared Cargo | `/shared-search` | Co-load marketplace for spare vehicle space |
| Shipper Tracker | `/track` | Public cargo tracking portal (no login required) |

---

## 2. System Requirements & Installation

### 2.1 Prerequisites

Before setting up Fulmile, ensure the following are installed on your machine:

| Software | Minimum Version | Purpose |
|----------|----------------|---------|
| **Node.js** | v18+ | Backend runtime and frontend toolchain |
| **npm** | v9+ | Package manager |
| **PostgreSQL** | v14+ | Primary relational database |

### 2.2 Database Setup

1. **Create the PostgreSQL database and user:**

```sql
-- Run as a PostgreSQL superuser (e.g., postgres)
CREATE DATABASE fulmile;
-- The default setup uses the postgres user directly.
-- Optionally create a dedicated user:
-- CREATE USER fulmile_user WITH PASSWORD 'your_password';
-- GRANT ALL PRIVILEGES ON DATABASE fulmile TO fulmile_user;
```

2. **Run the schema migration:**

```powershell
psql -U postgres -d fulmile -f database\schema.sql
```

3. **Load seed data** (optional — recommended for development/demo):

```powershell
psql -U postgres -d fulmile -f database\seed.sql
```

The seed data creates:
- 4 system roles (`fleet_manager`, `driver`, `safety_officer`, `financial_analyst`)
- 5 sample vehicles (`KA-01-VAN-05`, `KA-02-TRK-01`, etc.)
- 4 sample drivers (`Alex`, `Ravi`, `Meera`, `Suresh` — where Suresh is pre-set as `Suspended` to demonstrate gating)

### 2.3 Backend Setup

```powershell
cd backend
npm install
```

Create or verify your `.env` file in the `backend/` directory:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fulmile
DB_USER=postgres
DB_PASSWORD=your_db_password
JWT_SECRET=your_jwt_secret_key_change_in_production
JWT_EXPIRE=7d
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

Start the backend server:

```powershell
npm start
# Or for development with auto-reload:
npm run dev
```

> The API server starts on **port 5000** by default (`http://localhost:5000`).  
> You should see: `Fulmile server running on port 5000 in development mode`  
> Followed by: `Database connection has been established successfully.`

### 2.4 Frontend Setup

```powershell
cd frontend
npm install
npm start
```

> The React development server starts on **port 3000** by default (`http://localhost:3000`).

### 2.5 Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | `localhost` | PostgreSQL server hostname |
| `DB_PORT` | `5432` | PostgreSQL server port |
| `DB_NAME` | `fulmile` | Database name |
| `DB_USER` | `postgres` | Database username |
| `DB_PASSWORD` | _(set this)_ | Database password |
| `JWT_SECRET` | _(must change in prod)_ | Secret key for signing JWT auth tokens |
| `JWT_EXPIRE` | `7d` | JWT token expiry duration |
| `PORT` | `5000` | Port on which the backend API listens |
| `NODE_ENV` | `development` | Environment mode |
| `FRONTEND_URL` | `http://localhost:3000` | Allowed CORS origin for the frontend |

> **Security note:** Never commit `.env` files to version control. The `.gitignore` file is already configured to exclude them.

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React.js)                       │
│  React SPA · Redux Toolkit · Tailwind CSS                   │
│  React-Leaflet (Maps) · Recharts · Socket.io-client         │
│  Runs at: http://localhost:3000                              │
└───────────────────────┬─────────────────────────────────────┘
                        │  HTTP REST API  +  WebSocket (Socket.io)
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (Node.js / Express)               │
│  Express.js · Socket.io · JWT Auth · Sequelize ORM          │
│  Helmet (security) · Morgan (logging)                        │
│  Runs at: http://localhost:5000                              │
│                                                              │
│  API Routes:                                                 │
│  /api/auth          → Registration & login                   │
│  /api/vehicles      → Vehicle CRUD + shared bookings        │
│  /api/drivers       → Driver CRUD                            │
│  /api/trips         → Trip lifecycle management             │
│  /api/maintenance   → Maintenance work orders               │
│  /api/fuel-logs     → Fuel fill-up logs                     │
│  /api/expenses      → Vehicle expense logs                   │
│  /api/reports       → Analytics & ROI data                   │
│  /api/tracking      → GPS checkpoints                        │
└───────────────────────┬─────────────────────────────────────┘
                        │  Sequelize ORM
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    DATABASE (PostgreSQL)                      │
│  Tables: roles · users · vehicles · drivers · routes        │
│          trips · maintenance_logs · fuel_logs · expenses     │
│          tracking                                            │
│  View: vehicle_operational_costs (aggregate cost view)       │
│  Runs at: localhost:5432                                     │
└─────────────────────────────────────────────────────────────┘
```

### Real-Time Architecture (Socket.io)

```
Driver Browser                     Backend Socket.io              Shipper Browser
      │                                    │                              │
      │──── emit('driverLocation') ───────►│                              │
      │     { trip_id, lat, lng, ... }     │──── emit('trackingUpdated') ►│
      │                                    │     to room: trip_id         │
      │                                    │                              │
      │◄─── emit('trackingUpdated') ───────│◄──── emit('join', trip_id) ──│
      │     (reflected to driver too)      │                              │
```

No GPS coordinates are written to the database during live streaming — they are relayed in memory via Socket.io rooms for zero-latency delivery.

---

## 4. User Roles & Access Control

Fulmile uses **role-based access control (RBAC)**. Your role is assigned during registration and cannot be changed without administrator access to the database.

| Role | Internal Value | Access Level |
|------|---------------|--------------|
| **Fleet Manager** | `fleet_manager` | Full operational access to all modules |
| **Driver** | `driver` | Trip execution, fuel logs, shared cargo |
| **Safety Officer** | `safety_officer` | Driver compliance, license monitoring |
| **Financial Analyst** | `financial_analyst` | Reports, expenses, fuel logs |

### Page Access Matrix

| Page / Route | Fleet Manager | Driver | Safety Officer | Financial Analyst |
|-------------|:-------------:|:------:|:--------------:|:-----------------:|
| Dashboard `/dashboard` | ✅ | ✅ | ✅ | ✅ |
| Vehicles `/vehicles` | ✅ | ❌ | ❌ | ❌ |
| Drivers `/drivers` | ✅ | ❌ | ✅ | ❌ |
| Trips `/trips` | ✅ | ✅ | ❌ | ❌ |
| Maintenance `/maintenance` | ✅ | ❌ | ❌ | ❌ |
| Fuel & Expenses `/fuel-logs` | ✅ | ✅ | ❌ | ✅ |
| Reports `/reports` | ✅ | ❌ | ❌ | ✅ |
| Shared Cargo `/shared-search` | ✅ | ✅ | ✅ | ✅ |
| Shipper Tracker `/track` | ✅ (public) | ✅ (public) | ✅ (public) | ✅ (public) |

> **Note:** The `/track` route is **fully public** — clients and external stakeholders can view live shipment tracking without any account.

---

## 5. Getting Started — Registration & Login

### 5.1 Registering an Account

1. Open your browser and navigate to `http://localhost:3000`.
2. Click **Register** in the top-right corner of the navigation bar, or go to `/register`.
3. Complete the registration form:

| Field | Required | Notes |
|-------|----------|-------|
| **Select Role** | ✅ | Choose from: Fleet Manager, Driver, Safety Officer, Financial Analyst |
| **Full Name** | ✅ | Your display name shown in the navbar |
| **Email Address** | ✅ | Must be unique across all users |
| **Phone Number** | ❌ | Optional contact number |
| **Password** | ✅ | Minimum 6 characters |
| **Confirm Password** | ✅ | Must exactly match the Password field |

4. Click **Register**.
5. On success: You are redirected to the **Login** page with a green success toast notification.

> **Common error — "Registration failed":** The email address is already registered, or the passwords do not match. Check the Confirm Password field carefully.

---

### 5.2 Logging In

1. Navigate to `/login`.
2. Enter your registered **Email Address** and **Password**.
3. Click **Sign In**.
4. On success: You are redirected to the **Dashboard** and a toast message shows: `Welcome back, [Your Name]!`

Your session is stored as a JWT token in the browser's `localStorage`. It remains valid for **7 days** before requiring re-login.

---

### 5.3 Logging Out

Click **Logout** in the top-right corner of the navigation bar. This:
- Clears the JWT token from `localStorage`
- Clears the Redux store
- Redirects you to the `/login` page

---

## 6. Navigation Bar

The dark navigation bar is permanently visible at the top of every page once you are logged in.

```
[ 🚛 Fulmile ] [ Dashboard ] [ Vehicles ] [ Drivers ] [ Maintenance ] [ Reports ] [ Track Cargo ] [ Find Shared Cargo ]  |  [ Role ]  [ Name ]  [ Logout ]
```

| Link | Visible To | Destination |
|------|-----------|-------------|
| **🚛 Fulmile** (logo) | Everyone | `/dashboard` |
| **Dashboard** | Everyone | `/dashboard` |
| **Vehicles** | Fleet Manager | `/vehicles` |
| **Drivers** | Fleet Manager, Safety Officer | `/drivers` |
| **Trips** / **My Trips** | Fleet Manager, Driver | `/trips` |
| **Maintenance** | Fleet Manager | `/maintenance` |
| **Fuel Logs / Expenses** | Fleet Manager, Driver, Financial Analyst | `/fuel-logs` |
| **Reports** | Fleet Manager, Financial Analyst | `/reports` |
| **Track Cargo** | Everyone | `/track` |
| **Find Shared Cargo** | Everyone | `/shared-search` |
| **Logout** | Everyone | Clears session → `/login` |

The **Role** badge and **Name** displayed in the top-right corner confirm your currently authenticated identity and access level.

---

## 7. Dashboard — Operations Command Center

**Route:** `/dashboard` · **Access:** All roles

The Dashboard is your real-time command center. It auto-updates via WebSocket whenever any vehicle, driver, or trip state changes anywhere in the system — **no page refresh required**.

### 7.1 KPI Cards

Four KPI (Key Performance Indicator) cards display at the top of the Dashboard:

| Card | What It Shows | Formula |
|------|--------------|---------|
| **Available Vehicles** | `X / Total` ready to dispatch | Count of vehicles with status = `Available` |
| **Active Dispatches** | Trips currently on the road | Count of trips with status = `Dispatched` |
| **Fleet Utilization %** | Percentage of fleet in use | `(On Trip vehicles / Total non-Retired vehicles) × 100` |
| **Vehicles In Shop** | Under maintenance right now | Count of vehicles with status = `In Shop` |

### 7.2 Operations Overview Panel

A summary table beneath the KPI cards shows four operational counts:

- **Vehicles on the road** — `On Trip` vehicle count
- **Drivers currently on duty** — `On Trip` driver count
- **Pending dispatches (Drafts)** — trips in `Draft` status, not yet dispatched
- **Completed Deliveries** — total historical `Completed` trips

### 7.3 Role-Specific Quick Actions

Below the overview panel, a quick-action card appears based on your role:

| Role | Quick Action |
|------|-------------|
| Fleet Manager | **Manage Fleet Registry** (→ `/vehicles`) · **Schedule Maintenance** (→ `/maintenance`) |
| Driver | **View Trip List** (→ `/trips`) |
| Safety Officer | **Driver Licenses & Star Scores** (→ `/drivers`) |
| Financial Analyst | **Financial Reports & ROI** (→ `/reports`) |

### 7.4 Real-Time WebSocket Connection

A green **● Real-Time Connected** badge in the Dashboard header confirms your live WebSocket connection is active. When the backend pushes any state change, the KPI cards update automatically within milliseconds.

---

## 8. Vehicle Registry

**Route:** `/vehicles` · **Access:** Fleet Manager only

### 8.1 Viewing the Fleet

All registered vehicles appear as cards in a responsive grid. Each card displays:

| Field | Description |
|-------|-------------|
| **Registration Number** | Unique plate number (e.g., `TN01AB1234`) |
| **Model Name** | Make and model (e.g., `Tata Ace Gold`) |
| **Status Badge** | Color-coded: Available (green), On Trip (blue), In Shop (amber), Retired (red) |
| **Odometer** | Current km reading |
| **Acquisition Cost** | Purchase price in Indian Rupees (Rs.) |
| **Operating Region** | City or region the vehicle is based in |
| **Payload Capacity** | Maximum cargo load in KG |

### 8.2 Adding a New Vehicle

1. Click **Add Vehicle** (top-right of the page).
2. A modal form appears. Fill in all required fields:

| Field | Required | Description | Example |
|-------|----------|-------------|---------|
| **Registration Number** | ✅ | Unique government plate number | `TN01AB1234` |
| **Model Name** | ✅ | Vehicle make and model | `Tata Ace Gold` |
| **Vehicle Type** | ✅ | Select from the dropdown | `mini_truck` |
| **Payload Capacity (KG)** | ✅ | Maximum cargo weight this vehicle can carry | `750` |
| **Initial Odometer (KM)** | ✅ | Odometer reading at the time of registration | `42500` |
| **Acquisition Cost (INR)** | ✅ | Purchase price of the vehicle | `650000` |
| **Operating Region** | ❌ | City or geographic region | `Chennai` |

3. Click **Save Asset**. The new vehicle card appears immediately with status `Available`.

**Vehicle Type Options & Typical Capacity Ranges:**

| Type Value | Display Name | Typical Capacity |
|-----------|-------------|-----------------|
| `bike` | Bike | Up to ~150 kg |
| `van` | Van | 500 – 2,000 kg |
| `mini_truck` | Mini Truck | 600 – 1,500 kg |
| `truck` | Truck | 4,000 – 16,000 kg |
| `container_truck` | Container Truck | 20,000+ kg |

### 8.3 Removing a Vehicle

1. Click the **trash icon** on a vehicle card.
2. Confirm the browser prompt: *"Are you sure you want to remove this vehicle?"*
3. The vehicle is permanently deleted from the database.

> **Warning:** Vehicles that are currently `On Trip` or have open maintenance files cannot be safely deleted. Complete or cancel those records first.

### 8.4 Vehicle Status Lifecycle

```
   [Available] ──────────── Dispatch Trip ──────────────► [On Trip]
       ▲                                                      │
       │                                            Complete / Cancel Trip
       │                                                      │
       └──────────── Close Maintenance File ─────── [In Shop] ◄── Schedule Maintenance
                                                              
   [Retired] ← Manual status update (admin action)
```

| Status | Color | Meaning |
|--------|-------|---------|
| `Available` | 🟢 Green | In depot, ready to be dispatched |
| `On Trip` | 🔵 Blue | Currently on an active dispatched trip |
| `In Shop` | 🟡 Amber | Under maintenance, excluded from dispatch |
| `Retired` | 🔴 Red | Decommissioned; kept for records only |

---

## 9. Driver Registry

**Route:** `/drivers` · **Access:** Fleet Manager, Safety Officer

### 9.1 Viewing Drivers

All registered drivers appear as cards. Each card shows:

| Field | Description |
|-------|-------------|
| **Driver Name** | Full name |
| **License Category** | Type of license (e.g., `HMV Category`) |
| **Status Badge** | Available, On Trip, Off Duty, or Suspended |
| **License Number** | Government-issued license ID |
| **License Expiry Date** | Color-coded warning system (see §9.4) |
| **Phone Contact** | Driver's mobile number |
| **Safety Score** | Rating out of 10.0 (shown with a star icon) |

### 9.2 Adding a New Driver

1. Click **Add Driver** (top-right).
2. Fill in the registration form:

| Field | Required | Description | Example |
|-------|----------|-------------|---------|
| **Driver Name** | ✅ | Full legal name | `Ravi Kumar` |
| **License Number** | ✅ | Unique government-issued number | `TN-0120230012345` |
| **License Category** | ✅ | Type of license held | `HMV` |
| **License Expiration** | ✅ | Validity end date | `2027-03-15` |
| **Contact Number** | ✅ | Driver's mobile number | `+91-9001234567` |
| **Safety Rating (0–10)** | ✅ | Initial safety score (decimals allowed) | `8.5` |

3. Click **Register Driver**.

**License Category Reference:**

| Category | Meaning |
|---------|---------|
| `LMV` | Light Motor Vehicle — cars, small vans |
| `HMV` | Heavy Motor Vehicle — large trucks, buses |
| `HPMV` | Heavy Passenger Motor Vehicle / container trucks |
| `MCWG` | Motorcycle With Gear |

### 9.3 Removing a Driver

Click the **trash icon** on a driver card and confirm. Drivers assigned to an active `Dispatched` trip cannot be removed until that trip is completed or cancelled.

### 9.4 License Expiry Monitoring

The Driver Registry automatically displays expiry status on each card:

| Badge Color | Condition | Action Required |
|------------|-----------|----------------|
| 🔴 Red — **"Expired"** | License date is in the past | Driver must NOT be dispatched. Renew immediately. |
| 🟡 Amber — **"Expires in X days"** | Expiry is within 30 days | Schedule renewal urgently. |
| _(no badge)_ | License is valid and not near expiry | No action needed. |

> Drivers with expired licenses are **automatically excluded** from the dispatch dropdown — the gating is enforced server-side.

---

## 10. Dispatch & Trips — The Trip Lifecycle

**Route:** `/trips` · **Access:** Fleet Manager (full), Driver (read + tracking)

### 10.1 Trip Lifecycle State Machine

```
                    ┌─────────────────────────────────────┐
                    │                                     │
         Create     ▼          Dispatch                   │ Cancel
  ────────────► [DRAFT] ──────────────────► [DISPATCHED] ─┤
                                                │         │
                                                │         └──► [CANCELLED]
                                                │ Complete
                                                ▼
                                          [COMPLETED]
```

| Transition | Trigger | Automatic Side Effects |
|-----------|---------|----------------------|
| `Draft` → `Dispatched` | Click **Dispatch** button | Vehicle status → `On Trip` · Driver status → `On Trip` · Sets `dispatched_at` timestamp |
| `Dispatched` → `Completed` | Click **Complete** (fill odometer & fuel) | Vehicle status → `Available` · Driver status → `Available` · Updates vehicle odometer · Creates fuel log entry |
| `Draft/Dispatched` → `Cancelled` | Click **Cancel** | Vehicle status → `Available` · Driver status → `Available` |

---

### 10.2 Creating a Dispatch (Draft)

1. Click **Create Dispatch** (top-right of Trips page).
2. Fill in the **Create Dispatch Trip** modal:

| Field | Required | Description | Example |
|-------|----------|-------------|---------|
| **Source Depot** | ✅ | Origin warehouse or pickup location | `Chennai Central WH` |
| **Destination** | ✅ | Delivery destination | `Bengaluru Hub` |
| **Select Driver** | ✅ | Dropdown shows only `Available` drivers | `Ravi Kumar (Score: 8.5)` |
| **Select Vehicle** | ✅ | Dropdown shows only `Available` vehicles | `TN01AB1234 (Capacity: 750 kg)` |
| **Planned Distance (KM)** | ✅ | Estimated route distance | `348` |
| **Cargo Payload Weight (KG)** | ✅ | Weight of cargo to be loaded | `600` |

3. The **Payload Gauge** bar appears automatically once you select a vehicle and enter a cargo weight. It visually fills to show how much of the vehicle's capacity is used.

4. The **Schedule Draft** button is **disabled** (and shows an error) if the cargo weight exceeds the selected vehicle's maximum load capacity.

5. Click **Schedule Draft**. The trip card appears with a 🟡 `Draft` status badge.

> **Dropdown filtering:** Only `Available` drivers and vehicles appear. The system server-side filters out `On Trip`, `Off Duty`, `Suspended` drivers and `On Trip`, `In Shop`, `Retired` vehicles.

---

### 10.3 Dispatching a Trip

1. Locate a trip card with status **Draft**.
2. Click the **Dispatch** button (play icon).
3. Confirm if prompted.
4. The system automatically performs the transition (see §10.1).

---

### 10.4 Live GPS Tracking (Go Live)

For any `Dispatched` trip, drivers can stream their real-time GPS position continuously.

1. On a `Dispatched` trip card, click **Go Live** (broadcast tower icon).
2. The browser displays a location permission prompt — click **Allow**.
3. Once allowed, the system:
   - Reads your device's GPS coordinates continuously using `navigator.geolocation.watchPosition`
   - Reverse-geocodes each position to a city name using OpenStreetMap's Nominatim API
   - Streams each update via **Socket.io** to all browsers watching this trip's tracking page
4. The button changes to **Stop Live** (pulsing red indicator) to show active streaming.
5. Click **Stop Live** to end the GPS session.

> **One stream at a time:** If you try to go live on a second trip while already streaming, the app will prompt you to stop the first stream before starting a new one.

> **No database writes:** Live GPS updates are relayed in memory via Socket.io — they are not stored in the database. Only manually pinned checkpoints (§10.5) are persisted.

---

### 10.5 Manual Location Checkpoint

If continuous GPS streaming is not practical (intermittent connectivity, driver breaks), drivers can manually pin a checkpoint.

1. On a `Dispatched` trip, click **Pin Location** (map pin icon).
2. The app automatically attempts to fetch your current GPS coordinates.
   - **GPS Acquired:** Latitude, longitude, and city name are pre-filled automatically.
   - **GPS Unavailable:** Fields are empty — fill them in manually.
3. Complete the checkpoint form:

| Field | Description | Example |
|-------|-------------|---------|
| **Location / Checkpoint Name** | Descriptive location name | `Hosur Toll Plaza` |
| **Latitude** | GPS latitude (auto-filled if GPS available) | `12.7409` |
| **Longitude** | GPS longitude (auto-filled if GPS available) | `77.8253` |
| **Status** | Current shipment state | `in_transit` |
| **Notes** | Optional context | `Traffic jam near NH44, delayed 45 min` |

**Checkpoint Status Options:**

| Value | Meaning |
|-------|---------|
| `in_transit` | Vehicle is moving toward destination |
| `loading` | Cargo is being loaded onto the vehicle |
| `unloading` | Cargo is being unloaded at destination |
| `arrived` | Vehicle has arrived at destination |
| `delayed` | Vehicle is experiencing a delay |

4. Click **Save Checkpoint**. The checkpoint is:
   - Written to the `tracking` table in the database (persisted)
   - Broadcast via Socket.io to all browsers watching this trip's tracking page in real-time

---

### 10.6 Sharing Spare Capacity on a Route

If a dispatched vehicle has unused cargo space, publish it to the **Shared Cargo Marketplace** so other shippers can book co-load space.

1. On a `Dispatched` trip, click **Share Capacity** (share icon).
2. Fill in the **Share Vehicle Capacity** modal:

| Field | Required | Description | Example |
|-------|----------|-------------|---------|
| **Route Source** | ✅ | Starting point of the shareable route | `Mumbai Port` |
| **Route Destination** | ✅ | End point of the shareable route | `Pune Depot` |
| **Intermediate Stops** | ❌ | Comma-separated list of stops en route | `Nashik, Shirdi` |
| **Departure Time** | ❌ | Scheduled departure date and time | `2026-07-25 08:00` |
| **Estimated Arrival** | ❌ | Estimated arrival date and time | `2026-07-25 14:00` |
| **Price per KG (Rs.)** | ✅ | Your rate charged per kilogram of shared cargo | `5.50` |

3. Click **Publish Route**. The route is now visible in the **Find Shared Cargo** portal (§14).

---

### 10.7 Generating a Shipper Tracking Link

Share a direct, public tracking URL with your client — no login required for the client.

1. On a `Dispatched` trip, click **Open Tracker** (external link icon).
2. The app:
   - **Automatically copies** the tracking URL to your clipboard (e.g., `http://localhost:3000/track/abc123...`)
   - Opens the Shipper Tracking page in a **new browser tab**
3. Share the copied URL with your client via WhatsApp, email, or SMS.

You can also copy the **Trip ID** (the short hash shown under the trip title) by clicking on it directly — useful for referencing in client communications.

---

### 10.8 Completing a Trip

When cargo has been delivered, complete the trip to update vehicle records and log fuel consumption.

1. On a `Dispatched` trip, click **Complete** (checkmark icon).
2. Fill in the **Complete Trip Delivery** modal:

| Field | Required | Description | Example |
|-------|----------|-------------|---------|
| **Final Odometer Reading (KM)** | ✅ | Odometer at end of trip. Auto-suggested as `start odometer + planned distance`. | `42848` |
| **Fuel Consumed (Liters)** | ✅ | Actual fuel used during the entire trip | `42.5` |

3. Click **Complete & Release**. The system automatically:
   - Sets trip status to `Completed`
   - Updates the vehicle's odometer to the final reading
   - Creates a fuel log entry linked to this trip
   - Restores the vehicle status to `Available`
   - Restores the driver status to `Available`

---

### 10.9 Cancelling a Trip

1. On a `Draft` or `Dispatched` trip, click **Cancel** (ban icon).
2. Confirm the browser prompt: *"Cancel this trip?"*
3. The trip status changes to `Cancelled`, and the vehicle and driver are restored to `Available`.

---

## 11. Maintenance Center

**Route:** `/maintenance` · **Access:** Fleet Manager only

When a vehicle is sent for maintenance, it is automatically set to `In Shop` and removed from the dispatch pool.

### 11.1 Viewing Maintenance Logs

All service files appear as rows in a table, showing:

| Column | Description |
|--------|-------------|
| Vehicle | Registration number + model name |
| Status | `open` (in progress) or `closed` (complete) |
| Service Type | `Preventive` or `Corrective` |
| Description | Diagnostic notes and work to be done |
| Scheduled Date | The date the service was scheduled |
| Completed Date | The date the service was finished (empty if still open) |
| Maintenance Cost | Final or estimated cost in Rs. |

### 11.2 Scheduling a Maintenance File

1. Click **Schedule Maintenance** (top-right).
2. Fill in the form:

| Field | Required | Description | Example |
|-------|----------|-------------|---------|
| **Select Vehicle** | ✅ | Dropdown shows `Available` and `In Shop` vehicles | `TN01AB1234 (Tata Ace Gold — Available)` |
| **Service Type** | ✅ | `Preventive` (routine) or `Corrective` (repair) | `Preventive` |
| **Schedule Date** | ✅ | Date for the service appointment | `2026-07-25` |
| **Estimated Cost (INR)** | ❌ | Initial cost estimate | `12000` |
| **Description / Diagnoses** | ✅ | Describe what needs to be done | `Full service — oil change, filters, brake pads` |

3. Click **Schedule Service**. The vehicle status automatically changes to **In Shop**.

**Service Type Guide:**

| Type | When to Use |
|------|-------------|
| **Preventive** | Scheduled, routine service: oil change, tyre rotation, filter replacement, annual inspection |
| **Corrective** | Unplanned repair due to breakdown or damage: engine repair, transmission overhaul, accident repair |

### 11.3 Closing a Maintenance File

When service is complete and the vehicle is ready to return to the fleet:

1. Find the open maintenance log (`open` status badge).
2. Click **Close File**.
3. A browser prompt appears: *"Enter final maintenance cost (INR):"* — enter the actual final cost.
4. Click **OK**. The system:
   - Marks the maintenance log as `closed`
   - Sets `completed_date` to today's date
   - Records the final cost
   - Restores the vehicle status to **Available**

---

## 12. Fleet Transactions — Fuel & Expenses

**Route:** `/fuel-logs` · **Access:** Fleet Manager, Driver, Financial Analyst

This page has two tabs: **Fuel Register** and **Expense Register**.

### 12.1 Fuel Register

**Purpose:** Log every fuel fill-up for any vehicle in the fleet.

The page is split into:
- **Left panel** — Log Transaction form
- **Right panel** — Transaction Register ledger (all logged entries in a table)

**To add a fuel log:**

1. Ensure the **Fuel Register** tab is active.
2. Fill in the form:

| Field | Required | Description | Example |
|-------|----------|-------------|---------|
| **Select Vehicle** | ✅ | Any vehicle in the fleet | `TN01AB1234 (Tata Ace Gold)` |
| **Link Trip (Optional)** | ❌ | Associate this fill-up with a specific trip | `Chennai Central WH → Bengaluru Hub` |
| **Liters Filled** | ✅ | Number of litres fueled | `42.50` |
| **Receipt Cost (Rs.)** | ✅ | Total amount on the fuel receipt | `3867.50` |
| **Transaction Date** | ✅ | Date of fill-up (defaults to today) | `2026-07-10` |

3. Click **Save Log**. The entry appears immediately in the right-side ledger.

> **Auto-created logs:** When you complete a trip (§10.8), a fuel log is automatically created using the fuel consumed value you entered. You do not need to manually re-log that entry.

**Ledger Columns:** Vehicle · Liters · Cost · Date

---

### 12.2 Expense Register

**Purpose:** Log additional vehicle operating expenses beyond fuel (tolls, miscellaneous costs).

1. Switch to the **Expense Register** tab.
2. Fill in the form:

| Field | Required | Description | Example |
|-------|----------|-------------|---------|
| **Select Vehicle** | ✅ | Vehicle that incurred the expense | `WB08OP9012` |
| **Expense Type** | ✅ | Category of the expense | `Tolls` |
| **Amount (Rs.)** | ✅ | Cost in Indian Rupees | `2400` |
| **Date** | ✅ | Date of the expense (defaults to today) | `2026-07-08` |
| **Description / Memo** | ❌ | Notes about the expense | `Kolkata–Patna NH19 tolls` |

**Expense Type Options:**

| Value | Use Case |
|-------|---------|
| `tolls` | Highway or bridge toll charges |
| `maintenance` | Ad-hoc repair costs not captured in a maintenance file |
| `other` | Any other operational expense |

3. Click **Record Expense**. It appears in the right-side ledger.

**Expense Ledger Columns:** Vehicle · Type · Description · Amount · Date

---

## 13. Fleet Analytics & Reports

**Route:** `/reports` · **Access:** Fleet Manager, Financial Analyst

### 13.1 Vehicle Allocation Chart (Pie)

A donut/pie chart shows the percentage split of your entire fleet across all four status categories:

| Color | Status |
|-------|--------|
| 🟢 Green | Available |
| 🔵 Blue | On Trip |
| 🟡 Amber | In Shop |
| 🔴 Red | Retired |

Use this to understand at a glance what proportion of your fleet is productive vs. idle vs. grounded.

### 13.2 Fuel Economy Chart (Bar)

A bar chart showing **Kilometers per Litre (KPL)** for each vehicle that has completed trips with fuel data.

- **Formula:** `Total Distance Traveled (km) / Total Fuel Consumed (Liters)`
- Higher bars = better fuel economy
- Identifies fuel-inefficient vehicles that may need servicing or replacement

### 13.3 Operating Cost Breakdown (Stacked Bar)

For each vehicle, a stacked bar chart shows the cumulative breakdown of operating costs:

| Bar Segment | Color | Source |
|------------|-------|--------|
| Fuel Cost | 🔵 Blue | Sum of all fuel log costs for this vehicle |
| Maintenance Cost | 🟡 Amber | Sum of all **closed** maintenance file costs |

This chart is powered by the `vehicle_operational_costs` database view, which aggregates costs in real time.

**Use case:** Identify which vehicles are the most expensive to operate and flag candidates for retirement or replacement.

### 13.4 ROI Ledger Table

Below the charts, a detailed table provides **Return on Investment analysis** for every vehicle in the fleet:

| Column | Description |
|--------|-------------|
| **Vehicle** | Registration number + model name |
| **Acquisition Cost** | Original purchase price (Rs.) |
| **Total Operational Cost** | Total fuel cost + total maintenance cost |
| **Asset Value Ratio** | `(Operational Cost / Acquisition Cost) × 100%` |

**Ratio Badge Color:**

| Color | Threshold | Interpretation |
|-------|-----------|---------------|
| 🟢 Green | Below 50% | Healthy — vehicle is cost-effective relative to its purchase price |
| 🔴 Red | 50% or above | Review needed — vehicle may be approaching end-of-life or needs attention |

### 13.5 Exporting a CSV Report

Click **Export CSV Report** to download a full operational cost report as a `.csv` spreadsheet.

The exported file contains: vehicle details, acquisition cost, fuel cost, maintenance cost, total operational cost, and asset value ratio — ready for import into Excel, Google Sheets, or an accounting system.

---

## 14. Shared Cargo Marketplace

**Route:** `/shared-search` · **Access:** All authenticated users

The Shared Cargo Marketplace allows shippers to find vehicles with published spare capacity and book co-load space. This directly addresses the **empty miles / underutilized fleet** problem.

### 14.1 Searching for Shared Space

1. Fill in the **Search Shared Vehicles** form:

| Field | Required | Description | Example |
|-------|----------|-------------|---------|
| **Pickup Location** | ✅ | Where the cargo needs to be picked up | `Mumbai Port` |
| **Destination** | ✅ | Where it needs to be delivered | `Pune Depot` |
| **Cargo Weight (KG)** | ✅ | How many kg need to be shipped | `500` |

2. Click **Search**.
3. Result cards appear, each showing:
   - Vehicle info (registration, model, type)
   - Route (source → destination, with stops)
   - Departure time and estimated arrival
   - Available remaining capacity (KG)
   - Price per KG (Rs.)
   - Pre-calculated total quote for your cargo weight

### 14.2 Booking a Shared Slot

1. Click **Book Space** on a result card.
2. A booking modal appears with vehicle info and a pre-calculated price quote.
3. Enter the **Planned Distance (KM)** for your portion of the route.
4. Review the **Price Quote (Rs.)** — auto-calculated as `cargo weight × price_per_kg`.
5. Click **Book Slot**.

A new trip record is created and linked to the shared route. The fleet manager sees the new booking appear automatically in the Trips page.

---

## 15. Public Shipment Tracker

**Route:** `/track` or `/track/:tripId` · **Access:** Anyone (no login required)

This is the **customer-facing tracking portal**. Share the tracking URL with clients so they can follow their cargo in real time without needing a Fulmile account.

### 15.1 Accessing the Tracker

**Option A — Direct URL (recommended for clients):**
The fleet manager uses the **Open Tracker** button (§10.7), which generates a URL like:
```
http://localhost:3000/track/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```
The client opens this URL directly and the trip is loaded automatically.

**Option B — Manual lookup:**
1. Navigate to `/track`.
2. Enter the **Trip ID** in the search box.
3. Click **Track Shipment** (or press Enter).

The Trip ID is visible on the trip card in `/trips` — click the short hash to copy it.

### 15.2 What the Tracker Shows

**Trip Summary Card:**

| Field | Description |
|-------|-------------|
| Route | Source → Destination |
| Driver Name | Name of the assigned driver |
| Vehicle Registration | Plate number of the vehicle |
| Cargo Weight | In KG |
| Trip Status | Current lifecycle status badge |
| Dispatched At | Timestamp when trip was dispatched |
| Completed At | Timestamp when trip was completed (if applicable) |

**Interactive Map (Leaflet / OpenStreetMap):**
- A 🚛 truck icon marks the current/latest known GPS position
- A blue polyline traces the route path through all past checkpoints
- The map auto-zooms and centers on the truck's current position

**Location Timeline:**
- All manually pinned checkpoints in chronological order (oldest at bottom, newest at top)
- Each checkpoint shows: location name, status, latitude/longitude, notes, and timestamp

### 15.3 Live GPS Updates

When the driver has activated **Go Live** mode (§10.4):
- A pulsing red **● Live** badge appears on the tracking page
- The truck icon on the map moves in real time as the driver's position updates
- The map automatically re-centers to follow the truck
- Each live ping shows speed information if available from the device

When the driver stops the live stream, the Live badge disappears and the last known position is retained.

---

## 16. Business Rules & Automated Gating

Fulmile enforces the following business rules automatically — no manual checking is required.

| Rule | What It Prevents | Where It's Enforced |
|------|-----------------|---------------------|
| **Dispatch Gating — Vehicle** | Vehicles with status `Retired` or `In Shop` cannot be selected for a new trip | Server-side + Client-side dropdown filter |
| **Dispatch Gating — Driver** | Drivers with expired licenses or `Suspended` status cannot be assigned to trips | Server-side + Client-side dropdown filter |
| **Double Assignment** | Drivers or vehicles currently `On Trip` cannot be assigned to another trip | Server-side + Client-side dropdown filter |
| **Payload Capacity** | Cargo weight must not exceed the selected vehicle's `max_load_capacity_kg` | Client-side (payload gauge) + Server-side validation |
| **Trip → Dispatched** | Automatically sets vehicle and driver status to `On Trip` | Server-side (trip controller) |
| **Trip → Completed** | Automatically restores vehicle and driver to `Available`; updates odometer | Server-side (trip controller) |
| **Trip → Cancelled** | Automatically restores vehicle and driver to `Available` | Server-side (trip controller) |
| **Maintenance → Open** | Creating an open maintenance log sets vehicle status to `In Shop` | Server-side (maintenance controller) |
| **Maintenance → Closed** | Closing a maintenance file restores vehicle status to `Available` | Server-side (maintenance controller) |

---

## 17. API Reference

All API endpoints are prefixed with `/api/` and require a valid JWT Bearer token in the `Authorization` header, except where noted.

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|:------------:|
| `POST` | `/api/auth/register` | Register a new user account | ❌ |
| `POST` | `/api/auth/login` | Login and receive a JWT token | ❌ |

### Vehicles

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| `GET` | `/api/vehicles` | Get all vehicles | All |
| `GET` | `/api/vehicles/eligible-for-dispatch` | Get vehicles available for dispatch | All |
| `GET` | `/api/vehicles/:id` | Get a single vehicle by ID | All |
| `POST` | `/api/vehicles` | Create a new vehicle | Fleet Manager |
| `PUT` | `/api/vehicles/:id` | Update a vehicle | Fleet Manager |
| `DELETE` | `/api/vehicles/:id` | Delete a vehicle | Fleet Manager |
| `GET` | `/api/vehicles/search` | Search for shared capacity | All |
| `POST` | `/api/vehicles/shared-booking` | Book shared space | All |
| `POST` | `/api/vehicles/:id/publish-route` | Publish a spare capacity route | Fleet Manager, Driver |
| `GET` | `/api/vehicles/:id/routes` | Get all routes for a vehicle | All |

### Drivers

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| `GET` | `/api/drivers` | Get all drivers | All |
| `POST` | `/api/drivers` | Create a new driver | Fleet Manager |
| `DELETE` | `/api/drivers/:id` | Delete a driver | Fleet Manager |

### Trips

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| `GET` | `/api/trips` | Get all trips | Fleet Manager, Driver |
| `POST` | `/api/trips` | Create a new trip (Draft) | Fleet Manager |
| `PUT` | `/api/trips/:id/dispatch` | Dispatch a trip | Fleet Manager |
| `PUT` | `/api/trips/:id/complete` | Complete a trip | Fleet Manager, Driver |
| `PUT` | `/api/trips/:id/cancel` | Cancel a trip | Fleet Manager, Driver |

### Maintenance

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| `GET` | `/api/maintenance` | Get all maintenance logs | Fleet Manager |
| `POST` | `/api/maintenance` | Create a maintenance file | Fleet Manager |
| `PUT` | `/api/maintenance/:id/close` | Close a maintenance file | Fleet Manager |
| `DELETE` | `/api/maintenance/:id` | Delete a maintenance log | Fleet Manager |

### Fuel Logs

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| `GET` | `/api/fuel-logs` | Get all fuel logs | Fleet Manager, Driver, Financial Analyst |
| `POST` | `/api/fuel-logs` | Create a fuel log entry | Fleet Manager, Driver, Financial Analyst |

### Expenses

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| `GET` | `/api/expenses` | Get all expenses | Fleet Manager, Driver, Financial Analyst |
| `POST` | `/api/expenses` | Create an expense entry | Fleet Manager, Driver, Financial Analyst |

### Reports

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| `GET` | `/api/reports` | Get fleet analytics data | Fleet Manager, Financial Analyst |

### Tracking

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|:------------:|
| `GET` | `/api/tracking/:tripId` | Get all checkpoints for a trip | ❌ (Public) |
| `POST` | `/api/tracking` | Save a manual GPS checkpoint | ✅ |

### Authentication Header Format

```http
Authorization: Bearer <your_jwt_token>
```

---

## 18. Role-by-Role Daily Workflows

### Fleet Manager — Daily Workflow

```
Morning Briefing (5–10 min):
1. Open Dashboard → check KPI cards for overnight changes
2. Note any new "Vehicles In Shop" count → go to Maintenance Center
3. Close any maintenance files for vehicles that are repaired → click "Close File"

Mid-Morning Operations:
4. Go to Trips → review Draft trips
5. Dispatch any ready trips → click "Dispatch" on Draft trip cards
6. Create new dispatch orders as needed → click "Create Dispatch"
7. Check Driver Registry for any license expiry warnings

During the Day:
8. Monitor active trips via the Tracker → click "Open Tracker" on Dispatched trips
9. Log any incoming fuel receipts → Fuel & Expenses → Fuel Register
10. Log toll or other expense receipts → Expense Register tab

End of Day / Weekly:
11. Go to Reports → review ROI ledger for red-badge vehicles
12. Check Fuel Economy chart for efficiency outliers
13. Export CSV report for the accounts team
```

### Driver — Daily Workflow

```
Start of Shift:
1. Login → open Dashboard → check your trip summary
2. Go to My Trips (→ /trips) → find your Dispatched trip

On the Road:
3. Click "Go Live" → allow location permission → begin streaming
4. At rest stops or checkpoints → click "Pin Location" → save a checkpoint
5. Use "Share Capacity" if your truck has spare space for co-loading

On Arrival:
6. Click "Complete" on your trip → enter final odometer + fuel used
7. If you filled up fuel separately → go to Fuel Logs → log the fill-up
```

### Safety Officer — Daily Workflow

```
Daily Check:
1. Open Dashboard → note active driver count
2. Go to Drivers → scan for:
   - Red "Expired" badges → escalate immediately, ensure driver is not dispatched
   - Amber "Expires in X days" badges → contact driver, schedule renewal
3. Review safety scores → flag any driver with score below 6.0 for review
4. Document and report compliance issues to fleet management
```

### Financial Analyst — Daily Workflow

```
Daily Review:
1. Open Dashboard → check fleet utilization % (target: >70% for healthy operations)
2. Go to Reports → review ROI ledger
   - Red badges (>50% ratio) → flag vehicles for management review
3. Check Fuel Economy chart → identify inefficient vehicles
4. Go to Fuel & Expenses → audit recent transaction ledger entries for accuracy

Weekly:
5. Export CSV report → import into accounting software
6. Compare week-over-week operational costs per vehicle
```

---

## 19. Status Glossary

### Vehicle Statuses

| Status | Badge Color | Meaning | Can Be Dispatched? |
|--------|------------|---------|:-----------------:|
| `Available` | 🟢 Green | In depot, ready for next assignment | ✅ Yes |
| `On Trip` | 🔵 Blue | Currently on an active dispatched trip | ❌ No |
| `In Shop` | 🟡 Amber | Under maintenance, work order is open | ❌ No |
| `Retired` | 🔴 Red | Decommissioned; kept for records only | ❌ No |

### Driver Statuses

| Status | Badge Color | Meaning | Can Be Dispatched? |
|--------|------------|---------|:-----------------:|
| `Available` | 🟢 Green | Ready and can be assigned to a new trip | ✅ Yes |
| `On Trip` | 🔵 Blue | Currently on an active dispatched trip | ❌ No |
| `Off Duty` | ⚫ Gray | On break, leave, or off shift | ❌ No |
| `Suspended` | 🔴 Red | Not allowed to take trips (compliance issue) | ❌ No |

### Trip Statuses

| Status | Badge Color | Meaning |
|--------|------------|---------|
| `Draft` | 🟡 Amber | Trip planned but not yet dispatched |
| `Dispatched` | 🔵 Blue | Trip is active — vehicle and driver are on the road |
| `Completed` | 🟢 Green | Delivery done; odometer and fuel logged; resources released |
| `Cancelled` | 🔴 Red | Trip cancelled; vehicle and driver were released |

### Maintenance Statuses

| Status | Badge Color | Meaning | Vehicle Status |
|--------|------------|---------|---------------|
| `open` | 🟡 Amber | Service work order is in progress | `In Shop` |
| `closed` | 🟢 Green | Service is complete | `Available` |

### Checkpoint / Tracking Statuses

| Status | Meaning |
|--------|---------|
| `in_transit` | Vehicle is moving toward destination |
| `loading` | Cargo being loaded |
| `unloading` | Cargo being unloaded at destination |
| `arrived` | Vehicle has reached destination |
| `delayed` | Vehicle is experiencing a delay |

---

## 20. Troubleshooting & FAQ

### Installation Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| `ECONNREFUSED` on backend startup | PostgreSQL is not running | Start PostgreSQL service: `net start postgresql-x64-14` (Windows) |
| `database "fulmile" does not exist` | Schema not created | Run: `psql -U postgres -c "CREATE DATABASE fulmile;"` then run `schema.sql` |
| `relation "roles" does not exist` | Seed data run before schema | Run `schema.sql` first, then `seed.sql` |
| Frontend shows blank page | Backend API not running | Start the backend server first (`npm start` in `/backend`) |
| CORS error in browser console | `FRONTEND_URL` mismatch | Ensure `.env` `FRONTEND_URL` matches your React dev server URL |

### Login & Authentication Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| "Login failed" with correct credentials | Account may be inactive (`is_active = false`) | Contact system administrator to re-enable the account |
| Redirected to `/login` on every page refresh | JWT token expired (>7 days) | Log in again |
| "Registration failed" | Email already in use, or passwords don't match | Use a different email or recheck the Confirm Password field |

### Dispatch & Trip Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| Vehicle does not appear in Create Trip dropdown | Vehicle is `On Trip` or `In Shop` | Wait for active trip to complete, or close the maintenance file |
| Driver does not appear in Create Trip dropdown | Driver is `On Trip`, `Off Duty`, or `Suspended` | Check Driver Registry for the driver's current status |
| "Schedule Draft" button is disabled | Cargo weight exceeds vehicle capacity | Reduce cargo weight or select a vehicle with higher payload capacity |
| Cannot cancel a trip | Bug or permission issue | Check your role — only Fleet Manager and Driver can cancel trips |

### GPS & Tracking Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| "GPS unavailable" in Pin Location modal | Browser denied location permission, or device has no GPS | Click browser lock icon → reset location permissions → try again, or enter coordinates manually |
| Live GPS streaming stops unexpectedly | Browser tab was backgrounded or device went to sleep | Re-click "Go Live" to resume streaming |
| Tracking link shows "Trip not found" | Wrong Trip ID entered | Copy the exact Trip ID from the Trips page by clicking the hash text |
| Map shows no truck icon | No checkpoints saved and driver not live | Driver needs to use "Pin Location" or "Go Live" to set a position |

### Reports & Analytics Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| Report charts are empty | No fuel or maintenance data logged yet | Add at least one fuel log and close at least one maintenance file |
| Fuel Economy chart missing a vehicle | No completed trips with fuel data for that vehicle | Complete at least one trip and log fuel consumed |
| ROI table shows 0 for operational cost | No fuel logs or closed maintenance files for that vehicle | Log fuel and/or complete a maintenance file |
| CSV export is empty | Same as above | Ensure fuel and maintenance data exists |

### Maintenance Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| Cannot delete a vehicle | Vehicle has associated active records (trips, fuel logs, or open maintenance) | Complete/cancel trips and close maintenance files first |
| Vehicle still shows "In Shop" after closing maintenance | Page not refreshed | Reload the page; the WebSocket update should reflect the change |

### General Tips

- **Toast notifications** appear in the top-right corner for every action (green = success, red = error, amber = warning). Always read them to confirm your action was processed.
- **All dropdowns are pre-filtered** — only eligible options are shown. If something is missing from a dropdown, check its current status.
- **Real-time updates** — Dashboard KPI cards and status badges update automatically via WebSocket. No need to manually refresh the page.
- **The `/track` route is fully public** — share it freely with clients. They do not need a Fulmile account.

---

> **Fulmile v1.0** — Smart Fleet Operations Management Platform  
> Enterprise Logistics · Tech Stack: React.js · Node.js/Express · PostgreSQL · Socket.io  
> For technical issues, refer to [README.md](./README.md) or contact your system administrator.

---

*End of User Manual*
