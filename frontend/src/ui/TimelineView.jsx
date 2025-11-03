import React, { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import { Chart, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend } from "chart.js";
Chart.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend);

const API = import.meta.env.VITE_API_BASE || "http://localhost:8080";

export default function TimelineView({ documentId }) {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    (async () => {
      const r = await fetch(`${API}/api/timeline/${documentId}`);
      const j = await r.json();
      setEvents(j.events || []);
    })();
  }, [documentId]);

  const labels = events.map(e => e.date || "");
  const data = {
    labels,
    datasets: [{
      label: "Discoveries",
      data: events.map((_,i)=> i+1),
      tension: 0.2
    }]
  };

  return (
    <div>
      <div style={{height:280}}><Line data={data} options={{ plugins:{legend:{display:false}}, scales:{y:{display:false}} }} /></div>
      <ol>
        {events.map((e,i)=>(
          <li key={i} style={{marginBottom:8}}>
            <strong>{e.title}</strong> — <em>{e.date}</em>
            <div>{e.summary}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}
