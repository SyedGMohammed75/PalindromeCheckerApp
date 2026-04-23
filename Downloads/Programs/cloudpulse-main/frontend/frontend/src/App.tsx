"use client"
import { useState, useEffect, useCallback } from "react"
import { LineChart, Line, Tooltip, ResponsiveContainer } from "recharts";
const API_URL = import.meta.env.VITE_API_URL;
// ── Types ──────────────────────────────────────────────────────────────
interface Service {
  id: string
  name: string
  url: string
  status: "operational" | "degraded" | "down"
  statusCode: number
  latency: number
  uptime: number
  history: { t: string; latency: number }[]
  lastChecked: Date
}

interface Log {
  id: string
  service: string
  message: string
  level: "info" | "warn" | "error"
  time: Date
}

type NavPage = "dashboard" | "services" | "logs"

// ── Mock data helpers ──────────────────────────────────────────────────
function genHistory(base: number) {
  return Array.from({ length: 20 }, (_, i) => ({
    t: `${i}m`,
    latency: Math.max(10, base + Math.round((Math.random() - 0.5) * base * 0.6))
  }))
}

const INITIAL_SERVICES: Service[] = [
  { id: "1", name: "Auth API", url: "api.auth.internal", status: "operational", statusCode: 200, latency: 42, uptime: 99.98, history: genHistory(42), lastChecked: new Date() },
  { id: "2", name: "Payment Gateway", url: "payments.internal", status: "operational", statusCode: 200, latency: 118, uptime: 99.91, history: genHistory(118), lastChecked: new Date() },
  { id: "3", name: "ML Inference", url: "ml.internal:8080", status: "degraded", statusCode: 200, latency: 632, uptime: 97.4, history: genHistory(632), lastChecked: new Date() },
  { id: "4", name: "Image CDN", url: "cdn.assets.io", status: "operational", statusCode: 200, latency: 28, uptime: 100, history: genHistory(28), lastChecked: new Date() },
  { id: "5", name: "Webhook Relay", url: "hooks.internal", status: "down", statusCode: 503, latency: 0, uptime: 94.2, history: genHistory(800), lastChecked: new Date() },
  { id: "6", name: "Search Service", url: "search.internal", status: "operational", statusCode: 200, latency: 77, uptime: 99.5, history: genHistory(77), lastChecked: new Date() },
]

const INITIAL_LOGS: Log[] = [
  { id: "1", service: "Webhook Relay", message: "Connection timeout after 30s — service unreachable", level: "error", time: new Date(Date.now() - 60000) },
  { id: "2", service: "ML Inference", message: "Response time exceeded 500ms SLA threshold", level: "warn", time: new Date(Date.now() - 180000) },
  { id: "3", service: "Auth API", message: "Health check passed — all endpoints nominal", level: "info", time: new Date(Date.now() - 300000) },
  { id: "4", service: "Payment Gateway", message: "Rate limit approaching — 87% of quota used", level: "warn", time: new Date(Date.now() - 420000) },
  { id: "5", service: "Image CDN", message: "Cache hit ratio: 98.4% — performance optimal", level: "info", time: new Date(Date.now() - 600000) },
  { id: "6", service: "Search Service", message: "Index replication completed in 1.2s", level: "info", time: new Date(Date.now() - 900000) },
]

// ── Utilities ──────────────────────────────────────────────────────────
function timeAgo(d: Date) {
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

function statusColor(s: Service["status"]) {
  return s === "operational" ? "#10b981" : s === "degraded" ? "#f59e0b" : "#ef4444"
}

function latencyColor(l: number) {
  if (l === 0) return "#ef4444"
  if (l < 100) return "#10b981"
  if (l < 400) return "#f59e0b"
  return "#ef4444"
}

function logColor(l: Log["level"]) {
  return l === "error" ? "#ef4444" : l === "warn" ? "#f59e0b" : "#10b981"
}

// ── Custom Tooltip ─────────────────────────────────────────────────────
function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "#94a3b8" }}>
      <span style={{ color: "#e2e8f0", fontWeight: 500 }}>{payload[0].value}ms</span>
    </div>
  )
}

