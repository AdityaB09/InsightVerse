import React from "react";
import { Trash2 } from "lucide-react";

export default function DocList({ docs, selected, onSelect, onDelete }) {
  if (!docs?.length) return <div className="bd small">No documents yet</div>;

  return (
    <div>
      {docs.map((d) => {
        const sel = selected?.id === d.id;
        return (
          <div key={d.id} className={`doc ${sel ? "sel" : ""}`}>
            <div style={{ flex: 1, cursor: "pointer" }} onClick={() => onSelect?.(d)}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{d.title}</div>
              <div className="small">{new Date(d.created_at).toLocaleString()}</div>
            </div>
            <button className="btn danger" title="Delete" onClick={() => onDelete?.(d.id)}>
              <Trash2 size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
