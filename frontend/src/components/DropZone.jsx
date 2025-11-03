import React, { useRef, useState } from "react";
import { toast } from "react-hot-toast";

const API = (p) => (import.meta.env.VITE_API_URL || "http://localhost:8080") + p;

export default function DropZone({ onUploaded }) {
  const ref = useRef();
  const [busy, setBusy] = useState(false);

  const upload = async (files) => {
    const fd = new FormData();
    [...files].forEach((f) => fd.append("files", f));
    setBusy(true);
    try {
      const r = await fetch(API("/api/ingest"), { method: "POST", body: fd });
      const j = await r.json();
      if (j.ingested >= 1) {
        toast.success(`Ingested ${j.ingested} doc(s)`);
        onUploaded?.();
      } else toast.error(j.error || "Upload failed");
    } catch {
      toast.error("Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files?.length) upload(e.dataTransfer.files);
      }}
      className="kv"
    >
      <div className="small">Drop PDFs here</div>
      <div>
        <input
          ref={ref}
          type="file"
          accept="application/pdf"
          multiple
          onChange={(e) => upload(e.target.files)}
          style={{ display: "none" }}
        />
        <button className="btn" onClick={() => ref.current?.click()} disabled={busy}>
          {busy ? "Uploading…" : "Choose Files"}
        </button>
      </div>
    </div>
  );
}
