# MESA

PWA personal de poker en vivo. Spec completo en `docs/MESA-spec.md`.

## Correr

```
npm install
npm run dev        # abre en http://localhost:5173 — en el celular usa la IP de tu compu
npm test           # motor de apuestas
npm run build      # genera dist/ con service worker
```

## Deploy en Vercel

1. Sube el repo a GitHub.
2. En Vercel: New Project → importa el repo. Detecta Vite solo. Deploy.
3. Abre la URL en el celular → Compartir → "Añadir a pantalla de inicio".

Cada push a `main` redespliega.

## Estructura

```
src/engine/    motor de apuestas (puro, con tests)
src/db/        esquema Dexie / IndexedDB
src/ui/        Mesa visual, Carta, Chip, helpers
src/features/  inicio · mano (HUD) · tracking · stats
docs/          spec y prototipo de referencia
```

## El profesor

Usa tu propia llave de la API de Anthropic. Ajustes (arriba a la derecha) → pega la llave →
Guardar. Se guarda en IndexedDB de este dispositivo y nunca sale a otro servidor.

Consigue la llave en console.anthropic.com. Con $5 de saldo te alcanza para meses.

## Estado

Hecho: motor de apuestas + 20 tests, esquema de datos, cuatro pestañas, sesiones
(iniciar / recompra / cerrar), HUD con botón que avanza cada mano, registro de mano en vivo
con straddle, detalle de sesión con historial de manos, análisis y narración por mano,
análisis de sesión completa, ajustes con respaldo.

Falta: sesión pasada (log de sesión ya terminada con duración por presets), rivales
recurrentes con playbook, sync con cámara, breakdowns por lugar / día / hora, calendario
mensual de P&L.
