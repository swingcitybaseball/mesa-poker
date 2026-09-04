/** Evaluador de manos. Formato de carta: "As", "Kh", "Td", "9c". */

const ORDEN = "23456789TJQKA";
export const valorCarta = (c: string) => ORDEN.indexOf(c[0]) + 2;
const palo = (c: string) => c[1];

export const CATEGORIAS = [
  "Carta alta",
  "Par",
  "Dos pares",
  "Trío",
  "Escalera",
  "Color",
  "Full",
  "Póker",
  "Escalera de color",
] as const;
export type Categoria = (typeof CATEGORIAS)[number];

/** Puntaje comparable: [categoría, ...desempates]. Mayor gana. */
export function evaluar5(cartas: string[]): number[] {
  const vs = cartas.map(valorCarta).sort((a, b) => b - a);
  const ps = cartas.map(palo);
  const color = ps.every((p) => p === ps[0]);

  const unicos = [...new Set(vs)].sort((a, b) => b - a);
  let escalera = 0;
  if (unicos.length === 5) {
    if (unicos[0] - unicos[4] === 4) escalera = unicos[0];
    // rueda: A-2-3-4-5 cuenta como escalera al 5
    else if (unicos[0] === 14 && unicos[1] === 5 && unicos[4] === 2) escalera = 5;
  }

  const conteo = new Map<number, number>();
  vs.forEach((v) => conteo.set(v, (conteo.get(v) ?? 0) + 1));
  // ordenar por cantidad y luego por valor
  const grupos = [...conteo.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const forma = grupos.map((g) => g[1]).join("");
  const claves = grupos.map((g) => g[0]);

  if (escalera && color) return [8, escalera];
  if (forma === "41") return [7, claves[0], claves[1]];
  if (forma === "32") return [6, claves[0], claves[1]];
  if (color) return [5, ...vs];
  if (escalera) return [4, escalera];
  if (forma === "311") return [3, claves[0], claves[1], claves[2]];
  if (forma === "221") return [2, claves[0], claves[1], claves[2]];
  if (forma === "2111") return [1, claves[0], claves[1], claves[2], claves[3]];
  return [0, ...vs];
}

export const compararPuntaje = (a: number[], b: number[]): number => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? -1) - (b[i] ?? -1);
    if (d !== 0) return d;
  }
  return 0;
};

function combinaciones<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [primero, ...resto] = arr;
  return [
    ...combinaciones(resto, k - 1).map((c) => [primero, ...c]),
    ...combinaciones(resto, k),
  ];
}

export interface Resultado {
  puntaje: number[];
  categoria: Categoria;
  cartas: string[];
}

/**
 * Mejor mano de 5.
 * NLH: cualquier 5 de las 7. PLO: exactamente 2 del hoyo y 3 del board.
 */
export function mejorMano(hoyo: string[], board: string[], plo = false): Resultado | null {
  const limpio = (a: string[]) => a.filter((c) => c && c !== "??" && c.length === 2);
  const h = limpio(hoyo);
  const b = limpio(board);

  let candidatas: string[][];
  if (plo) {
    if (h.length < 2 || b.length < 3) return null;
    candidatas = [];
    for (const dosH of combinaciones(h, 2))
      for (const tresB of combinaciones(b, 3)) candidatas.push([...dosH, ...tresB]);
  } else {
    const todas = [...h, ...b];
    if (todas.length < 5) return null;
    candidatas = combinaciones(todas, 5);
  }

  let mejor: Resultado | null = null;
  for (const c of candidatas) {
    const p = evaluar5(c);
    if (!mejor || compararPuntaje(p, mejor.puntaje) > 0)
      mejor = { puntaje: p, categoria: CATEGORIAS[p[0]], cartas: c };
  }
  return mejor;
}

export interface Contendiente {
  pos: string;
  hoyo: string[];
}

/**
 * Devuelve quién gana. Puede haber empate (bote dividido).
 * Si a alguien le faltan cartas, no se puede decidir: devuelve null.
 */
export function ganadores(
  contendientes: Contendiente[],
  board: string[],
  plo = false
): { pos: string[]; categoria: Categoria } | null {
  const utiles = (a: string[]) => a.filter((c) => c && c !== "??" && c.length === 2).length;
  // Sin las cartas de todos, o sin las cinco del board, no se puede decidir.
  if (contendientes.some((c) => utiles(c.hoyo) < 2)) return null;
  if (utiles(board) < 5) return null;
  const evaluados = contendientes.map((c) => ({ pos: c.pos, r: mejorMano(c.hoyo, board, plo) }));
  if (evaluados.some((e) => !e.r)) return null;

  let mejor = evaluados[0].r!.puntaje;
  for (const e of evaluados) if (compararPuntaje(e.r!.puntaje, mejor) > 0) mejor = e.r!.puntaje;

  const pos = evaluados.filter((e) => compararPuntaje(e.r!.puntaje, mejor) === 0).map((e) => e.pos);
  const categoria = evaluados.find((e) => compararPuntaje(e.r!.puntaje, mejor) === 0)!.r!.categoria;
  return { pos, categoria };
}
