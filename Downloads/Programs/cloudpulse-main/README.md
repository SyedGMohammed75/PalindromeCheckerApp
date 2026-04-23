# ☁️ CloudPulse — Real-Time Cloud Monitoring Dashboard

CloudPulse is a modern **real-time monitoring system** that tracks the health, latency, and uptime of web services and APIs. It provides a clean dashboard with live updates, helping developers and teams quickly detect issues in their infrastructure.

---

## 🚀 Features

* 📡 Real-time monitoring using WebSockets (Socket.io)
* ⚡ Live latency tracking and status updates
* 🟢 Status classification: Operational / Degraded / Down
* 📊 Interactive charts for performance visualization
* 📋 Activity logs for system events
* ➕ Add / ❌ Remove services dynamically
* ☁️ Cloud database integration using Supabase

---

## 🧱 Tech Stack

### Frontend

* React (Vite)
* TypeScript
* Recharts (charts)

### Backend

* Node.js
* Express.js
* Socket.io
* Axios

### Database

* Supabase

---

## 🏗️ Project Structure

```
cloudpulse/
├── backend/        # Node.js server
├── frontend/       # React application
```

---

## 🖥️ Screenshots

### 📊 Dashboard

![Dashboard](./screenshots/dashboard.png)

### 📦 Services Page

![Services](./screenshots/services.png)

### 📋 Logs Page

![Logs](./screenshots/logs.png)

---

## ⚙️ Setup Instructions

### 1️⃣ Clone Repository

```
git clone https://github.com/06nikunj/cloudpulse.git
cd cloudpulse
```

---

### 2️⃣ Backend Setup

```
cd backend
npm install
node index.js
```

---

### 3️⃣ Frontend Setup

```
cd frontend
npm install
npm run dev
```

Open:

```
http://localhost:5173
```

---

## 🔐 Environment Variables

Create `.env` inside `backend/`:

```
SUPABASE_URL=your_url
SUPABASE_SERVICE_ROLE_KEY=your_key
PORT=3000
```

---

## 🌐 Deployment

* Frontend: Netlify / Vercel
* Backend: Render / Railway

---

## 📈 How It Works

1. User adds a service (URL + name)
2. Backend schedules periodic health checks
3. Response data (latency, status) is stored in database
4. Backend emits updates via Socket.io
5. Frontend updates UI in real time

---

## 🎯 Use Cases

* API monitoring
* DevOps dashboards
* Microservices health tracking
* Cloud infrastructure observability

---

## 📌 Future Improvements

* 🔔 Alert system (email / notifications)
* 📊 Historical analytics dashboard
* 🔐 Authentication system
* 📈 SLA monitoring

---

## 👨‍💻 Author

**Nikunj Purohit**
GitHub: https://github.com/06nikunj

---

## ⭐ Acknowledgements

* Supabase
* Recharts
* Socket.io

---

## 📄 License

This project is for educational and demonstration purposes.
