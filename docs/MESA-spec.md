# MESA — Spec del producto

Estado: **en pausa, sin construir**. Este documento es la fuente de verdad para cuando se retome desde la computadora.

---

## 1. Qué es

App personal de poker en vivo, instalada en el celular como PWA. Un solo usuario (Luis). Sin cuentas, sin backend, datos en el dispositivo con respaldo exportable.

**El propósito principal no es el tracking. Es la memoria de mesa.** Luis graba sus sesiones con una cámara aparte para YouTube. En la mesa no puede recordar quién apostó, cuánto, desde qué posición, en qué calle. La app existe para registrar eso en el momento, en segundos, y que después en la edición pueda reconstruir la mano y narrarla bien.

Todo lo demás (stats, bankroll, profesor) se apoya sobre esos registros.

---

## 2. Los tres trabajos de la app

### 2.1 Memoria de mesa (prioridad 1)
Registrar una mano completa en mesa, rápido y sin teclear: posición propia, quién entró, quién apostó y cuánto, por calle, board, resultado, showdown si lo hubo. Después, en la computadora, esa mano se puede abrir y verse completa.

### 2.2 Tracking y reporte (prioridad 2)
Sesiones con hora de inicio/fin, lugar, ciegas, buy-ins, recompras, cash out. De ahí salen: horas jugadas, $/hora, ROI, ganancia neta, bankroll actual, todo segmentado por stake y por tipo de mesa.

### 2.3 Profesor (prioridad 3)
Al cerrar una sesión, un análisis IA de las manos registradas: qué fuga se repite, qué fue varianza y qué fue error, qué trabajar. Con memoria entre sesiones para ver si una fuga mejora o sigue.

---

## 3. Multi-stake

La app se organiza por nivel: 1/2, 1/3, 2/5, 5/5, 5/10 (y custom). Cada nivel tiene:

- Sus propias stats (horas, $/hr, ROI, bb/hr) — nunca mezcladas
- Buy-in típico y buy-ins de bankroll que requiere
- Un indicador de "listo para subir": X buy-ins de bankroll + Y horas ganadoras en el nivel actual. Y de "hay que bajar": bankroll cae debajo de Z buy-ins.

El journey se ve como una línea de tiempo: cuándo empezó en 1/3, cuándo probó 2/5, cómo le fue en cada uno.

---

## 4. Módulos

### 4.0 Navegación
Cuatro pestañas fijas abajo:
- **Inicio** — resumen: bankroll, sesión activa si hay, última sesión, indicador de stake
- **Mano** — el HUD en vivo y el registro de manos (rápida / completa)
- **Tracking** — sesiones: iniciar, cerrar, historial, detalle de cada una
- **Stats** — análisis, curva de bankroll, por stake / posición / rival / fuga, profesor

### 4.0.1 HUD en vivo (durante la sesión)
Es la pantalla que Luis tiene abierta mientras juega. Tiene que verse bien y leerse en un segundo, con el teléfono en la mesa y poca luz.

- Dibujo de la mesa con el botón, SB y BB, y su asiento marcado. **El botón avanza un lugar cada mano** con un solo tap ("siguiente mano"), así su posición se actualiza sola y siempre sabe dónde está sin contar.
- Nombre de su posición actual en grande (BTN, CO, UTG…) con una línea de qué significa ("juegas al último", "abre cerrado").
- Reloj de sesión, manos jugadas, invertido hasta ahora.
- Botón grande de "Registrar esta mano" que abre el modo rápido ya con su posición puesta.
- Rivales recurrentes marcados en sus asientos si ya tienen perfil.
- Discreto: sin colores chillones ni animaciones que llamen la atención de la mesa.

El HUD es la razón de que la app exista en el celular y no en la computadora. Todo lo demás se puede revisar después; esto se usa en el momento.

### 4.1 Sesión
- Iniciar: lugar, ciegas, buy-in inicial, tipo de juego (casino / casa / privado), número de jugadores
- Durante: reloj vivo, recompras, contador de manos, botón de registrar mano
- Cerrar: cash out, propinas/rake estimado (opcional), notas de sesión, estado mental (bien / cansado / tilt), calidad de la mesa (suave / normal / dura)
- Resultado: neto, duración, $/hr de esa sesión

