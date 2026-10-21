// Shape Computer Type Definitions
// This file contains type definitions for the shape computer module, 
// which is responsible for calculating and managing shapes
export type ValueType = "int" | "number" | "string" | "list";

export type Value = {
    valueType: ValueType;
    //scalar
    value?: number |string;
    //lists
    items?: Value[];
};

export type NodeKind = 
    | "value" | "operator" | "print" | "list"
    | "read" | "write" | "key"
    | "if"
    | "display" | "xy";

export type Operator = "add" | "multiply" | "divide" | "lt" | "gt" | "eq";

export type Node = {
    id : string;
    kind: NodeKind;
    x: number;
    y: number;
    //value nodes
    value?: Value;
    //operator nodes
    op?: Operator;
    name?: string;
};

export type Connection = {
  id: string
  from: string
  to: string
  port?: "A" | "B" | "in"
}

export type Program = { nodes: Node[]; conns : Connection[]};

//Execution events for visualization
export type Ev = 
| {type: "node"; id: string} //activate
| {type: "conn"; id: string} //activate
| {type: "produce"; id: string; value: Value}
| {type: "out"; value: Value}
| {type: "err"; msg: string; id?: string}
| {type: "write"; name: string; value: Value}
| {type: "display"; name: string; value: Value}
| {type: "xy"; x: number; y: number};

export type Result = {
    evs : Ev[];
    outs : Value[];
    errs : string[];
    produced: Record<string, Value>; //map of node id to produced value
    writes: Array<{name: string; value: Value}>;
    displays: Array<{ name: string; value: Value}>;
    xy: { x:number; y: number} | null;
};
