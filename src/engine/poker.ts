export type Pos = "SB" | "BB" | "UTG" | "UTG+1" | "MP" | "LJ" | "HJ" | "CO" | "BTN";
export type Calle = 0 | 1 | 2 | 3 | 4; // preflop, flop, turn, river, showdown
export type Accion = "fold" | "check" | "call" | "raise";

export const MESA9: Pos[] = ["SB", "BB", "UTG", "UTG+1", "MP", "LJ", "HJ", "CO", "BTN"];
export const MESA6: Pos[] = ["SB", "BB", "UTG", "MP", "CO", "BTN"];
export const CALLES = ["Preflop", "Flop", "Turn", "River", "Showdown"] as const;

/**
 * Modelo de asientos físicos: los asientos no se mueven, el botón sí.
 * `posDeAsiento` deriva el nombre de posición a partir de la distancia al botón.
 */
export function posDeAsiento(asiento: number, boton: number, n: number): Pos {
  const mesa = n === 6 ? MESA6 : MESA9;
  const off = (asiento - boton + n) % n; // 0 = BTN, 1 = SB, 2 = BB, ...
  return off === 0 ? "BTN" : mesa[off - 1];
}

/** El botón avanza un asiento por mano. */
export const siguienteBoton = (boton: number, n: number) => (boton + 1) % n;
export const anteriorBoton = (boton: number, n: number) => (boton - 1 + n) % n;

export interface Stake {
  nombre: string;
  sb: number;
  bb: number;
}

export interface Jugador {
  pos: Pos;
  hero: boolean;
  stack: number;
  bet: number;
  folded: boolean;
  allIn: boolean;
  acted: boolean;
}

export interface Straddle {
  pos: Pos;
  monto: number;
}

export interface Mano {
  stake: Stake;
  straddle: Straddle | null;
  /** Apuesta obligatoria más grande del preflop: bb, o el straddle si lo hubo. */
  bbEfectiva: number;
  jugadores: Jugador[];
  calle: Calle;
  bote: number;
  apuesta: number;
  turno: number; // -1 = nadie
  board: string[];
  log: string[];
  ganador: Pos | null;
  terminada: boolean;
}

export const mny = (n: number) =>
  (n < 0 ? "−$" : "$") + Math.abs(Math.round(n)).toLocaleString("en-US");

export function nuevaMano(
  mesa: Pos[],
  heroPos: Pos,
  stack: number | Partial<Record<Pos, number>>,
  stake: Stake,
  straddle: Straddle | null = null
): Mano {
  const stackDe = (pos: Pos) =>
    typeof stack === "number" ? stack : Math.max(0, stack[pos] ?? 0);
  const jugadores: Jugador[] = mesa.map((pos) => ({
    pos,
    hero: pos === heroPos,
    stack: stackDe(pos),
    bet: 0,
    folded: false,
    allIn: false,
    acted: false,
  }));
  jugadores[0].stack -= stake.sb;
  jugadores[0].bet = stake.sb;
  jugadores[1].stack -= stake.bb;
  jugadores[1].bet = stake.bb;

  const log = [`Ciegas ${stake.nombre} · ${mesa.length} jugadores`];
  let apuesta = stake.bb;
  let turno = 2 % jugadores.length;

  if (straddle) {
    const i = mesa.indexOf(straddle.pos);
    if (i < 0) throw new Error("El straddle no corresponde a un asiento de la mesa");
    const monto = Math.min(straddle.monto, jugadores[i].stack + jugadores[i].bet);
    jugadores[i].stack -= monto - jugadores[i].bet;
    jugadores[i].bet = monto;
    apuesta = monto;
    // La acción abre a la izquierda del straddle; él habla al último (tiene la opción).
    turno = (i + 1) % jugadores.length;
    log.push(`${straddle.pos} pone straddle de ${mny(monto)}`);
  }

  return {
    stake,
    straddle,
    bbEfectiva: apuesta,
    jugadores,
    calle: 0,
    bote: 0,
    apuesta,
    turno,
    board: [],
    log,
    ganador: null,
    terminada: false,
  };
}

/** Straddle estándar: el doble de la ciega grande. */
export const montoStraddle = (stake: Stake, multiplo = 2) => stake.bb * multiplo;

/** Posiciones donde normalmente se hace straddle. */
export function posicionesStraddle(mesa: Pos[]): Pos[] {
  return [mesa[2], mesa[mesa.length - 1]]; // UTG y BTN (Mississippi)
}

export function boteVivo(m: Mano): number {
  return m.bote + m.jugadores.reduce((a, p) => a + p.bet, 0);
}

function siguiente(j: Jugador[], desde: number, apuesta: number): number {
  for (let k = 1; k <= j.length; k++) {
    const i = (desde + k) % j.length;
    const p = j[i];
    if (!p.folded && !p.allIn && (!p.acted || p.bet < apuesta)) return i;
  }
  return -1;
}

function cerrarCalle(m: Mano): void {
  m.bote += m.jugadores.reduce((a, p) => a + p.bet, 0);
  m.jugadores.forEach((p) => {
    p.bet = 0;
    p.acted = false;
  });
  m.apuesta = 0;
  m.calle = (m.calle + 1) as Calle;
  if (m.calle >= 4) {
    m.turno = -1;
    m.terminada = true;
    return;
  }
  const activos = m.jugadores.filter((p) => !p.folded && !p.allIn);
  if (activos.length <= 1) {
    m.turno = -1;
    m.calle = 4;
    m.terminada = true;
    return;
  }
  m.turno = m.jugadores.findIndex((p) => !p.folded && !p.allIn);
}

