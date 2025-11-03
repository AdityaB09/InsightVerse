import React, { useEffect, useMemo, useRef, useState } from "react";
import cytoscape from "cytoscape";
import fcose from "cytoscape-fcose";
import coseBilkent from "cytoscape-cose-bilkent";
import dagre from "cytoscape-dagre";
import tinycolor from "tinycolor2";

cytoscape.use(fcose);
cytoscape.use(coseBilkent);
cytoscape.use(dagre);

const LAYOUTS = {
  "Force (fCoSE)": { name: "fcose", quality: "default", nodeRepulsion: 4500, idealEdgeLength: 80, randomize: true, animate: "end" },
  "Force (CoSE-Bilkent)": { name: "cose-bilkent", animate: "end", gravity: 0.25, nodeRepulsion: 8000, idealEdgeLength: 120, edgeElasticity: 0.2 },
  "Concentric": { name: "concentric", minNodeSpacing: 40, animate: "end" },
  "Circle": { name: "circle", avoidOverlap: true, animate: "end" },
  "DAG (dagre)": { name: "dagre", rankDir: "LR", animate: "end" }
};

function choosePalette(n) {
  const base = tinycolor("#7dd3fc"); // light blue
  const colors = [];
  for (let i = 0; i < n; i++) {
    colors.push(base.clone().spin((i * (360 / Math.max(1, n))) % 360).saturate(10).toHexString());
  }
  return colors;
}

// Very light community detection: connected components over filtered graph.
function connectedComponents(nodes, edges) {
  const adj = new Map(nodes.map(n => [n.id, new Set()]));
  edges.forEach(e => { adj.get(e.source)?.add(e.target); adj.get(e.target)?.add(e.source); });
  const seen = new Set(); const comps = [];
  for (const n of nodes) {
    if (seen.has(n.id)) continue;
    const q = [n.id]; const comp = [];
    seen.add(n.id);
    while (q.length) {
      const u = q.pop();
      comp.push(u);
      for (const v of adj.get(u) ?? []) {
        if (!seen.has(v)) { seen.add(v); q.push(v); }
      }
    }
    comps.push(comp);
  }
  const byId = new Map(); comps.forEach((c, i) => c.forEach(id => byId.set(id, i)));
  return byId; // nodeId -> component index
}

function preprocess(raw, nodeLimit, minEdgeWeight, pruneIsolates) {
  const nodes = (raw.nodes ?? []).map(n => ({ id: n.id ?? n, label: n.label ?? String(n.label ?? n.id ?? "") }));
  const edges = (raw.edges ?? []).map(e => ({
    source: e.source, target: e.target, weight: typeof e.weight === "number" ? e.weight : 1
  }));

  // Compute degree & weights
  const degree = new Map(nodes.map(n => [n.id, 0]));
  edges.forEach(e => {
    if (e.weight < minEdgeWeight) return;
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
  });

  // Rank nodes by degree, cap
  const ranked = [...nodes].sort((a,b) => (degree.get(b.id)??0) - (degree.get(a.id)??0)).slice(0, nodeLimit);
  const keep = new Set(ranked.map(n => n.id));

  // Filter edges to kept nodes and min weight
  let keptEdges = edges.filter(e => keep.has(e.source) && keep.has(e.target) && e.weight >= minEdgeWeight);

  // Optionally drop isolates
  if (pruneIsolates) {
    const deg2 = new Map(ranked.map(n => [n.id, 0]));
    keptEdges.forEach(e => {
      deg2.set(e.source, (deg2.get(e.source) ?? 0) + 1);
      deg2.set(e.target, (deg2.get(e.target) ?? 0) + 1);
    });
    const rankedNonIso = ranked.filter(n => (deg2.get(n.id) ?? 0) > 0);
    return { nodes: rankedNonIso, edges: keptEdges };
  }
  return { nodes: ranked, edges: keptEdges };
}

