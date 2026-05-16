// src/components/ApiStatusBanner.jsx
// Shows backend status — adapts gracefully to mock mode so
// the hosted demo remains clearly labelled.

import { useEffect, useState } from "react";
import { fetchHealth } from "../api/client";

export default function ApiStatusBanner() {
  const [status, setStatus] = useState("checking");
  const [info,   setInfo]   = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchHealth();
        if (!cancelled) { setStatus("online"); setInfo(data); }
      } catch {
        if (!cancelled) setStatus("offline");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const cfg = {
    checking: { bg: "rgba(255,179,0,0.08)",   border: "rgba(255,179,0,0.3)",   color: "#B45309", icon: "⏳", text: "Connecting to CardioAI backend…" },
    online:   { bg: "rgba(102,187,106,0.08)", border: "rgba(102,187,106,0.3)", color: "#2E7D32", icon: "✅", text: `Backend online · ${info?.device ?? "CPU"} · Live predictions active` },
    offline:  { bg: "rgba(30,136,229,0.06)",  border: "rgba(30,136,229,0.2)", color: "#1565C0", icon: "🧪", text: "Demo mode — AI predictions are simulated locally (no backend required)" },
  }[status];

  return (
    <div style={{
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      borderRadius: "var(--radius-sm)",
      padding: "10px 18px",
      display: "flex",
      alignItems: "center",
      gap: 10,
      fontSize: "0.83rem",
      fontWeight: 500,
      color: cfg.color,
      marginBottom: 20,
    }}>
      <span style={{ fontSize: "1rem" }}>{cfg.icon}</span>
      <span>{cfg.text}</span>
      {status === "online" && info?.modelsLoaded?.length > 0 && (
        <span style={{ marginLeft: "auto", fontWeight: 600, fontSize: "0.78rem", opacity: 0.8 }}>
          Loaded: {info.modelsLoaded.join(", ")}
        </span>
      )}
      {status === "offline" && (
        <span style={{ marginLeft: "auto", fontWeight: 600, fontSize: "0.75rem", opacity: 0.7 }}>
          Start api.py for live model inference
        </span>
      )}
    </div>
  );
}
