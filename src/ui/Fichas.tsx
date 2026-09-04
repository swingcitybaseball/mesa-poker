/** Fichas de casino con las denominaciones reales de una sala. */
const DENOM: { v: number; color: string; borde: string }[] = [
  { v: 5000, color: "#7B4A9E", borde: "#C9A9E0" },
  { v: 1000, color: "#C9A253", borde: "#F2E3BC" },
  { v: 500, color: "#5B3A8E", borde: "#BFA6E0" },
  { v: 100, color: "#1C1B1A", borde: "#8A857C" },
  { v: 25, color: "#2E6B45", borde: "#8FC7A5" },
  { v: 5, color: "#B33A33", borde: "#E8A9A4" },
  { v: 1, color: "#EDE8DE", borde: "#A8A296" },
];

/** Descompone un monto en fichas, de mayor a menor. */
export function descomponer(monto: number, maxFichas = 5): { v: number; n: number }[] {
  let resto = Math.max(0, Math.round(monto));
  const out: { v: number; n: number }[] = [];
  for (const d of DENOM) {
    if (resto < d.v) continue;
    const n = Math.floor(resto / d.v);
    resto -= n * d.v;
    out.push({ v: d.v, n });
    if (out.length >= maxFichas) break;
  }
  return out;
}

export function Ficha({ v, size = 16 }: { v: number; size?: number }) {
  const d = DENOM.find((x) => x.v === v) ?? DENOM[DENOM.length - 1];
  return (
    <span
      className="ficha"
      title={"$" + v}
      style={{
        width: size,
        height: size,
        background: d.color,
        border: `${Math.max(1, size * 0.09)}px dashed ${d.borde}`,
      }}
    />
  );
}

/**
 * Pila de fichas que representa un monto. Puramente visual:
 * el número siempre va al lado, la pila solo da la sensación de mesa.
 */
export function Pila({ monto, size = 16, max = 4 }: { monto: number; size?: number; max?: number }) {
  if (!monto || monto <= 0) return null;
  const partes = descomponer(monto, max);
  return (
    <span className="pila">
      {partes.map((p) => (
        <Ficha key={p.v} v={p.v} size={size} />
      ))}
    </span>
  );
}
