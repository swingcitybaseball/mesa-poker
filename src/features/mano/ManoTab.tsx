import { useState } from "react";
import { db, type Sesion } from "../../db";
import ManoEnVivo from "./ManoEnVivo";
import { posDeAsiento, siguienteBoton, anteriorBoton } from "../../engine/poker";
import { Mesa, CORTA, money } from "../../ui";
import { Reloj } from "../tracking/Tracking";
import type { Tab } from "../../App";

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
  const n = s.nJugadores;
  const miPos = posDeAsiento(s.heroAsiento, s.botonAsiento, n);

  if (enVivo)
    return (
      <ManoEnVivo
        s={s}
        onSalir={(avanzar) => {
          setEnVivo(false);
          if (avanzar)
            db.sesiones.update(s.id!, {
              botonAsiento: siguienteBoton(s.botonAsiento, n),
              manosJugadas: s.manosJugadas + 1,
            });
        }}
      />
    );

  const invertido = s.compras.reduce((a, c) => a + c.monto, 0);
  
  const hablanDespues = (s.botonAsiento - s.heroAsiento + n) % n;

  const asientos = Array.from({ length: n }, (_, i) => {
    const pos = posDeAsiento(i, s.botonAsiento, n);
    return { pos, hero: i === s.heroAsiento };
  });

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <span className="mut" style={{ fontSize: 13 }}>{s.lugar || "En juego"} · {s.stakeId} · {s.juego}</span>
        <span className="mut" style={{ fontSize: 13 }}><Reloj inicio={s.inicio} /></span>
      </div>

      <Mesa
        asientos={asientos}
        seleccionada={miPos}
        onTap={(pos) => {
          const i = asientos.findIndex((a) => a.pos === pos);
          if (i >= 0) db.sesiones.update(s.id!, { heroAsiento: i });
        }}
        height={330}
        vertical
      />

      <div className="hud-card" style={{ marginTop: 14 }}>
        <p className="lab" style={{ marginBottom: 8 }}>Estás en</p>
        <p className="disp hud-pos">{miPos}</p>
        <p style={{ fontSize: 15, margin: "12px 0 0" }}>{CORTA[miPos]}</p>
        <p className="sub" style={{ marginTop: 6 }}>
          {hablanDespues === 0
            ? "Nadie habla después de ti"
            : hablanDespues + (hablanDespues === 1 ? " habla" : " hablan") + " después de ti"}
        </p>
      </div>

      <button className="btn grande" onClick={() => setEnVivo(true)} style={{ marginBottom: 10 }}>
        Registrar esta mano
      </button>

      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <button className="btn ghost" style={{ flex: 2 }}
          onClick={() => db.sesiones.update(s.id!, {
            botonAsiento: siguienteBoton(s.botonAsiento, n), manosJugadas: s.manosJugadas + 1,
          })}>
          Siguiente mano →
        </button>
        <button className="btn ghost" style={{ flex: 1, fontSize: 13 }}
          onClick={() => db.sesiones.update(s.id!, {
            botonAsiento: anteriorBoton(s.botonAsiento, n), manosJugadas: Math.max(0, s.manosJugadas - 1),
          })}>
          ← Atrás
        </button>
      </div>

      <div className="hud-strip">
        <div><p className="v">{s.manosJugadas}</p><p className="k">Manos</p></div>
        <div><p className="v">{money(invertido)}</p><p className="k">Invertido</p></div>
        <div><p className="v">{n}</p><p className="k">En mesa</p></div>
      </div>

      <p className="dim" style={{ fontSize: 12, textAlign: "center", margin: "14px 0 0", lineHeight: 1.6 }}>
        Tu silla no se mueve. El botón (D) gira con cada mano, igual que en la mesa real.
      </p>
    </>
  );
}
