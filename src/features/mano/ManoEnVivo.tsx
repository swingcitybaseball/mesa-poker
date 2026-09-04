import { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Sesion } from "../../db";
import {
  nuevaMano, actuar, opcionesSubida, boteVivo, cartasRequeridas,
  montoStraddle, posicionesStraddle, posDeAsiento,
  MESA9, MESA6, CALLES, type Mano, type Pos, type Straddle,
} from "../../engine/poker";
import { ganadores as calcularGanadores } from "../../engine/evaluador";
import { clasificar } from "../../engine/clasificar";
import { Mesa, Carta, money } from "../../ui";
import { Pila } from "../../ui/Fichas";
import { Picker } from "../../ui/Picker";

type PickSlot = { t: "mia"; i: number } | { t: "board"; i: number } | { t: "sd"; pos: Pos; i: number } | null;
type Revelado = { cartas: (string | null)[]; muck: boolean };

export default function ManoEnVivo({ s, onSalir }: { s: Sesion; onSalir: (avanzar?: boolean) => void }) {
  const mesa = s.nJugadores === 9 ? MESA9 : MESA6;
  const miPos = posDeAsiento(s.heroAsiento, s.botonAsiento, s.nJugadores);
  const nCartas = s.juego === "PLO" ? 4 : 2;
  const stake = { nombre: s.stakeId, sb: Number(s.stakeId.split("/")[0]), bb: Number(s.stakeId.split("/")[1]) };
  const stackBase = s.compras[0]?.monto ?? 300;

  const [str, setStr] = useState<Straddle | null>(null);
  const [arrancada, setArrancada] = useState(false);
  const [stacks, setStacks] = useState<Partial<Record<Pos, number>>>({});
  const [editaStacks, setEditaStacks] = useState(false);
  const [m, setM] = useState<Mano>(() => nuevaMano(mesa, miPos, stackBase, stake));

  const arrancar = (conStraddle: Straddle | null) => {
    setStr(conStraddle);
    const conf: Partial<Record<Pos, number>> = {};
    mesa.forEach((p) => (conf[p] = stacks[p] ?? stackBase));
    setStacks(conf);
    setM(nuevaMano(mesa, miPos, conf, stake, conStraddle));
    setArrancada(true);
  };
  const [mias, setMias] = useState<(string | null)[]>(Array(nCartas).fill(null));
  const [pick, setPick] = useState<PickSlot>(null);
  const [nota, setNota] = useState("");
  const [custom, setCustom] = useState("");
  const [err, setErr] = useState("");
  const [hist, setHist] = useState<{ n: number; pos: Pos | null; estado: string }[]>([]);
  const [panel, setPanel] = useState<Pos | null>(null);
  const [ganador, setGanador] = useState<Pos | null>(null);
  const ocultarPref = useLiveQuery(async () => (await db.ajustes.get("ocultarCartas"))?.valor === "1", []) ?? false;
  const [espiando, setEspiando] = useState(false);
  const tapadas = ocultarPref && !espiando;
  useEffect(() => {
    if (!espiando) return;
    const t = setTimeout(() => setEspiando(false), 4000);
    return () => clearTimeout(t);
  }, [espiando]);
  const [revelado, setRevelado] = useState<Record<string, Revelado>>({});
  const rev = (pos: Pos): Revelado => revelado[pos] ?? { cartas: Array(nCartas).fill(null), muck: false };

  /** Si ya hay board completo y cartas de todos los que no hicieron muck, calcula el ganador. */
  const auto = (() => {
    if (!m.terminada || m.ganador) return null;
    const vivos = m.jugadores.filter((p) => !p.folded);
    const conCartas = vivos.filter((p) => (p.hero ? mias : rev(p.pos).cartas).some(Boolean) && !rev(p.pos).muck);
    const mucks = vivos.filter((p) => !p.hero && rev(p.pos).muck);
    // Si todos menos uno hicieron muck, ese gana sin evaluar.
    if (mucks.length === vivos.length - 1 && conCartas.length === 1)
      return { pos: [conCartas[0].pos], categoria: null as string | null };
    if (conCartas.length + mucks.length !== vivos.length) return null;
    if (conCartas.length < 2) return null;
    return calcularGanadores(
      conCartas.map((p) => ({ pos: p.pos, hoyo: (p.hero ? mias : rev(p.pos).cartas).filter(Boolean) as string[] })),
      m.board,
      s.juego === "PLO"
    );
  })();


  const usadas = new Set([
    ...mias.filter(Boolean),
    ...m.board.filter((c) => c && c !== "??"),
    ...Object.values(revelado).flatMap((r) => r.cartas.filter(Boolean)),
  ] as string[]);
  const idxHero = mesa.indexOf(miPos);
  const act = m.turno >= 0 ? m.jugadores[m.turno] : null;
  // Si hubo all-in y se llegó a showdown, se reparten las cinco.
  const req = m.ganador ? cartasRequeridas(m.calle) : m.calle >= 4 ? 5 : cartasRequeridas(m.calle);
  const puestas = m.board.filter((c) => c && c !== "??").length;
  const faltanCartas = puestas < req;

  const pot = boteVivo(m);

  const snap = () =>
    setHist((h) => [...h.slice(-60), { n: m.log.length, pos: m.turno >= 0 ? m.jugadores[m.turno].pos : null, estado: JSON.stringify(m) }]);
  const deshacer = () => {
    const h = [...hist];
    const last = h.pop();
    if (!last) return;
    setM(JSON.parse(last.estado));
    setHist(h);
    setGanador(null);
    setErr("");
  };

  const restaurar = (k: number) => {
    setM(JSON.parse(hist[k].estado));
    setHist(hist.slice(0, k));
    setGanador(null);
    setRevelado({});
    setErr("");
    setPanel(null);
  };

  /** Rebobina hasta justo antes de la línea `i` del historial. */
  const rebobinar = (i: number) => {
    const k = hist.findIndex((x) => x.n === i);
    if (k >= 0) restaurar(k);
  };

  /** Rebobina hasta justo antes de la última acción de ese jugador. */
  const corregirA = (pos: Pos) => {
    for (let k = hist.length - 1; k >= 0; k--) if (hist[k].pos === pos) return restaurar(k);
  };
  const puedeCorregir = (pos: Pos) => hist.some((x) => x.pos === pos);

  /** Ajusta el stack de un jugador en medio de la mano. */
  const ajustarStack = (pos: Pos, valor: number) => {
    const n = structuredClone(m);
    const j = n.jugadores.find((p) => p.pos === pos);
    if (!j) return;
    j.stack = Math.max(0, valor);
    j.allIn = j.stack === 0 && j.bet > 0;
    setM(n);
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

  /** Postflop, cuando la ronda se va en checks. */
  const pasanHastaMi = () => {
    snap();
    let x = structuredClone(m);
    let guard = 0;
    const heroYaPaso = x.jugadores[x.turno]?.hero;
    while (x.turno >= 0 && !x.terminada && x.apuesta === 0 && guard++ < 12) {
      const esHero = x.jugadores[x.turno].hero;
      if (esHero && !heroYaPaso) break;
      x = actuar(x, "check");
      if (esHero && heroYaPaso) {
        // el hero pasó primero: seguimos hasta que cierre la ronda
      }
      if (x.calle !== m.calle) break;
    }
    setM(x);
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
      const cartas = [...r.cartas];
      cartas[pick.i] = c;
      setRevelado({ ...revelado, [pick.pos]: { cartas, muck: false } });
      setPick(pick.i < nCartas - 1 ? { t: "sd", pos: pick.pos, i: pick.i + 1 } : null);
      return;
    }
    if (pick.t === "mia") {
      const n = [...mias];
      n[pick.i] = c;
      setMias(n);
      setPick(pick.i < nCartas - 1 ? { t: "mia", i: pick.i + 1 } : null);
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
    const gane = m.ganador === miPos || (auto ? auto.pos.includes(miPos) : ganador === miPos);
    const netoMano = gane ? m.bote - puesto : -puesto;
    await db.manos.add({
      sesionId: s.id!, n: s.manosJugadas + 1, ts: new Date().toISOString(), modo: "completa",
      pos: miPos, cartas: mias, board: m.board, log: m.log,
      res: hero.folded ? "Foldeé" : netoMano >= 0 ? "Gané" : "Perdí",
      neto: netoMano, nota,
      etiquetas: clasificar({
        pos: miPos, cartas: mias, board: m.board, log: m.log, neto: netoMano,
        plo: s.juego === "PLO",
        showdown: m.jugadores.filter((p) => !p.folded && !p.hero).map((p) => ({
          pos: p.pos, cartas: rev(p.pos).cartas, muck: rev(p.pos).muck,
        })),
      }).etiquetas,
      straddle: str ?? undefined,
      showdown: m.jugadores.filter((p) => !p.folded && !p.hero).map((p) => ({
        pos: p.pos, cartas: rev(p.pos).cartas, muck: rev(p.pos).muck,
      })),
      ganador: (ganador ?? m.ganador) ?? undefined,
    });
    await db.sesiones.update(s.id!, { fichas: Math.max(0, (s.fichas ?? 0) + netoMano) });
    onSalir(true);
  };

  const asientos = m.jugadores.map((p) => ({
    pos: p.pos, hero: p.hero, stack: p.stack, bet: p.bet, folded: p.folded, allIn: p.allIn,
    cartas: p.hero
      ? mias
      : revelado[p.pos] && !revelado[p.pos].muck
        ? revelado[p.pos].cartas
        : undefined,
    cartasOcultas: p.hero && tapadas,
  }));

  if (!arrancada) {
    const opciones = posicionesStraddle(mesa);
    const monto = montoStraddle(stake);
    return (
      <>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontSize: 15, fontWeight: 500 }}>Mano {s.manosJugadas + 1}</span>
          <button className="dim" style={{ fontSize: 14 }} onClick={() => onSalir(false)}>Salir</button>
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

        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p className="lab" style={{ margin: 0 }}>Stacks · todos con {money(stackBase)}</p>
            <button type="button" className="chip" style={{ minHeight: 34, fontSize: 12 }}
              onClick={() => setEditaStacks(!editaStacks)}>
              {editaStacks ? "Listo" : "Cambiar"}
            </button>
          </div>
          {editaStacks && (
            <>
              <p className="mut" style={{ fontSize: 13, lineHeight: 1.6, margin: "12px 0 10px" }}>
                Pon lo que traía cada quien. Los que dejes vacíos usan {money(stackBase)}.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {mesa.map((p) => (
                  <div key={p} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span className="dim" style={{ fontFamily: "var(--mono)", fontSize: 11, width: 38 }}>
                      {p}{p === miPos ? "*" : ""}
                    </span>
                    <input className="inp" type="number" inputMode="decimal"
                      style={{ minHeight: 40, fontSize: 14, padding: "8px 9px" }}
                      placeholder={String(stackBase)}
                      value={stacks[p] ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setStacks({ ...stacks, [p]: v === "" ? undefined : Number(v) });
                      }} />
                  </div>
                ))}
              </div>
              <button className="btn ghost" style={{ marginTop: 12, fontSize: 13 }}
                onClick={() => setStacks({})}>Todos a {money(stackBase)}</button>
            </>
          )}
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
          <button className="dim" style={{ fontSize: 14 }} onClick={() => onSalir(false)}>Salir</button>
        </span>
      </div>

      <Mesa
        asientos={asientos}
        ancla={idxHero}
        turno={m.turno}
        onTap={(pos) => setPanel(panel === pos ? null : pos)}
        height={370}
        vertical
        centro={
          <>
            <div style={{ display: "flex", gap: 5, justifyContent: "center", marginBottom: 12 }}>
              {Array.from({ length: 5 }).map((_, i) => {
                const c = m.board[i];
                const puesta = c && c !== "??";
                const activaCalle = i < req;
                if (puesta)
                  return (
                    <Carta key={i} c={c} size="md"
                      activa={pick?.t === "board" && pick.i === i}
                      onClick={m.calle > 0 ? () => setPick({ t: "board", i }) : undefined} />
                  );
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={!activaCalle || m.calle === 0}
                    onClick={() => setPick({ t: "board", i })}
                    style={{
                      width: 30, height: 42, borderRadius: 4,
                      border: `1px ${activaCalle ? "solid" : "dashed"} ${
                        pick?.t === "board" && pick.i === i ? "var(--brass)" : activaCalle ? "var(--line2)" : "rgba(58,92,76,.5)"
                      }`,
                      background: activaCalle ? "rgba(242,237,227,.06)" : "transparent",
                      color: activaCalle ? "var(--muted)" : "transparent",
                      fontSize: 14, lineHeight: 1, padding: 0,
                      boxShadow: pick?.t === "board" && pick.i === i ? "0 0 0 2px var(--brass)" : undefined,
                    }}
                  >
                    {activaCalle ? "+" : ""}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>
              <Pila monto={pot} size={15} max={4} />
            </div>
            <p className="sub" style={{ margin: 0 }}>Bote</p>
            <p className="disp" style={{ fontSize: 24, margin: 0, color: "var(--brass)" }}>{money(pot)}</p>
          </>
        }
      />

      <p className="dim" style={{ fontSize: 12, textAlign: "center", margin: "10px 0 12px", lineHeight: 1.6 }}>
        Toca a cualquier jugador para corregir su acción o su stack
      </p>

      {panel && (() => {
        const j = m.jugadores.find((p) => p.pos === panel)!;
        const ultima = [...m.log].reverse().find((l) => l.startsWith(panel + " "));
        return (
          <div className="card" style={{ borderColor: "rgba(201,162,83,.45)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 17, fontWeight: 700 }}>
                {panel}{j.hero ? " · tú" : ""}
                {j.folded ? <span className="dim" style={{ fontSize: 13, fontWeight: 400 }}> · foldeó</span> : null}
              </span>
              <button className="dim" style={{ fontSize: 13 }} onClick={() => setPanel(null)}>Cerrar</button>
            </div>

            <p className="mut" style={{ fontSize: 13, margin: "0 0 12px", lineHeight: 1.6 }}>
              {ultima ? "Lo último: " + ultima : "Todavía no ha hecho nada esta mano."}
              {j.bet > 0 ? ` · lleva ${money(j.bet)} en esta calle` : ""}
            </p>

            <p className="lab">Su stack</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input className="inp" type="number" inputMode="decimal" style={{ flex: 1 }}
                defaultValue={Math.round(j.stack)}
                onBlur={(e) => { const v = Number(e.target.value); if (!isNaN(v)) ajustarStack(panel, v); }} />
              <button className="btn" style={{ width: "auto", padding: "0 18px" }}
                onClick={() => setPanel(null)}>Listo</button>
            </div>

            <button className="btn ghost" disabled={!puedeCorregir(panel)}
              style={puedeCorregir(panel) ? undefined : { opacity: 0.4 }}
              onClick={() => corregirA(panel)}>
              {puedeCorregir(panel)
                ? "Corregir desde su última acción"
                : "No hay acción suya que corregir"}
            </button>
            {puedeCorregir(panel) && (
              <p className="dim" style={{ fontSize: 12, margin: "10px 0 0", lineHeight: 1.6 }}>
                La mano regresa a justo antes de que él hablara. El bote y los stacks se
                recalculan solos, y sigues desde ahí.
              </p>
            )}
          </div>
        );
      })()}

      {/* mis cartas */}
      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="lab" style={{ margin: 0 }}>Tus cartas</span>
            {Array.from({ length: nCartas }).map((_, i) => (
              <Carta key={i} c={mias[i]} size={nCartas > 2 ? "sm" : "md"} oculta={tapadas}
                activa={pick?.t === "mia" && pick.i === i}
                onClick={() => (tapadas ? setEspiando(true) : setPick({ t: "mia", i }))} />
            ))}
          </div>
          {ocultarPref && mias.some(Boolean) ? (
            <button type="button" className="chip" style={{ minHeight: 36, fontSize: 12 }}
              onClick={() => setEspiando(!espiando)}>
              {espiando ? "Tapar" : "Ver 4s"}
            </button>
          ) : (
            <span className="dim" style={{ fontSize: 12 }}>
              {mias.some(Boolean) ? "ya salen en la mesa" : "toca para ponerlas"}
            </span>
          )}
        </div>
        {pick?.t === "mia" && <Picker usadas={usadas} onPick={ponerCarta} onCerrar={() => setPick(null)} />}
      </div>

      {/* board */}
      {faltanCartas && m.calle > 0 && (
        <div className="card">
          <p className="lab" style={{ marginBottom: pick?.t === "board" ? 0 : 10 }}>
            {m.calle >= 4
              ? "Corre el board — pon las cartas que faltan"
              : "Salió el " + CALLES[m.calle].toLowerCase() + " — toca las cartas en la mesa"}
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
          {m.calle > 0 && m.apuesta === 0 && (
            <button className="btn ghost" style={{ marginBottom: 10, fontSize: 13 }} onClick={pasanHastaMi}>
              {act.hero ? "Todos pasan (paso yo también)" : "Pasan hasta mí ↓"}
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
                {m.ganador === miPos ? "Ganaste" : m.ganador + " gana"} {money(m.bote)}
              </p>
            </>
          ) : (
            <>
              <p className="lab">Showdown — ¿qué tenían?</p>
              {!auto && faltanCartas && (
                <p className="mut" style={{ fontSize: 13, lineHeight: 1.6, margin: "0 0 14px" }}>
                  Faltan cartas del board. Ponlas arriba y calculo el ganador solo.
                </p>
              )}
              {auto && (
                <div style={{ background: "rgba(130,168,104,.12)", border: "1px solid rgba(130,168,104,.35)",
                  borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
                  <p className="sage" style={{ fontSize: 15, fontWeight: 500, margin: 0 }}>
                    {auto.pos.length > 1
                      ? "Bote dividido: " + auto.pos.join(" y ")
                      : auto.pos[0] === miPos
                        ? "Ganaste"
                        : auto.pos[0] + " gana"}
                    {auto.categoria ? " con " + auto.categoria.toLowerCase() : ""}
                  </p>
                  <p className="sub" style={{ marginTop: 4 }}>Calculado con las cartas que registraste</p>
                </div>
              )}
              {m.jugadores.filter((p) => !p.folded).map((p) => {
                const r = rev(p.pos);
                const gano = auto ? auto.pos.includes(p.pos) : ganador === p.pos;
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
                          {Array.from({ length: nCartas }).map((_, i) => (
                            <Carta key={i} c={r.cartas[i]} size={nCartas > 2 ? "xs" : "sm"}
                              activa={pick?.t === "sd" && pick.pos === p.pos && pick.i === i}
                              onClick={() => setPick({ t: "sd", pos: p.pos, i })} />
                          ))}
                        </div>
                      )}
                      {!p.hero && (
                        <button type="button" className={"chip" + (r.muck ? " on" : "")}
                          style={{ marginLeft: "auto", minHeight: 34, padding: "6px 10px", fontSize: 12 }}
                          onClick={() => {
                            setRevelado({ ...revelado, [p.pos]: { cartas: Array(nCartas).fill(null), muck: !r.muck } });
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
                  {ganador === miPos ? "Ganaste" : ganador + " gana"} {money(m.bote)}
                </p>
              )}
            </>
          )}
          <textarea className="inp" placeholder="¿Qué dudaste? Para el video y para el profesor."
            value={nota} onChange={(e) => setNota(e.target.value)} style={{ marginBottom: 10 }} />
          <button className="btn" onClick={guardar} disabled={!m.ganador && !ganador && !auto}
            style={!m.ganador && !ganador && !auto ? { opacity: 0.45 } : undefined}>
            {!m.ganador && !ganador && !auto ? "Marca quién ganó o registra las cartas" : "Guardar mano y seguir"}
          </button>
        </div>
      )}

      <div className="card" style={{ marginBottom: 0 }}>
        <p className="lab">Lo que pasó · toca una línea para volver ahí</p>
        {m.log.map((l, i) => {
          const puede = hist.some((x) => x.n === i);
          return (
            <button
              key={i}
              type="button"
              disabled={!puede}
              onClick={() => rebobinar(i)}
              style={{
                display: "block", width: "100%", textAlign: "left", padding: "5px 8px",
                borderRadius: 6, fontSize: 13, lineHeight: 1.5, marginBottom: 2,
                background: "transparent",
                color: i === m.log.length - 1 ? "var(--bone)" : "var(--muted)",
                cursor: puede ? "pointer" : "default",
                border: `1px solid ${puede ? "var(--line)" : "transparent"}`,
              }}
              onMouseOver={(e) => { if (puede) e.currentTarget.style.borderColor = "var(--line2)"; }}
              onMouseOut={(e) => (e.currentTarget.style.borderColor = "transparent")}
            >
              {l}
            </button>
          );
        })}
      </div>
    </>
  );
}
