# Quiniela Clocktower

MVP móvil para hacer predicciones secretas antes de una partida de Blood on the Clocktower.

## Desarrollo

```bash
npm install
npm run dev
```

La app importa el JSON estándar de BOTC mediante `BotcJsonScriptImporter`. La identidad local del jugador se guarda en el navegador; el esquema D1 conserva partidas, participantes y predicciones. La frontera de serialización pública solo incluye elecciones y setup cuando la partida está en estado `FINISHED`.

## Comprobaciones

```bash
npm run build
npm run lint
```