// ── Sidebar ─────────────────────────────────────────────────────────────
function Sidebar({ active, onNav, serviceCount }: { active: NavPage; onNav: (p: NavPage) => void; serviceCount: number }) {
  const items: { id: NavPage; label: string; icon: string }[] = [
    { id: "dashboard", label: "Dashboard", icon: "▦" },
    { id: "services", label: "Services", icon: "◈" },
    { id: "logs", label: "Logs", icon: "≡" },
  ]
  return (
    <aside style={{ width: 220, background: "#0f172a", borderRight: "1px solid #1e293b", display: "flex", flexDirection: "column", flexShrink: 0, height: "100vh", position: "sticky", top: 0 }}>
      <div style={{ padding: "24px 20px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
          <div style={{ width: 32, height: 32, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "white", fontWeight: 700, flexShrink: 0 }}>CP</div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9", margin: 0, letterSpacing: -0.3 }}>CloudPulse</p>
            <p style={{ fontSize: 10, color: "#475569", margin: 0, letterSpacing: "0.06em" }}>MONITORING</p>
          </div>
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {items.map(item => (
            <button key={item.id} onClick={() => onNav(item.id)} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8,
              background: active === item.id ? "rgba(99,102,241,0.15)" : "transparent",
              border: active === item.id ? "1px solid rgba(99,102,241,0.3)" : "1px solid transparent",
              color: active === item.id ? "#818cf8" : "#64748b",
              fontSize: 13, fontWeight: active === item.id ? 500 : 400, cursor: "pointer",
              textAlign: "left", width: "100%", transition: "all 0.15s"
            }}>
              <span style={{ fontSize: 14, opacity: 0.8 }}>{item.icon}</span>
              {item.label}
              {item.id === "services" && (
                <span style={{ marginLeft: "auto", fontSize: 10, background: "rgba(99,102,241,0.2)", color: "#818cf8", padding: "2px 7px", borderRadius: 20, fontWeight: 500 }}>{serviceCount}</span>
              )}
            </button>
          ))}
        </nav>
      </div>
      <div style={{ marginTop: "auto", padding: "16px 20px", borderTop: "1px solid #1e293b" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981" }} />
          <span style={{ fontSize: 11, color: "#475569" }}>All systems nominal</span>
        </div>
      </div>
    </aside>
  )
}

// ── Header ─────────────────────────────────────────────────────────────
function Header({ page }: { page: NavPage }) {
  const titles: Record<NavPage, { title: string; sub: string }> = {
    dashboard: { title: "Overview", sub: "Real-time infrastructure health" },
    services: { title: "Services", sub: "Manage monitored endpoints" },
    logs: { title: "Activity logs", sub: "Recent events and alerts" },
  }
  const now = new Date()
  return (
    <div style={{ padding: "20px 28px 0", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: "#f1f5f9", margin: 0, letterSpacing: -0.5 }}>{titles[page].title}</h1>
        <p style={{ fontSize: 13, color: "#475569", margin: "2px 0 0" }}>{titles[page].sub}</p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981" }} />
        <span style={{ fontSize: 12, color: "#475569" }}>Live · {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
      </div>
    </div>
  )
}

// ── Stat card ──────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{ background: "#1e293b", borderRadius: 12, border: "1px solid #334155", padding: "16px 20px" }}>
      <p style={{ fontSize: 11, color: "#64748b", margin: "0 0 6px", letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 600, color, margin: "0 0 2px", letterSpacing: -0.5 }}>{value}</p>
      <p style={{ fontSize: 11, color: "#475569", margin: 0 }}>{sub}</p>
    </div>
  )
}

// ── Service Card ───────────────────────────────────────────────────────
function ServiceCard({ svc, onRemove }: { svc: Service; onRemove: (id: string) => void }) {
  const [hovered, setHovered] = useState(false)
  const sc = statusColor(svc.status)
  const lc = latencyColor(svc.latency)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? "#243044" : "#1e293b",
        borderRadius: 14, border: `1px solid ${hovered ? "#334155" : "#263348"}`,
        padding: "18px 20px", cursor: "default",
        transition: "all 0.2s ease",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ position: "relative", width: 10, height: 10, flexShrink: 0 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: sc }} />
            <div style={{
              position: "absolute", inset: -3, borderRadius: "50%",
              border: `2px solid ${sc}`, opacity: 0.4,
              animation: "ping 2s cubic-bezier(0, 0, 0.2, 1) infinite"
            }} />
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 500, color: "#e2e8f0", margin: 0 }}>{svc.name}</p>
            <p style={{ fontSize: 11, color: "#475569", margin: "1px 0 0", fontFamily: "monospace" }}>{svc.url}</p>
          </div>
        </div>
        <button onClick={() => onRemove(svc.id)} style={{
          background: "transparent", border: "none", color: "#475569", cursor: "pointer",
          fontSize: 14, padding: "2px 4px", borderRadius: 4, opacity: hovered ? 1 : 0,
          transition: "opacity 0.15s"
        }}>✕</button>
      </div>

      <div style={{ height: 56, marginBottom: 12 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={svc.history} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
            <Line type="monotone" dataKey="latency" stroke={lc} strokeWidth={1.5} dot={false} />
            <Tooltip content={<ChartTooltip />} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 11, background: `${sc}18`, color: sc, padding: "2px 8px", borderRadius: 20, fontWeight: 500 }}>
          {svc.status}
        </span>
        <span style={{ fontSize: 11, color: "#64748b" }}>HTTP {svc.statusCode}</span>
        <span style={{ marginLeft: "auto", fontSize: 12, color: lc, fontWeight: 500, fontFamily: "monospace" }}>
          {svc.latency > 0 ? `${svc.latency}ms` : "—"}
        </span>
        <span style={{ fontSize: 11, color: "#475569" }}>{svc.uptime}% up</span>
      </div>
    </div>
  )
}

