import Dexie, { type EntityTable } from "dexie";
import type { Pos } from "../engine/poker";

export interface Stake {
  id: string; // "1/3"
  sb: number;
  bb: number;
  buyInTipico: number;
  buyInsRequeridos: number;
  orden: number;
}

export interface Lugar {
  id?: number;
  nombre: string;
  tipo: "casino" | "casa" | "privado";
}

export interface Rival {
  id?: number;
  lugarId?: number;
  apodo: string;
  tipo: TipoRival;
  notas: string;
  proximaVez: string;
}

export type TipoRival = "Paga todo" | "Foldea mucho" | "Sólido" | "Loco";
export const TIPOS_RIVAL: TipoRival[] = ["Paga todo", "Foldea mucho", "Sólido", "Loco"];

export interface Compra {
  monto: number;
  ts: string;
}

export interface Sesion {
  id?: number;
  inicio: string;
  fin: string | null;
  lugar: string;
  stakeId: string;
  nJugadores: 6 | 9;
  compras: Compra[];
  cashOut: number;
  notas: string;
  estadoMental?: "bien" | "cansado" | "tilt";
  calidadMesa?: "suave" | "normal" | "dura";
  syncCamara?: string; // ISO del instante en que arrancó la grabación
  coach?: string;
  // HUD: posición del hero al momento; el botón se mueve con "siguiente mano"
  heroPos: Pos;
  manosJugadas: number;
}

export type Etiqueta =
  | "Farol contra station"
  | "Pagué de más"
  | "Sizing chico con mano fuerte"
  | "Abrí muy ancho fuera de posición"
  | "No cobré valor delgado"
  | "Tilt"
  | "Cooler"
  | "Buena jugada";

export const ETIQUETAS: Etiqueta[] = [
  "Farol contra station",
  "Pagué de más",
  "Sizing chico con mano fuerte",
  "Abrí muy ancho fuera de posición",
  "No cobré valor delgado",
  "Tilt",
  "Cooler",
  "Buena jugada",
];

export interface Mano {
  id?: number;
  sesionId: number;
  n: number;
  ts: string;
  modo: "rapida" | "completa";
  pos: Pos;
  cartas: [string | null, string | null];
  rivalTipo?: TipoRival;
  rivalId?: number;
  board: string[];
  log: string[];
  res: "Gané" | "Perdí" | "Foldeé";
  neto: number;
  nota: string;
  etiquetas: Etiqueta[];
  straddle?: { pos: Pos; monto: number };
  narracion?: string;
}

export interface Estudio {
  id?: number;
  fecha: string;
  horas: number;
  tema: string;
  notas: string;
}

export interface Ajuste {
  clave: string;
  valor: string;
}

class MesaDB extends Dexie {
  stakes!: EntityTable<Stake, "id">;
  lugares!: EntityTable<Lugar, "id">;
  rivales!: EntityTable<Rival, "id">;
  sesiones!: EntityTable<Sesion, "id">;
  manos!: EntityTable<Mano, "id">;
  estudio!: EntityTable<Estudio, "id">;
  ajustes!: EntityTable<Ajuste, "clave">;

  constructor() {
    super("mesa");
    this.version(1).stores({
      stakes: "id, orden",
      lugares: "++id, nombre",
      rivales: "++id, lugarId, apodo",
      sesiones: "++id, inicio, fin, stakeId, lugar",
      manos: "++id, sesionId, ts, pos, rivalTipo, rivalId",
      estudio: "++id, fecha",
      ajustes: "clave",
    });
  }
}

export const db = new MesaDB();

export const STAKES_BASE: Stake[] = [
  { id: "1/2", sb: 1, bb: 2, buyInTipico: 200, buyInsRequeridos: 25, orden: 1 },
  { id: "1/3", sb: 1, bb: 3, buyInTipico: 300, buyInsRequeridos: 25, orden: 2 },
  { id: "2/5", sb: 2, bb: 5, buyInTipico: 500, buyInsRequeridos: 30, orden: 3 },
  { id: "5/5", sb: 5, bb: 5, buyInTipico: 1000, buyInsRequeridos: 30, orden: 4 },
  { id: "5/10", sb: 5, bb: 10, buyInTipico: 1000, buyInsRequeridos: 30, orden: 5 },
];

export async function semilla() {
  if ((await db.stakes.count()) === 0) await db.stakes.bulkAdd(STAKES_BASE);
}

/* helpers */
export const invertido = (s: Sesion) => s.compras.reduce((a, c) => a + c.monto, 0);
export const neto = (s: Sesion) => (s.fin ? s.cashOut - invertido(s) : 0);
export const horas = (s: Sesion) =>
  Math.max(0, ((s.fin ? new Date(s.fin) : new Date()).getTime() - new Date(s.inicio).getTime()) / 36e5);

export async function ajuste(clave: string, porDefecto = ""): Promise<string> {
  return (await db.ajustes.get(clave))?.valor ?? porDefecto;
}
export async function setAjuste(clave: string, valor: string) {
  await db.ajustes.put({ clave, valor });
}
