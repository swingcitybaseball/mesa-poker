import { describe, it, expect } from "vitest";
import { nuevaMano, actuar, boteVivo, opcionesSubida, redondearApuesta, posDeAsiento, siguienteBoton, MESA9, MESA6 } from "./poker";

const S13 = { nombre: "1/3", sb: 1, bb: 3 };
const turno = (m: ReturnType<typeof nuevaMano>) => m.jugadores[m.turno]?.pos;

describe("orden de acción", () => {
  it("preflop arranca en UTG", () => {
    const m = nuevaMano(MESA9, "BTN", 300, S13);
    expect(turno(m)).toBe("UTG");
    expect(boteVivo(m)).toBe(4);
  });

  it("6-max preflop arranca en UTG", () => {
    const m = nuevaMano(MESA6, "BTN", 300, S13);
    expect(turno(m)).toBe("UTG");
  });

  it("postflop arranca en el primer activo desde SB", () => {
    const m = nuevaMano(MESA9, "BTN", 300, S13);
    for (let i = 0; i < 6; i++) actuar(m, "fold");
    actuar(m, "raise", 12); // BTN
    actuar(m, "fold"); // SB
    actuar(m, "call"); // BB
    expect(m.calle).toBe(1);
    expect(turno(m)).toBe("BB");
  });
});

describe("opción del BB", () => {
  it("BB tiene acción aunque nadie suba", () => {
    const m = nuevaMano(MESA9, "BTN", 300, S13);
    for (let i = 0; i < 6; i++) actuar(m, "fold");
    actuar(m, "call"); // BTN limp
    actuar(m, "call"); // SB completa
    expect(turno(m)).toBe("BB");
    actuar(m, "check");
    expect(m.calle).toBe(1);
    expect(m.bote).toBe(9);
  });
});

describe("cierre de rondas", () => {
  it("una subida reabre la acción a todos", () => {
    const m = nuevaMano(MESA9, "BTN", 300, S13);
    actuar(m, "call"); // UTG limp
    actuar(m, "call"); // UTG+1 limp
    for (let i = 0; i < 4; i++) actuar(m, "fold");
    expect(turno(m)).toBe("BTN");
    actuar(m, "raise", 15);
    actuar(m, "fold"); // SB
    expect(turno(m)).toBe("BB");
    actuar(m, "call");
    expect(turno(m)).toBe("UTG");
    actuar(m, "call");
    expect(turno(m)).toBe("UTG+1");
    actuar(m, "fold");
    expect(m.calle).toBe(1);
    expect(m.bote).toBe(1 + 15 + 15 + 3 + 15);
  });

  it("check-check-check avanza de calle", () => {
    const m = nuevaMano(MESA9, "BTN", 300, S13);
    for (let i = 0; i < 6; i++) actuar(m, "fold");
    actuar(m, "call");
    actuar(m, "call");
    actuar(m, "check");
    expect(m.calle).toBe(1);
    actuar(m, "check");
    actuar(m, "check");
    actuar(m, "check");
    expect(m.calle).toBe(2);
  });

  it("llega a showdown después del river", () => {
    const m = nuevaMano(MESA6, "BTN", 300, S13);
    for (let i = 0; i < 3; i++) actuar(m, "fold");
    actuar(m, "call"); // BTN
    actuar(m, "fold"); // SB
    actuar(m, "check"); // BB
    for (let c = 0; c < 3; c++) {
      actuar(m, "check");
      actuar(m, "check");
    }
    expect(m.calle).toBe(4);
    expect(m.terminada).toBe(true);
  });
});

describe("fin por fold", () => {
  it("todos foldean y el último gana el bote", () => {
    const m = nuevaMano(MESA9, "BTN", 300, S13);
    for (let i = 0; i < 6; i++) actuar(m, "fold");
    actuar(m, "raise", 12);
    actuar(m, "fold");
    actuar(m, "fold");
    expect(m.terminada).toBe(true);
    expect(m.ganador).toBe("BTN");
    expect(m.bote).toBe(16);
  });
});

