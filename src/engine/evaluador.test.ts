import { describe, it, expect } from "vitest";
import { evaluar5, mejorMano, ganadores, compararPuntaje } from "./evaluador";

const cat = (h: string[], b: string[], plo = false) => mejorMano(h, b, plo)!.categoria;

describe("evaluar5", () => {
  it("reconoce cada categoría", () => {
    expect(evaluar5(["As", "Ks", "Qs", "Js", "Ts"])[0]).toBe(8); // escalera de color
    expect(evaluar5(["9s", "9h", "9d", "9c", "2s"])[0]).toBe(7); // póker
    expect(evaluar5(["9s", "9h", "9d", "2c", "2s"])[0]).toBe(6); // full
    expect(evaluar5(["As", "9s", "7s", "4s", "2s"])[0]).toBe(5); // color
    expect(evaluar5(["9s", "8h", "7d", "6c", "5s"])[0]).toBe(4); // escalera
    expect(evaluar5(["9s", "9h", "9d", "7c", "2s"])[0]).toBe(3); // trío
    expect(evaluar5(["9s", "9h", "7d", "7c", "2s"])[0]).toBe(2); // dos pares
    expect(evaluar5(["9s", "9h", "6d", "4c", "2s"])[0]).toBe(1); // par
    expect(evaluar5(["As", "9h", "6d", "4c", "2s"])[0]).toBe(0); // carta alta
  });

  it("la rueda A-2-3-4-5 es escalera al 5", () => {
    const r = evaluar5(["As", "2h", "3d", "4c", "5s"]);
    expect(r[0]).toBe(4);
    expect(r[1]).toBe(5);
    // pierde contra una escalera al 6
    expect(compararPuntaje(evaluar5(["6s", "2h", "3d", "4c", "5s"]), r)).toBeGreaterThan(0);
  });

  it("desempata por kicker", () => {
    const a = evaluar5(["As", "Ah", "9d", "7c", "2s"]);
    const b = evaluar5(["Ad", "Ac", "9s", "6c", "2h"]);
    expect(compararPuntaje(a, b)).toBeGreaterThan(0);
  });
});

describe("mejorMano en 7 cartas", () => {
  it("arma color usando el board", () => {
    expect(cat(["As", "2s"], ["9s", "7s", "4s", "Kh", "Qd"])).toBe("Color");
  });
  it("arma set con par de bolsillo", () => {
    expect(cat(["9h", "9d"], ["9s", "7c", "4d", "Kh", "Qd"])).toBe("Trío");
  });
  it("dos pares contra par", () => {
    const g = ganadores([{ pos: "BTN", hoyo: ["As", "9h"] }, { pos: "BB", hoyo: ["Kd", "Qc"] }],
      ["Ah", "9c", "4d", "2s", "7h"]);
    expect(g!.pos).toEqual(["BTN"]);
    expect(g!.categoria).toBe("Dos pares");
  });
});

describe("ganadores", () => {
  it("detecta empate exacto", () => {
    const g = ganadores([{ pos: "BTN", hoyo: ["As", "Kh"] }, { pos: "BB", hoyo: ["Ad", "Kc"] }],
      ["Ac", "Kd", "9s", "4h", "2d"]);
    expect(g!.pos.sort()).toEqual(["BB", "BTN"]);
  });

  it("el board sirve para todos si nadie mejora", () => {
    const g = ganadores([{ pos: "BTN", hoyo: ["2c", "3d"] }, { pos: "BB", hoyo: ["4c", "5d"] }],
      ["As", "Ks", "Qs", "Js", "Ts"]);
    expect(g!.pos.length).toBe(2);
    expect(g!.categoria).toBe("Escalera de color");
  });

  it("devuelve null si faltan cartas", () => {
    expect(ganadores([{ pos: "BTN", hoyo: ["As", "Kh"] }, { pos: "BB", hoyo: [] }],
      ["Ac", "Kd", "9s", "4h", "2d"])).toBe(null);
  });

  it("ignora placeholders del board sin cartas", () => {
    expect(ganadores([{ pos: "BTN", hoyo: ["As", "Kh"] }], ["Ac", "??", "9s"])).toBe(null);
  });
});

describe("PLO", () => {
  it("obliga a usar exactamente dos del hoyo", () => {
    // El board tiene cuatro picas; en NLH el As del hoyo daría color.
    // En PLO hay que usar dos del hoyo, así que no hay color.
    expect(cat(["As", "Kh", "Qd", "Jc"], ["9s", "7s", "4s", "2s", "3h"], true)).not.toBe("Color");
    // Con dos picas en el hoyo sí hay color.
    expect(cat(["As", "Ks", "Qd", "Jc"], ["9s", "7s", "4s", "2h", "3h"], true)).toBe("Color");
  });
});
