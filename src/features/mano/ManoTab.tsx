import { useState } from "react";
import { db, type Sesion } from "../../db";
import ManoEnVivo from "./ManoEnVivo";
import { MESA9, MESA6, type Pos } from "../../engine/poker";
import { Mesa, CORTA, money } from "../../ui";
import { Reloj } from "../tracking/Tracking";
import type { Tab } from "../../App";

function siguientePos(mesa: Pos[], actual: Pos): Pos {
  const i = mesa.indexOf(actual);
  return mesa[(i - 1 + mesa.length) % mesa.length];
}
function anteriorPos(mesa: Pos[], actual: Pos): Pos {
  const i = mesa.indexOf(actual);
  return mesa[(i + 1) % mesa.length];
}
function hablanDespues(mesa: Pos[], hero: Pos): number {
  return mesa.length - 1 - mesa.indexOf(hero);
}

export default function ManoTab({ activa, ir }: { activa: Sesion | null; ir: (t: Tab) => void }) {
  const [enVivo, setEnVivo] = useState(false);

  if (!activa)
    return (
      <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
        <p style={{ margin: "0 0 8px", fontSize: 17 }}>No hay sesión activa</p>
        <p className="sub" style={{ margin: "0 0 22px", lineHeight: 1.6 }}>
          El HUD se prende cuando empiezas una sesión.
        </p>
        <button className="btn" onClick={() => ir("tracking")}>Empezar sesión</button>
      </div>
    );

  const s = activa;
  const mesa = s.nJugadores === 9 ? MESA9 : MESA6;

  if (enVivo)
    return (
      <ManoEnVivo
        s={s}
        onSalir={() => {
          setEnVivo(false);
          db.sesiones.update(s.id!, {
            heroPos: siguientePos(mesa, s.heroPos),
            manosJugadas: s.manosJugadas + 1,
          });
        }}
      />
    );

  const idx = mesa.indexOf(s.heroPos);
  const invertido = s.compras.reduce((a, c) => a + c.monto, 0);
  const despues = hablanDespues(mesa, s.heroPos);

  const asientos = mesa.map((p, i) => ({
    pos: p,
    hero: p === s.heroPos,
    orden: (i < idx ? "antes" : i > idx ? "despues" : undefined) as "antes" | "despues" | undefined,
  }));

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <span className="mut" style={{ fontSize: 13 }}>{s.lugar || "En juego"} · {s.stakeId}</span>
        <span className="mut" style={{ fontSize: 13 }}><Reloj inicio={s.inicio} /></span>
      </div>

      <Mesa
        asientos={asientos}
        ancla={idx}
        seleccionada={s.heroPos}
        onTap={(pos) => db.sesiones.update(s.id!, { heroPos: pos })}
        height={264}
      />

      <div className="hud-card" style={{ marginTop: 14 }}>
        <p className="lab" style={{ marginBottom: 8 }}>Estás en</p>
        <p className="disp hud-pos">{s.heroPos}</p>
        <p style={{ fontSize: 15, margin: "12px 0 0" }}>{CORTA[s.heroPos]}</p>
        <p className="sub" style={{ marginTop: 6 }}>
          {despues === 0 ? "Nadie habla después de ti" : despues + (despues === 1 ? " habla" : " hablan") + " después de ti"}
        </p>
      </div>

      <button className="btn grande" onClick={() => setEnVivo(true)} style={{ marginBottom: 10 }}>
        Registrar esta mano
      </button>

      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <button className="btn ghost" style={{ flex: 2 }}
          onClick={() => db.sesiones.update(s.id!, {
            heroPos: siguientePos(mesa, s.heroPos), manosJugadas: s.manosJugadas + 1,
          })}>
          Siguiente mano →
        </button>
        <button className="btn ghost" style={{ flex: 1, fontSize: 13 }}
          onClick={() => db.sesiones.update(s.id!, {
            heroPos: anteriorPos(mesa, s.heroPos), manosJugadas: Math.max(0, s.manosJugadas - 1),
          })}>
          ← Atrás
        </button>
      </div>

      <div className="hud-strip">
        <div><p className="v">{s.manosJugadas}</p><p className="k">Manos</p></div>
        <div><p className="v">{money(invertido)}</p><p className="k">Invertido</p></div>
        <div><p className="v">{s.nJugadores}</p><p className="k">En mesa</p></div>
      </div>

      <p className="dim" style={{ fontSize: 12, textAlign: "center", margin: "14px 0 0", lineHeight: 1.6 }}>
        Toca cualquier asiento si te desincronizaste
      </p>
    </>
  );
}
