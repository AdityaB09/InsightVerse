import React from "react";

export default function TimelinePanel({ items }) {
  return (
    <div className="card timeline">
      <div className="card-header">
        <div className="title">Timeline of Discoveries</div>
      </div>
      <ol className="timeline-list">
        {(items ?? []).length === 0 ? (
          <div className="empty">n/a</div>
        ) : (
          items.map((e, i) => (
            <li key={i} className="timeline-item">
              <div className="dot" />
              <div className="content">
                <div className="when">{e.when || ""}</div>
                <div className="what">{e.what || e.summary || e.text || ""}</div>
              </div>
            </li>
          ))
        )}
      </ol>
    </div>
  );
}
