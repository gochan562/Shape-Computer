"use client";

import { useEffect, useRef, useState } from "react";
import type { Connection, Ev, Node, Program, Value } from "./types";
import { COLOR, dia, evaluate, fmt, path, poly, port, star, uid } from "./evaluator";
import { DEMOS } from "./demos"; // Dont forget to write demos!!!!!!!!!

// Toolbox palette
const PAL: Array<{ kind: Node["kind"]; label: string; glyph: string; op?: "add" | "multiply" | "divide"; val?: Value }> = [
  { kind:"value", label: "INT", glyph: "○", val: { valueType: "int", value: 5 } },
  { kind: "value", label:"NUM", glyph: "○", val: { valueType: "number", value: 3.14 } },
  { kind: "value", label:"STR", glyph:"○", val:  { valueType: "string", value: "x" } },
  { kind: "list", label:"LIST", glyph: "□", val: {valueType: "list", items: [
    { valueType: "int", value: 1 }, { valueType: "int", value: 2 }, { valueType: "int", value: 3 } ] } },
  { kind:"operator",label: "ADD", glyph: "□", op: "add" },
  { kind: "operator", label: "MUL", glyph: "⬟", op: "multiply" },
  { kind: "operator", label: "DIV", glyph: "★", op: "divide" },
  { kind: "print",label: "PRINT", glyph: "⬢" },
];

