import React from "react";
import cn from "classnames";

export default function DocList({ docs, activeId, onSelect, onDelete }) {
  if (!docs?.length) return <div className="empty">No documents yet.</div>;
  return (
    <ul className="doclist">
      {docs.map(d => (
        <li key={d.id} className={cn({ active: activeId === d.id })}>
          <button className="doclink" onClick={() => onSelect(d)} title={d.title}>
            <div className="doc-title">{d.title}</div>
            <div className="doc-meta">{new Date(d.created_at).toLocaleString()}</div>
          </button>
          <button className="trash" title="Delete" onClick={(e)=>{e.stopPropagation(); onDelete(d.id);}}>🗑</button>
        </li>
      ))}
    </ul>
  );
}
