// src/components/ApiStatusBanner.jsx
// Shows live backend connectivity status on calculator pages.

import { useEffect, useState } from "react";
import { fetchHealth } from "../api/client";

export default function ApiStatusBanner() {
  const [status,  setStatus]  = useState("checking"); // checking | online | offline
  const [info,    setInfo]    = useState(null);

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

  const styles = {
    checking: { bg: "rgba(255,179,0,0.08)",  border: "rgba(255,179,0,0.3)",  color: "#B45309" },
    online:   { bg: "rgba(102,187,106,0.08)", border: "rgba(102,187,106,0.3)", color: "#2E7D32" },
    offline:  { bg: "rgba(239,83,80,0.08)",  border: "rgba(239,83,80,0.3)",  color: "#C62828" },
  }[status];

  const icons   = { checking: "⏳", online: "✅", offline: "❌" };
  const labels  = {
    checking: "Connecting to CardioAI backend…",
    online:   `Backend online · ${info?.device ?? "CPU"} · API ready`,
    offline:  "Backend offline — start api.py then refresh",
  };

  return (
    <div style={{
      background:   styles.bg,
      border:       `1px solid ${styles.border}`,
      borderRadius: "var(--radius-sm)",
      padding:      "10px 18px",
      display:      "flex",
      alignItems:   "center",
      gap:          10,
      fontSize:     "0.83rem",
      fontWeight:   500,
      color:        styles.color,
      marginBottom: 20,
    }}>
      <span style={{ fontSize: "1rem" }}>{icons[status]}</span>
      <span>{labels[status]}</span>
      {status === "online" && info?.modelsLoaded?.length > 0 && (
        <span style={{ marginLeft: "auto", fontWeight: 600, fontSize: "0.78rem", opacity: 0.8 }}>
          Loaded: {info.modelsLoaded.join(", ")}
        </span>
      )}
    </div>
  );
}
