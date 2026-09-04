import { useState } from "react";
import { db, type Sesion } from "../../db";
import {
  nuevaMano, actuar, opcionesSubida, boteVivo, cartasRequeridas,
  montoStraddle, posicionesStraddle,
  MESA9, MESA6, CALLES, type Mano, type Pos, type Straddle,
} from "../../engine/poker";
import { Mesa, Carta, money } from "../../ui";
import { Picker } from "../../ui/Picker";

type PickSlot = { t: "mia"; i: number } | { t: "board"; i: number } | { t: "sd"; pos: Pos; i: number } | null;
type Revelado = { cartas: [string | null, string | null]; muck: boolean };

export default function ManoEnVivo({ s, onSalir }: { s: Sesion; onSalir: () => void }) {
  const mesa = s.nJugadores === 9 ? MESA9 : MESA6;
  const stake = { nombre: s.stakeId, sb: Number(s.stakeId.split("/")[0]), bb: Number(s.stakeId.split("/")[1]) };
  const stackBase = s.compras[0]?.monto ?? 300;

  const [str, setStr] = useState<Straddle | null>(null);
  const [arrancada, setArrancada] = useState(false);
  const [m, setM] = useState<Mano>(() => nuevaMano(mesa, s.heroPos, stackBase, stake));

  const arrancar = (conStraddle: Straddle | null) => {
    setStr(conStraddle);
    setM(nuevaMano(mesa, s.heroPos, stackBase, stake, conStraddle));
    setArrancada(true);
  };
  const [mias, setMias] = useState<[string | null, string | null]>([null, null]);
  const [pick, setPick] = useState<PickSlot>(null);
  const [nota, setNota] = useState("");
  const [custom, setCustom] = useState("");
  const [err, setErr] = useState("");
  const [hist, setHist] = useState<string[]>([]);
  const [ganador, setGanador] = useState<Pos | null>(null);
  const [revelado, setRevelado] = useState<Record<string, Revelado>>({});
  const rev = (pos: Pos): Revelado => revelado[pos] ?? { cartas: [null, null], muck: false };

  const usadas = new Set([
    ...mias.filter(Boolean),
    ...m.board.filter((c) => c && c !== "??"),
    ...Object.values(revelado).flatMap((r) => r.cartas.filter(Boolean)),
  ] as string[]);
  const idxHero = mesa.indexOf(s.heroPos);
  const act = m.turno >= 0 ? m.jugadores[m.turno] : null;
  const req = cartasRequeridas(m.calle);
  const puestas = m.board.filter((c) => c && c !== "??").length;
  const faltanCartas = puestas < req;
  const ranuras = Math.max(req, m.board.length);
  const pot = boteVivo(m);

  const snap = () => setHist((h) => [...h.slice(-40), JSON.stringify(m)]);
  const deshacer = () => {
    const h = [...hist];
    const last = h.pop();
    if (!last) return;
    setM(JSON.parse(last));
    setHist(h);
    setGanador(null);
    setErr("");
  };

  const aplicar = (accion: "fold" | "check" | "call" | "raise", monto = 0) => {
    snap();
    setErr("");
    setCustom("");
    try {
      setM(actuar(structuredClone(m), accion, monto));
    } catch (e) {
      setErr((e as Error).message);
      setHist((h) => h.slice(0, -1));
    }
  };

  /** Foldea a todos hasta que le toque al hero. El atajo más usado en mesa. */
  const foldeanHastaMi = () => {
    snap();
    let x = structuredClone(m);
    let guard = 0;
    while (x.turno >= 0 && !x.jugadores[x.turno].hero && !x.terminada && guard++ < 12) {
      x = actuar(x, "fold");
    }
    setM(x);
  };

  const ponerCarta = (c: string) => {
    if (!pick) return;
    if (pick.t === "sd") {
      const r = rev(pick.pos);
      const cartas = [...r.cartas] as [string | null, string | null];
      cartas[pick.i] = c;
      setRevelado({ ...revelado, [pick.pos]: { cartas, muck: false } });
      setPick(pick.i === 0 ? { t: "sd", pos: pick.pos, i: 1 } : null);
      return;
    }
    if (pick.t === "mia") {
      const n = [...mias] as [string | null, string | null];
      n[pick.i] = c;
      setMias(n);
      setPick(pick.i === 0 ? { t: "mia", i: 1 } : null);
    } else {
      const b = [...m.board];
      for (let i = 0; i < pick.i; i++) if (!b[i]) b[i] = "??";
      b[pick.i] = c;
      setM({ ...m, board: b });
      const siguienteVacia = Array.from({ length: req }).findIndex((_, i) => !b[i] || b[i] === "??");
      setPick(siguienteVacia >= 0 ? { t: "board", i: siguienteVacia } : null);
    }
  };

  const guardar = async () => {
    const hero = m.jugadores[idxHero];
    const puesto = stackBase - hero.stack;
    const gane = ganador === s.heroPos || m.ganador === s.heroPos;
    const netoMano = gane ? m.bote - puesto : -puesto;
    await db.manos.add({
      sesionId: s.id!, n: s.manosJugadas + 1, ts: new Date().toISOString(), modo: "completa",
      pos: s.heroPos, cartas: mias, board: m.board, log: m.log,
      res: hero.folded ? "Foldeé" : netoMano >= 0 ? "Gané" : "Perdí",
      neto: netoMano, nota, etiquetas: [], straddle: str ?? undefined,
      showdown: m.jugadores.filter((p) => !p.folded && !p.hero).map((p) => ({
        pos: p.pos, cartas: rev(p.pos).cartas, muck: rev(p.pos).muck,
      })),
      ganador: (ganador ?? m.ganador) ?? undefined,
    });
    onSalir();
  };

  const asientos = m.jugadores.map((p) => ({
    pos: p.pos, hero: p.hero, stack: p.stack, bet: p.bet, folded: p.folded, allIn: p.allIn,
  }));

  if (!arrancada) {
    const opciones = posicionesStraddle(mesa);
    const monto = montoStraddle(stake);
    return (
      <>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontSize: 15, fontWeight: 500 }}>Mano {s.manosJugadas + 1}</span>
          <button className="dim" style={{ fontSize: 14 }} onClick={onSalir}>Salir</button>
        </div>
        <div className="card">
          <p className="lab">¿Hubo straddle?</p>
          <button className="btn" style={{ marginBottom: 10 }} onClick={() => arrancar(null)}>
            No, mano normal
          </button>
          {opciones.map((pos) => (
            <button key={pos} className="btn ghost" style={{ marginBottom: 10 }}
              onClick={() => arrancar({ pos, monto })}>
              Sí, en {pos} · {money(monto)}
            </button>
          ))}
          <p className="dim" style={{ fontSize: 12, margin: "4px 0 0", lineHeight: 1.6 }}>
            Con straddle al botón la acción arranca en la ciega chica y el botón habla al último.
            Si fue de otro monto, lo ajustas con "Subió" en la primera acción.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 15, fontWeight: 500 }}>
          Mano {s.manosJugadas + 1} · {CALLES[m.calle]}{str ? ` · straddle ${str.pos}` : ""}
        </span>
        <span>
          <button className="dim" style={{ fontSize: 13, marginRight: 14 }} onClick={deshacer}>Deshacer</button>
          <button className="dim" style={{ fontSize: 14 }} onClick={onSalir}>Salir</button>
        </span>
      </div>

      <Mesa
        asientos={asientos}
        ancla={idxHero}
        turno={m.turno}
        height={268}
        centro={
          <>
            <div style={{ display: "flex", gap: 5, justifyContent: "center", marginBottom: 10, minHeight: 42 }}>
              {Array.from({ length: ranuras }).map((_, i) => {
                const c = m.board[i];
                return (
                  <Carta
                    key={i}
                    c={c && c !== "??" ? c : null}
                    size="sm"
                    activa={pick?.t === "board" && pick.i === i}
                    onClick={m.calle > 0 && m.calle < 4 ? () => setPick({ t: "board", i }) : undefined}
                  />
                );
              })}
            </div>
            <p className="sub" style={{ margin: 0 }}>Bote</p>
            <p className="disp" style={{ fontSize: 26, margin: 0, color: "var(--brass)" }}>{money(pot)}</p>
          </>
        }
      />

      {/* mis cartas */}
      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="lab" style={{ margin: 0 }}>Tengo</span>
            {[0, 1].map((i) => (
              <Carta key={i} c={mias[i]} activa={pick?.t === "mia" && pick.i === i}
                onClick={() => setPick({ t: "mia", i })} />
            ))}
          </div>
          <span className="dim" style={{ fontSize: 12 }}>{s.heroPos}</span>
        </div>
        {pick?.t === "mia" && <Picker usadas={usadas} onPick={ponerCarta} onCerrar={() => setPick(null)} />}
      </div>

      {/* board */}
      {faltanCartas && m.calle > 0 && m.calle < 4 && (
        <div className="card">
          <p className="lab" style={{ marginBottom: pick?.t === "board" ? 0 : 10 }}>
            Salió el {CALLES[m.calle].toLowerCase()} — toca las cartas en la mesa
          </p>
          {pick?.t === "board" ? (
            <Picker usadas={usadas} onPick={ponerCarta} onCerrar={() => setPick(null)} />
          ) : (
            <button className="btn ghost" style={{ fontSize: 13 }}
              onClick={() => {
                const b = [...m.board];
                for (let i = 0; i < req; i++) if (!b[i]) b[i] = "??";
                setM({ ...m, board: b });
                setPick(null);
              }}>
              No las vi — seguir sin cartas
            </button>
          )}
        </div>
      )}

      {/* acción */}
      {act && !faltanCartas && !m.terminada && (
        <div className="card">
          <div style={{ textAlign: "center", marginBottom: 14 }}>
            <p className="lab" style={{ marginBottom: 2 }}>Le toca a</p>
            <p className="disp" style={{ fontSize: 40, lineHeight: 1, margin: 0, color: act.hero ? "var(--brass)" : "var(--bone)" }}>
              {act.pos}{act.hero ? " · tú" : ""}
            </p>
            <p className="mut" style={{ fontSize: 13, margin: "6px 0 0" }}>
              {m.apuesta > act.bet ? `debe ${money(m.apuesta - act.bet)}` : "no debe nada"} · {money(act.stack)} atrás
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <button className="btn danger" style={{ flex: 1.4 }} onClick={() => aplicar("fold")}>Foldeó</button>
            {m.apuesta > act.bet ? (
              <button className="btn ghost" style={{ flex: 1 }} onClick={() => aplicar("call")}>
                Pagó {money(Math.min(m.apuesta - act.bet, act.stack))}
              </button>
            ) : (
              <button className="btn ghost" style={{ flex: 1 }} onClick={() => aplicar("check")}>Pasó</button>
            )}
          </div>

          {!act.hero && m.calle === 0 && (
            <button className="btn ghost" style={{ marginBottom: 10, fontSize: 13 }} onClick={foldeanHastaMi}>
              Foldean hasta mí ↓
            </button>
          )}

          <div className="row" style={{ marginBottom: 10 }}>
            {opcionesSubida(m).map((o) => (
              <button key={o.etiqueta} onClick={() => aplicar("raise", o.monto)}
                style={{ flex: "1 1 30%", minHeight: 48, borderRadius: 9, padding: "8px 4px", fontSize: 14,
                  border: "1px solid rgba(201,162,83,.4)", color: "var(--brass)" }}>
                <span style={{ display: "block", fontSize: 11, color: "var(--dim)" }}>{o.etiqueta}</span>
                {money(o.monto)}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <input className="inp" type="number" inputMode="decimal" placeholder="Subió a…" value={custom}
              onChange={(e) => setCustom(e.target.value)} style={{ flex: 1 }} />
            <button className="btn" style={{ width: "auto", padding: "0 20px" }}
              onClick={() => { const v = parseFloat(custom); if (v) aplicar("raise", v); }}>Subió</button>
          </div>
          {err && <p className="red" style={{ fontSize: 13, margin: "10px 0 0" }}>{err}</p>}
        </div>
      )}

      {/* fin */}
      {m.terminada && (
        <div className="card">
          {m.ganador ? (
            <>
              <p className="lab">Todos foldearon</p>
              <p className="disp" style={{ fontSize: 22, margin: "0 0 14px" }}>
                {m.ganador === s.heroPos ? "Ganaste" : m.ganador + " gana"} {money(m.bote)}
              </p>
            </>
          ) : (
            <>
              <p className="lab">Showdown — ¿qué tenían?</p>
              {m.jugadores.filter((p) => !p.folded).map((p) => {
                const r = rev(p.pos);
                const gano = ganador === p.pos;
                return (
                  <div key={p.pos} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => setGanador(p.pos)}
                        style={{ width: 62, padding: "9px 4px", borderRadius: 8, fontSize: 12, fontWeight: gano ? 600 : 400,
                          border: `1px solid ${gano ? "var(--sage)" : "var(--line2)"}`,
                          background: gano ? "rgba(130,168,104,.16)" : "transparent",
                          color: gano ? "var(--sage)" : "var(--muted)" }}>
                        {p.pos}{p.hero ? " · tú" : ""}
                      </button>
                      {p.hero ? (
                        <div style={{ display: "flex", gap: 6 }}>
                          {mias.map((c, i) => <Carta key={i} c={c} size="sm" />)}
                        </div>
                      ) : r.muck ? (
                        <span className="dim" style={{ fontSize: 13, flex: 1 }}>Hizo muck</span>
                      ) : (
                        <div style={{ display: "flex", gap: 6 }}>
                          {[0, 1].map((i) => (
                            <Carta key={i} c={r.cartas[i]} size="sm"
                              activa={pick?.t === "sd" && pick.pos === p.pos && pick.i === i}
                              onClick={() => setPick({ t: "sd", pos: p.pos, i })} />
                          ))}
                        </div>
                      )}
                      {!p.hero && (
                        <button type="button" className={"chip" + (r.muck ? " on" : "")}
                          style={{ marginLeft: "auto", minHeight: 34, padding: "6px 10px", fontSize: 12 }}
                          onClick={() => {
                            setRevelado({ ...revelado, [p.pos]: { cartas: [null, null], muck: !r.muck } });
                            setPick(null);
                          }}>Muck</button>
                      )}
                    </div>
                    {pick?.t === "sd" && pick.pos === p.pos && (
                      <Picker usadas={usadas} onPick={ponerCarta} onCerrar={() => setPick(null)} />
                    )}
                  </div>
                );
              })}
              {ganador && (
                <p className="disp" style={{ fontSize: 20, margin: "14px 0 12px" }}>
                  {ganador === s.heroPos ? "Ganaste" : ganador + " gana"} {money(m.bote)}
                </p>
              )}
            </>
          )}
          <textarea className="inp" placeholder="¿Qué dudaste? Para el video y para el profesor."
            value={nota} onChange={(e) => setNota(e.target.value)} style={{ marginBottom: 10 }} />
          <button className="btn" onClick={guardar} disabled={!m.ganador && !ganador}
            style={!m.ganador && !ganador ? { opacity: 0.45 } : undefined}>
            {!m.ganador && !ganador ? "Marca quién ganó" : "Guardar mano"}
          </button>
        </div>
      )}

      <div className="card" style={{ marginBottom: 0 }}>
        <p className="lab">Lo que pasó</p>
        {m.log.map((l, i) => (
          <p key={i} style={{ fontSize: 13, margin: "0 0 5px", lineHeight: 1.5, color: i === m.log.length - 1 ? "var(--bone)" : "var(--muted)" }}>{l}</p>
        ))}
      </div>
    </>
  );
}
