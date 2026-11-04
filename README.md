# TransitOps — Smart Transport Operations Platform

TransitOps is an enterprise transport operations and freight platform designed to optimize fleet utilization, automate logistics dispatch, enforce compliance gates, track maintenance lifecycles, and monitor operational finances. 

This platform solves major logistics challenges by introducing real-time freight tracking, shared capacity utilization, automated fleet management, and instant financial settlement.

---

## 🎯 Key Industry Challenges Solved

1. **Real-Time Freight Visibility (The "Where is my cargo?" problem)**
   * **Solution:** We built a live tracking Shipper Portal using `Socket.io` and `Leaflet` maps. Drivers can broadcast their live GPS location, and customers can watch their cargo move on a map in real-time with zero-latency updates.
2. **Underutilized Fleet Capacity (The "Empty Miles" problem)**
   * **Solution:** A **Shared Capacity Marketplace**. If a truck is dispatched with only partial load, the manager or driver can "Share Capacity", publishing the remaining space (e.g., 500 KG available) for other shippers to book at a calculated price-per-kg.
3. **Compliance & Safety Risks**
   * **Solution:** Automated dispatch gating. The system physically prevents dispatching drivers with expired licenses, poor safety scores, or vehicles currently marked "In Shop" for maintenance.
4. **Disjointed Financial Tracking**
   * **Solution:** Centralized analytics that automatically calculate Vehicle ROI, fuel efficiency, and maintenance burn rates across the entire fleet.

---

## 🚀 Core Features Built

### 🗺 Real-Time Tracking & Shipper Portal
* **Live GPS Broadcasting:** Drivers click "Go Live" to stream their device's actual geolocation directly to the server.
* **Customer Map Dashboard:** Customers use a public tracking link to view a live OpenStreetMap with their cargo's exact location, speed, and moving route trail.
* **Manual Checkpoints:** Drivers can drop manual GPS pins (with reverse-geocoded location names) if continuous streaming drops.

### 🤝 Shared Capacity Marketplace
* **Dynamic Space Calculation:** The system automatically calculates remaining vehicle weight capacity.
* **Route Publishing:** Active trips can publish their extra space along a route with a specific price quote.
* **Booking Integration:** Customers can view shared routes and book the extra space, instantly increasing the vehicle's ROI for that trip.

### 🚚 Vehicle & Asset Management
* **Centralized Registry:** Track registration numbers, models, purchase details, and current odometer readings.
* **Real-Time Status Tracking:** Monitor vehicle availability states (`Available`, `On Trip`, `In Shop`, `Retired`).
* **Fleet Health Tracking:** Automated status updates based on active maintenance logs.

### 👥 Driver Compliance & Profile Management
* **Driver Registry:** Store driver information, license categories, and safety ratings.
* **Automated Expiry Warnings:** Monitor driver license expiration dates to prevent expired dispatches.

### 📅 Trip Planning & Automated Dispatch
* **Intelligent Dispatching:** Select available vehicles and qualified drivers for new dispatches.
* **Dynamic Resource Gating:** Prevent selection of busy, retired, suspended, or maintenance-bound assets.
* **Payload Capacity Verification:** Enforce cargo weight limits against vehicle load capabilities.

### 🔧 Maintenance & Repairs
* **Shop Locking:** Mark vehicles as `In Shop` while maintenance logs are open, automatically releasing them back to `Available` upon completion.

### 📊 Reports & Operational Analytics
* **KPI Metrics Dashboard:** Compute Fleet Utilization, Driver Statuses, and Active Trips dynamically.
* **Fleet Analytics:**
    * **Fleet Utilization (%)** = (Vehicles on Trip / Total Available Fleet) * 100
    * **Fuel Efficiency** = Distance Traveled (km) / Fuel Consumed (Liters)
    * **Vehicle ROI** = (Trip Revenue - Costs) / Acquisition Cost

---

## 🛠 Tech Stack Used

*   **Frontend (Client):** 
    * React.js (Single Page Application)
    * Tailwind CSS (Modern, responsive UI)
    * Redux Toolkit (State Management)
    * React-Leaflet (Live Maps)
    * Recharts (Data Visualizations)
*   **Backend (API):** 
    * Node.js & Express.js
    * Socket.io (WebSockets for live GPS streaming)
    * JWT (Role-based access control authentication)
*   **Database (Storage):** 
    * PostgreSQL (Relational Data)
    * Sequelize ORM

---

## ⚙️ Operational Business Rules Enforced

The system acts as a smart ledger, automatically enforcing these rules:

1.  **Dispatch Gating:** Vehicles marked `Retired` or `In Shop` are excluded from trip dispatch selection pools.
2.  **Driver Compliance Gating:** Drivers with expired licenses or a `Suspended` status cannot be assigned to trips.
3.  **Double Assignment Prevention:** Drivers or vehicles marked `On Trip` cannot be assigned to another trip.
4.  **Payload Capacity Gating:** Cargo weight must not exceed the selected vehicle's maximum load capacity.
5.  **Trip Lifecycle Status Transitions:**
    *   `Draft` &rarr; `Dispatched`: Automatically changes vehicle and driver status to `On Trip`.
    *   `Dispatched` &rarr; `Completed`: Automatically restores vehicle and driver status to `Available` and updates the vehicle's odometer.
6.  **Maintenance Status Transitions:**
    *   Creating an active maintenance log changes vehicle status to `In Shop`.
    *   Closing the maintenance log restores the vehicle status to `Available`.
