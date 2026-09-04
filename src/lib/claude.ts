import { db, type Mano, type Sesion, invertido, neto, horas } from "../db";
import { clasificar } from "../engine/clasificar";

const MODELO_POR_DEFECTO = "claude-sonnet-5";

async function llamar(system: string, prompt: string, maxTokens = 1200): Promise<string> {
  const apiKey = (await db.ajustes.get("apiKey"))?.valor ?? "";
  if (!apiKey) throw new Error("Falta tu llave de API. Ponla en Ajustes.");
  const model = (await db.ajustes.get("modelo"))?.valor ?? MODELO_POR_DEFECTO;

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content: prompt }] }),
  });

  if (!r.ok) {
    if (r.status === 401) throw new Error("Llave inválida");
    if (r.status === 429) throw new Error("Demasiadas peticiones, espera un momento");
    if (r.status === 400) throw new Error("Petición rechazada — revisa el modelo en Ajustes");
    throw new Error("Error " + r.status);
  }
  const d = await r.json();
  return (d.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
}

function describirMano(m: Mano, s: Sesion): string {
  const L: string[] = [
    `Mano ${m.n} · ${s.stakeId} · mesa de ${s.nJugadores}`,
    `Mi posición: ${m.pos}`,
  ];
  const cartas = m.cartas.filter(Boolean);
  if (cartas.length) L.push(`Mis cartas: ${cartas.join(" ")}`);
  if (m.straddle) L.push(`Hubo straddle en ${m.straddle.pos} de $${m.straddle.monto}`);
  if (m.board.length) L.push(`Board: ${m.board.filter((c) => c !== "??").join(" ") || "no se registró"}`);
  if (m.rivalTipo) L.push(`Tipo de rival principal: ${m.rivalTipo}`);
  if (m.log.length) L.push(`Secuencia de acción:\n${m.log.map((l) => "  " + l).join("\n")}`);
  if (m.showdown?.length) {
    const filas = m.showdown.map((r) =>
      r.muck ? `  ${r.pos}: hizo muck` : `  ${r.pos}: ${r.cartas.filter(Boolean).join(" ") || "no se vieron sus cartas"}`
    );
    L.push(`Showdown:\n${filas.join("\n")}`);
  }
  if (m.ganador) L.push(`Ganó: ${m.ganador}`);
  L.push(`Resultado: ${m.res}, neto ${m.neto >= 0 ? "+" : ""}$${Math.round(m.neto)}`);
  if (m.nota) L.push(`Lo que dudé: "${m.nota}"`);

  const c = clasificar({
    pos: m.pos, cartas: m.cartas, board: m.board, log: m.log, neto: m.neto,
    plo: s.juego === "PLO", showdown: m.showdown, ganador: m.ganador,
  });
  if (c.hechos.length) L.push(`\nHechos verificados por la app (no los contradigas):\n${c.hechos.map((h) => "  - " + h).join("\n")}`);
  if (c.etiquetas.length) L.push(`Clasificación automática: ${c.etiquetas.join(", ")}`);
  return L.join("\n");
}

const SYS_ANALISIS = `Eres un coach de poker en vivo de stakes bajos y medios en salas de Estados Unidos. Hablas español mexicano casual y directo, sin jerga innecesaria.

Te van a pasar una mano registrada. Tu trabajo:

1. Di primero si la mano se jugó bien o mal, sin rodeos. Si fue un cooler o varianza pura, dilo claro y no lo trates como error.
2. Señala la calle exacta donde estuvo la decisión importante. No repases toda la mano: ve al punto donde se ganó o se perdió el dinero.
3. Si hubo error, nombra el concepto: sizing, selección de rango, posición, tipo de rival, control del bote.
4. La app ya calculó hechos objetivos con las cartas y el board: si fue farol, si fue apuesta de valor, si dejaste valor sin cobrar, si fue cooler. Esos hechos son ciertos. Úsalos como base y explica el porqué; nunca los contradigas ni inventes otros.
5. Si faltan datos (no se registró el board, ni el tipo de rival, ni las cartas del rival), dilo en una línea y analiza con lo que hay. No inventes lo que no está.
6. Una mano suelta no dice nada del jugador. No saques conclusiones sobre su nivel ni sobre su winrate.

Formato: prosa corta, 2 o 3 párrafos de 2-3 líneas. **Negritas** solo para nombrar el concepto clave. Máximo 200 palabras. Nada de listas ni de relleno motivacional.`;

const SYS_NARRACION = `Escribes guiones de narración en off para videos de poker en vivo en YouTube, en español mexicano natural y hablado.

Te van a pasar una mano registrada. Escribe la narración en primera persona, como si el jugador estuviera contando la mano sobre su propia grabación.

Reglas:
- Presente narrativo: "estoy en el botón", "me llega", "el señor sube a quince".
- Sigue el orden real de la mano: preflop, flop, turn, river. Una frase o dos por calle.
- Menciona los montos y las posiciones, que son lo que da contexto al espectador.
- Deja tensión donde la hubo. Si la decisión fue difícil, dilo en voz alta: "aquí me quedo pensando".
- No expliques teoría de poker. Es narración, no clase.
- Si falta información (no se registró el board o las cartas), no la inventes: escribe la narración saltando esa parte.
- Sin saludos de intro, sin "qué onda muchachos", sin despedida. Solo la mano.

Largo: 120 a 180 palabras. Párrafos cortos, como se habla.`;

export async function analizarMano(m: Mano, s: Sesion) {
  return llamar(SYS_ANALISIS, describirMano(m, s), 700);
}

export async function narrarMano(m: Mano, s: Sesion) {
  return llamar(SYS_NARRACION, describirMano(m, s), 700);
}

const SYS_SESION = `Eres un coach de poker en vivo de stakes bajos y medios. Hablas español mexicano casual y directo.

Te van a pasar todas las manos que un jugador registró en una sesión. Tu trabajo:

1. Busca el patrón, no la mano suelta. Lo que importa es lo que se repite.
2. Sé concreto: en vez de "juega mejor tus posiciones", di "abriste tres manos desde UTG en una sesión".
3. Separa varianza de error, sin suavizar el error.
4. Prioriza. Máximo tres cosas, y la primera debe ser la que más dinero cuesta.
5. Respeta el tamaño de muestra: con pocas manos y pocas horas no concluyas nada sobre su winrate ni le sugieras cambiar de stake.
6. Si los registros están incompletos, dilo y pídele qué registrar la próxima vez.
7. Cada mano trae una clasificación automática calculada con las cartas reales (Farol, Apuesta de valor, Valor no cobrado, Pagué de más, Pasivo con mano fuerte, Cooler, Fold disciplinado). Cuenta cuántas veces aparece cada una y basa tu análisis en ese conteo, no en impresiones.

Formato: prosa corta, párrafos de 2-3 líneas. **Negritas** solo para nombrar cada fuga. Máximo 300 palabras.`;

export async function analizarSesion(s: Sesion, manos: Mano[]) {
  const cab = `Sesión en ${s.lugar || "sin lugar"}, ${s.stakeId}, ${horas(s).toFixed(1)} horas, invertido $${invertido(s)}, cash out $${s.cashOut}, neto ${neto(s) >= 0 ? "+" : ""}$${neto(s)}.`;
  const cuerpo = manos.length
    ? manos.map((m) => describirMano(m, s)).join("\n\n")
    : "No registró ninguna mano en esta sesión.";
  return llamar(SYS_SESION, cab + "\n\n" + cuerpo, 1200);
}
