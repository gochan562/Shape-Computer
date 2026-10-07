// Shape Computer Graph Evaluator
// (Future: Program Graph -> Compiler -> Virtural CPU. not yet implemented)

// Algorithm:
// 1. seed value/list nodes
// 2. propagate through connections
// 3. evaluate with a binary op has both inputs
// 4. produce output value

import type { Connection, Ev, Node, Program, Result, Value} from "./types";

const num = (v?: Value): v is Value & { value: number} =>
    !!v && (v.valueType === "int" || v.valueType === "number");

const asNum = (v: Value): number =>
    typeof v.value === "number" ? v.value : parseFloat(String(v.value));

function apply(op: string, a:Value, b:Value):{ok:true; v: Value} | {ok:false; msg:string} {
    // string + string = concat
    if (op ==="add" && a.valueType === "string" && b.valueType === "string") {
        return {ok:true, v: {valueType: "string", value: String(a.value) + String(b.value)}};
    }
    if (op === "add" && a.valueType === "list" && b.valueType === "list") {
        return {ok:true, v: {valueType: "list", items: [...(a.items ?? []), ...(b.items ?? [])]}};
    }
    if (!num(a) || !num(b))
        return {ok: false, msg: "ERROR: TYPE MISMATCH - expected number"};
    const x = asNum(a), y = asNum(b);
    const bothInt = a.valueType === "int" && b.valueType === "int";
    if (op === "add") {
        const s = x + y;
        return {ok: true, v: {valueType: bothInt ? "int" : "number", value: bothInt ? Math.round(s) : s}};
    };
    if (op === "multiply") {
        const m = x * y;
        return {ok: true, v: {valueType: bothInt ? "int" : "number", value: bothInt ? Math.round(m) : m}};
    };
    if (op === "divide") {
        if (y === 0)
            return {ok: false, msg: "ERROR: DIVIDE BY ZERO"};
        const d = x/y;
        const clean = x%y===0&&bothInt;
        return {ok: true, v: {valueType: clean ? "int" : "number", value: clean ? Math.round(d) : d}};
    }
    return {ok: false, msg: "ERROR: UNKNOWN OPERATOR"};
}

// cycle check: DFS, gray = in-progress
function hasCycle(p:Program): string[] {
    const st: Record<string, "w"|"g"|"b"> = {};
    p.nodes.forEach(n => st[n.id] = "w");
    const cyc: string[] = [];
    const out = (id:string) => p.conns.filter((c) => c.from === id);
    const visit = (id: string)=> {
        if (st[id] === "g") {
            cyc.push(id);
            return;
        }
        if (st[id] === "b") return;
        st[id] = "g";
        for (const c of out (id)) visit(c.to);
        st[id] = "b";
    };
    p.nodes.forEach((n) => st[n.id] === "w" && visit(n.id));
    return cyc;
}

