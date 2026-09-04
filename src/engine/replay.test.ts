import { describe, it, expect } from "vitest";
import { parsearLog, reconstruir } from "./replay";

const S13 = { nombre: "1/3", sb: 1, bb: 3 };

const LOG = [
  "Ciegas 1/3 · 9 jugadores",
  "UTG paga $3", "UTG+1 paga $3", "MP foldea", "LJ foldea", "HJ paga $3",
  "CO sube a $15", "BTN foldea", "SB foldea", "BB paga $12",
  "UTG paga $12", "UTG+1 paga $12", "HJ paga $12",
  "BB pasa", "UTG apuesta $25", "UTG+1 paga $25", "HJ foldea", "CO paga $25", "BB foldea",
];

describe("parsearLog", () => {
  it("saca las acciones y omite la línea de ciegas", () => {
    const { pasos } = parsearLog(LOG);
    expect(pasos.length).toBe(18);
    expect(pasos[0]).toEqual({ pos: "UTG", accion: "call", monto: 0 });
    expect(pasos[5]).toEqual({ pos: "CO", accion: "raise", monto: 15 });
  });

  it("reconoce el straddle", () => {
    const { straddle } = parsearLog(["Ciegas 1/3 · 9 jugadores", "BTN pone straddle de $6", "SB foldea"]);
    expect(straddle).toEqual({ pos: "BTN", monto: 6 });
  });

  it("ignora la línea de gana sin showdown", () => {
    const { pasos } = parsearLog(["UTG foldea", "BTN gana $16 sin showdown"]);
    expect(pasos.length).toBe(1);
  });
});

describe("reconstruir", () => {
  const frames = reconstruir({
    log: LOG, board: ["Th", "5s", "Qd", "4s", "Ts"],
    heroPos: "CO", nJugadores: 9, stack: 300, stake: S13,
  });

  it("genera un frame por acción más el inicial y los de calle", () => {
    expect(frames.length).toBeGreaterThan(18);
    expect(frames[0].texto).toBe("Reparten las cartas");
  });

  it("el board aparece solo cuando toca", () => {
    expect(frames[0].board.length).toBe(0);
    const flop = frames.find((f) => f.texto === "Sale el flop")!;
    expect(flop.board).toEqual(["Th", "5s", "Qd"]);
    const ultimo = frames[frames.length - 1];
    expect(ultimo.calle).toBeGreaterThanOrEqual(1);
  });

  it("el bote crece y nunca baja", () => {
    for (let i = 1; i < frames.length; i++)
      expect(frames[i].bote).toBeGreaterThanOrEqual(frames[i - 1].bote);
  });

  it("los foldeados se quedan foldeados", () => {
    const iMP = frames.findIndex((f) => f.texto === "MP foldea");
    for (let i = iMP; i < frames.length; i++)
      expect(frames[i].jugadores.find((j) => j.pos === "MP")!.folded).toBe(true);
  });

  it("devuelve vacío si el historial no sirve", () => {
    expect(reconstruir({ log: [], board: [], heroPos: "CO", nJugadores: 9, stack: 300, stake: S13 })).toEqual([]);
  });

  it("corta sin reventar si el historial no cuadra", () => {
    const f = reconstruir({
      log: ["Ciegas 1/3", "BTN foldea", "MP foldea"],
      board: [], heroPos: "CO", nJugadores: 9, stack: 300, stake: S13,
    });
    expect(f.length).toBeLessThanOrEqual(2);
  });
});
