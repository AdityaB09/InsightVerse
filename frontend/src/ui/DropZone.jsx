import React, { useState } from "react";
const API = import.meta.env.VITE_API_BASE || "http://localhost:8080";

export default function DropZone({ onUploaded }) {
  const [busy, setBusy] = useState(false);

  const handleFiles = async files => {
    const fd = new FormData();
    for (const f of files) fd.append("files", f);
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/ingest`, { method: "POST", body: fd });
      if (!r.ok) alert(await r.text());
      else onUploaded?.();
    } finally { setBusy(false); }
  };

  return (
    <div
      className="card"
      style={{ padding: 12, textAlign: "center", borderStyle:"dashed" }}
      onDragOver={e=>e.preventDefault()}
      onDrop={e=>{ e.preventDefault(); handleFiles(e.dataTransfer.files); }}
    >
      <p>Drop PDFs here or</p>
      <input type="file" multiple accept="application/pdf" onChange={e=>handleFiles(e.target.files)} />
      {busy && <div style={{marginTop:8}}>Uploading & indexing...</div>}
    </div>
  );
}
