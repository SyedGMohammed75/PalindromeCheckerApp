// CloudPulse — Polling Engine + Real-Time Socket.io
// index.js (ES Modules)
import cors from "cors";
import express from "express";
import { createServer } from "http";           // ← needed to attach Socket.io
import { Server } from "socket.io";            // ← Socket.io server
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import cron from "node-cron";
import axios from "axios";

dotenv.config();

// ─────────────────────────────────────────────
// App Setup
// Key change: Socket.io needs a raw http.Server,
// not just the express app — so we create one here
// ─────────────────────────────────────────────
const app = express();
app.use(cors());
const httpServer = createServer(app);           // wrap express in http server
const io = new Server(httpServer, {
  cors: { origin: "*" },                        // allow any origin (lock down in prod)
});

const PORT = process.env.PORT || 3000;
app.use(express.json());

// ─────────────────────────────────────────────
// Supabase Setup
// ─────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);
console.log("✅ Connected to Supabase");

// ─────────────────────────────────────────────
// Socket.io — Connection Logging
// Runs whenever a frontend client connects
// ─────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`🔌 Client connected    → socket id: ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`🔌 Client disconnected → socket id: ${socket.id}`);
  });
});

// ─────────────────────────────────────────────
// In-memory map of active cron jobs
// ─────────────────────────────────────────────
const activeJobs = {};

// ─────────────────────────────────────────────
// Helper: Convert interval_seconds → cron string
// ─────────────────────────────────────────────
function secondsToCron(seconds) {
  if (seconds < 60) {
    console.warn(`⚠️  ${seconds}s < 60s minimum. Defaulting to 1 min.`);
    return "* * * * *";
  }
  const minutes = Math.floor(seconds / 60);
  return `*/${minutes} * * * *`;
}

function isReachable(url) {
  return axios.get(url, { timeout: 5000 })
    .then(() => true)
    .catch(() => false);
}

// ─────────────────────────────────────────────
// Core: Poll one service + emit real-time event
// ─────────────────────────────────────────────
async function pollService(service) {
  console.log(`\n🔍 Polling [${service.name}] → ${service.url}`);

  const startTime = Date.now();
  let statusCode = 0;
  let isUp = false;
  let latencyMs = 0;

  try {
    const response = await axios.get(service.url, {
      timeout: 10000,
      validateStatus: () => true,  // never throw on 4xx / 5xx
    });

    latencyMs = Date.now() - startTime;
    statusCode = response.status;
    isUp = statusCode < 400;

    console.log(`   ✅ ${statusCode} | ${latencyMs}ms | Up: ${isUp}`);
  } catch (err) {
  latencyMs = Date.now() - startTime;
  statusCode = 0;
  isUp = false;
}

  // ── Build the health check payload ──────────
  const healthCheck = {
    service_id:  service.id,
    status_code: statusCode,
    latency_ms:  latencyMs,
    is_up:       isUp,
    checked_at:  new Date().toISOString(),
  };

  // ── Save to Supabase ─────────────────────────
  const { error: insertError } = await supabase
    .from("health_checks")
    .insert(healthCheck);

  if (insertError) {
    console.error(`   ⚠️  Insert failed: ${insertError.message}`);
  } else {
    console.log(`   💾 Saved to health_checks`);

    // ── Emit real-time event to all dashboard clients ──
    // Every connected browser receives this instantly
    io.emit("metric:new", healthCheck);
    console.log(`   📡 Emitted metric:new → ${JSON.stringify(healthCheck)}`);
  }

  // ── Update service status in services table ──
  const { error: updateError } = await supabase
    .from("services")
    .update({ status: isUp ? "UP" : "DOWN" })
    .eq("id", service.id);

  if (updateError) {
    console.error(`   ⚠️  Status update failed: ${updateError.message}`);
  }
}

// ─────────────────────────────────────────────
// Schedule a cron job for one service
// ─────────────────────────────────────────────
function scheduleService(service) {
  if (activeJobs[service.id]) {
    activeJobs[service.id].stop();
    console.log(`🔄 Restarting job for: ${service.name}`);
  }

  const cronExpr = secondsToCron(service.interval_seconds);
  console.log(`⏰ [${service.name}] → "${cronExpr}" (every ~${service.interval_seconds}s)`);

  const task = cron.schedule(cronExpr, () => pollService(service));
  activeJobs[service.id] = task;

  pollService(service); // immediate first poll — don't wait for tick
}

