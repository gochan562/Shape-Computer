// example Programs (boring as fk)
// 1. add, 2. multiply, 3.combination,4. string, 5. lsit,
import type { Program } from "./types";

export type Demo = { id: string; name: string; program: Program };

export const DEMOS: Demo[] = [
    {
        id: "add", name: "1+1", program: {
            nodes: [
                { id:"a", kind: "value", x:100, y:160,value:{valueType: "int", value:1}},
                { id:"b", kind :"value", x:100, y: 280, value:{valueType:"int", value:1}},
                { id:"p", kind: "operator", x:280, y:220, op: "add"},
                {id : "o", kind: "print", x:460, y:220},
            ],
            
            conns:[
                {id: "c1", from: "a", to: "p", port:"A"},
                {id: "c2", from :"b", to:"p", port:"B"},
                {id: "c3", from: "p", to: "o"},
            ],
        },
    },
    {
        id: "mul", name: "2x3", program: {
            nodes:[
                {id: "a", kind: "value", x:100,y:160,value:{valueType:"int", value: 2}},
                { id: "b", kind: "value", x: 100, y: 280, value: { valueType: "int", value: 3 } },
                {id: "p", kind: "operator", x:280, y:220, op: "multiply"},
                {id: "o", kind:"print", x:460, y:220},
            ],
            conns: [
                { id: "c1", from: "a", to: "p", port: "A" },
                { id: "c2", from: "b", to: "p", port: "B"},
                { id:"c3", from: "p", to:"o"},
            ],
        },
    },
    {
        id: "comp", name: "2x(3+4)", program: {
            nodes: [
                { id: "a3", kind: "value", x: 80, y: 120, value:{valueType: "int", value: 4}},
                {id: "a4", kind: "value", x: 80, y: 280, value: { valueType: "int", value: 4 } },
                { id: "add", kind:"operator", x: 260, y: 200,  op: "add"},
                { id: "m2", kind: "value", x: 260, y: 360, value: { valueType: "int", value: 2 } },
                { id: "mul", kind: "operator", x: 460, y: 280, op: "multiply" },
                { id: "o", kind:"print", x:640,y:280},
            ],
            conns:[
                { id: "c1", from: "a3", to: "add", port: "A" },
                { id: "c2", from: "a4", to: "add", port: "B" },
                { id:"c3", from: "add", to: "mul", port:"A"},
                { id: "c4", from: "m2", to: "mul", port: "B"},
                {id: "c5", from: "mul", to: "o"},

            ],
        },
    },
    {
        id: "str", name: "string", program: {
            nodes: [
                { id: "s", kind: "value", x: 160, y:220, value: { valueType: "string", value: "HELLO" } },
                { id:"o", kind:"print", x: 420,y: 220 },
            ],
            conns:[{id: "c1", from: "s", to: "o"}],
        },
    },
    {
        // this one's a bit different
        id: "list", name: "list", program: {
            nodes:[
                { id: "l", kind: "list", x: 160, y: 220, value: { valueType: "list", items: [
                    { valueType: "int", value: 1},
                    { valueType: "int", value: 2},
                    { valueType: "int", value: 3},
            ]}},
            {id: "o", kind: "print", x: 460, y:220},
            ],
            conns: [{id: "c1", from:"l",to:"o"}],
        },
    },
];