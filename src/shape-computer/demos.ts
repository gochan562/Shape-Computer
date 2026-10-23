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
                { id: "a3", kind: "value", x: 80, y: 120, value:{valueType: "int", value: 3}},
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

    //new ones!!! (same, boring but bettter)
    // simple conter/ key detect / bounce / move
    {
        id: "counter", name: "counter", program: {
            nodes: [
                {id: "rx", kind: "read", name: "x", x:100, y:200},
                {id: "one", kind : "value", x: 100, y: 320, value: {valueType:"int", value:1}},
                {id: "add", kind: "value", x:280,y:260, op:"add"},
                {id: "wx", kind: "write", name:"x", x:460, y:260},
                {id: "rx2", kind: "read", name:"x", x:100, y:420},
                {id: "dx", kind: "display", name: "x", x:280, y:420},

            ],
            conns: [
                {id: "c1", from: "rx", to: "add", port:"A"},
                {id: "c2", from:"one", to:"add", port:"B"},
                {id: "c3", from: "add", to: "wx"},
                {id: "c4", from: "rx2", to: "dx"},
            ],
        },
    },

    {
        id: "keymove", name: "keymove", program:{
            nodes:[
                {id: "rx", kind: "read", name: "x", x:100, y:200},
                {id: "kr", kind: "key", name: "RIGHT", x:100, y:320},
                {id: "add", kind: "operator", x:280, y:260, op:"add"},
                {id: "kl", kind: "key", name:"LEFT", x:280, y:380},
                { id: "neg", kind: "value", x:280, y:460, value: {valueType: "int", value: -1}},
                {id: "mlt", kind: "operator", x:460, y:420, op:"multiply"},
                {id:"add2", kind: "operator", x:640, y:320, op: "add"},
                { id: "wx", kind: "write", name: "x", x:820, y:320},
                {id: "rx2",  kind: "read",name: "x", x: 640, y: 200 },
                { id: "dx", kind: "display", name: "x", x:820, y:200}, // btw display is NOT output. output uses print.
                
            ],
            conns: [
                {id: "c1", from: "rx", to: "add", port: "A"},
                {id: "c2", from: "kr", to : "add", port: "B"},
                {id: "c3", from: "kl", to:"mlt", port:"A"},
                {id: "c4", from: "neg", to: "mlt", port:"B"},
                {id: "c5", from: "add", to: "add2", port: "A"},
                {id: "c6", from: "mlt", to: "add2", port: "B"},
                {id: "c7", from: "add2", to: "wx"},
                {id: "c8", from: "rx2", to: "dx"},
            ]
        },
    },
    {

        id: "bounce", name: "bounce", program: {
            nodes: [
                { id: "rx", kind: "read", name: "x", x:80, y:200},
                {id: "lim", kind: "value", x:80, y:320, value: {valueType: "int", value:5}},
                {id: "cmp", kind: "operator", x:260, y:260, op: "gt"},
                {id: "zero", kind: "value", x:260, y:120, value: {valueType: "int", value: 0}},
                {id: "one", kind: "value", x:80, y:420, value: {valueType: "int", value:1}},
                {id: "inc", kind: "operator", x:260, y:420, op: "add"},
                {id: "ifx", kind: "if", x:460, y:260},
                {id: "wx", kind: "write", name: "x", x:640, y:260},
                {id: "rx2", kind: "read", name: "x", x:640, y:140},
                {id: "dx", kind: "display", name: "x", x:820, y:140},

            ],

            conns:[
                {id: "c1", from: "rx", to: "cmp", port: "A"},
                {id: "c2", from: "lim", to: "cmp", port: "B"},
                {id: "c3", from: "rx", to :"inc", port:"A"},
                {id: "c4", from: "one", to: "inc", port: "B"},
                {id: "c5", from: "cmp" ,to: "ifx"},
                {id: "c6", from: "zero", to: "ifx", port: "A"},
                {id: "c7", from: "inc", to: "ifx", port: "B"},
                {id: "c8", from: "ifx", to: "wx"},
                {id: "c9", from: "rx2", to: "dx"},
            ],
        },
    },
    //Here coms the big one...
    {
        id: "move", name: "move", program: {
            nodes: [
                // x is x+ right - left? maybe
                {id: "rx", kind: "read", name: "x", x:60, y:80},
                {id: "kr", kind: "key", name: "RIGHT", x:60, y:200},
                {id: "kl", kind: "key", name: "LEFT", x:60, y: 320},
                {id: "neg1", kind: "value", x:60, y:420, value :{valueType: "int", value: -1}},
                {id: "ax", kind: "operator", x:240, y: 140, op: "add"},
                {id: "ml", kind: "operator", x:240, y:320, op: "multiply"},
                {id: "ax2", kind: "operator", x:420, y:220, op: "add"},
                {id: "wx", kind: "write", name:"x", x:600, y:220},
                {id: "ry", kind: "read", name: "y", x:60, y:540},
                {id: "kd", kind: "key", name: "DOWN", x:60, y:660},
                {id: "ku", kind: "key", name: "UP", x:60, y:780},
                {id: "neg1y", kind: "value", x:60, y:880, value:{valueType: "int", value: -1}},
                {id: "ay", kind: "operator", x:240, y:600, op:"add"},
                {id: "mly", kind: "operator", x:240, y:780, op:"multiply"},
                {id: "ay2", kind: "operator", x:420, y:680, op: "add"},
                {id: "wy", kind: "write", name:"y", x:600, y:680},

                //feed
                {id: "rx3", kind: "read", name: "x", x:780, y:200},
                {id: "ry3", kind: "read", name: "y", x:780, y:660},
                {id: "xy", kind: "xy", x:960, y:440},
            ],
            conns: [
                { id: "c1", from:"rx", to: "ax", port:"A"},
                {id: "c2", from:"kr", to:"ax", port:"B"},
                {id: "c3", from:"kl", to:"ml", port:"A"},
                {id: "c4", from:"neg1", to:"ml", port:"B"},
                {id: "c5", from:"ax",to:"ax2", port:"A"},
                {id: "c6", from: "ml", to: "ax2", port: "B"},
                {id: "c7", from: "ax2", to: "wx"},
                {id: "c8", from: "ry", to: "ay", port:"A"},
                {id: "c9", from: "kd", to: "ay", port:"B"},
                {id: "c10", from: "ku", to: "mly", port:"A"},
                {id: "c11", from: "neg1y", to: "mly", port:"B"},
                {id: "c12", from: "ay", to: "ay2", port:"A"},
                {id: "c13", from: "mly", to: "ay2", port:"B"},
                {id: "c14", from: "ay2", to: "wy"},
                {id: "c15", from: "rx3", to: "xy", port:"A"},
                {id: "c16", from: "ry3", to: "xy", port:"B"},
            ]
        },
    },
];