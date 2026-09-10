# Quiniela Clocktower

MVP móvil para hacer predicciones secretas antes de una partida de Blood on the Clocktower.

## Desarrollo local

La aplicación usa Next.js y Postgres. En desarrollo, si no existe
`DATABASE_URL`, se inicia automáticamente una base local aislada en `.pglite`.
Las tablas se crean en la primera petición y los datos nunca se mezclan con
Vercel.
Configura también `SUPERADMIN_USERNAMES` con uno o varios usuarios separados
por comas. Por ejemplo: `SUPERADMIN_USERNAMES=boza,ramon`. Estos permisos se
comprueban siempre en el servidor; no basta con modificar la interfaz.

```bash
npm install
npm run dev
```

Crea `.env.local` con `SUPERADMIN_USERNAMES=tu_usuario` para habilitar el panel
global en tu sesión local. `DATABASE_URL` solo es necesaria si prefieres usar
una base Postgres externa también durante el desarrollo.

La app importa el JSON estándar de BOTC mediante `BotcJsonScriptImporter`.
Postgres conserva usuarios, organizaciones, invitaciones, partidas y apuestas.
Las elecciones y el setup permanecen ocultos hasta que la partida finaliza.

## Despliegue en Vercel

1. Importa este repositorio desde GitHub en Vercel.
2. En **Storage**, añade una base de datos Postgres (por ejemplo Neon).
3. Comprueba que la integración haya creado `DATABASE_URL` para Production,
   Preview y Development.
4. Añade `SUPERADMIN_USERNAMES` en cada entorno donde quieras habilitar el
   panel global.
5. Pulsa **Deploy**. Vercel detectará Next.js y ejecutará `npm run build`.

No hace falta ejecutar migraciones manuales para el MVP: el servidor crea de
forma idempotente las tablas e índices necesarios.

## Comprobaciones

```bash
npm run build
npm run lint
```