// ─────────────────────────────────────────────
// Boot: Load all services → schedule all jobs
// ─────────────────────────────────────────────
async function startPollingEngine() {
  console.log("\n🚀 Starting Polling Engine...");

  const { data: services, error } = await supabase
    .from("services")
    .select("*");

  if (error) {
    console.error("❌ Could not load services:", error.message);
    return;
  }

  if (!services || services.length === 0) {
    console.log("ℹ️  No services yet. Engine standing by.");
    return;
  }

  console.log(`📋 ${services.length} service(s) found. Scheduling...\n`);
  services.forEach((s) => scheduleService(s));
}
// ─────────────────────────────────────────────
// Routes (Clean + Improved)
// ─────────────────────────────────────────────

// ✅ Health check route
app.get("/", (_req, res) => {
  res.json({ message: "☁️ CloudPulse is running" });
});

// ✅ Test database connection
app.get("/test-db", async (_req, res) => {
  const { data, error } = await supabase.from("services").select("*");

  if (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }

  return res.json({
    success: true,
    count: data.length,
    data,
  });
});

// ✅ Register new service
app.post("/api/services", async (req, res) => {
  const name = req.body.name?.trim().toLowerCase();
  const url = req.body.url?.trim();
  const interval_seconds = req.body.interval_seconds;

  // 🔒 Validate input
  if (!name || !url || !interval_seconds) {
    return res.status(400).json({
      success: false,
      message: "name, url, and interval_seconds are required",
    });
  }

  // Improved URL validation
  let validatedUrl;
  try {
    validatedUrl = new URL(url);
    if (validatedUrl.protocol !== "http:" && validatedUrl.protocol !== "https:") {
      throw new Error("Invalid protocol");
    }
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: "Invalid URL. Please provide a valid http or https address.",
    });
  }

  // 🔍 Check duplicate service
  const { data: existing } = await supabase
    .from("services")
    .select("*")
    .eq("name", name)
    .maybeSingle(); // safer than .single()

  if (existing) {
    return res.status(400).json({
      success: false,
      message: "Service already exists",
    });
  }

  // 💾 Insert into DB
  const { data, error } = await supabase
    .from("services")
    .insert({
      name,
      url: validatedUrl.toString(),
      interval_seconds,
      status: "PENDING",
    })
    .select()
    .single();

  if (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }

  // ⚙️ Start polling immediately
  scheduleService(data);
  console.log(`➕ Registered & scheduled: ${name}`);

  return res.status(201).json({
    success: true,
    message: "Service registered. Polling started!",
    service: data,
  });
});

// ✅ Get all services
app.get("/api/services", async (_req, res) => {
  const { data, error } = await supabase.from("services").select("*");

  if (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }

  return res.json({
    success: true,
    data,
  });
});

// ✅ Get last 50 health checks of a service
app.get("/api/services/:id/health", async (req, res) => {
  const { data, error } = await supabase
    .from("health_checks")
    .select("*")
    .eq("service_id", req.params.id)
    .order("checked_at", { ascending: false })
    .limit(50);

  if (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }

  return res.json({
    success: true,
    data,
  });
});

// ✅ Manual poll trigger
app.post("/api/services/:id/poll", async (req, res) => {
  const { data: service, error } = await supabase
    .from("services")
    .select("*")
    .eq("id", req.params.id)
    .maybeSingle();

  if (error || !service) {
    return res.status(404).json({
      success: false,
      message: "Service not found",
    });
  }

  await pollService(service);

  return res.json({
    success: true,
    message: `Polled "${service.name}" manually`,
  });
});

// ✅ Delete service (NEW)
app.delete("/api/services/:id", async (req, res) => {
  const { id } = req.params;

  // 🛑 Stop cron job if running
  if (activeJobs[id]) {
    activeJobs[id].stop();
    delete activeJobs[id];
  }

  const { error } = await supabase
    .from("services")
    .delete()
    .eq("id", id);

  if (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }

  return res.json({
    success: true,
    message: "Service deleted successfully",
  });
});
// ─────────────────────────────────────────────
// Start server (use httpServer, NOT app.listen)
// This is required for Socket.io to work
// ─────────────────────────────────────────────
httpServer.listen(PORT, async () => {
  console.log(`\n🌐 Server     → http://localhost:${PORT}`);
  console.log(`🔌 Socket.io  → ws://localhost:${PORT}`);
  await startPollingEngine();
});