describe("all-in", () => {
  it("call corto queda all-in y no vuelve a actuar", () => {
    const m = nuevaMano(MESA9, "BTN", 300, S13);
    m.jugadores[2].stack = 10; // UTG corto
    actuar(m, "raise", 20); // UTG sube (all-in por 10 + 3? no: bet 0 -> hasta min(20, 10) = 10)
    expect(m.jugadores[2].allIn).toBe(true);
    expect(m.jugadores[2].bet).toBe(10);
  });

  it("dos all-in y nadie más: salta a showdown", () => {
    const m = nuevaMano(MESA6, "BTN", 300, S13);
    for (let i = 0; i < 3; i++) actuar(m, "fold");
    actuar(m, "raise", 300); // BTN all-in
    actuar(m, "fold"); // SB
    actuar(m, "call"); // BB all-in
    expect(m.terminada).toBe(true);
    expect(m.calle).toBe(4);
    expect(m.bote).toBe(601);
  });
});

describe("validaciones", () => {
  it("no deja pasar frente a apuesta", () => {
    const m = nuevaMano(MESA9, "BTN", 300, S13);
    expect(() => actuar(m, "check")).toThrow();
  });

  it("no deja subir menos que la apuesta", () => {
    const m = nuevaMano(MESA9, "BTN", 300, S13);
    expect(() => actuar(m, "raise", 2)).toThrow();
  });
});

describe("opciones de subida", () => {
  it("preflop estándar cuenta limpers", () => {
    const m = nuevaMano(MESA9, "BTN", 300, S13);
    actuar(m, "call");
    actuar(m, "call");
    for (let i = 0; i < 4; i++) actuar(m, "fold");
    const o = opcionesSubida(m);
    expect(o[0].etiqueta).toBe("Estándar");
    expect(o[0].monto).toBe(9 + 6);
  });

  it("siempre termina con all-in", () => {
    const m = nuevaMano(MESA9, "BTN", 300, S13);
    const o = opcionesSubida(m);
    expect(o[o.length - 1].etiqueta).toBe("All-in");
    expect(o[o.length - 1].monto).toBe(300);
  });
});

describe("straddle", () => {
  it("straddle al botón: la acción arranca en SB y el botón habla al último", () => {
    const m = nuevaMano(MESA9, "BTN", 300, S13, { pos: "BTN", monto: 6 });
    expect(m.apuesta).toBe(6);
    expect(turno(m)).toBe("SB");
    for (let i = 0; i < 7; i++) actuar(m, "fold"); // SB..HJ foldean
    expect(turno(m)).toBe("CO");
    actuar(m, "call");
    expect(turno(m)).toBe("BTN"); // el straddler tiene la opción al final
  });

  it("straddle en UTG: arranca en UTG+1 y UTG habla al último", () => {
    const m = nuevaMano(MESA9, "BTN", 300, S13, { pos: "UTG", monto: 6 });
    expect(turno(m)).toBe("UTG+1");
    for (let i = 0; i < 7; i++) actuar(m, "fold"); // UTG+1..SB foldean
    expect(turno(m)).toBe("BB");
    actuar(m, "call");
    expect(turno(m)).toBe("UTG");
  });

  it("el straddler puede pasar si nadie sube", () => {
    const m = nuevaMano(MESA9, "BTN", 300, S13, { pos: "BTN", monto: 6 });
    for (let i = 0; i < 7; i++) actuar(m, "fold");
    actuar(m, "call"); // CO paga el straddle
    actuar(m, "check"); // BTN usa su opción
    expect(m.calle).toBe(1);
    expect(turno(m)).toBe("CO"); // postflop arranca en el primer activo
  });

  it("el bote y los stacks cuadran con el straddle", () => {
    const m = nuevaMano(MESA9, "BTN", 300, S13, { pos: "BTN", monto: 6 });
    expect(boteVivo(m)).toBe(1 + 3 + 6);
    expect(m.jugadores[8].stack).toBe(294);
  });

  it("sizing estándar usa el straddle como bb efectiva", () => {
    const m = nuevaMano(MESA9, "BTN", 300, S13, { pos: "BTN", monto: 6 });
    const o = opcionesSubida(m);
    expect(o[0].etiqueta).toBe("Estándar");
    expect(o[0].monto).toBe(18); // 3 x 6, sin limpers
  });

  it("sin straddle todo sigue igual", () => {
    const m = nuevaMano(MESA9, "BTN", 300, S13);
    expect(m.straddle).toBe(null);
    expect(m.bbEfectiva).toBe(3);
    expect(turno(m)).toBe("UTG");
  });
});

