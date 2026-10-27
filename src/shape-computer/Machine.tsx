"use client";

import { useEffect, useRef, useState } from "react";
import type { Connection, Ev, Node, Program, Value } from "./types";
import { COLOR, dia, diamond, evaluate, fmt, path, poly, port, star, uid } from "./evaluator";
import { Runtime, codeToKeyName} from "./runtime"
import { DEMOS } from "./demos"; // Dont forget to write demos!!!!!!!!!

type PalEntry = {
  kind: Node["kind"];
  label: string;
  glyph: string;
  op?: "add"|"multiply"|"divide"|"lt"|"gt"|"eq";
  val?: Value;
  name?: string;
};

// Toolbox palette
const PAL: PalEntry[]= [
  { kind:"value", label: "INT", glyph: "○", val: { valueType: "int", value: 5 } },
  { kind: "value", label:"NUM", glyph: "○", val: { valueType: "number", value: 3.14 } },
  { kind: "value", label:"STR", glyph:"○", val:  { valueType: "string", value: "x" } },
  { kind: "list", label:"LIST", glyph: "□", val: {valueType: "list", items: [
    { valueType: "int", value: 1 }, { valueType: "int", value: 2 }, { valueType: "int", value: 3 } ] } },
  { kind:"operator",label: "ADD", glyph: "□", op: "add" },
  { kind: "operator", label: "MUL", glyph: "⬟", op: "multiply" },
  { kind: "operator", label: "DIV", glyph: "★", op: "divide" },
  { kind: "print",label: "PRINT", glyph: "⬢" },
  { kind: "operator", label: "LT", glyph: "△", op:"lt"},
  { kind: "operator", label: "GT", glyph: "△", op:"gt"},
  { kind: "operator", label: "EQ", glyph: "△", op: "eq"},
  { kind: "if", label: "IF", glyph: "◇"},
  { kind: "read", label: "READ", glyph: "◍", name: "x"},
  {kind: "write", label: "WRITE", glyph:"▣", name: "x"},
  { kind: "key", label: "KEY", glyph: "◉", name: "RIGHT"},
  { kind: "display", label: "DISP", glyph: "▭", name: "out"},
  {kind: "xy", label: "XY", glyph: "▣"} //had to use cuz I coudnt find others :(
];


function opLabel(op?: string): string {
  if (op==="add") return "+";
  if (op === "multiply") return "×";
  if (op ==="divide") return "÷";
  if (op === "lt") return "<";
  if (op=== "gt") return ">";
  if (op === "eq") return "=";
  return "?";

}

