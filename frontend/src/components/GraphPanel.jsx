import React, { useEffect, useMemo, useRef, useState } from "react";
import CytoscapeComponent from "react-cytoscapejs";
import { RefreshCw } from "lucide-react";

const API = (p) => (import.meta.env.VITE_API_URL || "http://localhost:8080") + p;

// Utility: build elements + apply simplification to keep graphs readable on messy data
function buildElements(raw, nodeLimit, minWeight, showAll) {
  const nodes = raw?.nodes || [];
  const edges = raw?.edges || [];

  let filteredEdges = edges.filter((e) => (e.weight ?? 1) >= minWeight);
  let nodeSet = new Set(filteredEdges.flatMap((e) => [e.source, e.target]));

  // If showAll: include isolated nodes too
  if (showAll) nodes.forEach((n) => nodeSet.add(n.id));

  // Reduce node count to top-degree nodes if needed
  if (nodeSet.size > nodeLimit) {
    const degree = new Map();
    filteredEdges.forEach((e) => {
      degree.set(e.source, (degree.get(e.source) || 0) + 1);
      degree.set(e.target, (degree.get(e.target) || 0) + 1);
    });
    const ranked = [...degree.entries()].sort((a, b) => b[1] - a[1]).slice(0, nodeLimit);
    nodeSet = new Set(ranked.map(([id]) => id));
    filteredEdges = filteredEdges.filter((e) => nodeSet.has(e.source) && nodeSet.has(e.target));
  }

  const usedNodes = nodes.filter((n) => nodeSet.has(n.id));
  const els = [
    ...usedNodes.map((n) => ({ data: { id: n.id, label: n.label ?? n.id } })),
    ...filteredEdges.map((e) => ({
      data: { source: e.source, target: e.target, weight: e.weight ?? 1 }
    }))
  ];
  return els;
}

export default function GraphPanel({ documentId }) {
  const [raw, setRaw] = useState(null);
  const [nodeLimit, setNodeLimit] = useState(60);
  const [minWeight, setMinWeight] = useState(2);
  const [layoutName, setLayoutName] = useState("cose");
  const [showAll, setShowAll] = useState(false);

  const elements = useMemo(
    () => buildElements(raw, nodeLimit, minWeight, showAll),
    [raw, nodeLimit, minWeight, showAll]
  );

  useEffect(() => {
    if (!documentId) { setRaw(null); return; }
    (async () => {
      const r = await fetch(API(`/api/graph/${documentId}`));
      const j = await r.json();
      setRaw(j);
    })();
  }, [documentId]);

  const layout = useMemo(() => {
    if (layoutName === "concentric") {
      return { name: "concentric", levelWidth: () => 1, minNodeSpacing: 15, animate: true };
    }
    if (layoutName === "grid") {
      return { name: "grid", fit: true, avoidOverlap: true };
    }
    // default: cose force-directed
    return { name: "cose", animate: true, padding: 20, nodeRepulsion: 10000, idealEdgeLength: 100 };
  }, [layoutName]);

  return (
    <>
      <div className="toolbar" style={{ marginBottom: 8 }}>
        <label className="small">Layout</label>
        <select className="select" value={layoutName} onChange={(e) => setLayoutName(e.target.value)}>
          <option value="cose">Force (CoSE)</option>
          <option value="concentric">Concentric</option>
          <option value="grid">Grid</option>
        </select>

        <label className="small">Node limit: {nodeLimit}</label>
        <input type="range" min="20" max="200" value={nodeLimit} className="slider" onChange={(e) => setNodeLimit(+e.target.value)} />

        <label className="small">Min edge weight: {minWeight}</label>
        <input type="range" min="1" max="10" value={minWeight} className="slider" onChange={(e) => setMinWeight(+e.target.value)} />

        <label className="small" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          Show isolated nodes
        </label>

        <button className="btn" onClick={() => setLayoutName((x) => x)}>
          <RefreshCw size={16} /> Stabilize
        </button>
      </div>

      <div style={{ height: 320 }}>
        <CytoscapeComponent
          elements={elements}
          style={{ width: "100%", height: "100%" }}
          layout={layout}
          stylesheet={[
            { selector: "node", style: {
                "background-color": "#7aa2ff",
                "label": "data(label)",
                "color": "#e8eefb",
                "font-size": 10,
                "text-wrap": "wrap",
                "text-max-width": 100,
                "width": "mapData(degree, 0, 10, 14, 28)",
                "height": "mapData(degree, 0, 10, 14, 28)",
                "border-color": "#cfe2ff",
                "border-width": 1
              }
            },
            { selector: "edge", style: {
                "width": "mapData(weight, 1, 10, 1, 5)",
                "line-color": "#6b7b96",
                "curve-style": "bezier",
                "target-arrow-shape": "triangle",
                "target-arrow-color": "#6b7b96"
              }
            },
            { selector: ":selected", style: { "background-color": "#27e1a1", "line-color": "#27e1a1", "target-arrow-color": "#27e1a1" } }
          ]}
          cy={(cy) => {
            // calculate degree to size nodes
            cy.nodes().forEach(n => n.data("degree", n.degree(false)));
            // highlight on hover
            cy.on("mouseover", "node", (e) => {
              const n = e.target;
              n.connectedEdges().addClass("hover");
              n.connectedEdges().style("line-color", "#a5b4fc");
            });
            cy.on("mouseout", "node", (e) => {
              const n = e.target;
              n.connectedEdges().removeClass("hover");
              n.connectedEdges().style("line-color", "#6b7b96");
            });
          }}
        />
      </div>

      {!documentId && <div className="small" style={{ marginTop: 8 }}>Select a document to render the graph.</div>}
    </>
  );
}