/** Aplica una acción al jugador en turno. Muta y devuelve la misma mano. */
export function actuar(m: Mano, accion: Accion, monto = 0): Mano {
  if (m.turno < 0 || m.terminada) return m;
  const p = m.jugadores[m.turno];
  let linea = "";

  switch (accion) {
    case "fold":
      p.folded = true;
      p.acted = true;
      linea = `${p.pos} foldea`;
      break;
    case "check":
      if (m.apuesta > p.bet) throw new Error("No puede pasar: hay apuesta");
      p.acted = true;
      linea = `${p.pos} pasa`;
      break;
    case "call": {
      const falta = Math.min(m.apuesta - p.bet, p.stack);
      p.stack -= falta;
      p.bet += falta;
      p.acted = true;
      if (p.stack === 0) p.allIn = true;
      linea = `${p.pos} paga ${mny(falta)}${p.allIn ? " (all-in)" : ""}`;
      break;
    }
    case "raise": {
      const hasta = Math.min(monto, p.bet + p.stack);
      if (hasta <= m.apuesta && hasta < p.bet + p.stack)
        throw new Error("La subida debe ser mayor a la apuesta actual");
      p.stack -= hasta - p.bet;
      linea = `${p.pos} ${m.apuesta === 0 ? "apuesta" : "sube a"} ${mny(hasta)}`;
      p.bet = hasta;
      p.acted = true;
      if (p.stack === 0) {
        p.allIn = true;
        linea += " (all-in)";
      }
      if (hasta > m.apuesta) {
        m.apuesta = hasta;
        m.jugadores.forEach((x) => {
          if (x !== p && !x.folded && !x.allIn) x.acted = false;
        });
      }
      break;
    }
  }
  m.log.push(linea);

  const vivos = m.jugadores.filter((x) => !x.folded);
  if (vivos.length === 1) {
    m.bote += m.jugadores.reduce((a, x) => a + x.bet, 0);
    m.jugadores.forEach((x) => (x.bet = 0));
    m.ganador = vivos[0].pos;
    m.turno = -1;
    m.terminada = true;
    m.log.push(`${vivos[0].pos} gana ${mny(m.bote)} sin showdown`);
    return m;
  }

  const n = siguiente(m.jugadores, m.turno, m.apuesta);
  if (n === -1) cerrarCalle(m);
  else m.turno = n;
  return m;
}

/**
 * En vivo nadie apuesta $23: se apuesta $25. Redondea al escalón que de
 * verdad se usa en la mesa, según el tamaño del bote y de la ciega.
 */
export function escalon(monto: number, bb: number): number {
  if (monto >= 1000) return 100;
  if (monto >= 400) return 50;
  if (monto >= 150) return 25;
  if (monto >= 40) return 10;
  return Math.max(5, bb);
}

export function redondearApuesta(monto: number, bb: number): number {
  const e = escalon(monto, bb);
  return Math.max(e, Math.round(monto / e) * e);
}

/** Opciones rápidas de subida según contexto. Devuelve montos "subir a". */
export function opcionesSubida(m: Mano): { etiqueta: string; monto: number }[] {
  if (m.turno < 0) return [];
  const p = m.jugadores[m.turno];
  const pot = boteVivo(m);
  const falta = m.apuesta - p.bet;
  const max = p.bet + p.stack;
  const bb = m.bbEfectiva;
  let o: { etiqueta: string; monto: number }[];

  if (m.calle === 0 && m.apuesta === bb) {
    const ciegas: Pos[] = m.straddle ? ["BB", m.straddle.pos] : ["BB"];
    const limpers = m.jugadores.filter(
      (x) => !x.folded && x.bet === bb && !ciegas.includes(x.pos)
    ).length;
    o = [
      { etiqueta: "Estándar", monto: bb * 3 + limpers * bb },
      { etiqueta: "4bb", monto: bb * 4 },
      { etiqueta: "5bb", monto: bb * 5 },
    ];
  } else if (m.apuesta === 0) {
    o = [
      { etiqueta: "33%", monto: pot * 0.33 },
      { etiqueta: "50%", monto: pot * 0.5 },
      { etiqueta: "75%", monto: pot * 0.75 },
      { etiqueta: "Bote", monto: pot },
    ];
  } else {
    o = [
      { etiqueta: "2.5x", monto: m.apuesta * 2.5 },
      { etiqueta: "3x", monto: m.apuesta * 3 },
      { etiqueta: "Bote", monto: m.apuesta + pot + falta },
    ];
  }
  const esPreflopAbierto = m.calle === 0 && m.apuesta === bb;
  o = o
    // Preflop los múltiplos de ciega ya son redondos; postflop hay que redondear.
    .map((x) => ({ ...x, monto: esPreflopAbierto ? Math.round(x.monto) : redondearApuesta(x.monto, bb) }))
    .filter((x) => x.monto > m.apuesta && x.monto < max);

  // Dos porcentajes distintos pueden caer en el mismo monto redondo.
  const vistos = new Set<number>();
  o = o.filter((x) => (vistos.has(x.monto) ? false : (vistos.add(x.monto), true)));

  o.push({ etiqueta: "All-in", monto: max });
  return o;
}

export function cartasRequeridas(calle: Calle): number {
  return calle === 1 ? 3 : calle === 2 ? 4 : calle === 3 ? 5 : 0;
}
