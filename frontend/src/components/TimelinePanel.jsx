import React, { useEffect, useState } from "react";
const API = (p) => (import.meta.env.VITE_API_URL || "http://localhost:8080") + p;

export default function TimelinePanel({ documentId }) {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    if (!documentId) { setEvents([]); return; }
    (async () => {
      const r = await fetch(API(`/api/timeline/${documentId}`));
      const j = await r.json();
      setEvents(j.events || []);
    })();
  }, [documentId]);

  return (
    <div style={{ maxHeight: 322, overflow: "auto", display: "grid", gap: 8 }}>
      {events.length === 0 && <div className="small">n/a</div>}
      {events.map((e, i) => (
        <div key={i} className="panel" style={{ background: "rgba(255,255,255,0.03)" }}>
          <div className="bd">
            <div className="small" style={{ marginBottom: 6 }}>{e.date || e.anchor || "—"}</div>
            <div style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>{e.summary}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
