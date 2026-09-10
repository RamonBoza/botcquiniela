import {
  currentUser,
  hashPassword,
  isSuperAdmin,
  randomToken,
} from '@/lib/server-auth';
import { db, ensureDatabase } from '@/lib/server-store';

type AdminAction =
  | 'createUser'
  | 'deleteUser'
  | 'createOrganization'
  | 'deleteOrganization'
  | 'addMember'
  | 'removeMember'
  | 'setMemberRole'
  | 'deleteGame';

async function audit(
  actorId: string,
  action: AdminAction,
  targetType: string,
  targetId: string | null,
  details: unknown = {},
) {
  await db()
    .prepare(
      'INSERT INTO admin_audit_log (id,actor_user_id,action,target_type,target_id,details_json,created_at) VALUES (?,?,?,?,?,?,?)',
    )
    .bind(
      crypto.randomUUID(),
      actorId,
      action,
      targetType,
      targetId,
      JSON.stringify(details),
      Date.now(),
    )
    .run();
}

export async function GET(request: Request) {
  await ensureDatabase();
  const actor = await currentUser(request);
  if (!actor)
    return Response.json({ error: 'Debes iniciar sesión.' }, { status: 401 });
  if (!isSuperAdmin(actor))
    return Response.json(
      { error: 'Acceso reservado al superadministrador.' },
      { status: 403 },
    );
  const [users, organizations, games, auditLog] = await Promise.all([
    db()
      .prepare(
        'SELECT u.id,u.username,u.display_name AS displayName,u.created_at AS createdAt,(SELECT COUNT(*) FROM organization_members m WHERE m.user_id=u.id) AS organizationCount FROM users u ORDER BY u.created_at DESC',
      )
      .all(),
    db()
      .prepare(
        'SELECT o.id,o.name,o.slug,o.created_at AS createdAt,(SELECT COUNT(*) FROM organization_members m WHERE m.organization_id=o.id) AS memberCount,(SELECT COUNT(*) FROM app_games g WHERE g.organization_id=o.id) AS gameCount FROM organizations o ORDER BY o.created_at DESC',
      )
      .all(),
    db()
      .prepare(
        'SELECT g.id,g.name,g.status,g.player_count AS playerCount,o.name AS organizationName,(SELECT COUNT(*) FROM app_predictions p WHERE p.game_id=g.id) AS predictionCount FROM app_games g JOIN organizations o ON o.id=g.organization_id ORDER BY g.created_at DESC',
      )
      .all(),
    db()
      .prepare(
        'SELECT a.id,a.action,a.target_type AS targetType,a.target_id AS targetId,a.details_json AS detailsJson,a.created_at AS createdAt,u.username AS actorUsername FROM admin_audit_log a JOIN users u ON u.id=a.actor_user_id ORDER BY a.created_at DESC LIMIT 30',
      )
      .all(),
  ]);
  const memberships = await db()
    .prepare(
      'SELECT m.id,m.organization_id AS organizationId,m.user_id AS userId,m.role,u.username,u.display_name AS displayName FROM organization_members m JOIN users u ON u.id=m.user_id ORDER BY u.display_name',
    )
    .all();
  return Response.json({
    users: users.results.map((user) => ({
      ...user,
      isSuperAdmin: isSuperAdmin(user as { username: string }),
    })),
    organizations: organizations.results,
    games: games.results,
    memberships: memberships.results,
    auditLog: auditLog.results,
  });
}