### 4.2 Registro de mano
Dos modos, ambos dentro de la sesión, numerados (Mano 1, Mano 2…):

**Rápida (en mesa, 20 segundos):** posición tocando el dibujo de la mesa, dos cartas, tipo de rival, resultado, monto, nota de una línea.

**Completa (simulador):** mesa visual con botón/SB/BB, se escoge asiento, y se va tocando la acción jugador por jugador: fold / check / call / raise con montos rápidos contextuales (3bb+limpers preflop, % del bote postflop, múltiplos del raise) o monto libre. Reparte flop, turn, river (al azar para practicar, o eligiendo cartas para reproducir una mano real). Showdown con selección de ganador. Deshacer. Historial de acción en texto.

**Ambos modos guardan:** timestamp exacto (para sincronizar con la grabación), posición, cartas, rivales, acción por calle, board, resultado, neto, nota, y etiquetas de fuga.

### 4.3 Sincronización con video
- Cada mano guarda la hora exacta en que se registró
- Al iniciar la sesión, un botón "sincronizar cámara" marca el instante en que empezó la grabación
- Resultado: cada mano muestra "minuto X:XX de la grabación", para encontrarla en edición sin buscar
- Exportar lista de manos con timestamps como texto para pegar en el editor de video

### 4.4 Narración para video
- Cada mano puede generar un guion de narración en primera persona (IA): "Estoy en el botón con A♠K♦, hay tres limpers…"
- Tono ajustable: explicativo (educativo) o de vlog (casual)
- Se puede editar y copiar

### 4.5 Rivales recurrentes y cómo jugarles
- Perfil de jugador por casino: apodo ("el señor de la gorra"), tipo (paga todo / foldea mucho / sólido / loco), notas
- Al registrar una mano se puede etiquetar contra quién fue
- Historial: cuánto se ha ganado o perdido contra ese jugador específico

**Playbook por tipo (en el HUD, durante la sesión):** al marcar el tipo de un rival, la app muestra en dos líneas cómo jugarle. Ejemplo para "paga todo": *"Apuesta valor delgado en las tres calles, más grande de lo normal. Nunca farolees."* Para "foldea mucho": *"Aquí sí vive el farol. C-bet casi siempre, roba las ciegas."* Es un recordatorio en mesa, no un tratado.

**Playbook por rival específico (persistente):** en el perfil de cada rival recurrente, una sección "la próxima vez" que Luis escribe después de la sesión o que el profesor sugiere a partir de las manos registradas contra él. Ejemplo: *"Cuando sube grande en turn tiene la mano. Tres veces ya. No lo pagues con top pair."* Se muestra automáticamente en el HUD cuando ese rival está marcado en la mesa.

**El profesor lo alimenta:** al analizar una sesión, si detecta un patrón contra un rival etiquetado, propone una entrada al playbook de ese rival y Luis la acepta o la edita.

### 4.6 Etiquetas de fuga
Taxonomía fija para que las stats y el profesor puedan agregar:
- Farol contra station
- Pagué de más
- Sizing chico con mano fuerte
- Abrí muy ancho fuera de posición
- No cobré valor delgado
- Tilt
- Cooler (no es fuga, es varianza)
- Buena jugada (para reforzar)

### 4.7 Análisis
- Totales: neto, horas, $/hr, bb/hr, sesiones, ROI sobre buy-ins
- Por stake (siempre separado)
- Por lugar / tipo de juego / día de la semana / hora del día
- Por posición y por tipo de rival
- Por etiqueta de fuga: cuánto cuesta cada una
- Curva de bankroll con línea de "requerido para el stake actual"
- Contexto de varianza: con N horas, el rango realista de resultados es ±X. Que la app le diga cuándo la muestra todavía no significa nada.
- Sesiones ganadoras vs perdedoras, tamaño promedio de cada tipo

