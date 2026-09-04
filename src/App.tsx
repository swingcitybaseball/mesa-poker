import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, neto } from "./db";
import { money } from "./ui";
import Inicio from "./features/inicio/Inicio";
import ManoTab from "./features/mano/ManoTab";
import Tracking from "./features/tracking/Tracking";
import Stats from "./features/stats/Stats";
import Ajustes from "./features/ajustes/Ajustes";
import SesionDetalle from "./features/tracking/SesionDetalle";

export type Tab = "inicio" | "mano" | "tracking" | "stats";

const TABS: [Tab, string][] = [
  ["inicio", "Inicio"],
  ["mano", "Mano"],
  ["tracking", "Tracking"],
  ["stats", "Stats"],
];

export default function App() {
  const [tab, setTab] = useState<Tab>("inicio");
  const [ajustes, setAjustes] = useState(false);
  const [detalle, setDetalle] = useState<number | null>(null);
  const sesiones = useLiveQuery(() => db.sesiones.toArray(), []) ?? [];
  const bankrollInicial =
    useLiveQuery(async () => Number((await db.ajustes.get("bankrollInicial"))?.valor ?? 0), []) ?? 0;
  const bankroll = bankrollInicial + sesiones.filter((s) => s.fin).reduce((a, s) => a + neto(s), 0);
  const activa = sesiones.find((s) => !s.fin) ?? null;

  return (
    <>
      <div className="wrap">
        <header className="top">
          <span className="mark">MESA</span>
          <span>
            <span className="dim" style={{ fontSize: 13, marginRight: 12 }}>Bankroll {money(bankroll)}</span>
            <button className="dim" style={{ fontSize: 13 }} onClick={() => setAjustes(true)}>Ajustes</button>
          </span>
        </header>
        {ajustes ? (
          <Ajustes onCerrar={() => setAjustes(false)} />
        ) : detalle != null && sesiones.find((x) => x.id === detalle) ? (
          <SesionDetalle s={sesiones.find((x) => x.id === detalle)!} onCerrar={() => setDetalle(null)} />
        ) : (
          <>
            {tab === "inicio" && <Inicio activa={activa} sesiones={sesiones} ir={setTab} />}
            {tab === "mano" && <ManoTab activa={activa} ir={setTab} />}
            {tab === "tracking" && <Tracking activa={activa} sesiones={sesiones} verDetalle={setDetalle} />}
            {tab === "stats" && <Stats sesiones={sesiones} />}
          </>
        )}
      </div>
      <nav className="tabs">
        {TABS.map(([k, t]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{t}</button>
        ))}
      </nav>
    </>
  );
}
