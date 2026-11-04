# Fulmile — Smart Transport Operations Platform

Fulmile is a centralized transport operations platform designed to optimize fleet utilization, automate logistics dispatch, enforce compliance gates, track maintenance lifecycles, and monitor operational finances.

## Core Features & Business Logic

### 1. Real-Time Tracking & Shipper Portal
* **Live GPS Broadcasting:** Drivers can stream their actual coordinates via WebSockets (`Socket.io`).
* **Customer Map Dashboard:** A public tracking page featuring an interactive OpenStreetMap (`Leaflet`) with the cargo's route, speed, and real-time location.

### 2. Shared Capacity Marketplace
* **Dynamic Capacity Management:** Automatically tracks remaining vehicle weight/volume.
* **Route Sharing:** Drivers and managers can post partial routes and offer available cargo capacity at a calculated price-per-kg to other shippers.

### 3. Smart Resource Gating & Compliance
* **Dispatch Gating:** Automatically prevents assignment of retired vehicles or those currently marked `In Shop` for maintenance.
* **Driver Compliance Gating:** Blocks assigning drivers who are suspended or have expired licenses.
* **Double Assignment Prevention:** Ensures active drivers and vehicles cannot be assigned to more than one trip at a time.

### 4. Fleet Maintenance Tracking
* **Shop Locking:** Locks vehicles as `In Shop` while maintenance logs are open, preventing them from being scheduled for trips. Once logs are closed, vehicles are automatically marked as `Available`.

### 5. Fleet Performance & Financial Analytics
* **Utilization Rate:** Calculated as `(Vehicles on Trip / Total Available Fleet) * 100`.
* **Fuel Efficiency:** Calculates distance vs. fuel consumption.
* **Vehicle ROI:** Calculates Return on Investment using trip revenue, operational costs, and acquisition cost.

## Technology Stack

* **Frontend:** React.js, Tailwind CSS, Redux Toolkit, React-Leaflet, Recharts.
* **Backend:** Node.js, Express.js, Socket.io, JWT Authentication.
* **Database:** PostgreSQL with Sequelize ORM.