function inputPorts(n: Node): Array<{port: string; x: number; y: number}>{
  if (n.kind === "operator"){
    return [{port: "A", ...port(n, "A")}, {port: "B", ...port(n, "B")}];
  }
  if (n.kind === "if") {
    return [{port: "in", ...port(n, "in")}, {port: "A", ...port(n,"A")}, {port: "B", ...port(n,"B")}];

  }
  if (n.kind === "xy") {
    return [{port: "A", ...port(n,"A")}, {port: "B", ...port(n, "B")}];
  }

  if(n.kind === "print" || n.kind === "list" || n.kind === "write" || n.kind === "display"){
    return [{port:"in", ...port(n, "in")}];
  }
  return[];
}
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
  const [looping, setLooping] = useState(false)
  const [stageTick, setStageTick] = useState(0);
  const [dragConn, setDragConn] = useState<{ from:string; x:number;y: number } | null>(null);
  const [highlightPort,setHighlightPort] = useState<{ id:string; port: string } |null>(null);
  //gotta zoom them out cuz it's getting messy from hr
  const [view, setView] = useState({ x:0, y:0, zoom: 1});
  const viewRef = useRef(view);
  viewRef.current = view;
  
  const timer =useRef<ReturnType<typeof setTimeout> | null>(null);
  const svgRef= useRef<SVGSVGElement | null>(null);
  const rt = useRef<Runtime>(new Runtime());
  const loopTimer = useRef<ReturnType<typeof setInterval> | null>(null);

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
      // Each input port acccepts only one conn, 
      //  so remove the curent conn to taht port before adding the new one

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
    stopLoop();
    rt.current.reset();
    setProg({ nodes: [], conns: [] });
    setOuts([]); setErrs([]); setActiveNodes(new Set()); setActiveConns(new Set()); setProduced({}); setSel(null);
    setView({x:0, y:0, zoom:1});
    setStageTick(t => t+1);
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
  const setName = (id: string, name: string) =>
    setProg((s) => ({...s, nodes: s.nodes.map((n) => (n.id === id ? {...n, name}:n))}));
  // ruun!
  const run = () =>{
    if (timer.current) clearTimeout(timer.current);
    setActiveNodes(new Set()); setActiveConns(new Set()); setProduced({});
    setOuts([]); setErrs([]); setRunning(true);
    const r=  evaluate(prog);
    setStageTick(t => t+1);
    if (!r.evs.length) { setRunning(false); if (r.errs.length) setErrs(r.errs); return; }
    let i = 0;
    const aN = new Set<string>(), aC = new Set<string>();
    const prod: Record<string, Value> = {};
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

  //loops and reset

  const startLoop = () => {
    stopLoop();
    setLooping(true);
    setActiveNodes(new Set());
    setActiveConns(new Set());
    setOuts([]);
    setErrs([]);
    loopTimer.current = setInterval (() => {
      const r = rt.current.tick(prog);
      setStageTick(t => t+1);
      const aN = new Set<string>();
      const aC = new Set<string>();
      for (const e of r.evs) {
        if (e.type=== "node") aN.add(e.id);
        if (e.type === "conn") aC.add(e.id);
      }
      setActiveNodes(aN); setActiveConns(aC);
      setProduced({...r.produced});
      if (r.errs.length) setErrs(r.errs);
    }, 200);
  };

  const stopLoop = () => {
    if (loopTimer.current) {clearInterval (loopTimer.current); loopTimer.current=null;}
    setLooping(false);
    setActiveNodes(new Set()); setActiveConns(new Set());

  };
  const reset = () => {
    rt.current.reset();
    setOuts([]); setErrs([]); setActiveNodes(new Set()); setActiveConns(new Set()); setProduced({});
    setStageTick(t => t+1);
  }

  useEffect(() => () => {if (timer.current) clearTimeout(timer.current); }, []);

  
  //wheel zooom
  useEffect (() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      if (!rect) return;
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const v = viewRef.current;
      const cx = (mx - v.x)/v.zoom, cy = (my-v.y)/v.zoom;
      const factor = e.deltaY<0 ? 1.1 : 1 / 1.1;
      const newZoom = Math.max(0.25, Math.min(4, v.zoom*factor));
      setView({ zoom: newZoom, x: mx - cx * newZoom, y: my - cy * newZoom });
    };
    svg.addEventListener("wheel", onWheel, {passive: false});
    return () => svg.removeEventListener("wheel", onWheel);
  },[]);

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
      const kn = codeToKeyName(e.code);
      if (kn) {
        e.preventDefault();
        rt.current.setKey(kn, true);
        setStageTick( t => t+1);
      }
    };

    //new key detecte
    const onUp = (e: KeyboardEvent) => {
      const kn = codeToKeyName(e.code);
      if (kn) {
        rt.current.setKey(kn, false);
        setStageTick(t=>1+t);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onUp);
    return () => {window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onUp)};
  }, [sel, prog]);

  const toCanvas = (cx: number, cy: number) => {
    const r = svgRef.current?.getBoundingClientRect();
    const v = viewRef.current;
    return { x: cx - (r?.left ?? 0) -v.x, y: (cy - (r?.top ?? 0)- v.y) / v.zoom};
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
        if (n.id === id) continue;
        for (const pp of inputPorts(n)) {
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

  //panning

  const onCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const tgt = e.target as Element;
    if (tgt.tagName !== "svg" && tgt.id !== "mc-bg") return;
    setSel(null);
    let lastX = e.clientX, lastY = e.clientY;
    const move = (ev: MouseEvent) => {
      const dx = ev.clientX-lastX, dy = ev.clientY- lastY;
      lastX = ev.clientX;
      lastY = ev.clientY;
      const v = viewRef.current;
      setView({...v, x: v.x+dx, y: v.y+dy});
    };

    const up = () => {window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up) ;
    }
  }

  const editing= prog.nodes.find((n) => n.id=== editId);
  void stageTick;
  const stateSnap = rt.current.stateSnapshot();
  const displaySnap: Array<{ name: string; value: Value}> = Array.from(rt.current.displays.entries()).map(([name,value]) => ({name,value}));
  const xyPos = rt.current.xy;
  const heldKeys = Array.from(rt.current.inputs);

  return (
    <div className="mc">
      <header className="mc-bar">
        <span className="mc-title">SHAPE COMPUTER</span>
        <span className= "mc-spacer" />

        {DEMOS.map((d) => (
          <button key={d.id} className="mc-btn mc-btn-ghost" onClick={() => loadDemo(d.id)} title={d.name}>{d.name}</button>
        ))}
        <button className="mc-btn mc-btn-warn" onClick={clear} disabled={running || looping}>CLR</button>
        <button className="mc-btn mc-btn-warn" onClick ={reset} disabled={running}>RESET</button>
        <button className="mc-btn mc-btn-ghost" onClick={running ? undefined: run} disabled={running||looping}>{running ? "..." : "RUN"}</button>
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
            <div className= "mc-leg"><i style={{ background: COLOR.read}}/>READ</div>
            <div className="mc-leg"><i style={{ background: COLOR.write }} /> WRITE</div>
            <div className="mc-leg"><i style= {{background: COLOR.key}}/>KEY</div>
            <div className="mc-leg"><i style={{background: COLOR.if}}/>IF</div>
            <div className="mc-leg"><i style={{background: COLOR.display}}/>DISP</div>
            <div className="mc-leg"><i style={{background: COLOR.xy}}/>XY</div>

          </div>
        </aside>

        <div className="mc-canvas-wrap">
          <svg
            ref={svgRef}
            className="mc-canvas"
            onMouseDown = {onCanvasMouseDown}
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

              <marker id="mc-arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 z" fill={COLOR.conn} />
              </marker>
              <marker id="mc-arr-a" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d= "M0,0 L6,3 L0,6 z" fill={COLOR.connActive} />
              </marker>
            </defs>

          <g transform={`translate(${view.x}, ${view.y})scale(${view.zoom})`}>
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
              const stroke = 
                n.kind === "value" || n.kind === "list"
                  ? (v ? COLOR[v.valueType] : COLOR.op)
                  : n.kind === "read" ? COLOR.read
                  : n.kind === "write"? COLOR.write
                  : n.kind === "key" ? COLOR.key
                  : n.kind === "if"? COLOR.if
                  : n.kind === "display"? COLOR.display
                  : n.kind=== "xy"? COLOR.xy
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

                  {n.kind === "read"&& (()=> {
                    const cv = rt.current.readVar(n.name ?? "_");
                    const r = dia(cv)/2;
                    return (
                      <>
                        <circle r={r} fill={stroke} stroke={isSel ? "#fff" : stroke} strokeWidth={isSel ? 2 : 1} opacity="0.95"
                          onMouseDown= {(e)=> startNodeDrag(n.id,e)}
                          onDoubleClick={() => setEditId(n.id)}/>
                        <text textAnchor="middle" dy="-0.1em" className="mc-label-sm" fill="#08131f">{n.name ?? "_"}</text>
                        <text textAnchor="middle" dy="1em" className="mc-label" fill="#08131f">{fmt(cv)}</text>
                        <circle cx={r} cy={0} r="6" fill="#08131f" stroke={stroke} strokeWidth="1.5" className="mc-port" onMouseDown={(e) => startConn(n.id, e)} />
                      </>
                    );
                  })()}

                  {n.kind === "key" && (() => {
                    const pressed = rt.current.isKey((n.name ?? "").toUpperCase());
                    const r = 18;
                    return (
                      <>
                        <circle r={r} fill={pressed ? stroke: "#0d1626"} stroke={isSel ? "#fff" : stroke} strokeWidth={isSel ? 2:1.5} opacity={pressed ? 0.95 : 0.6}
                          onMouseDown={(e) => startNodeDrag(n.id, e)}
                          onDoubleClick={() => setEditId(n.id)} />
                        <text textAnchor="middle" dy="-0.1em" className ="mc-label-sm" fill={pressed ? "#08131f" : stroke}>{(n.name ?? "?").slice(0, 5)}</text>
                        <text textAnchor ="middle"dy="1em" className= "mc-label" fill={pressed ? "#08131f" : stroke}> {pressed ? "1" : "0"}</text>
                        <circle cx={r} cy= {0} r="6" fill= "#08131f" stroke={stroke} strokeWidth ="1.5"  className= "mc-port" onMouseDown={(e) => startConn( n.id, e) } />

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

                  {n.kind === "if" && (() => {
                    const h = 32;
                    const pts = diamond(h);
                    const iP = port(n, "in")m, aP = port(n, "A"), bP = port(n, "B"), oP = port(n, "out");
                    return (
                      <>
                        <polygon points={pts} fill = "#0d1626" stroke={isSel ? "#fff" : COLOR.if} strokeWidth={isSel ? 2 : 1.25}
                          onMouseDown={(e) => startNodeDrag(n.id, e)} />
                        <text textAnchor="middle" dy="0.35em" className="mc-label-sm" fill={COLOR.if}>IF</text>
                        {pv && (
                          <g transform={`translate(${h+18},0)`}>
                            <circle r={dia(pv) / 2} fill={COLOR[pv.valueType]} stroke={COLOR[pv.valueType]} strokeWidth="1" opacity="0.95" className="mc-produced" />
                            <text textAnchor="middle" dy="0.35em" className="mc-label" fill="#08131f">{fmt(pv)}</text>

                          </g>
                        )}
                          <circle cx= {iP.x, n.x} cy={iP.y - n.y} r = "6" fill ="#08131f" stroke={COLOR.if} strokeWidth="1.5"
                            className={`mc-port ${highlightPort?.id === n.id && highlightPort.port ==="in" ? "is-hot" : ""}`} onMouseDown={(e) => e.stopPropagation()} />
                          <circle cx={aP.x - n.x} cy={aP.y - n.y} r="6" fill="#08131f" stroke= {COLOR.if} strokeWidth="1.5"
                            className={`mc-port ${highlightPort?.id === n.id && highlightPort.port=== "A"? "is-hot" : ""}`} onMouseDown={(e) => e.stopPropagation()} />
                          <circle cx={bP.x - n.x} cy={bP.y - n.y} r="6" fill = "#08131f" xtroke={COLOR.if} strokeWidth="1.5"
                            className={`mc-port${highlightPort?.id === n.id && highlightPort.port==="B" ? "is-hot":""}`} onMouseDown={(e) => e.stopPropagation()} />
                          <circle cx={oP.x - n.x} cy={oP.y - n.y} r="6" fill="#08131f" stroke={COLOR.if} strokeWidth="1.5" className="mc-port" onMouseDown={(e) => startConn(n.id, e)} />
                          
                      </>
                    );
                  })()}
                  {/*btw most are template codes so I just copy paste them... is it fine? */}
                  {n.kind === "write" && (() => {
                    const h = 32;
                    const pts = poly(5,h);
                    const iP = port(n, "in");
                    return (
                      <>
                        <polygon points={pts} fill="#0d1626" stroke={isSel ? "#fff" : COLOR.write} strokeWidth={isSel ? 2 : 1.25}
                          onMouseDown={(e) => startNodeDrag(n.id, e)}
                          onDoubleClick={()=> setEditId(n.id)}/>
                        <text textAnchor="middle" dy="-0.1em" className="mc-label-sm" fill={COLOR.write}>WRITE</text>
                        <text textAnchor="middle" dy="1em" className="mc-label" fill={COLOR.write}>{n.name ?? "_"}</text>
                        <circle cx={iP.x - n.x} cy={iP.y - n.y} r="6" fill="#08131f" stroke={COLOR.write} strokeWidth="1.5"
                          className={`mc-port ${highlightPort?.id === n.id && highlightPort.port === "in" ? "is-hot" : ""}`} onMouseDown={(e) => e.stopPropagation()} />

                      </>
                    );
                  })()}


                  {n.kind === "display"&& (() => {
                    const w = 70, h = 32;
                    const iP =port(n, "in");
                    const cv = rt.current.displays.get(n.name ?? "_");
                    return (
                      <>
                        <rect x={-w/2} y={-h/2} width ={w} height={h} rx ="1" fill = "#0d1626" stroke={isSel ? "#fff" : COLOR.display} strokeWidth={isSel ? 1.5 : 1}
                          onMouseDown={(e) => startNodeDrag(n.id, e)}
                          onDoubleClick={() => setEditId(n.id)} />
                        <text textAnchor="middle" dy="-0.15em" className="mc-label-sm" fill={COLOR.display}>DISP</text>
                        <text textAnchor="middle" dy="1em" className="mc-label" fill={COLOR.display}>{cv ? fmt(cv) : "-"}</text>
                        <circle cx={iP.x - n.x} cy={iP.y - n.y} r="6" fill="#08131f" stroke={COLOR.display} strokeWidth="1.5"
                          className={`mc-port ${highlightPort?.id === n.id && highlightPort.port === "in" ? "is-hot" : ""}`} onMouseDown={(e) => e.stopPropagation()} />
                      </>
                    );
                  })()}

                  {n.kind === "xy" && (() => {
                    const h = 32;
                    const aP = port(n, "A"), bP=port(n, "B");
                    return (
                      <>
                        <rect x ={-h} y ={-h} width={h*2} rx="1" fill="#0d1626" stroke={isSel ? "#fff" : COLOR.xy} strokeWidth={isSel ? 1.5 : 1.25}
                          onMouseDown={(e) => startNodeDrag(n.id, e)} />
                        <text textAnchor="middle" dy="-0.1em" className="mc-label-sm" fill={COLOR.xy}>XY</text>
                        {xyPos && <text textAnchor= "middle" dy="1em" className="mc-label" fill={COLOR.xy}>{Math.round(xyPos.x)}, {Math.round(xyPos.y)}</text>}
                        <circle cx={aP.x - n.x} cy={aP.y - n.y} r="6" fill="#08131f" stroke={COLOR.xy} strokeWidth="1.5" 
                          className={`mc-port ${highlightPort?.id === n.id && highlightPort.port === "A" ? "is-hot" : ""}`} onMouseDown={(e) => e.stopPropagation()} />
                        <circle cx={bP.x - n.x} cy={bP.y - n.y} r="6" fill="#08131f" stroke={COLOR.xy} strokeWidth="1.5"
                          className={`mc-port ${highlightPort?.id === n.id && highlightPort.port === "B" ? "is-hot" : ""}`} onMouseDown={(e) => e.stopPropagation()} />

                        
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
          </g>
          </svg>
        </div>

      </div>

      {/*some more butttons hr*/}
      
      

      {/* style */}
      <footer className="mc-out">
        <span className="mc-out-prompt">OUTPUT&gt;</span>
        {outs.length === 0 && errs.length === 0 && <span className="mc-out-empty">{running ? "executing…" : "-"}</span>}
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


