import { parsearLog } from "./replay";
import { mejorMano, compararPuntaje, type Categoria } from "./evaluador";
import { CALLES, type Pos } from "./poker";

export type Etiqueta =
  | "Farol"
  | "Semifarol"
  | "Apuesta de valor"
  | "Valor no cobrado"
  | "Pagué de más"
  | "Pasivo con mano fuerte"
  | "Cooler"
  | "Fold disciplinado";

export interface Clasificacion {
  etiquetas: Etiqueta[];
  /** Hechos objetivos, en español, para que el profesor no invente. */
  hechos: string[];
  /** Fuerza de la mano al final, si se puede calcular. */
  categoriaFinal: Categoria | null;
}

interface AccionCalle {
  calle: number;
  accion: "fold" | "check" | "call" | "raise";
  monto: number;
}

const limpio = (a: (string | null)[]) =>
  a.filter((c): c is string => !!c && c !== "??" && c.length === 2);

/** Cartas del board visibles en cada calle: 0 preflop, 3 flop, 4 turn, 5 river. */
const boardHasta = (board: string[], calle: number) =>
  board.slice(0, calle === 1 ? 3 : calle === 2 ? 4 : calle >= 3 ? 5 : 0);

/**
 * Reconstruye en qué calle ocurrió cada acción del héroe.
 * Usa la misma regla de cierre de ronda que el motor: la calle avanza
 * cuando todos los activos igualaron la apuesta.
 */
function accionesDelHeroe(log: string[], heroPos: Pos): AccionCalle[] {
  const { pasos } = parsearLog(log);
  const out: AccionCalle[] = [];
  let calle = 0;
  let apuesta = 0;
  const igualado = new Map<string, number>();
  const vivos = new Set<string>();
  let actuaron = new Set<string>();

  for (const p of pasos) vivos.add(p.pos);

  for (const p of pasos) {
    if (p.accion === "raise") {
      apuesta = p.monto;
      igualado.set(p.pos, p.monto);
      actuaron = new Set([p.pos]);
    } else if (p.accion === "call") {
      igualado.set(p.pos, apuesta);
      actuaron.add(p.pos);
    } else if (p.accion === "check") {
      actuaron.add(p.pos);
    } else {
      vivos.delete(p.pos);
      actuaron.add(p.pos);
    }

    if (p.pos === heroPos) out.push({ calle, accion: p.accion, monto: p.monto });

    // ¿cerró la ronda?
    const activos = [...vivos];
    const todosActuaron = activos.every((v) => actuaron.has(v));
    const todosIgualaron = activos.every((v) => (igualado.get(v) ?? 0) === apuesta);
    if (todosActuaron && todosIgualaron && activos.length > 1) {
      calle++;
      apuesta = 0;
      igualado.clear();
      actuaron = new Set();
    }
  }
  return out;
}

export interface EntradaClasificacion {
  pos: Pos;
  cartas: (string | null)[];
  board: string[];
  log: string[];
  neto: number;
  plo?: boolean;
  showdown?: { pos: Pos; cartas: (string | null)[]; muck: boolean }[];
  ganador?: Pos;
}

