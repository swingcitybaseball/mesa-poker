import { useState, useEffect, useMemo, useRef } from "react";
import { reconstruir } from "../../engine/replay";
import { MESA9, MESA6, type Pos } from "../../engine/poker";
import { Mesa, Carta, money } from "../../ui";
import { Pila } from "../../ui/Fichas";
import type { Mano, Sesion } from "../../db";

const VELOCIDADES = [0.5, 1, 2] as const;
const MS_BASE = 1100;

export default function ReplayMano({ m, s }: { m: Mano; s: Sesion }) {
  const frames = useMemo(() => {
    const [sb, bb] = s.stakeId.split("/").map(Number);
    return reconstruir({
      log: m.log,
      board: m.board.filter((c) => c && c !== "??"),
      heroPos: m.pos,
      nJugadores: s.nJugadores,
      stack: s.compras[0]?.monto ?? 300,
      stake: { nombre: s.stakeId, sb, bb },
    });
  }, [m, s]);

  const [i, setI] = useState(0);
  const [corriendo, setCorriendo] = useState(false);
  const [vel, setVel] = useState<number>(1);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!corriendo) return;
    if (i >= frames.length - 1) {
      setCorriendo(false);
      return;
    }
    timer.current = window.setTimeout(() => setI((x) => x + 1), MS_BASE / vel);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [corriendo, i, vel, frames.length]);

  if (!frames.length)
    return (
      <p className="mut" style={{ fontSize: 14, lineHeight: 1.6 }}>
        Esta mano no se puede reproducir. Al historial le faltan acciones o no cuadra con la mesa.
      </p>
    );

  const f = frames[Math.min(i, frames.length - 1)];
  const mesa = s.nJugadores === 9 ? MESA9 : MESA6;
  const fin = i >= frames.length - 1;

  const revelar = (pos: Pos): (string | null)[] | undefined => {
    if (pos === m.pos) return m.cartas;
    if (!fin) return undefined;
    const r = m.showdown?.find((x) => x.pos === pos);
    return r && !r.muck ? r.cartas : undefined;
  };

  const asientos = f.jugadores.map((p) => ({
    pos: p.pos,
    hero: p.hero,
    stack: p.stack,
    bet: p.bet,
    folded: p.folded,
    allIn: p.allIn,
    cartas: p.folded ? undefined : revelar(p.pos),
  }));

  const ancla = mesa.indexOf(m.pos);

  return (
    <>
      <Mesa
        asientos={asientos}
        ancla={ancla >= 0 ? ancla : 0}
        turno={f.turno}
        height={330}
        vertical
        centro={
          <>
            <div style={{ display: "flex", gap: 5, justifyContent: "center", marginBottom: 10, minHeight: 58 }}>
              {Array.from({ length: 5 }).map((_, k) => {
                const c = f.board[k];
                return c ? (
                  <Carta key={k} c={c} size="md" />
                ) : (
                  <span key={k} style={{ width: 42, height: 58, borderRadius: 5,
                    border: "1px dashed rgba(58,92,76,.5)", display: "inline-block" }} />
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>
              <Pila monto={f.bote} size={15} max={4} />
            </div>
            <p className="sub" style={{ margin: 0 }}>Bote</p>
            <p className="disp" style={{ fontSize: 27, margin: 0, color: "var(--brass)" }}>{money(f.bote)}</p>
          </>
        }
      />

      <p style={{ textAlign: "center", fontSize: 15, margin: "14px 0 12px", minHeight: 22 }}>
        {f.texto}
      </p>

      <input
        type="range"
        min={0}
        max={frames.length - 1}
        value={i}
        onChange={(e) => { setCorriendo(false); setI(Number(e.target.value)); }}
        style={{ width: "100%", accentColor: "var(--brass)", marginBottom: 12 }}
      />

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button className="btn" style={{ flex: 1 }}
          onClick={() => {
            if (fin) { setI(0); setCorriendo(true); }
            else setCorriendo(!corriendo);
          }}>
          {fin ? "Repetir" : corriendo ? "Pausa" : "Reproducir"}
        </button>
        <button className="btn ghost" style={{ width: 52 }}
          onClick={() => { setCorriendo(false); setI(Math.max(0, i - 1)); }}>‹</button>
        <button className="btn ghost" style={{ width: 52 }}
          onClick={() => { setCorriendo(false); setI(Math.min(frames.length - 1, i + 1)); }}>›</button>
      </div>

      <div className="row" style={{ marginTop: 10, justifyContent: "center" }}>
        {VELOCIDADES.map((v) => (
          <button key={v} className={"chip" + (vel === v ? " on" : "")} onClick={() => setVel(v)}>
            {v}x
          </button>
        ))}
        <span className="dim" style={{ fontSize: 12, alignSelf: "center", marginLeft: 8 }}>
          {i + 1} / {frames.length}
        </span>
      </div>
    </>
  );
}