// ── Add Service Form ───────────────────────────────────────────────────
function AddServiceForm({ onAdd }: { onAdd: (name: string, url: string) => void }) {
  const [name, setName] = useState("")
  const [url, setUrl] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [focused, setFocused] = useState<string | null>(null)

  function handle(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !url.trim()) return

    // URL validation
    try {
      const validatedUrl = new URL(url.trim());
      if (validatedUrl.protocol !== "http:" && validatedUrl.protocol !== "https:") {
        setError("URL must start with http:// or https://");
        return;
      }
    } catch (err) {
      setError("Please enter a valid URL (e.g., https://google.com)");
      return;
    }

    setError(null)
    onAdd(name.trim(), url.trim())
    setName(""); setUrl("")
  }

  const inputStyle = (field: string) => ({
    width: "100%", padding: "10px 14px", borderRadius: 10,
    background: "#0f172a", color: "#e2e8f0", fontSize: 13,
    border: `1px solid ${focused === field ? "#6366f1" : error && field === "url" ? "#ef4444" : "#334155"}`,
    outline: "none", transition: "border-color 0.15s", boxSizing: "border-box" as const,
    fontFamily: "inherit"
  })

  return (
    <div style={{ background: "#1e293b", borderRadius: 14, border: "1px solid #263348", padding: "20px 24px" }}>
      <p style={{ fontSize: 13, fontWeight: 500, color: "#94a3b8", margin: "0 0 16px", letterSpacing: "0.04em" }}>Add new service</p>
      <form onSubmit={handle} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 180px" }}>
          <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 5, letterSpacing: "0.06em" }}>SERVICE NAME</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Auth API"
            onFocus={() => setFocused("name")} onBlur={() => setFocused(null)}
            style={inputStyle("name")} />
        </div>
        <div style={{ flex: "2 1 240px" }}>
          <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 5, letterSpacing: "0.06em" }}>ENDPOINT URL</label>
          <input value={url} onChange={e => { setUrl(e.target.value); setError(null); }} placeholder="https://api.example.com/health"
            onFocus={() => setFocused("url")} onBlur={() => setFocused(null)}
            style={inputStyle("url")} />
        </div>
        <button type="submit" style={{
          padding: "10px 20px", borderRadius: 10, border: "none",
          background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
          color: "white", fontSize: 13, fontWeight: 500, cursor: "pointer",
          whiteSpace: "nowrap", flexShrink: 0, height: 40, alignSelf: "flex-end",
          transition: "opacity 0.15s", opacity: name && url ? 1 : 0.5
        }}>
          + Add service
        </button>
      </form>
      {error && <p style={{ color: "#ef4444", fontSize: 12, marginTop: 10, margin: "10px 0 0" }}>{error}</p>}
    </div>
  )
}

// ── Log Row ─────────────────────────────────────────────────────────────
function LogRow({ log }: { log: Log }) {
  const c = logColor(log.level)
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "12px 0", borderBottom: "1px solid #1e293b" }}>
      <span style={{ fontSize: 10, fontWeight: 500, padding: "2px 8px", borderRadius: 4, background: `${c}18`, color: c, flexShrink: 0, marginTop: 1, letterSpacing: "0.06em" }}>
        {log.level.toUpperCase()}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, color: "#e2e8f0", margin: 0 }}>{log.message}</p>
        <p style={{ fontSize: 11, color: "#475569", margin: "2px 0 0" }}>{log.service}</p>
      </div>
      <span style={{ fontSize: 11, color: "#475569", flexShrink: 0, whiteSpace: "nowrap" }}>{timeAgo(log.time)}</span>
    </div>
  )
}

