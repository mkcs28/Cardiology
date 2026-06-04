// src/components/ApiStatusBanner.jsx
// Shows backend status with a "Wake backend" button when offline.

import { useEffect, useState, useCallback } from "react";
import { fetchHealth } from "../api/client";

export default function ApiStatusBanner({ onStatusChange }) {
  const [status, setStatus]   = useState("checking");
  const [info,   setInfo]     = useState(null);
  const [waking, setWaking]   = useState(false);

  const check = useCallback(async () => {
    try {
      const data = await fetchHealth();
      setStatus("online");
      setInfo(data);
      onStatusChange?.("online");
    } catch {
      setStatus("offline");
      onStatusChange?.("offline");
    }
  }, [onStatusChange]);

  useEffect(() => {
    check();
  }, [check]);

  // Poll every 30s so the banner auto-updates when the backend wakes up
  useEffect(() => {
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [check]);

  const handleWake = async () => {
    setWaking(true);
    setStatus("checking");
    // Render free-tier cold-starts can take 40–60 s — poll until alive
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      try {
        const data = await fetchHealth();
        setStatus("online");
        setInfo(data);
        onStatusChange?.("online");
        setWaking(false);
        return;
      } catch {
        await new Promise(r => setTimeout(r, 5_000));
      }
    }
    setStatus("offline");
    onStatusChange?.("offline");
    setWaking(false);
  };

  const cfg = {
    checking: {
      bg: "rgba(255,179,0,0.08)", border: "rgba(255,179,0,0.3)",
      color: "#B45309", icon: "⏳",
      text: waking
        ? "Waking backend… this can take up to 60 s on Render free tier"
        : "Connecting to CardioAI backend…",
    },
    online: {
      bg: "rgba(102,187,106,0.08)", border: "rgba(102,187,106,0.3)",
      color: "#2E7D32", icon: "✅",
      text: `Backend online · ${info?.device ?? "CPU"} · Live model inference active`,
    },
    offline: {
      bg: "rgba(239,83,80,0.07)", border: "rgba(239,83,80,0.3)",
      color: "#C62828", icon: "🔴",
      text: "Backend offline — PDF analysis will use simulated results",
    },
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
      <span style={{ flex: 1 }}>{cfg.text}</span>

      {status === "online" && info?.modelsLoaded?.length > 0 && (
        <span style={{ fontWeight: 600, fontSize: "0.78rem", opacity: 0.8 }}>
          Loaded: {info.modelsLoaded.join(", ")}
        </span>
      )}

      {status === "offline" && !waking && (
        <button
          onClick={handleWake}
          style={{
            padding: "4px 14px",
            borderRadius: 20,
            border: "1px solid #C62828",
            background: "transparent",
            color: "#C62828",
            fontSize: "0.78rem",
            fontWeight: 700,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Wake backend
        </button>
      )}

      {status !== "online" && (
        <button
          onClick={check}
          disabled={waking}
          style={{
            padding: "4px 12px",
            borderRadius: 20,
            border: `1px solid ${cfg.color}`,
            background: "transparent",
            color: cfg.color,
            fontSize: "0.75rem",
            fontWeight: 600,
            cursor: waking ? "default" : "pointer",
            opacity: waking ? 0.5 : 1,
            whiteSpace: "nowrap",
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}