export async function POST(request: Request) {
  await ensureDatabase();
  const actor = await currentUser(request);
  if (!actor)
    return Response.json({ error: 'Debes iniciar sesión.' }, { status: 401 });
  if (!isSuperAdmin(actor))
    return Response.json(
      { error: 'Acceso reservado al superadministrador.' },
      { status: 403 },
    );
  const body = (await request.json()) as {
    action?: AdminAction;
    userId?: string;
    username?: string;
    displayName?: string;
    password?: string;
    organizationId?: string;
    gameId?: string;
    role?: 'ADMIN' | 'MEMBER';
    name?: string;
  };

  if (body.action === 'createUser') {
    const username = (body.username ?? '').trim().toLowerCase();
    const displayName = (body.displayName ?? '').trim();
    const password = body.password ?? '';
    if (username.length < 3 || displayName.length < 1 || password.length < 8)
      return Response.json(
        {
          error:
            'Indica usuario, nombre visible y una contraseña de al menos 8 caracteres.',
        },
        { status: 400 },
      );
    if (
      await db()
        .prepare('SELECT id FROM users WHERE username=?')
        .bind(username)
        .first()
    )
      return Response.json(
        { error: 'Ese usuario ya existe.' },
        { status: 409 },
      );
    const id = crypto.randomUUID();
    const secured = await hashPassword(password);
    await db()
      .prepare(
        'INSERT INTO users (id,username,display_name,password_hash,password_salt,created_at) VALUES (?,?,?,?,?,?)',
      )
      .bind(id, username, displayName, secured.hash, secured.salt, Date.now())
      .run();
    await audit(actor.id, body.action, 'user', id, { username });
    return Response.json({ ok: true });
  }

  if (body.action === 'deleteUser') {
    if (!body.userId || body.userId === actor.id)
      return Response.json(
        { error: 'No puedes eliminar tu propio usuario.' },
        { status: 409 },
      );
    const target = await db()
      .prepare('SELECT username FROM users WHERE id=?')
      .bind(body.userId)
      .first<{ username: string }>();
    if (!target)
      return Response.json({ error: 'El usuario no existe.' }, { status: 404 });
    if (isSuperAdmin(target))
      return Response.json(
        { error: 'No se puede eliminar un superadministrador desde el panel.' },
        { status: 409 },
      );
    if (
      await db()
        .prepare('SELECT id FROM organizations WHERE created_by=? LIMIT 1')
        .bind(body.userId)
        .first()
    )
      return Response.json(
        {
          error:
            'Este usuario creó organizaciones. Elimínalas o transfiérelas antes.',
        },
        { status: 409 },
      );
    await db().batch([
      db()
        .prepare('DELETE FROM app_predictions WHERE user_id=?')
        .bind(body.userId),
      db().prepare('DELETE FROM sessions WHERE user_id=?').bind(body.userId),
      db()
        .prepare('DELETE FROM organization_members WHERE user_id=?')
        .bind(body.userId),
    ]);
    await audit(actor.id, body.action, 'user', body.userId, {
      username: target.username,
    });
    await db().prepare('DELETE FROM users WHERE id=?').bind(body.userId).run();
    return Response.json({ ok: true });
  }

  if (body.action === 'createOrganization') {
    const name = (body.name ?? '').trim();
    if (name.length < 3)
      return Response.json(
        { error: 'El nombre debe tener al menos 3 caracteres.' },
        { status: 400 },
      );
    const id = crypto.randomUUID();
    const slug = `${name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')}-${randomToken(3)}`;
    await db().batch([
      db()
        .prepare(
          'INSERT INTO organizations (id,name,slug,created_by,created_at) VALUES (?,?,?,?,?)',
        )
        .bind(id, name, slug, actor.id, Date.now()),
      db()
        .prepare(
          "INSERT INTO organization_members (id,organization_id,user_id,role,joined_at) VALUES (?,?,?,'ADMIN',?)",
        )
        .bind(crypto.randomUUID(), id, actor.id, Date.now()),
    ]);
    await audit(actor.id, body.action, 'organization', id, { name });
    return Response.json({ ok: true });
  }

  if (body.action === 'deleteOrganization') {
    if (!body.organizationId)
      return Response.json(
        { error: 'Falta la organización.' },
        { status: 400 },
      );
    const target = await db()
      .prepare('SELECT name FROM organizations WHERE id=?')
      .bind(body.organizationId)
      .first<{ name: string }>();
    if (!target)
      return Response.json(
        { error: 'La organización no existe.' },
        { status: 404 },
      );
    await db().batch([
      db()
        .prepare(
          'DELETE FROM app_predictions WHERE game_id IN (SELECT id FROM app_games WHERE organization_id=?)',
        )
        .bind(body.organizationId),
      db()
        .prepare('DELETE FROM app_games WHERE organization_id=?')
        .bind(body.organizationId),
      db()
        .prepare('DELETE FROM organization_invites WHERE organization_id=?')
        .bind(body.organizationId),
      db()
        .prepare('DELETE FROM organization_members WHERE organization_id=?')
        .bind(body.organizationId),
    ]);
    await audit(actor.id, body.action, 'organization', body.organizationId, {
      name: target.name,
    });
    await db()
      .prepare('DELETE FROM organizations WHERE id=?')
      .bind(body.organizationId)
      .run();
    return Response.json({ ok: true });
  }

  if (body.action === 'addMember') {
    const username = (body.username ?? '').trim().toLowerCase();
    const user = await db()
      .prepare('SELECT id FROM users WHERE username=?')
      .bind(username)
      .first<{ id: string }>();
    if (!user)
      return Response.json(
        { error: 'No existe ningún usuario con ese nombre.' },
        { status: 404 },
      );
    if (!body.organizationId)
      return Response.json(
        { error: 'Falta la organización.' },
        { status: 400 },
      );
    await db()
      .prepare(
        "INSERT INTO organization_members (id,organization_id,user_id,role,joined_at) VALUES (?,?,?,'MEMBER',?) ON CONFLICT(organization_id,user_id) DO NOTHING",
      )
      .bind(crypto.randomUUID(), body.organizationId, user.id, Date.now())
      .run();
    await audit(actor.id, body.action, 'membership', user.id, {
      organizationId: body.organizationId,
      username,
    });
    return Response.json({ ok: true });
  }

  if (body.action === 'removeMember' || body.action === 'setMemberRole') {
    if (!body.organizationId || !body.userId)
      return Response.json(
        { error: 'Faltan datos de la membresía.' },
        { status: 400 },
      );
    const membership = await db()
      .prepare(
        'SELECT role FROM organization_members WHERE organization_id=? AND user_id=?',
      )
      .bind(body.organizationId, body.userId)
      .first<{ role: string }>();
    if (!membership)
      return Response.json(
        { error: 'La membresía no existe.' },
        { status: 404 },
      );
    if (
      membership.role === 'ADMIN' &&
      (body.action === 'removeMember' || body.role === 'MEMBER')
    ) {
      const admins = await db()
        .prepare(
          "SELECT COUNT(*) AS count FROM organization_members WHERE organization_id=? AND role='ADMIN'",
        )
        .bind(body.organizationId)
        .first<{ count: number | string }>();
      if (Number(admins?.count ?? 0) <= 1)
        return Response.json(
          {
            error: 'La organización debe conservar al menos un administrador.',
          },
          { status: 409 },
        );
    }
    if (body.action === 'removeMember')
      await db()
        .prepare(
          'DELETE FROM organization_members WHERE organization_id=? AND user_id=?',
        )
        .bind(body.organizationId, body.userId)
        .run();
    else {
      if (body.role !== 'ADMIN' && body.role !== 'MEMBER')
        return Response.json({ error: 'Rol no válido.' }, { status: 400 });
      await db()
        .prepare(
          'UPDATE organization_members SET role=? WHERE organization_id=? AND user_id=?',
        )
        .bind(body.role, body.organizationId, body.userId)
        .run();
    }
    await audit(actor.id, body.action, 'membership', body.userId, {
      organizationId: body.organizationId,
      role: body.role,
    });
    return Response.json({ ok: true });
  }

  if (body.action === 'deleteGame') {
    if (!body.gameId)
      return Response.json({ error: 'Falta la quiniela.' }, { status: 400 });
    const target = await db()
      .prepare('SELECT name FROM app_games WHERE id=?')
      .bind(body.gameId)
      .first<{ name: string }>();
    if (!target)
      return Response.json(
        { error: 'La quiniela no existe.' },
        { status: 404 },
      );
    await db()
      .prepare('DELETE FROM app_predictions WHERE game_id=?')
      .bind(body.gameId)
      .run();
    await audit(actor.id, body.action, 'game', body.gameId, {
      name: target.name,
    });
    await db()
      .prepare('DELETE FROM app_games WHERE id=?')
      .bind(body.gameId)
      .run();
    return Response.json({ ok: true });
  }

  return Response.json(
    { error: 'Acción de administración no válida.' },
    { status: 400 },
  );
}