// ── Dashboard Page ─────────────────────────────────────────────────────
function DashboardPage({ services, logs, onAdd, onRemove }: {
  services: Service[]; logs: Log[]; onAdd: (n: string, u: string) => void; onRemove: (id: string) => void
}) {
  const op = services.filter(s => s.status === "operational").length
  const down = services.filter(s => s.status === "down").length
  const degraded = services.filter(s => s.status === "degraded").length
  const avgLatency = Math.round(services.filter(s => s.latency > 0).reduce((a, s) => a + s.latency, 0) / (services.filter(s => s.latency > 0).length || 1))
  const avgUptime = (services.reduce((a, s) => a + s.uptime, 0) / (services.length || 1)).toFixed(2)

  return (
    <div style={{ padding: "20px 28px 32px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: 24 }}>
        <StatCard label="Operational" value={`${op}`} sub={`of ${services.length} services`} color="#10b981" />
        <StatCard label="Degraded" value={`${degraded}`} sub="high latency" color="#f59e0b" />
        <StatCard label="Down" value={`${down}`} sub="unreachable" color="#ef4444" />
        <StatCard label="Avg latency" value={`${avgLatency}ms`} sub="across all services" color="#818cf8" />
        <StatCard label="Avg uptime" value={`${avgUptime}%`} sub="last 30 days" color="#94a3b8" />
      </div>

      <div style={{ marginBottom: 16 }}>
        <AddServiceForm onAdd={onAdd} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 14, marginBottom: 28 }}>
        {services.map(s => <ServiceCard key={s.id} svc={s} onRemove={onRemove} />)}
      </div>

      <div style={{ background: "#1e293b", borderRadius: 14, border: "1px solid #263348", padding: "18px 20px" }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: "#94a3b8", margin: "0 0 4px", letterSpacing: "0.04em" }}>Recent activity</p>
        {logs.slice(0, 5).map(l => <LogRow key={l.id} log={l} />)}
      </div>
    </div>
  )
}

