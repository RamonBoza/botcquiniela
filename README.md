# Quiniela Clocktower

MVP móvil para hacer predicciones secretas antes de una partida de Blood on the Clocktower.

## Desarrollo local

La aplicación usa Next.js y Postgres. Crea `.env.local` a partir de
`.env.example` y configura `DATABASE_URL` con una base de datos Postgres vacía.
Las tablas se crean automáticamente en la primera petición.

```bash
npm install
npm run dev
```

La app importa el JSON estándar de BOTC mediante `BotcJsonScriptImporter`.
Postgres conserva usuarios, organizaciones, invitaciones, partidas y apuestas.
Las elecciones y el setup permanecen ocultos hasta que la partida finaliza.

## Despliegue en Vercel

1. Importa este repositorio desde GitHub en Vercel.
2. En **Storage**, añade una base de datos Postgres (por ejemplo Neon).
3. Comprueba que la integración haya creado `DATABASE_URL` para Production,
   Preview y Development.
4. Pulsa **Deploy**. Vercel detectará Next.js y ejecutará `npm run build`.

No hace falta ejecutar migraciones manuales para el MVP: el servidor crea de
forma idempotente las tablas e índices necesarios.

## Comprobaciones

```bash
npm run build
npm run lint
```
