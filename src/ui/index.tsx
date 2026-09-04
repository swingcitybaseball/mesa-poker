import type { Pos } from "../engine/poker";

export const DESC: Record<Pos, string> = {
  SB: "Ciega chica. Estás a la izquierda del repartidor y pones dinero antes de ver tus cartas. Después del flop hablas de primero toda la mano.",
  BB: "Ciega grande. Pones la apuesta más grande a ciegas. Defiendes más manos porque ya pusiste, pero juegas fuera de posición.",
  UTG: "Primero en hablar preflop, con toda la mesa atrás. Aquí solo abres manos fuertes.",
  "UTG+1": "Casi igual de temprano que UTG. Todavía juegas cerrado.",
  MP: "Posición media. Ya puedes abrir un poco más ancho.",
  LJ: "Justo antes del hijack. Empiezas a abrir pares chicos y conectores del mismo palo.",
  HJ: "Hijack. Solo quedan tres por hablar después de ti. Aquí abres bastante.",
  CO: "Cutoff. Solo el botón habla después de ti. Se roba mucho desde aquí.",
  BTN: "El botón. Actúas al último en flop, turn y river. La posición que más dinero gana.",
};

export const CORTA: Record<Pos, string> = {
  SB: "Hablas primero toda la mano",
  BB: "Ya pusiste — defiende, pero con cuidado",
  UTG: "Solo manos fuertes",
  "UTG+1": "Todavía cerrado",
  MP: "Un poco más ancho",
  LJ: "Pares chicos y conectores ya entran",
  HJ: "Abre bastante",
  CO: "Roba desde aquí",
  BTN: "Actúas al último — la mejor posición",
};

const SUITS: Record<string, { g: string; red: boolean }> = {
  s: { g: "♠", red: false },
  h: { g: "♥", red: true },
  d: { g: "♦", red: true },
  c: { g: "♣", red: false },
};

export function Carta({
  c, size = "md", onClick, activa,
}: { c: string | null; size?: "xs" | "sm" | "md"; onClick?: () => void; activa?: boolean }) {
  const D = size === "xs" ? [22, 30, 11, 9] : size === "sm" ? [30, 42, 14, 11] : [42, 58, 20, 15];
  const base = { width: D[0], height: D[1] } as const;
  if (!c)
    return (
      <button className="crd" onClick={onClick} disabled={!onClick}
        style={{ ...base, background: "transparent", color: "var(--dim)", fontSize: 16 }}>+</button>
    );
  const su = SUITS[c[1]];
  const Tag = onClick ? "button" : "span";
  return (
    <Tag className="crd" onClick={onClick}
      style={{ ...base, background: "var(--bone)", color: su.red ? "#C0392F" : "#151311",
        boxShadow: activa ? "0 0 0 2px var(--brass)" : undefined }}>
      <span style={{ fontSize: D[2], fontWeight: 600 }}>{c[0]}</span>
      <span style={{ fontSize: D[3] }}>{su.g}</span>
    </Tag>
  );
}

export function Chip({ on, onClick, children }: { on?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return <button className={"chip" + (on ? " on" : "")} onClick={onClick}>{children}</button>;
}

export interface Asiento {
  pos: Pos;
  hero?: boolean;
  stack?: number;
  bet?: number;
  folded?: boolean;
  allIn?: boolean;
  etiqueta?: string; // apodo del rival, si hay
}

/**
 * Mesa visual. `ancla` es el índice que va abajo al centro.
 * En setup se ancla el BTN; en el HUD se ancla al hero.
 */
export function Mesa({
  asientos, ancla, seleccionada, turno, onTap, height = 240,
}: {
  asientos: Asiento[];
  ancla: number;
  seleccionada?: Pos;
  turno?: number;
  onTap?: (pos: Pos) => void;
  height?: number;
}) {
  const n = asientos.length;
  const xy = (i: number, rx: number, ry: number) => {
    const j = (i - ancla + n) % n;
    const t = Math.PI / 2 + (j * 2 * Math.PI) / n;
    return [50 + rx * Math.cos(t), 50 + ry * Math.sin(t)];
  };
  return (
    <div className="tbl" style={{ height }}>
      {asientos.map((a, i) => {
        if (!["BTN", "SB", "BB"].includes(a.pos)) return null;
        const [x, y] = xy(i, 25, 21);
        const b = a.pos === "BTN";
        return (
          <div key={"m" + a.pos} className="mkr"
            style={{ left: `${x}%`, top: `${y}%`, background: b ? "var(--bone)" : "transparent",
              border: `1px solid ${b ? "var(--bone)" : "var(--brass)"}`, color: b ? "#151311" : "var(--brass)" }}>
            {b ? "D" : a.pos}
          </div>
        );
      })}
      {asientos.map((a, i) => {
        const [x, y] = xy(i, 40, 34);
        const on = seleccionada === a.pos || turno === i;
        const cls = "seat" + (on ? " on" : "") + (a.hero ? " hero" : "") + (a.folded ? " out" : "");
        return (
          <button
            key={a.pos}
            type="button"
            className={cls}
            style={{ left: `${x}%`, top: `${y}%`, cursor: onTap ? "pointer" : "default" }}
            onClick={onTap ? () => onTap(a.pos) : undefined}
            aria-pressed={seleccionada === a.pos}
          >
            <div style={{ fontWeight: 600 }}>{a.pos}</div>
            {a.stack != null ? (
              <div style={{ fontSize: 10, opacity: 0.75 }}>{a.allIn ? "all-in" : "$" + Math.round(a.stack)}</div>
            ) : a.hero ? (
              <div style={{ fontSize: 9, fontWeight: 600 }}>TÚ</div>
            ) : a.etiqueta ? (
              <div style={{ fontSize: 9, opacity: 0.8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.etiqueta}</div>
            ) : null}
            {a.bet ? (
              <div style={{ position: "absolute", left: "50%", bottom: -16, transform: "translateX(-50%)",
                fontSize: 10, color: "var(--sage)", fontWeight: 500, whiteSpace: "nowrap" }}>${Math.round(a.bet)}</div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export const money = (n: number) =>
  (n < 0 ? "−$" : "$") + Math.abs(Math.round(n)).toLocaleString("en-US");
export const fecha = (d: string) =>
  new Date(d).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
export const duracion = (h: number) => {
  const H = Math.floor(h);
  const M = Math.round((h - H) * 60);
  return `${H}h ${String(M).padStart(2, "0")}m`;
};