export function Machine() {
  const [prog, setProg] =useState<Program>({ nodes: [], conns: [] });
  const [sel, setSel]= useState<string | null>(null);
  const [editId, setEditId]= useState<string | null>(null);
  const [activeNodes, setActiveNodes] = useState<Set<string>>(new Set());
  const [activeConns, setActiveConns] = useState<Set<string>>(new Set());
  const [produced, setProduced]= useState <Record<string, Value>>({});
  const [outs, setOuts] =useState <Value[]>([]);
  const [errs, setErrs] =  useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [dragConn, setDragConn] = useState<{ from:string; x:number;y: number } | null>(null);
  const [highlightPort,setHighlightPort] = useState<{ id:string; port: string } |null>(null);
  const timer =useRef<ReturnType<typeof setTimeout> | null>(null);
  const svgRef= useRef<SVGSVGElement | null>(null);

  //mutations
  const addNode = (p: typeof  PAL[number], x: number, y: number) => {
    const n: Node = { id: uid("n"), kind: p.kind, x, y, value: p.val, op: p.op };
    setProg((s) => ({ ...s, nodes: [...s.nodes, n] }));
    setSel(n.id);
  };
  const moveNode = (id: string, x: number, y: number) =>
    setProg((s) => ({ ...s, nodes: s.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)) }));
  const delNode = (id: string) =>
    setProg((s) => ({ nodes: s.nodes.filter((n) => n.id !== id), conns: s.conns.filter((c) => c.from !== id && c.to !== id) }));
  const delConn = (id: string) => setProg((s) => ({ ...s, conns: s.conns.filter((c) => c.id !== id) }));
  const link = (from: string, to: string, port?: "A" | "B") =>
    setProg((s) => {
      // Each input port acccepts only one conn, so remove the curent conn to taht port before adding the new one

      const filtered = s.conns.filter((c) =>
        c.to===to ? (port ? c.port !== port : false) : true
      );
      if (filtered.some((c) => c.from === from && c.to === to && c.port === port)) return s;
      const c:  Connection = { id: uid("c"), from, to, port };
      return { ...s, conns: [...filtered, c] };
    });
  const clear =() => {
    if (!prog.nodes.length) return;
    if (!confirm("CLEAR machine?")) return;
    setProg({ nodes: [], conns: [] });
    setOuts([]); setErrs([]); setActiveNodes(new Set()); setActiveConns(new Set()); setProduced({}); setSel(null);
  };
  const loadDemo = (id: string) => {
    const d = DEMOS.find((x) => x.id === id);
    if (!d) return;
    const map =new Map<string, string>();
    const nodes= d.program.nodes.map((n) => { const id = uid("n"); map.set(n.id, id); return { ...n, id }; });
    const conns= d.program.conns.map((c) => ({ ...c, id: uid("c"), from: map.get(c.from)!, to: map.get(c.to)! }));
    setProg({ nodes, conns });
    setOuts([]); setErrs([]); setActiveNodes(new Set()); setActiveConns(new Set()); setProduced({}); setSel(null);
  };
  const setValue = (id: string, v: Value) =>
    setProg((s) => ({ ...s, nodes: s.nodes.map((n) => (n.id === id ? { ...n, value: v } : n)) }));

  // ruun!
  const run = () =>{
    if (timer.current) clearTimeout(timer.current);
    setActiveNodes(new Set()); setActiveConns(new Set()); setProduced({});
    setOuts([]); setErrs([]); setRunning(true);
    const r=  evaluate(prog);
    if (!r.evs.length) { setRunning(false); if (r.errs.length) setErrs(r.errs); return; }
    let i = 0;
    const aN = new Set<string>(), aC = new Set<string>();
    const prod  = {};
    const tick =() => {
      if (i >= r.evs.length) {
        setRunning(false); setActiveNodes(new Set()); setActiveConns(new Set());
        if (r.errs.length) setErrs(r.errs);
        return;
      }
      const e: Ev = r.evs[i++];
      if (e.type === "node") { aN.add(e.id); setActiveNodes(new Set(aN)); }
      else if(e.type === "conn") { aC.add(e.id); setActiveConns(new Set(aC)); }
      else if (e.type === "produce") { prod[e.id] = e.value; setProduced({ ...prod }); }
      else if (e.type === "out") setOuts((p) => [...p, e.value]);
      else if(e.type === "err") {
        setErrs((p) => [...p, e.msg]);
        if (e.id) setActiveNodes(new Set([e.id]));
      }
      timer.current = setTimeout(tick, 180);
    };
    timer.current = setTimeout(tick, 50);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // delete using keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA") return;
      if (e.key === "Delete" || e.key === "Backspace") {
        if (sel) {
          e.preventDefault();
          if (prog.nodes.some((n) => n.id === sel)) delNode(sel);
          else delConn(sel);
        }
      } else if (e.key === "Escape") setSel(null);
      else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); run(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sel, prog]);

  const toCanvas = (cx: number, cy: number) => {
    const r = svgRef.current?.getBoundingClientRect();
    return { x: cx - (r?.left ?? 0), y: cy - (r?.top ?? 0) };
  };
  const startNodeDrag = (id: string, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setSel(id);
    const n = prog.nodes.find((x) => x.id === id);
    if (!n) return;
    const p = toCanvas(e.clientX, e.clientY);
    const ox = p.x - n.x, oy = p.y - n.y;
    const move = (ev: MouseEvent) => moveNode(id, ev.clientX - (svgRef.current?.getBoundingClientRect().left ?? 0) - ox, ev.clientY - (svgRef.current?.getBoundingClientRect().top ?? 0) - oy);
    const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  };
  const startConn = (id: string, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const p = toCanvas(e.clientX, e.clientY);
    setDragConn({ from: id, x: p.x, y: p.y });
    // Track the nearest port ina ref so mouseup handler see the latest val
    // (avoiding stale closure over highlightPort state)..
    const nearRef: { id: string; port: string } | null = { id: "", port: "" };
    const move = (ev: MouseEvent) => {
      const cp = toCanvas(ev.clientX, ev.clientY);
      setDragConn((d) => (d ? { ...d, x: cp.x, y: cp.y } : d));
      //  hit-test
      let near: { id: string; port: string } | null = null;
      for (const n of prog.nodes) {
        const ports: Array<{ port: string; x: number; y: number }> =
          n.kind === "operator"
            ? [{ port: "A", ...port(n, "A") }, { port: "B", ...port(n, "B") }]
            : (n.kind === "print" || n.kind === "list") ? [{ port: "in", ...port(n, "in") }] : [];
        for (const pp of ports) {
          const dx = pp.x - cp.x, dy = pp.y - cp.y;
          if (Math.sqrt(dx * dx + dy * dy) < 24) near = { id: n.id, port: pp.port };
        }
      }
      if (near && near.id !== id) {
        nearRef.id = near.id; nearRef.port = near.port;
        setHighlightPort(near);
      } else {
        nearRef.id = ""; nearRef.port = "";
        setHighlightPort(null);
      }
    };
    const up = () => {
      window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up);

      setDragConn(null);
      if (nearRef.id && nearRef.id  !== id) {
        link(id, nearRef.id, nearRef.port === "in" ? undefined : (nearRef.port as "A" | "B"));
      }
      setHighlightPort(null);
    };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  };

  const editing= prog.nodes.find((n) => n.id=== editId);

  return (
    <div className="mc">
      <header className="mc-bar">
        <span className="mc-title">SHAPE COMPUTER</span>
        <span className="mc-meta">prototype v0.1</span>
        <span className= "mc-spacer" />

        {DEMOS.map((d) => (
          <button key={d.id} className="mc-btn mc-btn-ghost" onClick={() => loadDemo(d.id)} title={d.name}>{d.name}</button>
        ))}
        <button className="mc-btn mc-btn-warn" onClick={clear} disabled={running}>CLEAR</button>
        <button className="mc-btn mc-btn-go" onClick={run} disabled={running}>{running ? "..." : "RUN"}</button>
      </header>

      <div className="mc-main">
        <aside className="mc-side">
          <div className="mc-side-hdr">INSTRUCTIONS</div>
          {PAL.map((p) => (
            <button
              key={p.label}
              className="mc-inst"
              draggable
              onDragStart={(e) =>{ e.dataTransfer.setData("mc", JSON.stringify(p)); e.dataTransfer.effectAllowed = "copy"; }}
              onDoubleClick={()=>  addNode(p, 280, 240)}
              title={p.label}
            >
              <span className="mc-inst-glyph">{p.glyph}</span>
              <span className="mc-inst-label">{p.label}</span>
            </button>
          ))}
          <div className="mc-side-foot">
            <div className="mc-leg"><i style={{ background: COLOR.int }} />INT</div>
            <div className="mc-leg"><i style={{ background: COLOR.number }} /> NUM</div>
            <div className="mc-leg"><i style={{ background: COLOR.string }} />STR</div>
            <div className="mc-leg"><i style={{ background: COLOR.list }} />LIST </div>
          </div>
        </aside>

        <div className="mc-canvas-wrap">
          <svg
            ref={svgRef}
            className="mc-canvas"
            onClick={() => setSel(null)}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
            onDrop={(e) => {
              e.preventDefault();
              const raw = e.dataTransfer.getData("mc");
              if (!raw) return;
              const p = JSON.parse(raw) as typeof PAL[number] ;
              const pos = toCanvas(e.clientX, e.clientY);
              addNode(p,  pos.x, pos.y);
            }}
          >
            <defs>
              <pattern id= "mc-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="0.5" cy="0.5" r="0.6" fill="#1a2433" />
              </pattern>
              <marker id="mc-arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 z" fill={COLOR.conn} />
              </marker>
              <marker id="mc-arr-a" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d= "M0,0 L6,3 L0,6 z" fill={COLOR.connActive} />
              </marker>
            </defs>

            <rect width = "100%" height="100%" fill="url(#mc-grid)" />

            {/* connections */}
            {prog.conns.map((c) => {
              const f = prog.nodes.find((n) => n.id === c.from);
              const t =prog.nodes.find((n) => n.id=== c.to);

              if (!f || !t) return null;
              const a = port(f, "out");
              const tp = c.port ?? "in";
              const b = port(t, tp);
              const active = activeConns.has(c.id);
              return (
                <path
                  key={c.id}
                  d={path(a, b)}
                  className={`mc-conn ${active ? "is-active" : ""} ${sel === c.id ? "is-sel" : ""}`}
                  fill="none"
                  stroke={active ? COLOR.connActive : COLOR.conn}
                  strokeWidth={active? 2 : 1.25}
                  markerEnd={active ? "url(#mc-arr-a)" : "url(#mc-arr)"}
                  onClick={(e)=>{ e.stopPropagation(); setSel(c.id); }}
                />
              );
            })}

            {/* dragging Preview */}
            {dragConn && (() => {
              const f = prog.nodes.find((n) => n.id === dragConn.from);
              if (!f) return null;

              const a = port(f, "out");
              return <path d={path(a, { x: dragConn.x, y: dragConn.y })} fill="none" stroke={COLOR.connActive} strokeWidth="1.5" strokeDasharray="4 3" />;
            })()}

            {/* Nodes */}
            {prog.nodes.map((n) => {
              const isSel = sel === n.id;
              const isAct = activeNodes.has(n.id);
              const pv = produced[n.id];

              const v = pv ?? n.value;
              const stroke = n.kind === "value" || n.kind === "list"
                ? (v ? COLOR[v.valueType] : COLOR.op)
                : COLOR.op;
              return  (
                <g key={n.id} transform={`translate(${n.x},${n.y})`} className={`mc-node ${isSel ? "is-sel" : ""} ${isAct ? "is-active" : ""}`}>
                  {isAct && <circle r={40} fill="none" stroke={stroke} strokeWidth="0.6" opacity="0.5" className="mc-halo" />}

                  {n.kind ==="value" &&(() => {
                    const r =  dia(v) / 2;
                    return (
                      <>
                        <circle r={r} fill={stroke} stroke={isSel ? "#fff" : stroke} strokeWidth={isSel ? 2 : 1} opacity="0.95"
                          onMouseDown={(e)=>  startNodeDrag(n.id, e)}
                          onDoubleClick={() =>  setEditId(n.id)} />
                        <text textAnchor="middle" dy="0.35em" className="mc-label" fill="#08131f">{fmt(v)}</text>
                        <circle cx={r} cy={0} r="6" fill="#08131f" stroke={stroke} strokeWidth="1.5" className="mc-port" onMouseDown={(e) => startConn(n.id, e)} />
                      </>
                    );
                  })()}

                  {n.kind ==="list" && (() => {
                    const w = 80, h = 36;
                    return (
                      <>
                        <rect x={-w / 2} y={-h / 2} width={w} height={h} rx="2" fill="#0d1626" stroke={isSel ? "#fff" : COLOR.list} strokeWidth={isSel ? 1.5 : 1}
                          onMouseDown={(e) => startNodeDrag(n.id, e)}
                          onDoubleClick={() => setEditId(n.id)} />
                        <text textAnchor="middle" dy="0.35em" className="mc-label" fill={COLOR.list}>{fmt(v)}</text>
                        <circle cx={-w / 2} cy={0} r="6" fill="#08131f" stroke={COLOR.list} strokeWidth="1.5" className="mc-port"
                          onMouseDown={(e) => e.stopPropagation()} />
                        <circle cx={w / 2} cy={0} r="6" fill="#08131f" stroke={COLOR.list} strokeWidth="1.5" className="mc-port" onMouseDown={(e) => startConn(n.id, e)} />
                      </>
                    );
                  })()}

                  {n.kind === "operator" && (() => {
                    const h = 28;
                    let pts = "", lab = "";

                    if (n.op === "add")      { pts = poly(4, h);lab = "+"; }
                    else if (n.op=== "multiply") { pts = poly(5, h); lab = "×"; }
                    else                     { pts = star(5, h * 1.15, h * 0.5); lab = "÷"; }
                    const aP =port(n, "A"), bP = port(n, "B"), oP = port(n, "out");
                    return (
                      <>
                        <polygon points={pts} fill="#0d1626"  stroke={isSel ? "#fff" : COLOR.op} strokeWidth={isSel ? 2 : 1.25}
                          onMouseDown={(e) => startNodeDrag(n.id, e)} />

                        <text textAnchor="middle" dy="0.35em" className="mc-label" fill={COLOR.op}>{lab}</text>
                        {pv && (
                          <g transform={`translate(${h + 18}, 0)`}>
                            <circle r={dia(pv) / 2} fill={COLOR[pv.valueType]} stroke={COLOR[pv.valueType]} strokeWidth="1" opacity="0.95" className="mc-produced" />
                            <text textAnchor="middle" dy="0.35em" className="mc-label" fill="#08131f">{fmt(pv)}</text>
                          </g>
                        )}
                        <circle cx={aP.x - n.x} cy={aP.y - n.y} r="6" fill="#08131f" stroke={COLOR.op} strokeWidth="1.5"
                          className={`mc-port ${highlightPort?.id === n.id && highlightPort.port === "A" ? "is-hot" : ""}`} onMouseDown={(e) => e.stopPropagation()} />
                        <circle cx={bP.x - n.x} cy={bP.y - n.y} r="6" fill="#08131f" stroke={COLOR.op} strokeWidth="1.5"
                          className={`mc-port ${highlightPort?.id === n.id && highlightPort.port === "B" ? "is-hot" : ""}`} onMouseDown={(e) => e.stopPropagation()} />
                        <circle cx={oP.x - n.x} cy={oP.y - n.y} r="6" fill="#08131f" stroke={COLOR.op} strokeWidth="1.5" className="mc-port" onMouseDown={(e) => startConn(n.id, e)} />
                      </>
                    );
                  })()}

                  {n.kind === "print" && (() => {
                    const h = 32;
                    const pts = poly(6, h * 1.1, 0);
                    const iP = port(n, "in");
                    return (
                      <>
                        <polygon points={pts} fill="#0d1626" stroke={isSel ? "#fff" : COLOR.op} strokeWidth={isSel ? 2 : 1.25}
                          onMouseDown={(e) => startNodeDrag(n.id, e)} />
                        <text textAnchor="middle" dy="-0.15em" className="mc-label-sm" fill={COLOR.op}>PRINT</text>
                        {pv && <text textAnchor="middle" dy="1.1em" className="mc-label" fill={COLOR[pv.valueType]}>{fmt(pv)}</text>}
                        <circle cx={iP.x - n.x} cy={iP.y - n.y} r="6" fill="#08131f" stroke={COLOR.op} strokeWidth="1.5"
                          className={`mc-port ${highlightPort?.id === n.id && highlightPort.port === "in" ? "is-hot" : ""}`} onMouseDown={(e) => e.stopPropagation()} />
                      </>
                    );
                  })()}

                </g>

              );
            })}
          </svg>
        </div>

      </div>

      {/* style */}
      <footer className="mc-out">
        <span className="mc-out-prompt">OUTPUT&gt;</span>
        {outs.length === 0 && errs.length === 0 && <span className="mc-out-empty">{running ? "executing…" : "—"}</span>}
        {outs.map((o, i) => (
          <span key={i} className="mc-out-val" style={{ color: COLOR[o.valueType] }}>{fmt(o)}</span>
        ))}
        {errs.map((m, i) => (
          <span key={i} className="mc-out-err">{m}</span>
        ))}
      </footer>

      {/* pPrimitive  value editor*/}
      {editing && (editing.kind === "value" || editing.kind === "list") && (
        <div className="mc-edit" onMouseDown={() => setEditId(null)}>
          <form className="mc-edit-form" onMouseDown={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); setEditId(null); }}>
            <div className="mc-edit-hdr">EDIT VALUE</div>
            <div className="mc-edit-row">
              <label>TYPE</label>
              <div className="mc-edit-types">
                {(["int", "number", "string", "list"] as const).map((t) => (
                  <button key={t} type="button" className={`mc-edit-type ${editing.value?.valueType === t ? "is-on" : ""}`} style={{ borderColor: editing.value?.valueType === t ? COLOR[t] : undefined }}
                    onClick={() => {
                      if (t === "list") setValue(editing.id, { valueType: "list", items: editing.value?.valueType === "list" ? editing.value.items : [{ valueType: "int", value: 1 }] });
                      else if (t === "string") setValue(editing.id, { valueType: "string", value: String(editing.value?.value ?? "x") });

                      else setValue(editing.id, { valueType: t, value: t === "int" ? Math.round(Number(editing.value?.value ?? 0)) : Number(editing.value?.value ?? 0) });
                    }}>{t}</button>
                ))}
              </div>
            </div>
            {editing.value?.valueType === "list" ? (
              <div className="mc-edit-row">
                <label>ITEMS (comma-sep)</label>
                <input autoFocus className="mc-edit-input"
                  defaultValue={(editing.value.items ?? []).map((i) => i.valueType === "string" ? `"${i.value}"` : String(i.value)).join(",")}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); setEditId(null); } }}
                  onChange={(e) => {
                    const raw = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                    const items: Value[] = raw.map((s) => {
                      if (s.startsWith('"') && s.endsWith('"')) return { valueType: "string", value: s.slice(1, -1) };
                      const n = Number(s);
                      if (!isNaN(n)) return{ valueType: Number.isInteger(n) ? "int" : "number", value: n };
                      return { valueType:  "string", value: s };
                    });
                    setValue(editing.id,{ valueType: "list", items });
                  }}
                />
              </div>
            ) : (
              <div className="mc-edit-row">
                <label>VALUE </label>
                <input autoFocus className="mc-edit-input" type={editing.value?.valueType === "string" ? "text" : "number"}
                  defaultValue={String(editing.value?.value ?? "")}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); setEditId(null); } }}
                  onChange={(e) => {
                    const t = editing.value?.valueType ?? "int";
                    if (t === "string") setValue(editing.id, { valueType: "string", value: e.target.value });
                    else { const n = Number(e.target.value); setValue(editing.id, { valueType: t, value: t === "int" ? Math.round(n) : n }); }
                  }}
                />
              </div>
            )}
            <div className="mc-edit-foot">
              <button type="button" className="mc-btn mc-btn-ghost" onClick={() => setEditId(null)}>CLOSE</button>
            </div>

          </form>
        </div>

      )}
    </div>

  );
}