export default function GraphPanel({ rawGraph, docTitle, loading }) {
  const [layoutKey, setLayoutKey] = useState("Force (fCoSE)");
  const [nodeLimit, setNodeLimit] = useState(150);
  const [minEdge, setMinEdge] = useState(2);
  const [pruneIso, setPruneIso] = useState(false);
  const cyRef = useRef(null);
  const divRef = useRef(null);

  const processed = useMemo(
    () => preprocess(rawGraph, nodeLimit, minEdge, pruneIso),
    [rawGraph, nodeLimit, minEdge, pruneIso]
  );

  useEffect(() => {
    if (!divRef.current) return;

    if (cyRef.current) {
      cyRef.current.destroy();
      cyRef.current = null;
    }

    const { nodes, edges } = processed;
    const comps = connectedComponents(nodes, edges);
    const palette = choosePalette(Math.max(1, Math.max(...Array.from(comps.values())) + 1));

    cyRef.current = cytoscape({
      container: divRef.current,
      elements: [
        ...nodes.map(n => ({
          data: { id: n.id, label: n.label },
          classes: `c${comps.get(n.id) ?? 0}`
        })),
        ...edges.map(e => ({ data: { source: e.source, target: e.target, weight: e.weight } }))
      ],
      style: [
        {
          selector: "node",
          style: {
            "background-color": "#60a5fa",
            "label": "data(label)",
            "color": "#dbeafe",
            "font-size": "10px",
            "text-wrap": "wrap",
            "text-max-width": "120px",
            "text-outline-width": 2,
            "text-outline-color": "#0b1220",
            "border-width": 1,
            "border-color": "#1f2937"
          }
        },
        {
          selector: "edge",
          style: {
            "width": "mapData(weight, 1, 10, 1, 4)",
            "curve-style": "haystack",
            "line-color": "#334155",
            "opacity": 0.7
          }
        },
        ...palette.map((c, i) => ({
          selector: `.c${i}`,
          style: { "background-color": c }
        })),
        { selector: ":selected", style: { "border-width": 3, "border-color": "#fde047" } }
      ],
      wheelSensitivity: 0.2,
      minZoom: 0.2,
      maxZoom: 3
    });

    const runLayout = () => {
      const opts = LAYOUTS[layoutKey] ?? LAYOUTS["Force (fCoSE)"];
      const l = cyRef.current.layout(opts);
      l.run();
    };
    runLayout();

    // Fit after animation ends
    cyRef.current.on("layoutstop", () => cyRef.current.fit(undefined, 30));

    // Tooltip-ish title
    cyRef.current.nodes().forEach(n => n.qtip?.destroy?.());

    return () => cyRef.current?.destroy();
  }, [processed, layoutKey]);

  const stabilize = () => {
    if (!cyRef.current) return;
    const opts = LAYOUTS[layoutKey] ?? LAYOUTS["Force (fCoSE)"];
    cyRef.current.layout({ ...opts, randomize: true }).run();
  };

  const exportPng = () => {
    if (!cyRef.current) return;
    const png = cyRef.current.png({ full: true, scale: 2, bg: "#0b1220" });
    const a = document.createElement("a");
    a.href = png;
    a.download = `${(docTitle || "graph").replace(/\s+/g, "_")}.png`;
    a.click();
  };

  return (
    <div className="card graph">
      <div className="card-header">
        <div className="title">Semantic Graph <span className="subtitle">{docTitle || ""}</span></div>
        <div className="toolbar">
          <label>Layout&nbsp;
            <select value={layoutKey} onChange={e => setLayoutKey(e.target.value)}>
              {Object.keys(LAYOUTS).map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
          <label>Node limit&nbsp;
            <input type="range" min={30} max={300} value={nodeLimit} onChange={e=>setNodeLimit(+e.target.value)} />
            <span className="hint">{nodeLimit}</span>
          </label>
          <label>Min edge weight&nbsp;
            <input type="range" min={1} max={10} value={minEdge} onChange={e=>setMinEdge(+e.target.value)} />
            <span className="hint">{minEdge}</span>
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={pruneIso} onChange={e=>setPruneIso(e.target.checked)} />
            Prune isolated
          </label>
          <button className="btn" onClick={stabilize}>Stabilize</button>
          <button className="btn ghost" onClick={exportPng}>Export PNG</button>
        </div>
      </div>

      <div className="graph-body">
        {loading ? <div className="loading">Building graph…</div> : null}
        <div ref={divRef} className="cy"></div>
        {!processed.nodes.length && !loading ? <div className="empty">No graph data (try lowering “Min edge weight” or increasing “Node limit”).</div> : null}
      </div>
    </div>
  );
}
