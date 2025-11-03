import React, { useEffect, useState } from "react";
import CytoscapeComponent from "react-cytoscapejs";

const API = import.meta.env.VITE_API_BASE || "http://localhost:8080";

export default function GraphView({ documentId }) {
  const [elements, setElements] = useState([]);

  useEffect(() => {
    (async () => {
      const r = await fetch(`${API}/api/graph/${documentId}`);
      const j = await r.json();
      const els = [
        ...j.nodes.map(n => ({ data: { id: n.id, label: n.label } })),
        ...j.edges.map(e => ({ data: { id: e.id, source: e.source, target: e.target } }))
      ];
      setElements(els);
    })();
  }, [documentId]);

  return (
    <div style={{height: 420}}>
      <CytoscapeComponent
        elements={elements}
        style={{ width: "100%", height: "100%", background:"#0b0f14" }}
        layout={{ name: "cose", animate: false }}
        stylesheet={[
          { selector: "node", style: { label: "data(label)", "background-color":"#2e86ff", color:"#dfe7f1", "font-size":"10px" } },
          { selector: "edge", style: { width: 1, "line-color":"#335", "target-arrow-color":"#335" } }
        ]}
      />
    </div>
  );
}