describe("asientos físicos", () => {
  it("deriva la posición desde el botón", () => {
    // mesa de 9, botón en el asiento 0
    expect(posDeAsiento(0, 0, 9)).toBe("BTN");
    expect(posDeAsiento(1, 0, 9)).toBe("SB");
    expect(posDeAsiento(2, 0, 9)).toBe("BB");
    expect(posDeAsiento(3, 0, 9)).toBe("UTG");
    expect(posDeAsiento(8, 0, 9)).toBe("CO");
  });

  it("el botón avanza y mi asiento no se mueve", () => {
    const yo = 5;
    let boton = 0;
    // Conforme el botón se acerca a mi asiento, mi posición se hace más temprana,
    // luego paso por las ciegas y termino siendo el botón.
    const esperado = ["MP", "UTG+1", "UTG", "BB", "SB", "BTN", "CO", "HJ", "LJ"];
    for (const p of esperado) {
      expect(posDeAsiento(yo, boton, 9)).toBe(p);
      boton = siguienteBoton(boton, 9);
    }
    expect(boton).toBe(0); // dio la vuelta completa
  });

  it("da la vuelta completa en n manos", () => {
    let boton = 3;
    for (let i = 0; i < 9; i++) boton = siguienteBoton(boton, 9);
    expect(boton).toBe(3);
  });

  it("funciona en 6-max", () => {
    expect(posDeAsiento(0, 0, 6)).toBe("BTN");
    expect(posDeAsiento(3, 0, 6)).toBe("UTG");
    expect(posDeAsiento(5, 0, 6)).toBe("CO");
  });
});

describe("stacks distintos por jugador", () => {
  it("cada quien arranca con lo suyo", () => {
    const m = nuevaMano(MESA9, "BTN", { SB: 120, BB: 500, UTG: 80, BTN: 300 }, S13);
    expect(m.jugadores[0].stack).toBe(119); // SB puso 1
    expect(m.jugadores[1].stack).toBe(497); // BB puso 3
    expect(m.jugadores[2].stack).toBe(80);
    expect(m.jugadores[8].stack).toBe(300);
  });

  it("el corto no puede pagar más de lo que tiene", () => {
    const m = nuevaMano(MESA9, "BTN", { UTG: 40, BTN: 300, SB: 300, BB: 300 }, S13);
    actuar(m, "raise", 40); // UTG all-in
    expect(m.jugadores[2].allIn).toBe(true);
    for (let i = 0; i < 5; i++) actuar(m, "fold");
    actuar(m, "call"); // BTN paga
    expect(m.jugadores[8].bet).toBe(40);
  });
});

describe("montos redondos", () => {
  it("redondea al escalón que se usa en mesa", () => {
    expect(redondearApuesta(23, 3)).toBe(25);
    expect(redondearApuesta(35, 3)).toBe(35);
    expect(redondearApuesta(47, 3)).toBe(50);
    expect(redondearApuesta(163, 3)).toBe(175);
    expect(redondearApuesta(418, 3)).toBe(400);
  });

  it("montos chicos van de cinco en cinco", () => {
    expect(redondearApuesta(7, 3)).toBe(5);
    expect(redondearApuesta(13, 3)).toBe(15);
  });

  it("las opciones postflop salen redondas", () => {
    const m = nuevaMano(MESA9, "BTN", 300, S13);
    for (let i = 0; i < 6; i++) actuar(m, "fold");
    actuar(m, "raise", 15);
    actuar(m, "fold");
    actuar(m, "call"); // bote 31, al flop
    expect(m.calle).toBe(1);
    const o = opcionesSubida(m).filter((x) => x.etiqueta !== "All-in");
    for (const x of o) expect(x.monto % 5).toBe(0);
  });

  it("no repite el mismo monto dos veces", () => {
    const m = nuevaMano(MESA9, "BTN", 300, S13);
    for (let i = 0; i < 6; i++) actuar(m, "fold");
    actuar(m, "raise", 12);
    actuar(m, "fold");
    actuar(m, "call");
    const montos = opcionesSubida(m).map((x) => x.monto);
    expect(new Set(montos).size).toBe(montos.length);
  });
});
