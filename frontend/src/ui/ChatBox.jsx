import React, { useState } from "react";
const API = import.meta.env.VITE_API_BASE || "http://localhost:8080";

export default function ChatBox() {
  const [q, setQ] = useState("Give me a brief summary.");
  const [a, setA] = useState("");
  const [style, setStyle] = useState("concise");

  const ask = async () => {
    setA("Thinking...");
    const r = await fetch(`${API}/api/chat`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: q, style })
    });
    const j = await r.json();
    setA(j.answer || "(no answer)");
  };

  return (
    <div>
      <div style={{display:"flex", gap:8}}>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Ask anything..." />
        <select value={style} onChange={e=>setStyle(e.target.value)}>
          <option value="concise">Concise</option>
          <option value="bullets">Bullets</option>
        </select>
        <button onClick={ask}>Ask</button>
      </div>
      <div style={{whiteSpace:"pre-wrap", marginTop:8}}>{a}</div>
    </div>
  );
}
