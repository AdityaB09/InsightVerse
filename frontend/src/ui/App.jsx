import React, { useEffect, useState } from "react";
import DropZone from "./DropZone";
import ChatBox from "./ChatBox";
import GraphView from "./GraphView";
import TimelineView from "./TimelineView";

const API = import.meta.env.VITE_API_BASE || "http://localhost:8080";

export default function App() {
  const [docs, setDocs] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [q, setQ] = useState("What are the core findings?");
  const [hits, setHits] = useState([]);

  const refreshDocs = async () => {
    const r = await fetch(`${API}/api/docs`);
    const j = await r.json();
    setDocs(j.docs || []);
    if (j.docs?.length && !selectedDoc) setSelectedDoc(j.docs[0].id);
  };

  useEffect(() => { refreshDocs(); }, []);

  const doSearch = async () => {
    const r = await fetch(`${API}/api/search`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: q, topK: 8 })
    });
    const j = await r.json();
    setHits(j.hits || []);
  };

  return (
    <div className="container">
      <div className="row" style={{alignItems:"center", marginBottom:16}}>
        <h1 style={{margin:0}}>InsightVerse</h1>
        <span className="pill">RAG</span>
        <span className="pill">Semantic Graph</span>
        <span className="pill">Timeline</span>
      </div>

      <div className="grid-2" style={{marginBottom:16}}>
        <div className="card">
          <h3>Drag & Drop PDFs</h3>
          <DropZone onUploaded={refreshDocs}/>
          <div style={{marginTop:10}}>
            <strong>Documents</strong>
            <ul>
              {docs.map(d => (
                <li key={d.id}>
                  <a href="#" onClick={() => setSelectedDoc(d.id)} style={{color:"#9cf"}}>
                    {d.title || d.source}
                  </a> · {new Date(d.created_at).toLocaleString()}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="card">
          <h3>Ask your corpus</h3>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Your question..." />
          <div style={{marginTop:8, display:"flex", gap:8}}>
            <button onClick={doSearch}>Semantic Search</button>
          </div>
          <div className="hits" style={{marginTop:10}}>
            {hits.map((h,i)=>(
              <div className="hit" key={i}>
                <div style={{opacity:.8, fontSize:12}}>score: {h.score?.toFixed(3)}</div>
                <div>{h.text}</div>
              </div>
            ))}
          </div>
          <div style={{marginTop:12}}>
            <ChatBox />
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Semantic Graph</h3>
          {selectedDoc ? <GraphView documentId={selectedDoc}/> : <em>Upload a document to view the graph.</em>}
        </div>
        <div className="card">
          <h3>Timeline of Discoveries</h3>
          {selectedDoc ? <TimelineView documentId={selectedDoc}/> : <em>Upload a document to view the timeline.</em>}
        </div>
      </div>
    </div>
  );
}
