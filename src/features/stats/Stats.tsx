import { neto, horas, type Sesion } from "../../db";
import { money } from "../../ui";

export default function Stats({ sesiones }: { sesiones: Sesion[] }) {
  const cerradas = sesiones.filter((s) => s.fin);
  if (cerradas.length < 2)
    return (
      <div className="card" style={{ textAlign: "center", padding: "34px 16px" }}>
        <p style={{ margin: "0 0 6px", fontSize: 16 }}>Faltan sesiones</p>
        <p className="sub" style={{ margin: 0, lineHeight: 1.6 }}>
          Los patrones no significan nada con muestras chicas. Con menos de 100 horas, tu resultado dice más de la varianza que de tu juego.
        </p>
      </div>
    );

  const porStake: Record<string, { n: number; h: number; neto: number }> = {};
  cerradas.forEach((s) => {
    porStake[s.stakeId] ??= { n: 0, h: 0, neto: 0 };
    porStake[s.stakeId].n++;
    porStake[s.stakeId].h += horas(s);
    porStake[s.stakeId].neto += neto(s);
  });

  return (
    <div className="card">
      <p className="lab">Por stake</p>
      {Object.entries(porStake).map(([k, d]) => (
        <div key={k} className="cell">
          <div>
            <div style={{ fontSize: 14 }}>{k}</div>
            <div className="sub" style={{ margin: "2px 0 0" }}>{d.n} sesiones · {d.h.toFixed(0)}h · {d.h > 0 ? money(d.neto / d.h) + "/h" : "—"}</div>
          </div>
          <span className={"disp " + (d.neto >= 0 ? "sage" : "red")} style={{ fontSize: 19 }}>{money(d.neto)}</span>
        </div>
      ))}
    </div>
  );
}
