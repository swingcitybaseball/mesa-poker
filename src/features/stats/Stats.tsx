import { useLiveQuery } from "dexie-react-hooks";
import { db, neto, horas, ETIQUETAS, type Sesion } from "../../db";
import { money } from "../../ui";

export default function Stats({ sesiones }: { sesiones: Sesion[] }) {
  const manos = useLiveQuery(() => db.manos.toArray(), []) ?? [];
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

  const porEtiqueta: Record<string, { n: number; neto: number }> = {};
  manos.forEach((m) =>
    (m.etiquetas ?? []).forEach((t) => {
      porEtiqueta[t] ??= { n: 0, neto: 0 };
      porEtiqueta[t].n++;
      porEtiqueta[t].neto += m.neto || 0;
    })
  );
  const conDatos = ETIQUETAS.filter((t) => porEtiqueta[t]);

  return (
    <>
    {conDatos.length > 0 && (
      <div className="card">
        <p className="lab">Qué te cuesta cada jugada</p>
        {conDatos.map((t) => {
          const d = porEtiqueta[t];
          return (
            <div key={t} className="cell">
              <div>
                <div style={{ fontSize: 14 }}>{t}</div>
                <div className="sub" style={{ margin: "2px 0 0" }}>
                  {d.n} {d.n === 1 ? "mano" : "manos"} · {d.n ? "$" + Math.round(d.neto / d.n) : "—"} por mano
                </div>
              </div>
              <span className={"disp " + (d.neto >= 0 ? "sage" : "red")} style={{ fontSize: 18 }}>
                {money(d.neto)}
              </span>
            </div>
          );
        })}
        <p className="mut" style={{ fontSize: 13, margin: "12px 0 0", lineHeight: 1.6 }}>
          Calculado con tus cartas y el board, no con lo que creíste que hiciste.
          Si "Farol" está muy en rojo, estás faroleando a quien no foldea.
        </p>
      </div>
    )}
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
    </>
  );
}
