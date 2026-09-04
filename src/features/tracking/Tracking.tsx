import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, invertido, neto, netoVivo, horas, type Sesion } from "../../db";
import { posDeAsiento } from "../../engine/poker";
import { Mesa, Chip, DESC, money, fecha, duracion } from "../../ui";

export default function Tracking({ activa, sesiones, verDetalle }: { activa: Sesion | null; sesiones: Sesion[]; verDetalle: (id: number) => void }) {
  return activa ? <Activa s={activa} /> : <Nueva sesiones={sesiones} verDetalle={verDetalle} />;
}

function Nueva({ sesiones, verDetalle }: { sesiones: Sesion[]; verDetalle: (id: number) => void }) {
  const stakes = useLiveQuery(() => db.stakes.orderBy("orden").toArray(), []) ?? [];
  const [lugar, setLugar] = useState("");
  const [stakeId, setStakeId] = useState("1/3");
  const [nJug, setNJug] = useState<6 | 9>(9);
  const [asiento, setAsiento] = useState(0);
  const [juego, setJuego] = useState<"NLH" | "PLO">("NLH");
  const [buyIn, setBuyIn] = useState("300");
  const [err, setErr] = useState("");
  const botonInicial = (asiento - 1 + nJug) % nJug;
  const cerradas = sesiones.filter((s) => s.fin).sort((a, b) => b.inicio.localeCompare(a.inicio));

  const empezar = async () => {
    const b = parseFloat(buyIn);
    if (!b || b <= 0) return setErr("Pon el buy-in");
    await db.sesiones.add({
      inicio: new Date().toISOString(), fin: null, lugar: lugar.trim(), stakeId, nJugadores: nJug,
      compras: [{ monto: b, ts: new Date().toISOString() }], cashOut: 0, notas: "",
      heroAsiento: asiento, botonAsiento: (asiento - 1 + nJug) % nJug, juego, fichas: b, manosJugadas: 0,
    });
  };

  return (
    <>
      <div className="card">
        <p className="lab">Nueva sesión</p>
        <input className="inp" placeholder="Casino o lugar" value={lugar}
          onChange={(e) => setLugar(e.target.value)} style={{ marginBottom: 10 }} />
        <div className="row" style={{ marginBottom: 10 }}>
          {stakes.map((k) => <Chip key={k.id} on={stakeId === k.id} onClick={() => { setStakeId(k.id); setBuyIn(String(k.buyInTipico)); }}>{k.id}</Chip>)}
        </div>
        <div className="row" style={{ marginBottom: 10 }}>
          {([9, 6] as const).map((n) => (
            <Chip key={n} on={nJug === n} onClick={() => { setNJug(n); setAsiento(0); }}>{n} jugadores</Chip>
          ))}
        </div>
        <div className="row" style={{ marginBottom: 10 }}>
          {(["NLH", "PLO"] as const).map((j) => (
            <Chip key={j} on={juego === j} onClick={() => setJuego(j)}>{j}</Chip>
          ))}
        </div>
        <input className="inp" type="number" inputMode="decimal" placeholder="Buy-in" value={buyIn}
          onChange={(e) => setBuyIn(e.target.value)} />
      </div>

      <div className="card">
        <p className="lab">Toca tu silla en la mesa</p>
        <Mesa
          asientos={Array.from({ length: nJug }, (_, i) => ({ pos: posDeAsiento(i, botonInicial, nJug) }))}
          seleccionada={posDeAsiento(asiento, botonInicial, nJug)}
          onTap={(p) => {
            const i = Array.from({ length: nJug }, (_, k) => posDeAsiento(k, botonInicial, nJug)).indexOf(p);
            if (i >= 0) setAsiento(i);
          }}
          height={330}
          vertical
        />
        <div className="note" style={{ marginTop: 12 }}>
          <b className="brass">{posDeAsiento(asiento, botonInicial, nJug)}</b><br />
          {DESC[posDeAsiento(asiento, botonInicial, nJug)]}
        </div>
        <p className="dim" style={{ fontSize: 12, margin: "12px 0 0", lineHeight: 1.6 }}>
          Escoge tu silla real. Ahí te vas a quedar toda la sesión: el botón (D) es el que gira.
        </p>
      </div>

      {err && <p className="red" style={{ fontSize: 13, margin: "0 0 10px" }}>{err}</p>}
      <button className="btn" onClick={empezar}>Empezar sesión</button>

      {cerradas.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <p className="lab">Historial</p>
          {cerradas.map((s) => (
            <div key={s.id} className="cell" style={{ cursor: "pointer" }} onClick={() => verDetalle(s.id!)}>
              <div>
                <div style={{ fontSize: 14 }}>{s.lugar || "Sin lugar"} · {s.stakeId}</div>
                <div className="sub" style={{ margin: "2px 0 0" }}>{fecha(s.inicio)} · {duracion(horas(s))} · {s.manosJugadas} manos</div>
              </div>
              <span className={"disp " + (neto(s) >= 0 ? "sage" : "red")} style={{ fontSize: 19 }}>{money(neto(s))}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Activa({ s }: { s: Sesion }) {
  const [cerrando, setCerrando] = useState(false);
  const [cashOut, setCashOut] = useState("");
  const [editaFichas, setEditaFichas] = useState(false);
  const [fichasTxt, setFichasTxt] = useState("");
  const [recompra, setRecompra] = useState(false);
  const [montoRe, setMontoRe] = useState("300");
  const manos = useLiveQuery(() => db.manos.where("sesionId").equals(s.id!).count(), [s.id]) ?? 0;
  void manos;

  const cerrar = async () => {
    const c = parseFloat(cashOut === "" ? String(s.fichas ?? 0) : cashOut);
    if (isNaN(c) || c < 0) return;
    await db.sesiones.update(s.id!, { cashOut: c, fin: new Date().toISOString() });
  };
  const agregarRecompra = async () => {
    const n = parseFloat(montoRe);
    if (!n || n <= 0) return;
    await db.sesiones.update(s.id!, {
      compras: [...s.compras, { monto: n, ts: new Date().toISOString() }],
      fichas: (s.fichas ?? 0) + n,
    });
    setRecompra(false);
  };

  return (
    <>
      <div className="card" style={{ textAlign: "center", padding: "22px 16px" }}>
        <p className="lab" style={{ marginBottom: 6 }}>{s.lugar || "En juego"} · {s.stakeId}</p>
        <p className="disp big"><Reloj inicio={s.inicio} /></p>
        <div className="divide" style={{ display: "flex" }}>
          <div style={{ flex: 1 }}><p className="disp stat">{money(invertido(s))}</p><p className="sub">Invertido</p></div>
          <div style={{ flex: 1, borderLeft: "1px solid var(--line)", cursor: "pointer" }}
            onClick={() => { setFichasTxt(String(Math.round(s.fichas ?? 0))); setEditaFichas(true); }}>
            <p className="disp stat">{money(s.fichas ?? 0)}</p><p className="sub">Fichas · tocar</p>
          </div>
          <div style={{ flex: 1, borderLeft: "1px solid var(--line)" }}>
            <p className={"disp stat " + (netoVivo(s) >= 0 ? "sage" : "red")}>{money(netoVivo(s))}</p>
            <p className="sub">Vas</p>
          </div>
        </div>
      </div>

      {s.compras.length > 1 && (
        <div className="card">
          <p className="lab">Compras</p>
          {s.compras.map((c, i) => (
            <div key={i} className="cell">
              <span className="mut" style={{ fontSize: 14 }}>{i === 0 ? "Buy-in" : `Recompra ${i}`}</span>
              <span style={{ fontSize: 14 }}>{money(c.monto)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid2" style={{ marginBottom: 12 }}>
        <button className="btn ghost" onClick={() => setRecompra(!recompra)}>Recompra</button>
        <button className="btn ghost" onClick={() => setCerrando(!cerrando)}>Cerrar sesión</button>
      </div>

      {editaFichas && (
        <div className="card">
          <p className="lab">¿Cuántas fichas tienes ahorita?</p>
          <p className="mut" style={{ fontSize: 13, lineHeight: 1.6, margin: "0 0 10px" }}>
            Se ajusta sola con cada mano que registras. Corrígela si se desfasó.
          </p>
          <input className="inp" type="number" inputMode="decimal" value={fichasTxt}
            onChange={(e) => setFichasTxt(e.target.value)} style={{ marginBottom: 10 }} />
          <button className="btn" onClick={async () => {
            const n = parseFloat(fichasTxt);
            if (isNaN(n) || n < 0) return;
            await db.sesiones.update(s.id!, { fichas: n });
            setEditaFichas(false);
          }}>Guardar</button>
        </div>
      )}

      {recompra && (
        <div className="card">
          <p className="lab">¿De cuánto?</p>
          <input className="inp" type="number" inputMode="decimal" value={montoRe} onChange={(e) => setMontoRe(e.target.value)} style={{ marginBottom: 10 }} />
          <button className="btn" onClick={agregarRecompra}>Agregar</button>
        </div>
      )}

      {cerrando && (
        <div className="card">
          <p className="lab">¿Con cuánto te levantaste?</p>
          <input className="inp" type="number" inputMode="decimal" placeholder="Fichas al salir"
            value={cashOut === "" ? String(Math.round(s.fichas ?? 0)) : cashOut}
            onChange={(e) => setCashOut(e.target.value)} style={{ marginBottom: 10 }} />
          <button className="btn" onClick={cerrar}>Cerrar y guardar</button>
        </div>
      )}
    </>
  );
}

import { useEffect } from "react";
export function Reloj({ inicio }: { inicio: string }) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(t); }, []);
  return <>{duracion((Date.now() - new Date(inicio).getTime()) / 36e5)}</>;
}
