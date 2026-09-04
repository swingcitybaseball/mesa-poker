import { describe, it, expect } from "vitest";
import { clasificar } from "./clasificar";

// CO abre, BB paga; flop, turn, river con CO apostando siempre.
const logAgresivo = [
  "Ciegas 1/3 · 9 jugadores",
  "UTG foldea", "UTG+1 foldea", "MP foldea", "LJ foldea", "HJ foldea",
  "CO sube a $15", "BTN foldea", "SB foldea", "BB paga $12",
  "BB pasa", "CO apuesta $20", "BB paga $20",
  "BB pasa", "CO apuesta $50", "BB paga $50",
  "BB pasa", "CO apuesta $120", "BB paga $120",
];

describe("clasificar", () => {
  it("detecta farol: apuesto el river con carta alta", () => {
    const c = clasificar({
      pos: "CO", cartas: ["As", "Kh"], board: ["9c", "7d", "4s", "2h", "3c"],
      log: logAgresivo, neto: -205,
    });
    expect(c.etiquetas).toContain("Farol");
    expect(c.categoriaFinal).toBe("Carta alta");
  });

  it("detecta apuesta de valor: apuesto con dos pares", () => {
    const c = clasificar({
      pos: "CO", cartas: ["Ah", "9s"], board: ["9c", "7d", "4s", "Ad", "3c"],
      log: logAgresivo, neto: 205,
    });
    expect(c.etiquetas).toContain("Apuesta de valor");
    expect(c.categoriaFinal).toBe("Dos pares");
  });

  it("detecta valor no cobrado: llego al river con mano y paso", () => {
    const log = [
      "Ciegas 1/3 · 9 jugadores",
      "UTG foldea", "UTG+1 foldea", "MP foldea", "LJ foldea", "HJ foldea",
      "CO sube a $15", "BTN foldea", "SB foldea", "BB paga $12",
      "BB pasa", "CO pasa",
      "BB pasa", "CO pasa",
      "BB pasa", "CO pasa",
    ];
    const c = clasificar({
      pos: "CO", cartas: ["Ah", "9s"], board: ["9c", "7d", "4s", "2d", "3c"],
      log, neto: 31,
    });
    expect(c.etiquetas).toContain("Valor no cobrado");
  });

  it("detecta cooler: pierdo con color contra full", () => {
    const c = clasificar({
      pos: "CO", cartas: ["As", "Ks"], board: ["9s", "7s", "4s", "9d", "9h"],
      log: logAgresivo, neto: -205,
      showdown: [{ pos: "BB", cartas: ["9c", "7d"], muck: false }],
    });
    expect(c.etiquetas).toContain("Cooler");
  });

  it("detecta fold disciplinado", () => {
    const log = [
      "Ciegas 1/3 · 9 jugadores",
      "UTG foldea", "UTG+1 foldea", "MP foldea", "LJ foldea", "HJ foldea",
      "CO sube a $15", "BTN foldea", "SB foldea", "BB paga $12",
      "BB apuesta $25", "CO foldea",
    ];
    const c = clasificar({ pos: "CO", cartas: ["As", "Kh"], board: ["9c", "7d", "4s"], log, neto: -15 });
    expect(c.etiquetas).toContain("Fold disciplinado");
  });

  it("no inventa etiquetas si no hay cartas", () => {
    const c = clasificar({ pos: "CO", cartas: [], board: [], log: logAgresivo, neto: -205 });
    expect(c.categoriaFinal).toBe(null);
    expect(c.etiquetas.filter((x) => x !== "Fold disciplinado")).toEqual([]);
  });

  it("siempre entrega hechos objetivos para el profesor", () => {
    const c = clasificar({
      pos: "CO", cartas: ["As", "Kh"], board: ["9c", "7d", "4s", "2h", "3c"],
      log: logAgresivo, neto: -205,
    });
    expect(c.hechos.some((h) => h.includes("Mis acciones"))).toBe(true);
    expect(c.hechos.some((h) => h.includes("farol"))).toBe(true);
  });
});
