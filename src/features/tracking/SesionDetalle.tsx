import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, invertido, neto, horas, type Sesion, type Mano } from "../../db";
import { Carta, money, fecha, duracion } from "../../ui";
import { analizarMano, narrarMano, analizarSesion } from "../../lib/claude";

const fmt = (t: string) =>
  t.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith("**") ? <b key={i} className="brass">{p.slice(2, -2)}</b> : <span key={i}>{p}</span>
  );

export default function SesionDetalle({ s, onCerrar }: { s: Sesion; onCerrar: () => void }) {
  const manos = useLiveQuery(() => db.manos.where("sesionId").equals(s.id!).sortBy("n"), [s.id]) ?? [];
  const [abierta, setAbierta] = useState<number | null>(null);
  const [cargando, setCargando] = useState(false);
  const [err, setErr] = useState("");
  const h = horas(s);
  const n = neto(s);

  const pedirCoach = async () => {
    setCargando(true); setErr("");
    try {
      const t = await analizarSesion(s, manos);
      await db.sesiones.update(s.id!, { coach: t });
    } catch (e) { setErr((e as Error).message); }
    setCargando(false);
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <span style={{ fontSize: 15, fontWeight: 500 }}>{s.lugar || "Sesión"}</span>
        <button className="dim" style={{ fontSize: 14 }} onClick={onCerrar}>Cerrar</button>
      </div>

      <div className="card" style={{ textAlign: "center", padding: "22px 16px" }}>
        <p className={"disp big " + (n >= 0 ? "sage" : "red")}>{money(n)}</p>
        <p className="sub">{fecha(s.inicio)} · {s.stakeId} · mesa de {s.nJugadores}</p>
        <div className="divide" style={{ display: "flex" }}>
          <div style={{ flex: 1 }}><p className="disp stat">{duracion(h)}</p><p className="sub">Duración</p></div>
          <div style={{ flex: 1, borderLeft: "1px solid var(--line)" }}><p className="disp stat">{h > 0 ? money(n / h) : "—"}</p><p className="sub">Por hora</p></div>
          <div style={{ flex: 1, borderLeft: "1px solid var(--line)" }}><p className="disp stat">{manos.length}</p><p className="sub">Manos</p></div>
        </div>
        <div className="divide" style={{ display: "flex", marginBottom: 0, paddingBottom: 0 }}>
          <div style={{ flex: 1 }}><p className="disp stat">{money(invertido(s))}</p><p className="sub">Buy-in</p></div>
          <div style={{ flex: 1, borderLeft: "1px solid var(--line)" }}><p className="disp stat">{money(s.cashOut)}</p><p className="sub">Cash out</p></div>
        </div>
      </div>

      {manos.length > 0 && (
        <div className="card">
          <p className="lab">Manos de esta sesión</p>
          {manos.map((m) => (
            <div key={m.id}>
              <div className="cell" style={{ cursor: "pointer" }} onClick={() => setAbierta(abierta === m.id ? null : m.id!)}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span className="dim" style={{ fontSize: 12, width: 18 }}>{m.n}</span>
                  <div style={{ display: "flex", gap: 3 }}>
                    {m.cartas.map((c, i) => <Carta key={i} c={c} size="xs" />)}
                  </div>
                  <div style={{ minWidth: 0, marginLeft: 4 }}>
                    <div style={{ fontSize: 13 }}>{m.pos}{m.straddle ? " · straddle" : ""}</div>
                    <div className="sub" style={{ margin: "1px 0 0" }}>
                      {m.board.filter((c) => c !== "??").join(" ") || "sin board"}{m.nota ? " · con nota" : ""}
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: 14, fontWeight: 500 }} className={m.neto > 0 ? "sage" : m.neto < 0 ? "red" : "dim"}>
                  {m.neto ? money(m.neto) : "—"}
                </span>
              </div>
              {abierta === m.id && <DetalleMano m={m} s={s} />}
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <p className="lab">El profesor · toda la sesión</p>
        {s.coach ? (
          <>
            <div style={{ fontSize: 15, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{fmt(s.coach)}</div>
            <button className="btn ghost" style={{ marginTop: 14 }} onClick={pedirCoach} disabled={cargando}>
              {cargando ? "Revisando…" : "Volver a analizar"}
            </button>
          </>
        ) : (
          <>
            <p className="mut" style={{ fontSize: 14, lineHeight: 1.6, margin: "0 0 14px" }}>
              Busca el patrón que se repite en las {manos.length} manos de esta sesión.
            </p>
            <button className="btn" onClick={pedirCoach} disabled={cargando}>
              {cargando ? "Revisando tus manos…" : "Pedir análisis"}
            </button>
          </>
        )}
        {err && <p className="red" style={{ fontSize: 13, margin: "12px 0 0" }}>{err}</p>}
      </div>

      <button className="btn danger" onClick={async () => {
        if (!confirm("¿Borrar esta sesión y sus manos?")) return;
        await db.manos.where("sesionId").equals(s.id!).delete();
        await db.sesiones.delete(s.id!);
        onCerrar();
      }}>Borrar sesión</button>
    </>
  );
}

function DetalleMano({ m, s }: { m: Mano; s: Sesion }) {
  const [tab, setTab] = useState<"accion" | "analisis" | "narracion">("accion");
  const [analisis, setAnalisis] = useState("");
  const [narracion, setNarracion] = useState(m.narracion ?? "");
  const [cargando, setCargando] = useState(false);
  const [err, setErr] = useState("");

  const pedir = async (que: "analisis" | "narracion") => {
    setCargando(true); setErr(""); setTab(que);
    try {
      if (que === "analisis") setAnalisis(await analizarMano(m, s));
      else {
        const t = await narrarMano(m, s);
        setNarracion(t);
        await db.manos.update(m.id!, { narracion: t });
      }
    } catch (e) { setErr((e as Error).message); }
    setCargando(false);
  };

  const texto = tab === "analisis" ? analisis : tab === "narracion" ? narracion : "";

  return (
    <div style={{ background: "var(--surf2)", borderRadius: 10, padding: 14, margin: "4px 0 12px" }}>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className={"chip" + (tab === "accion" ? " on" : "")} onClick={() => setTab("accion")}>Acción</button>
        <button className={"chip" + (tab === "analisis" ? " on" : "")} onClick={() => analisis ? setTab("analisis") : pedir("analisis")}>Análisis</button>
        <button className={"chip" + (tab === "narracion" ? " on" : "")} onClick={() => narracion ? setTab("narracion") : pedir("narracion")}>Narración</button>
      </div>

      {tab === "accion" && (
        <>
          {m.board.length > 0 && (
            <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
              {m.board.map((c, i) => <Carta key={i} c={c === "??" ? null : c} size="sm" />)}
            </div>
          )}
          {m.log.map((l, i) => (
            <p key={i} className="mut" style={{ fontSize: 13, margin: "0 0 5px", lineHeight: 1.5 }}>{l}</p>
          ))}
          {m.nota && <p className="note" style={{ marginTop: 12 }}>{m.nota}</p>}
        </>
      )}

      {tab !== "accion" && (
        cargando ? <p className="mut" style={{ fontSize: 14 }}>Pensando…</p>
        : texto ? (
          <>
            <div style={{ fontSize: 15, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{fmt(texto)}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button className="btn ghost" style={{ fontSize: 13 }} onClick={() => navigator.clipboard?.writeText(texto)}>Copiar</button>
              <button className="btn ghost" style={{ fontSize: 13 }} onClick={() => pedir(tab)}>Otra versión</button>
            </div>
          </>
        ) : <button className="btn" onClick={() => pedir(tab)}>Generar</button>
      )}
      {err && <p className="red" style={{ fontSize: 13, margin: "12px 0 0" }}>{err}</p>}
    </div>
  );
}
