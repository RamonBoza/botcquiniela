import {
  createSession,
  currentUser,
  hashPassword,
  isSuperAdmin,
  sessionCookie,
  verifyPassword,
} from '@/lib/server-auth';
import { db, ensureDatabase } from '@/lib/server-store';

export async function GET(request: Request) {
  const user = await currentUser(request);
  return Response.json({
    user: user ? { ...user, isSuperAdmin: isSuperAdmin(user) } : null,
  });
}
export async function POST(request: Request) {
  await ensureDatabase();
  const body = (await request.json()) as {
    action: string;
    username?: string;
    displayName?: string;
    password?: string;
  };
  if (body.action === 'logout')
    return Response.json(
      { ok: true },
      { headers: { 'set-cookie': sessionCookie('', 0) } },
    );
  const username = (body.username ?? '').trim().toLowerCase();
  const password = body.password ?? '';
  if (username.length < 3 || password.length < 8)
    return Response.json(
      { error: 'El usuario debe tener 3 caracteres y la contraseña 8.' },
      { status: 400 },
    );
  let user: { id: string; username: string; displayName: string } | null = null;
  if (body.action === 'register') {
    if (!(body.displayName ?? '').trim())
      return Response.json(
        { error: 'Escribe tu nombre visible.' },
        { status: 400 },
      );
    const existing = await db()
      .prepare('SELECT id FROM users WHERE username=?')
      .bind(username)
      .first();
    if (existing)
      return Response.json(
        { error: 'Ese nombre de usuario ya está ocupado.' },
        { status: 409 },
      );
    const id = crypto.randomUUID();
    const secured = await hashPassword(password);
    await db()
      .prepare(
        'INSERT INTO users (id,username,display_name,password_hash,password_salt,created_at) VALUES (?,?,?,?,?,?)',
      )
      .bind(
        id,
        username,
        body.displayName!.trim(),
        secured.hash,
        secured.salt,
        Date.now(),
      )
      .run();
    user = { id, username, displayName: body.displayName!.trim() };
  } else {
    const row = await db()
      .prepare(
        'SELECT id,username,display_name AS displayName,password_hash AS passwordHash,password_salt AS passwordSalt FROM users WHERE username=?',
      )
      .bind(username)
      .first<{
        id: string;
        username: string;
        displayName: string;
        passwordHash: string;
        passwordSalt: string;
      }>();
    if (
      !row ||
      !(await verifyPassword(password, row.passwordSalt, row.passwordHash))
    )
      return Response.json(
        { error: 'Usuario o contraseña incorrectos.' },
        { status: 401 },
      );
    user = { id: row.id, username: row.username, displayName: row.displayName };
  }
  const token = await createSession(user.id);
  return Response.json(
    { user: { ...user, isSuperAdmin: isSuperAdmin(user) } },
    { headers: { 'set-cookie': sessionCookie(token) } },
  );
}