export function clasificar(e: EntradaClasificacion): Clasificacion {
  const etiquetas: Etiqueta[] = [];
  const hechos: string[] = [];
  const hoyo = limpio(e.cartas);
  const board = limpio(e.board);
  const acciones = accionesDelHeroe(e.log, e.pos);

  if (!acciones.length) return { etiquetas, hechos, categoriaFinal: null };

  const foldeo = acciones.some((a) => a.accion === "fold");
  const calleFinal = Math.max(...acciones.map((a) => a.calle));
  const agresivas = acciones.filter((a) => a.accion === "raise");
  const ultimaAgresiva = agresivas[agresivas.length - 1];

  const fuerzaEn = (calle: number) => {
    const b = boardHasta(board, calle);
    if (hoyo.length < 2 || b.length < 3) return null;
    return mejorMano(hoyo, b, e.plo);
  };

  const final = fuerzaEn(calleFinal >= 3 ? 3 : calleFinal);
  const categoriaFinal = final?.categoria ?? null;

  if (hoyo.length) hechos.push(`Mis cartas: ${hoyo.join(" ")}`);
  if (board.length) hechos.push(`Board: ${board.join(" ")}`);
  hechos.push(
    "Mis acciones: " +
      acciones.map((a) => `${CALLES[Math.min(a.calle, 3)]} ${a.accion === "raise" ? "apuesto/subo $" + a.monto : a.accion === "call" ? "pago" : a.accion === "check" ? "paso" : "foldeo"}`).join(", ")
  );
  if (categoriaFinal) hechos.push(`Mi mano final: ${categoriaFinal.toLowerCase()}`);

  // --- agresión sin mano = farol
  if (ultimaAgresiva && ultimaAgresiva.calle >= 1) {
    const f = fuerzaEn(ultimaAgresiva.calle);
    if (f) {
      const esNada = f.puntaje[0] === 0;
      if (esNada && ultimaAgresiva.calle >= 3) {
        etiquetas.push("Farol");
        hechos.push(`Aposté ${"$" + ultimaAgresiva.monto} en el river con carta alta: fue farol puro.`);
      } else if (esNada) {
        etiquetas.push("Semifarol");
        hechos.push(`Aposté en ${CALLES[ultimaAgresiva.calle].toLowerCase()} sin mano hecha.`);
      } else if (f.puntaje[0] >= 2) {
        etiquetas.push("Apuesta de valor");
        hechos.push(`Aposté con ${f.categoria.toLowerCase()}: fue por valor.`);
      }
    }
  }

  // --- llegué al river con mano y no aposté
  if (!foldeo && calleFinal >= 3 && final && final.puntaje[0] >= 1) {
    const enRiver = acciones.filter((a) => a.calle >= 3);
    if (enRiver.length && enRiver.every((a) => a.accion === "check")) {
      etiquetas.push("Valor no cobrado");
      hechos.push(`Llegué al river con ${final.categoria.toLowerCase()} y pasé sin apostar.`);
    }
  }

  // --- pagué el river y perdí con mano débil
  const pagoRiver = acciones.some((a) => a.calle >= 3 && a.accion === "call");
  if (pagoRiver && e.neto < 0 && final && final.puntaje[0] <= 1) {
    etiquetas.push("Pagué de más");
    hechos.push(`Pagué en el river con ${final.categoria.toLowerCase()} y perdí.`);
  }

  // --- nunca subí teniendo mano fuerte
  if (!foldeo && final && final.puntaje[0] >= 3 && !agresivas.some((a) => a.calle >= 1)) {
    etiquetas.push("Pasivo con mano fuerte");
    hechos.push(`Tenía ${final.categoria.toLowerCase()} y no subí en ninguna calle.`);
  }

  // --- cooler: perdí con mano muy fuerte contra una mejor
  if (e.neto < 0 && final && final.puntaje[0] >= 5 && e.showdown?.length) {
    const rival = e.showdown
      .filter((r) => !r.muck && limpio(r.cartas).length >= 2)
      .map((r) => mejorMano(limpio(r.cartas), board, e.plo))
      .filter(Boolean);
    if (rival.some((r) => compararPuntaje(r!.puntaje, final.puntaje) > 0)) {
      etiquetas.push("Cooler");
      hechos.push(`Perdí con ${final.categoria.toLowerCase()} contra una mano mejor: fue cooler, no error.`);
    }
  }

  // --- foldear ahorrando fichas
  if (foldeo && calleFinal >= 1) {
    etiquetas.push("Fold disciplinado");
    hechos.push(`Foldeé en ${CALLES[Math.min(calleFinal, 3)].toLowerCase()}.`);
  }

  return { etiquetas, hechos, categoriaFinal };
}
