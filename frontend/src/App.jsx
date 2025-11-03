import React, { useEffect, useState } from "react";
import { Toaster, toast } from "react-hot-toast";
import { BotMessageSquare, RefreshCw, Search, Trash2, Upload, Wand2 } from "lucide-react";

import DocList from "./components/DocList.jsx";
import DropZone from "./components/DropZone.jsx";
import GraphPanel from "./components/GraphPanel.jsx";
import TimelinePanel from "./components/TimelinePanel.jsx";

const API = (p) => (import.meta.env.VITE_API_URL || "http://localhost:8080") + p;

export default function App() {
  const [docs, setDocs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [q, setQ] = useState("What are the core findings?");
  const [hits, setHits] = useState([]);
  const [answer, setAnswer] = useState("");

  const loadDocs = async () => {
    const r = await fetch(API("/api/docs"));
    const j = await r.json();
    setDocs(j.docs || []);
    if ((j.docs || []).length && !selected) setSelected(j.docs[0]);
  };

  useEffect(() => { loadDocs(); }, []);

  const onUploaded = async () => {
    await loadDocs();
    toast.success("Ingested successfully");
  };

  const doSearch = async () => {
    const r = await fetch(API("/api/search"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ Query: q, TopK: 5 })
    });
    const j = await r.json();
    setHits(j.hits || []);
  };

  const ask = async () => {
    const r = await fetch(API("/api/chat"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ Query: q, Style: "concise" })
    });
    const j = await r.json();
    setAnswer(j.answer || "");
  };

  const deleteDoc = async (id) => {
    await fetch(API(`/api/docs/${id}`), { method: "DELETE" });
    if (selected?.id === id) setSelected(null);
    await loadDocs();
  };

  const resetAll = async () => {
    await fetch(API("/api/reset"), { method: "POST" });
    setHits([]); setAnswer(""); setSelected(null); await loadDocs();
    toast("Reset complete");
  };

  return (
    <div className="app">
      <Toaster position="top-right" />
      <div className="header">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800 }}>InsightVerse</h1>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="btn good" onClick={resetAll}><RefreshCw size={16}/> Reset All</button>
            <a className="btn" href="http://localhost:8080/swagger" target="_blank" rel="noreferrer">API Docs</a>
          </div>
        </div>
      </div>

      <div className="row">
        {/* LEFT */}
        <div className="col">
          <div className="panel">
            <div className="hd"><div>Drag & Drop PDFs</div><Upload size={16} /></div>
            <div className="bd"><DropZone onUploaded={onUploaded} /></div>
          </div>

          <div className="panel" style={{ marginTop: 16 }}>
            <div className="hd">
              <div>Documents</div>
              <div className="badge">{docs.length}</div>
            </div>
            <div className="doclist">
              <DocList docs={docs} selected={selected} onSelect={setSelected} onDelete={deleteDoc} />
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="col">
          <div className="panel">
            <div className="hd">
              <div>Ask your corpus <span className="badge">RAG</span></div>
            </div>
            <div className="bd">
              <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="What are the core findings?" />
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button className="btn brand" onClick={doSearch}><Search size={16}/> Semantic Search</button>
                <button className="btn good" onClick={ask}><BotMessageSquare size={16}/> Give me a brief summary</button>
              </div>

              {hits?.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div className="small" style={{ marginBottom: 6 }}>Top passages</div>
                  <div className="code">
                    {hits.map((h, i) => `#${i+1} • score ${ (h.score ?? 0).toFixed(3) }\n${h.text}\n\n`).join("")}
                  </div>
                </div>
              )}

              {answer && (
                <div style={{ marginTop: 12 }}>
                  <div className="small" style={{ marginBottom: 6 }}>Answer</div>
                  <div className="code">{answer}</div>
                </div>
              )}
            </div>
          </div>

          <div className="grid2" style={{ marginTop: 16 }}>
            <div className="panel">
              <div className="hd">
                <div>Semantic Graph</div>
                <div className="small">{selected ? selected.title : "Select a doc"}</div>
              </div>
              <div className="bd"><GraphPanel documentId={selected?.id} /></div>
            </div>

            <div className="panel">
              <div className="hd">
                <div>Timeline of Discoveries</div>
                <div className="small">{selected ? selected.title : "Select a doc"}</div>
              </div>
              <div className="bd"><TimelinePanel documentId={selected?.id} /></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