// ── Services Page ──────────────────────────────────────────────────────
function ServicesPage({ services, onAdd, onRemove }: { services: Service[]; onAdd: (n: string, u: string) => void; onRemove: (id: string) => void }) {
  return (
    <div style={{ padding: "20px 28px 32px" }}>
      <div style={{ marginBottom: 20 }}>
        <AddServiceForm onAdd={onAdd} />
      </div>
      <div style={{ background: "#1e293b", borderRadius: 14, border: "1px solid #263348", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 100px 90px 100px 40px", padding: "10px 20px", borderBottom: "1px solid #263348" }}>
          {["Service", "Status", "Latency", "Code", "Uptime", ""].map((h, i) => (
            <span key={i} style={{ fontSize: 11, color: "#475569", letterSpacing: "0.08em" }}>{h}</span>
          ))}
        </div>
        {services.map((s, i) => {
          const sc = statusColor(s.status)
          const lc = latencyColor(s.latency)
          return (
            <div key={s.id} style={{
              display: "grid", gridTemplateColumns: "1fr 120px 100px 90px 100px 40px",
              padding: "14px 20px", borderBottom: i < services.length - 1 ? "1px solid #1a2742" : "none",
              alignItems: "center"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ position: "relative", width: 8, height: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: sc }} />
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "#e2e8f0", margin: 0 }}>{s.name}</p>
                  <p style={{ fontSize: 11, color: "#475569", margin: 0, fontFamily: "monospace" }}>{s.url}</p>
                </div>
              </div>
              <span style={{ fontSize: 11, background: `${sc}18`, color: sc, padding: "2px 8px", borderRadius: 20, fontWeight: 500, width: "fit-content" }}>{s.status}</span>
              <span style={{ fontSize: 13, color: lc, fontFamily: "monospace", fontWeight: 500 }}>{s.latency > 0 ? `${s.latency}ms` : "—"}</span>
              <span style={{ fontSize: 12, color: "#64748b" }}>{s.statusCode}</span>
              <span style={{ fontSize: 12, color: "#64748b" }}>{s.uptime}%</span>
              <button onClick={() => onRemove(s.id)} style={{ background: "transparent", border: "none", color: "#475569", cursor: "pointer", fontSize: 13 }}>✕</button>
            </div>
          )
        })}
        {services.length === 0 && (
          <div style={{ padding: "48px 0", textAlign: "center" }}>
            <p style={{ fontSize: 14, color: "#475569" }}>No services monitored yet</p>
            <p style={{ fontSize: 12, color: "#334155", marginTop: 4 }}>Add a service above to start monitoring</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Logs Page ──────────────────────────────────────────────────────────
function LogsPage({ logs }: { logs: Log[] }) {
  const [filter, setFilter] = useState<"all" | Log["level"]>("all")
  const filtered = filter === "all" ? logs : logs.filter(l => l.level === filter)
  return (
    <div style={{ padding: "20px 28px 32px" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {(["all", "info", "warn", "error"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "6px 14px", borderRadius: 8, fontSize: 12, cursor: "pointer",
            border: `1px solid ${filter === f ? "#6366f1" : "#334155"}`,
            background: filter === f ? "rgba(99,102,241,0.15)" : "transparent",
            color: filter === f ? "#818cf8" : "#64748b", fontWeight: filter === f ? 500 : 400,
            transition: "all 0.15s"
          }}>{f}</button>
        ))}
      </div>
      <div style={{ background: "#1e293b", borderRadius: 14, border: "1px solid #263348", padding: "4px 20px" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "48px 0", textAlign: "center" }}>
            <p style={{ fontSize: 14, color: "#475569" }}>No logs matching filter</p>
          </div>
        ) : filtered.map(l => <LogRow key={l.id} log={l} />)}
      </div>
    </div>
  )
}

// ── Root App ───────────────────────────────────────────────────────────
export default function CloudPulse() {
  const [page, setPage] = useState<NavPage>("dashboard")
  const [services, setServices] = useState<Service[]>(INITIAL_SERVICES)
  const [logs, setLogs] = useState<Log[]>(INITIAL_LOGS)

  const addService = useCallback((name: string, url: string) => {
    // Basic simulation: if URL contains "error" or "invalid", it's down.
    // Otherwise it starts as "operational" for this mock version.
    const isInvalid = url.toLowerCase().includes("error") || url.toLowerCase().includes("invalid");
    
    const svc: Service = {
      id: Date.now().toString(), name, url,
      status: isInvalid ? "down" : "operational", 
      statusCode: isInvalid ? 0 : 200, 
      latency: isInvalid ? 0 : Math.floor(Math.random() * 150) + 20,
      uptime: isInvalid ? 0 : 100, 
      history: genHistory(isInvalid ? 0 : 80), 
      lastChecked: new Date()
    }
    setServices(prev => [svc, ...prev])
    setLogs(prev => [{
      id: Date.now().toString(), service: name,
      message: isInvalid 
        ? `Service added but health check failed: Host unreachable` 
        : `Service added to monitoring — health check scheduled`, 
      level: isInvalid ? "error" : "info", 
      time: new Date()
    }, ...prev])
  }, [])

  const removeService = useCallback((id: string) => {
    const svc = services.find(s => s.id === id)
    setServices(prev => prev.filter(s => s.id !== id))
    if (svc) setLogs(prev => [{
      id: Date.now().toString(), service: svc.name,
      message: `Service removed from monitoring`, level: "info", time: new Date()
    }, ...prev])
  }, [services])

  useEffect(() => {
    const interval = setInterval(() => {
      setServices(prev => prev.map(s => ({
        ...s,
        latency: s.status === "down" ? 0 : Math.max(10, s.latency + Math.round((Math.random() - 0.5) * 30)),
        history: [...s.history.slice(1), { t: "now", latency: s.status === "down" ? 0 : Math.max(10, s.latency + Math.round((Math.random() - 0.5) * 30)) }],
        lastChecked: new Date()
      })))
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:#0a1120;font-family:'Inter',sans-serif;color:#e2e8f0}
        @keyframes ping{0%{transform:scale(1);opacity:0.8}75%,100%{transform:scale(2.2);opacity:0}}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:#1e293b;border-radius:2px}
      `}</style>
      <div style={{ display: "flex", minHeight: "100vh", background: "#0a1120" }}>
        <Sidebar active={page} onNav={setPage} serviceCount={services.length} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflowY: "auto" }}>
          <Header page={page} />
          {page === "dashboard" && <DashboardPage services={services} logs={logs} onAdd={addService} onRemove={removeService} />}
          {page === "services" && <ServicesPage services={services} onAdd={addService} onRemove={removeService} />}
          {page === "logs" && <LogsPage logs={logs} />}
        </div>
      </div>
    </>
  )
}
