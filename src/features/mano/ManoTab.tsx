import { useState } from "react";
import { db, type Sesion } from "../../db";
import ManoEnVivo from "./ManoEnVivo";
import { MESA9, MESA6, type Pos } from "../../engine/poker";
import { Mesa, CORTA, money } from "../../ui";
import { Reloj } from "../tracking/Tracking";
import type { Tab } from "../../App";

/**
 * HUD en vivo. El botón físico se mueve un asiento a la izquierda cada mano;
 * desde el punto de vista del hero, su posición retrocede un índice en la lista.
 */
function siguientePos(mesa: Pos[], actual: Pos): Pos {
  const i = mesa.indexOf(actual);
  return mesa[(i - 1 + mesa.length) % mesa.length];
}
function anteriorPos(mesa: Pos[], actual: Pos): Pos {
  const i = mesa.indexOf(actual);
  return mesa[(i + 1) % mesa.length];
}

export default function ManoTab({ activa, ir }: { activa: Sesion | null; ir: (t: Tab) => void }) {
  const [enVivo, setEnVivo] = useState(false);
  if (!activa)
    return (
      <div className="card" style={{ textAlign: "center", padding: "34px 16px" }}>
        <p style={{ margin: "0 0 6px", fontSize: 16 }}>No hay sesión activa</p>
        <p className="sub" style={{ margin: "0 0 18px", lineHeight: 1.6 }}>El HUD se prende cuando empiezas una sesión.</p>
        <button className="btn" onClick={() => ir("tracking")}>Empezar sesión</button>
      </div>
    );

  const s = activa;
  if (enVivo) return <ManoEnVivo s={s} onSalir={() => { setEnVivo(false); db.sesiones.update(s.id!, { heroPos: siguientePos(s.nJugadores === 9 ? MESA9 : MESA6, s.heroPos), manosJugadas: s.manosJugadas + 1 }); }} />;
  const mesa = s.nJugadores === 9 ? MESA9 : MESA6;
  const idx = mesa.indexOf(s.heroPos);
  const invertido = s.compras.reduce((a, c) => a + c.monto, 0);

  const avanzar = () =>
    db.sesiones.update(s.id!, { heroPos: siguientePos(mesa, s.heroPos), manosJugadas: s.manosJugadas + 1 });
  const regresar = () =>
    db.sesiones.update(s.id!, { heroPos: anteriorPos(mesa, s.heroPos), manosJugadas: Math.max(0, s.manosJugadas - 1) });

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <span className="mut" style={{ fontSize: 13 }}>{s.lugar || "En juego"} · {s.stakeId}</span>
        <span className="mut" style={{ fontSize: 13 }}><Reloj inicio={s.inicio} /></span>
      </div>

      <Mesa
        asientos={mesa.map((p) => ({ pos: p, hero: p === s.heroPos }))}
        ancla={idx}
        seleccionada={s.heroPos}
        onTap={(pos) => db.sesiones.update(s.id!, { heroPos: pos })}
        height={250}
      />
      <p className="dim" style={{ fontSize: 12, textAlign: "center", margin: "10px 0 0", lineHeight: 1.6 }}>
        Toca cualquier asiento para corregir dónde estás sentado
      </p>

      <div className="card" style={{ textAlign: "center", marginTop: 12, padding: "20px 16px" }}>
        <p className="lab" style={{ marginBottom: 4 }}>Estás en</p>
        <p className="disp" style={{ fontSize: 56, lineHeight: 1, margin: 0, color: "var(--brass)" }}>{s.heroPos}</p>
        <p className="mut" style={{ fontSize: 14, margin: "8px 0 0" }}>{CORTA[s.heroPos]}</p>
      </div>

      <button className="btn" onClick={avanzar} style={{ marginBottom: 10 }}>
        Siguiente mano →
      </button>

      <div className="grid2" style={{ marginBottom: 12 }}>
        <button className="btn ghost" onClick={regresar}>← Me equivoqué</button>
        <button className="btn ghost" onClick={() => setEnVivo(true)}>Registrar mano</button>
      </div>

      <div className="card" style={{ display: "flex", marginBottom: 0 }}>
        <div style={{ flex: 1, textAlign: "center" }}><p className="disp stat">{s.manosJugadas}</p><p className="sub">Manos</p></div>
        <div style={{ flex: 1, textAlign: "center", borderLeft: "1px solid var(--line)" }}><p className="disp stat">{money(invertido)}</p><p className="sub">Invertido</p></div>
      </div>
    </>
  );
}
