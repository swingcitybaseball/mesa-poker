import { db, neto, netoVivo, horas, type Sesion } from "../../db";
import { posDeAsiento } from "../../engine/poker";
import { money, duracion, fecha } from "../../ui";
import type { Tab } from "../../App";

export async function descargarRespaldo() {
  const data = {
    version: 1,
    fecha: new Date().toISOString(),
    sesiones: await db.sesiones.toArray(),
    manos: await db.manos.toArray(),
    rivales: await db.rivales.toArray(),
    ajustes: (await db.ajustes.toArray()).filter((a) => a.clave !== "apiKey"),
  };
  const b = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const u = URL.createObjectURL(b);
  const a = document.createElement("a");
  a.href = u;
  a.download = `mesa-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 2000);
  await db.ajustes.put({ clave: "ultimoRespaldo", valor: new Date().toISOString() });
}

export default function Inicio({ activa, sesiones, ir }: { activa: Sesion | null; sesiones: Sesion[]; ir: (t: Tab) => void }) {
  const cerradas = sesiones.filter((s) => s.fin).sort((a, b) => b.inicio.localeCompare(a.inicio));
  const ultima = cerradas[0];
  const H = cerradas.reduce((a, s) => a + horas(s), 0);
  const N = cerradas.reduce((a, s) => a + neto(s), 0);

  return (
    <>
      {activa ? (
        <div className="card" style={{ borderColor: "rgba(201,162,83,.4)" }}>
          <p className="lab">Sesión en curso</p>
          <p style={{ fontSize: 16, margin: "0 0 6px" }}>
            {activa.lugar || "En juego"} · {activa.stakeId} · estás en{" "}
            <b className="brass">{posDeAsiento(activa.heroAsiento, activa.botonAsiento, activa.nJugadores)}</b>
          </p>
          <p className="sub" style={{ margin: "0 0 2px" }}>Vas</p>
          <p className={"disp stat " + (netoVivo(activa) >= 0 ? "sage" : "red")} style={{ marginBottom: 14 }}>
            {money(netoVivo(activa))}
          </p>
          <button className="btn" onClick={() => ir("mano")}>Abrir HUD</button>
        </div>
      ) : (
        <div className="card">
          <p className="lab">Sin sesión activa</p>
          <button className="btn" onClick={() => ir("tracking")}>Empezar sesión</button>
        </div>
      )}

      <div className="card" style={{ textAlign: "center", padding: "22px 16px" }}>
        <p className={"disp big " + (N >= 0 ? "sage" : "red")}>{money(N)}</p>
        <p className="sub">Ganancia total</p>
        <div className="divide" style={{ display: "flex" }}>
          <div style={{ flex: 1 }}><p className="disp stat">{H.toFixed(0)}h</p><p className="sub">Jugadas</p></div>
          <div style={{ flex: 1, borderLeft: "1px solid var(--line)" }}><p className="disp stat">{H > 0 ? money(N / H) : "—"}</p><p className="sub">Por hora</p></div>
          <div style={{ flex: 1, borderLeft: "1px solid var(--line)" }}><p className="disp stat">{cerradas.length}</p><p className="sub">Sesiones</p></div>
        </div>
      </div>

      {cerradas.length > 0 && (
        <div className="card">
          <p className="lab">Respaldo</p>
          <p className="mut" style={{ fontSize: 13, lineHeight: 1.6, margin: "0 0 12px" }}>
            Tus {cerradas.length} sesiones viven solo en este dispositivo. Si borras el
            navegador o cambias de teléfono, se pierden.
          </p>
          <button className="btn ghost" onClick={descargarRespaldo}>Descargar mis datos</button>
        </div>
      )}

      {ultima && (
        <div className="card">
          <p className="lab">Última sesión</p>
          <p className={"disp stat " + (neto(ultima) >= 0 ? "sage" : "red")}>{money(neto(ultima))}</p>
          <p className="sub">{ultima.lugar || "Sin lugar"} · {ultima.stakeId} · {duracion(horas(ultima))} · {fecha(ultima.inicio)}</p>
        </div>
      )}
    </>
  );
}