### 4.8 Profesor
- Al cerrar sesión: análisis de las manos con el prompt de coach de vivo (prosa corta, máximo tres fugas, separar varianza de error, respetar tamaño de muestra)
- Lee las etiquetas de fuga y los análisis anteriores: "hace tres sesiones te dije X, en esta sesión volvió a pasar dos veces"
- Modo pregunta: chatear sobre una mano específica
- Estilo de estudio: sugiere qué leer o ver según la fuga dominante (Ed Miller para vivo stakes bajos, Bart Hanson, Acevedo cuando haya volumen)

### 4.9 Estudio
- Log de horas estudiadas y qué (libro, video, revisión de manos)
- Separado de horas jugadas
- El profesor lo ve para saber qué ya se trabajó

### 4.10 Ajustes y datos
- Llave de API propia (Anthropic), guardada solo en el dispositivo
- Modelo seleccionable
- Bankroll inicial
- Respaldo: exportar / importar JSON. Idealmente respaldo automático a iCloud Drive o Google Drive.
- Borrar todo

---

## 5. Modelo de datos (esbozo)

```
Settings { apiKey, model, bankrollInicial, stakes[] }
Stake { id, nombre, sb, bb, buyInTipico, buyInsRequeridos }
Lugar { id, nombre, tipo: casino|casa|privado }
Rival { id, lugarId, apodo, tipo, notas }
Sesion { id, inicio, fin, lugarId, stakeId, nJugadores, compras[], cashOut,
         propinas, notas, estadoMental, calidadMesa, syncCamara, coach{} }
Mano { id, sesionId, n, ts, modo, pos, cartas[], rivales[], calles{}, board[],
       log[], res, neto, nota, etiquetas[], narracion }
Estudio { id, fecha, horas, tema, notas }
```

---

## 6. Decisiones ya tomadas

- **Tres criterios que mandan sobre cualquier feature:** robusta (no pierde datos, no se traba en mesa), fácil de usar (todo a taps, nada que requiera pensar en el momento), bonita (se tiene que sentir como app de verdad, no como formulario). Si una función rompe uno de los tres, no entra.
- **Dos preguntas que la app debe contestar a largo plazo:** ¿estoy jugando bien o mal al poker? (con datos, no con sensaciones) y ¿qué pasó en esa mano? (para documentar en YouTube con información real).
- **PWA, no app nativa.** Se instala desde el navegador, funciona offline, no pasa por App Store.
- **Sin backend.** Datos en localStorage/IndexedDB. La llave de API se usa directo desde el navegador (header `anthropic-dangerous-direct-browser-access`). Aceptable porque es uso personal en dispositivo propio.
- **Sin dependencias pesadas.** Un solo archivo o build mínimo. Nada de frameworks que necesiten servidor.
- **Diseño:** oscuro cálido (para casino con poca luz y discreción en mesa), bone/brass/sage/red, serif para números grandes, todo con taps grandes. Ya existe un lenguaje visual en el prototipo.
- **Motor de apuestas** ya está escrito y probado (orden de acción, opción del BB, cierre de rondas, all-in, fin por fold). Reutilizar.

---

## 7. Fuera de alcance (por ahora)

- Botes laterales con múltiples all-in de distinto tamaño
- Evaluación automática de manos en showdown (el usuario marca ganador)
- Multiusuario, compartir, nube propia
- Integración directa con el editor de video

---

## 8. Estado actual

Existe un prototipo funcional (`index.html` + `manifest.json` + `sw.js` + íconos) con: sesiones, mano rápida, simulador completo, análisis básico, profesor por sesión, respaldo JSON. Sirve como punto de partida, no como versión final.

Lo que **no** tiene el prototipo y sí tiene este spec: multi-stake real, sincronización con video, narración, rivales recurrentes, etiquetas de fuga, estudio, memoria del profesor entre sesiones, análisis por lugar/día/hora, indicador de subir/bajar de stake, contexto de varianza.

---

## 9. Cómo retomar

1. Crear un Proyecto en Claude con este archivo y el `index.html` del prototipo como conocimiento.
2. Desde la computadora, usar Claude Code para armarlo como repo real: estructura de carpetas, componentes separados, tests del motor de apuestas.
3. Empezar por 2.1 (memoria de mesa) y 4.3 (sync con video), porque son lo que hace que la app valga la pena para los videos. Lo demás se construye encima.
