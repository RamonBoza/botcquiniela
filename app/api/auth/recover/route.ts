import {
  createSession,
  hashPassword,
  isSuperAdmin,
  sessionCookie,
} from '@/lib/server-auth';
import { db, ensureDatabase } from '@/lib/server-store';

const encoder = new TextEncoder();

async function digest(value: string) {
  const bytes = new Uint8Array(
    await crypto.subtle.digest('SHA-256', encoder.encode(value)),
  );
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}

async function tokensMatch(received: string, expected: string) {
  const [receivedHash, expectedHash] = await Promise.all([
    digest(received),
    digest(expected),
  ]);
  let difference = 0;
  for (let index = 0; index < expectedHash.length; index += 1)
    difference |= receivedHash.charCodeAt(index) ^ expectedHash.charCodeAt(index);
  return difference === 0;
}

export async function POST(request: Request) {
  await ensureDatabase();
  const body = (await request.json()) as {
    username?: string;
    recoveryToken?: string;
    newPassword?: string;
  };
  const configuredUsername = (
    process.env.PASSWORD_RECOVERY_USERNAME ?? ''
  ).trim().toLowerCase();
  const configuredToken = process.env.PASSWORD_RECOVERY_TOKEN ?? '';
  const username = (body.username ?? '').trim().toLowerCase();
  const recoveryToken = body.recoveryToken ?? '';
  const newPassword = body.newPassword ?? '';

  if (!configuredUsername || configuredToken.length < 32)
    return Response.json(
      { error: 'La recuperación temporal no está activada.' },
      { status: 503 },
    );
  if (newPassword.length < 8)
    return Response.json(
      { error: 'La contraseña debe tener al menos 8 caracteres.' },
      { status: 400 },
    );
  if (
    username !== configuredUsername ||
    !(await tokensMatch(recoveryToken, configuredToken))
  )
    return Response.json(
      { error: 'El usuario o el código de recuperación no son correctos.' },
      { status: 403 },
    );

  const user = await db()
    .prepare('SELECT id,username,display_name AS displayName FROM users WHERE username=?')
    .bind(username)
    .first<{ id: string; username: string; displayName: string }>();
  if (!user)
    return Response.json(
      { error: 'El usuario o el código de recuperación no son correctos.' },
      { status: 403 },
    );

  const tokenHash = await digest(configuredToken);
  try {
    await db()
      .prepare(
        'INSERT INTO password_recovery_uses (token_hash,user_id,used_at) VALUES (?,?,?)',
      )
      .bind(tokenHash, user.id, Date.now())
      .run();
  } catch {
    return Response.json(
      { error: 'Este código de recuperación ya se ha utilizado.' },
      { status: 409 },
    );
  }

  const secured = await hashPassword(newPassword);
  await db()
    .prepare('UPDATE users SET password_hash=?,password_salt=? WHERE id=?')
    .bind(secured.hash, secured.salt, user.id)
    .run();
  await db().prepare('DELETE FROM sessions WHERE user_id=?').bind(user.id).run();
  const sessionToken = await createSession(user.id);
  return Response.json(
    {
      user: { ...user, isSuperAdmin: isSuperAdmin(user) },
      sessionToken: process.env.NODE_ENV !== 'production' ? sessionToken : undefined,
    },
    { headers: { 'set-cookie': sessionCookie(sessionToken) } },
  );
}
