import React, { useEffect, useState, Suspense } from "react";
import toast, { Toaster } from "react-hot-toast";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import DocList from "./components/DocList.jsx";
import TimelinePanel from "./components/TimelinePanel.jsx";

const GraphPanel = React.lazy(() => import("./components/GraphPanel.jsx"));

const API = import.meta.env.VITE_API_URL || "http://localhost:8080";

export default function App() {
  const [docs, setDocs] = useState([]);
  const [activeDoc, setActiveDoc] = useState(null);
  const [query, setQuery] = useState("What are the core findings?");
  const [answer, setAnswer] = useState("");
  const [graph, setGraph] = useState({ nodes: [], edges: [] });
  const [timeline, setTimeline] = useState([]);
  const [loadingGraph, setLoadingGraph] = useState(false);

  const fetchDocs = async () => {
    try {
      const r = await fetch(`${API}/api/docs`);
      const j = await r.json();
      const list = j.docs ?? [];
      setDocs(list);
      if (list.length && (!activeDoc || !list.find(d => d.id === activeDoc.id))) {
        setActiveDoc(list[0]);
      }
    } catch (e) {
      toast.error("Failed to load documents");
      console.error(e);
    }
  };

  useEffect(() => { fetchDocs(); }, []);

  const uploadFiles = async (files) => {
    const fd = new FormData();
    for (const f of files) fd.append("files", f);
    const p = fetch(`${API}/api/ingest`, { method: "POST", body: fd });
    toast.promise(p, { loading: "Ingesting…", success: "Ingested", error: "Upload failed" });
    await p;
    await fetchDocs();
  };

  const deleteDoc = async (id) => {
    const p = fetch(`${API}/api/docs/${id}`, { method: "DELETE" });
    toast.promise(p, { loading: "Deleting…", success: "Deleted", error: "Delete failed" });
    const r = await p; if (!r.ok) return;
    await fetchDocs();
    if (activeDoc?.id === id) {
      setActiveDoc(null); setGraph({ nodes: [], edges: [] }); setTimeline([]); setAnswer("");
    }
  };

  const reloadInsights = async (docId) => {
    if (!docId) return;
    setLoadingGraph(true);
    try {
      const [gr, tr] = await Promise.all([
        fetch(`${API}/api/graph/${docId}`),
        fetch(`${API}/api/timeline/${docId}`)
      ]);
      const gj = await gr.json();
      const tj = await tr.json();
      setGraph({ nodes: gj.nodes ?? [], edges: gj.edges ?? [] });
      setTimeline(tj.events ?? []);
    } catch (e) {
      console.error(e);
      setGraph({ nodes: [], edges: [] });
      setTimeline([]);
    } finally {
      setLoadingGraph(false);
    }
  };

  useEffect(() => { if (activeDoc?.id) reloadInsights(activeDoc.id); }, [activeDoc?.id]);

  const askSearch = async () => {
    try {
      const r = await fetch(`${API}/api/search`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ Query: query, TopK: 6 })
      });
      const j = await r.json();
      setAnswer((j.hits ?? []).map(h => `• ${h.text}`).join("\n"));
    } catch { toast.error("Search failed"); }
  };

  const askSummary = async () => {
    try {
      const r = await fetch(`${API}/api/chat`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ Query: query, Style: "concise" })
      });
      const j = await r.json();
      setAnswer(j.answer ?? "");
    } catch { toast.error("Chat failed"); }
  };

  const resetAll = async () => {
    const p = fetch(`${API}/api/reset`, { method: "POST" });
    toast.promise(p, { loading: "Resetting…", success: "Cleared", error: "Reset failed" });
    await p;
    setDocs([]); setActiveDoc(null); setGraph({ nodes: [], edges: [] }); setTimeline([]); setAnswer("");
  };

  return (
    <ErrorBoundary>
      <Toaster position="top-right" />
      <div className="container">
        <header className="header">
          <div className="brand">InsightVerse</div>
          <div className="actions">
            <button className="btn ghost" onClick={resetAll}>Reset All</button>
            <a className="btn ghost" href={`${API}/swagger`} target="_blank" rel="noreferrer">API Docs</a>
          </div>
        </header>

        <div className="grid">
          <aside className="sidebar">
            <div className="card">
              <div className="card-header"><div className="title">Drag & Drop PDFs</div></div>
              <div className="dropzone"
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); uploadFiles(e.dataTransfer.files); }}>
                Drop PDFs here
              </div>
              <input type="file" accept="application/pdf" multiple
                     onChange={e => uploadFiles(e.target.files)} />
            </div>

            <div className="card">
              <div className="card-header"><div className="title">Documents</div></div>
              <DocList
                docs={docs}
                activeId={activeDoc?.id}
                onSelect={setActiveDoc}
                onDelete={deleteDoc}
              />
            </div>
          </aside>

          <main className="main">
            <div className="card">
              <div className="card-header">
                <div className="title">Ask your corpus</div>
              </div>
              <div className="askbar">
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="What are the core findings?"
                />
                <button className="btn" onClick={askSearch}>Semantic Search</button>
                <button className="btn ghost" onClick={askSummary}>Give me a brief summary</button>
              </div>
              <textarea className="answer" value={answer} readOnly />
            </div>

            <div className="row">
              <Suspense fallback={<div className="card" style={{height:520,display:"flex",alignItems:"center",justifyContent:"center"}}>Loading graph…</div>}>
                <GraphPanel rawGraph={graph} docTitle={activeDoc?.title} loading={loadingGraph} />
              </Suspense>
              <TimelinePanel items={timeline} />
            </div>
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
}
