// persistent state / key input / tick

import type {Node, Program, Result, Value} from "./types";
import {evaluate} from "./evaluator";

const ZERO: Value = { valueType: "int", value: 0};


//super loong one
export class Runtime {
    state = new Map<string, Value>();
    inputs = new Set<string>();
    displays = new Map<string, Value>();
    xy: {x: number; y: number} | null = null;
    tickCount = 0;
    private timer: ReturnType<typeof setInterval> | null = null;
    readVar(name: string): Value {
        return this.state.get(name) ?? ZERO;
    }
    setKey(name: string, on: boolean) {
        if (on) this.inputs.add(name);
        else this.inputs.delete(name);
    }

    isKey(name: string): boolean {
        return this.inputs.has(name);
    }
    //Inject runtime val intoo read/key nodes
    // so that evaluator see them as seeded values

    private inject (prog: Program): Program {
        const nodes = prog.nodes.map((n): Node => {
            if (n.kind === "read") return { ...n, value: this.readVar(n.name ?? "_")};
            if (n.kind === "key"){
                const pressed  =this.isKey((n.name ?? "").toUpperCase());
                return { ...n, value: { valueType: "int", value: pressed ? 1 : 0 } };

            }
            return n;
        });
        return{nodes, conns:prog.conns };
    }

    // run 1 tick
    tick(prog: Program): Result {
        const injected = this.inject(prog);
        const r = evaluate(injected);
        for (const w of r.writes) this.state.set(w.name, w.value);
        for (const d of r.displays) this.displays.set(d.name, d.value);

        if (r.xy) this.xy = r.xy;
        this.tickCount++;
        return r;
    }

    start(prog:Program, ms:number, onTick:(r:Result) => void){
        this.stop();
        this.timer =setInterval(() => {
            const r = this.tick(prog);
            onTick(r);
        }, ms);
    }

    stop() {
        if (this.timer) {clearInterval(this.timer); this.timer=null;}

    }
    isRunning(){return this.timer !==null;}
    reset(){
        this.state.clear();
        this.inputs.clear();
        this.displays.clear();
        this.xy = null;
        this.tickCount=0;
    }

    stateSnapshot() : Record<string, Value> {
        const o:Record<string, Value> = {};
        for (const [k,v] of this.state) o[k] = v;
        return o;
    }
}

//key events goooing! (only arror keys and space for now, its hard)

export function codeToKeyName(code: string) : string | null {
    switch(code) {
        case "ArrowLeft": return "LEFT";
        case "ArrowRight": return "RIGHT";
        case "ArrowUp": return "UP";
        case "ArrowDown": return "DOWN";
        case "Space": return "SPACE";
        default: return null;
    }
}