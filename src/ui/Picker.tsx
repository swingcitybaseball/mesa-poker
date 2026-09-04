import { useState } from "react";

const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];
const SUITS = [
  { s: "s", g: "♠", red: false },
  { s: "h", g: "♥", red: true },
  { s: "d", g: "♦", red: true },
  { s: "c", g: "♣", red: false },
];

export function Picker({
  usadas, onPick, onCerrar,
}: { usadas: Set<string>; onPick: (c: string) => void; onCerrar: () => void }) {
  const [rank, setRank] = useState<string | null>(null);
  return (
    <div style={{ background: "var(--surf2)", border: "1px solid var(--line)", borderRadius: 10, padding: 12, marginTop: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 5, marginBottom: rank ? 10 : 0 }}>
        {RANKS.map((r) => (
          <button key={r} onClick={() => setRank(r)}
            style={{ height: 40, borderRadius: 6, fontSize: 15, fontWeight: 500,
              border: `1px solid ${rank === r ? "var(--brass)" : "var(--line2)"}`,
              background: rank === r ? "rgba(201,162,83,.13)" : "transparent",
              color: rank === r ? "var(--brass)" : "var(--bone)" }}>{r}</button>
        ))}
        <button onClick={onCerrar}
          style={{ height: 40, borderRadius: 6, border: "1px solid var(--line2)", color: "var(--dim)", fontSize: 15 }}>✕</button>
      </div>
      {rank && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
          {SUITS.map((su) => {
            const v = rank + su.s;
            const ok = !usadas.has(v);
            return (
              <button key={su.s} disabled={!ok} onClick={() => { onPick(v); setRank(null); }}
                style={{ height: 46, borderRadius: 6, border: "1px solid var(--line2)", fontSize: 21,
                  background: ok ? "var(--bone)" : "var(--surf)",
                  color: ok ? (su.red ? "#C0392F" : "#151311") : "var(--dim)" }}>{su.g}</button>
            );
          })}
        </div>
      )}
    </div>
  );
}