export function evaluate(p: Program): Result {
    const evs: Ev[] = [];
    const outs: Value[] = [];
    const errs: string[] = [];
    const produced: Record<string,Value> = {};
    if (!p.nodes.length) return {evs, outs, errs, produced};

    // cycle check
    const cyc = hasCycle(p);
    if (cyc.length){
        const m = "ERROR: CIRCULAR DEPENDENCY";
        evs.push({type: "err", msg: m, id: cyc[0]});
        errs.push(m);
        return {evs, outs, errs, produced};
    }
    const nodeById = new Map(p.nodes.map((n) => [n.id, n]));
    const out = (id:string) => p.conns.filter((c) => c.from === id);
    const inP = (id: string, port: "A"|"B"|"in") =>
        p.conns.find(
            (c) =>
                c.to === id && (port === "in" ? !c.port : c.port === port)
        );

    const valAt : Record<string, Value> = {};
    const done: Record<string, boolean> = {};
    const ports: Record<string, {A?: Value; B?: Value; in?: Value}> = {};
    const q: string[] = [];

    // seed
    for (const n of p.nodes) {
        if (n.kind === "value" && n.value) {
            valAt[n.id] = n.value;
            done[n.id] = true;
            q.push(n.id);
        }
        if (n.kind === "list" && n.value) {
            valAt[n.id] = n.value;
            done[n.id] = true;
            q.push(n.id);
        }
    }
    while (q.length) {
        const src = q.shift()!;
        const sv = valAt[src]; 
        if (!sv) continue;
        for (const c of out(src)) {
            const t = nodeById.get(c.to);
            if (!t) continue;
            evs.push({ type: "conn", id: c.id });
            evs.push({ type: "node", id: t.id });
            if (!ports[t.id]) ports[t.id] = {};
            const p = c.port ?? "in";
            ports[t.id][p] = sv;
            if (t.kind === "operator" && !done[t.id]){
                const ps = ports[t.id];
                if (ps.A && ps.B) {
                    const r = apply(t.op!, ps.A, ps.B);
                    if ("msg" in r) {
                        evs.push({ type: "err", msg: r.msg, id: t.id });
                        errs.push(r.msg);
                        return { evs, outs, errs, produced };
                    }

                    valAt[t.id] = r.v;
                    done[t.id] = true;
                    evs.push({ type: "produce", id: t.id, value: r.v });
                    produced[t.id] = r.v;
                    q.push(t.id);
                }
            } else if (t.kind === "print" && !done[t.id]) {
                done[t.id] = true;
                const v = ports[t.id].in!;
                evs.push({type: "out", value: v});
                outs.push(v);
            } else if (t.kind === "list" && !done[t.id]) {
                // list as pass-through, just propagate value
                done[t.id] = true;
            }
        }
    }
    // surface missing-input errors
    for (const n of p.nodes) {
        if (n.kind === "operator" && !done[n.id]) {
            const ps = ports[n.id] ?? {};
            const missing = !ps.A && !ps.B ? "2 inputs" : "1 input";
            const m = `ERROR: ${n.op?.toUpperCase()} — waiting for ${missing}`;
            evs.push({type: "err", msg: m, id: n.id});
            errs.push(m);
        }
        if (n.kind === "print" && !done[n.id]) {
            const m = "ERROR: PRINT - no input";
            evs.push({type: "err", msg: m, id: n.id});
            errs.push(m);
        }
    }
    return {evs, outs, errs, produced};
}

// tiny helpers shared with UI

let _id = 0;
export const uid = (p: string) => `${p}${++_id}`;

// diameter for value circles. log-magnitude mapping (bounded)

export const MIN_D = 28, MAX_D = 64;
export function dia(v: Value | undefined): number {
    if (!v) return MIN_D;
    if (v.valueType === "string" || v.valueType === "list") return 48;
    const n = typeof v.value === "number" ? Math.abs(v.value) : 0;
    if (n === 0) return MIN_D;
    return Math.max(MIN_D, Math.min(MAX_D, MIN_D + Math.log10(n+1)*14));

}

export const COLOR = {
    int:"#22c55e",
    number:"#38bdf8",
    string:"#fb923c",
    list:"#a78bfa",
    op:"#cbd5e1",
    conn:"#475569",
    connActive:"#e2e8f0",
};

//port positions for node
export function port(n: Node, p: "A" | "B" | "in" | "out"): { x: number; y: number } {
    if (n.kind === "value") {const r = dia(n.value) / 2; return p === "out" ? { x: n.x + r, y: n.y } : { x: n.x, y: n.y };}
    if (n.kind === "operator"){
        const h = 28;
        if (p === "A") return {x: n.x, y: n.y - h};
        if (p === "B") return {x: n.x, y: n.y + h};
        return {x: n.x + h, y: n.y};
    }
    if (n.kind === "print" || n.kind === "list") {
        const h = 32;
        if (p === "in") return {x: n.x - h, y: n.y};
        if (p === "out") return {x: n.x + h, y: n.y};
    }
    return {x: n.x, y: n.y};
}

// cubic bezier for connection curves
export function path (a: {x:number; y:number}, b: {x:number; y:number}): string {
    const dx = Math.max(40, Math.abs(b.x - a.x) * 0.5);
    return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
}

export function fmt(v: Value | undefined): string {
    if (!v) return "";
    if (v.valueType === "string") return `"${v.value}"`;
    if (v.valueType === "list") return `[${(v.items ?? []).map(fmt).join(", ")}]`;
    if (typeof v.value === "number") return Number.isInteger(v.value) ? String(v.value) : String(parseFloat(v.value.toFixed(4)));
    return String(v.value);
}

export const poly = (sides: number, r: number, rot = -Math.PI/2): string =>
    Array.from({length: sides}, (_, i) => {
        const a = rot + (i * 2 * Math.PI) / sides;
        return `${(r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)}`;
    }).join(" ");

export const star = (points: number, outer: number, inner: number, rot = -Math.PI / 2): string =>
  Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const a = rot + (i * Math.PI) / points;
    return `${(r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
