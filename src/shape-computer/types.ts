// Shape Computer Type Definitions
// This file contains type definitions for the shape computer module, 
// which is responsible for calculating and managing shapes in the application.
export type ValueType = "int" | "number" | "string" | "list";

export type Value = {
    valueType: ValueType;
    //scalar
    value?: number |string;
    //lists
    items?: Value[];
};

export type NodeKind = "value" | "operator" | "print" | "list";

export type Operator = "add" | "multiply" | "divide";

export type Node = {
    id : string;
    kind: NodeKind;
    x: number;
    y: number;
    //value nodes
    value?: Value;
    //operator nodes
    op?: Operator;
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
| {type: "err"; msg: string; id?: string};

export type Result = {
    evs : Ev[];
    outs : Value[];
    errs : string[];
    produced: Record<string, Value>; //map of node id to produced value
};
