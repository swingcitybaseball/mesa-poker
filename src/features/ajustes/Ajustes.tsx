import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db";

const MODELOS: [string, string][] = [
  ["claude-sonnet-5", "Sonnet 5"],
  ["claude-opus-5", "Opus 5"],
  ["claude-haiku-4-5-20251001", "Haiku 4.5"],
];

export const VERSION = "1.3.0";

export default function Ajustes({ onCerrar }: { onCerrar: () => void }) {
  const guardado = useLiveQuery(async () => ({
    key: (await db.ajustes.get("apiKey"))?.valor ?? "",
    modelo: (await db.ajustes.get("modelo"))?.valor ?? "claude-sonnet-5",
    bri: (await db.ajustes.get("bankrollInicial"))?.valor ?? "0",
    ocultar: (await db.ajustes.get("ocultarCartas"))?.valor === "1",
  }), []);
  const [key, setKey] = useState<string | null>(null);
  const [bri, setBri] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  if (!guardado) return null;

  const exportar = async () => {
    const data = {
      sesiones: await db.sesiones.toArray(),
      manos: await db.manos.toArray(),
      rivales: await db.rivales.toArray(),
      ajustes: (await db.ajustes.toArray()).filter((a) => a.clave !== "apiKey"),
    };
    const b = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const u = URL.createObjectURL(b);
    const a = document.createElement("a");
    a.href = u; a.download = "mesa-respaldo-" + new Date().toISOString().slice(0, 10) + ".json"; a.click();
    setTimeout(() => URL.revokeObjectURL(u), 2000);
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <span style={{ fontSize: 15, fontWeight: 500 }}>Ajustes</span>
        <button className="dim" style={{ fontSize: 14 }} onClick={onCerrar}>Cerrar</button>
      </div>

      <div className="card">
        <p className="lab">El profesor</p>
        <p className="mut" style={{ fontSize: 13, lineHeight: 1.65, margin: "0 0 12px" }}>
          Necesitas una llave de la API de Anthropic (console.anthropic.com). Se guarda solo en este
          dispositivo. Cada análisis cuesta centavos.
        </p>
        <input className="inp" type="password" placeholder="sk-ant-..." value={key ?? guardado.key}
          onChange={(e) => setKey(e.target.value)} style={{ marginBottom: 10 }} />
        <div className="row" style={{ marginBottom: 12 }}>
          {MODELOS.map(([v, t]) => (
            <button key={v} className={"chip" + (guardado.modelo === v ? " on" : "")}
              onClick={() => db.ajustes.put({ clave: "modelo", valor: v })}>{t}</button>
          ))}
        </div>
        <button className="btn ghost" onClick={async () => {
          await db.ajustes.put({ clave: "apiKey", valor: (key ?? guardado.key).trim() });
          setAviso("Llave guardada en este dispositivo");
        }}>Guardar llave</button>
      </div>

      <div className="card">
        <p className="lab">Privacidad en mesa</p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <p className="mut" style={{ fontSize: 13, lineHeight: 1.65, margin: 0, flex: 1 }}>
            Tapar tus cartas mientras juegas. Salen boca abajo y las destapas con un toque
            durante 4 segundos.
          </p>
          <button type="button" className={"chip" + (guardado.ocultar ? " on" : "")}
            style={{ minWidth: 74 }}
            onClick={() => db.ajustes.put({ clave: "ocultarCartas", valor: guardado.ocultar ? "0" : "1" })}>
            {guardado.ocultar ? "Tapadas" : "Visibles"}
          </button>
        </div>
      </div>

      <div className="card">
        <p className="lab">Bankroll inicial</p>
        <p className="mut" style={{ fontSize: 13, lineHeight: 1.65, margin: "0 0 10px" }}>
          Lo que tenías separado para poker antes de empezar a registrar.
        </p>
        <input className="inp" type="number" inputMode="decimal" value={bri ?? guardado.bri}
          onChange={(e) => setBri(e.target.value)} style={{ marginBottom: 10 }} />
        <button className="btn ghost" onClick={async () => {
          await db.ajustes.put({ clave: "bankrollInicial", valor: String(parseFloat(bri ?? guardado.bri) || 0) });
          setAviso("Guardado");
        }}>Guardar</button>
      </div>

      <div className="card">
        <p className="lab">Tus datos</p>
        <p className="mut" style={{ fontSize: 13, lineHeight: 1.65, margin: "0 0 10px" }}>
          Todo vive en este dispositivo. Baja un respaldo cada tanto.
        </p>
        <button className="btn ghost" onClick={exportar}>Descargar respaldo</button>
      </div>

      {aviso && <p className="dim" style={{ fontSize: 13, textAlign: "center" }}>{aviso}</p>}
      <p className="dim" style={{ fontSize: 12, textAlign: "center", marginTop: 18 }}>MESA v{VERSION}</p>
    </>
  );
}
