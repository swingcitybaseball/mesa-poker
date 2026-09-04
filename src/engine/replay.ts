import {
  nuevaMano, actuar, boteVivo, cartasRequeridas,
  MESA9, MESA6, type Mano, type Pos, type Stake, type Straddle, type Accion,
} from "./poker";

export interface Frame {
  calle: number;
  board: string[];
  bote: number;
  texto: string;
  jugadores: { pos: Pos; bet: number; stack: number; folded: boolean; allIn: boolean; hero: boolean }[];
  turno: number;
}

interface Paso {
  pos: Pos;
  accion: Accion;
  monto: number;
}

const NUM = (t: string) => Number(t.replace(/[^0-9.]/g, "")) || 0;

/** Convierte el historial de texto que guarda la app en pasos ejecutables. */
export function parsearLog(log: string[]): { pasos: Paso[]; straddle: Straddle | null } {
  const pasos: Paso[] = [];
  let straddle: Straddle | null = null;

  for (const linea of log) {
    const l = linea.trim();
    if (!l || l.startsWith("Ciegas")) continue;

    const mStr = l.match(/^(\S+) pone straddle de (\$[\d,]+)/);
    if (mStr) {
      straddle = { pos: mStr[1] as Pos, monto: NUM(mStr[2]) };
      continue;
    }
    if (/ gana .* sin showdown$/.test(l)) continue;

    const m = l.match(/^(\S+) (foldea|pasa|paga|apuesta|sube a) ?(\$[\d,]+)?/);
    if (!m) continue;
    const pos = m[1] as Pos;
    const verbo = m[2];
    const monto = m[3] ? NUM(m[3]) : 0;

    if (verbo === "foldea") pasos.push({ pos, accion: "fold", monto: 0 });
    else if (verbo === "pasa") pasos.push({ pos, accion: "check", monto: 0 });
    else if (verbo === "paga") pasos.push({ pos, accion: "call", monto: 0 });
    else pasos.push({ pos, accion: "raise", monto });
  }
  return { pasos, straddle };
}

function frame(m: Mano, texto: string, board: string[]): Frame {
  const req = cartasRequeridas(m.calle as 0 | 1 | 2 | 3 | 4);
  return {
    calle: m.calle,
    board: board.slice(0, m.calle >= 4 ? 5 : req),
    bote: boteVivo(m),
    texto,
    turno: m.turno,
    jugadores: m.jugadores.map((p) => ({
      pos: p.pos, bet: p.bet, stack: p.stack, folded: p.folded, allIn: p.allIn, hero: p.hero,
    })),
  };
}

export interface OpcionesReplay {
  log: string[];
  board: string[];
  heroPos: Pos;
  nJugadores: 6 | 9;
  stack: number;
  stake: Stake;
}

/**
 * Vuelve a correr la mano por el motor y captura el estado después de cada acción.
 * Devuelve [] si el historial no se puede reproducir.
 */
export function reconstruir(o: OpcionesReplay): Frame[] {
  const mesa = o.nJugadores === 9 ? MESA9 : MESA6;
  const { pasos, straddle } = parsearLog(o.log);
  if (!pasos.length) return [];

  let m: Mano;
  try {
    m = nuevaMano(mesa, o.heroPos, o.stack, o.stake, straddle);
  } catch {
    return [];
  }

  const frames: Frame[] = [frame(m, straddle ? `Straddle en ${straddle.pos}` : "Reparten las cartas", o.board)];

  for (const p of pasos) {
    // Si el turno no coincide con el registro, el historial no cuadra: se corta ahí.
    if (m.turno < 0 || m.jugadores[m.turno].pos !== p.pos) break;
    const calleAntes = m.calle;
    try {
      m = actuar(m, p.accion, p.monto);
    } catch {
      break;
    }
    const verbo =
      p.accion === "fold" ? "foldea"
      : p.accion === "check" ? "pasa"
      : p.accion === "call" ? "paga"
      : "sube";
    frames.push(frame(m, `${p.pos} ${verbo}`, o.board));
    if (m.calle > calleAntes && m.calle < 4) {
      const nombre = ["", "Flop", "Turn", "River"][m.calle];
      frames.push(frame(m, `Sale el ${nombre.toLowerCase()}`, o.board));
    }
    if (m.terminada) break;
  }
  return frames;
}
