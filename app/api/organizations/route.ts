import { randomToken, requireUser } from '@/lib/server-auth';
import { db, ensureDatabase } from '@/lib/server-store';

export async function GET(request: Request) {
  const user = await requireUser(request);
  const organizations = await db()
    .prepare(
      'SELECT o.id,o.name,o.slug,m.role,(SELECT COUNT(*) FROM organization_members x WHERE x.organization_id=o.id) AS memberCount FROM organization_members m JOIN organizations o ON o.id=m.organization_id WHERE m.user_id=? ORDER BY o.created_at DESC',
    )
    .bind(user.id)
    .all();
  return Response.json({ organizations: organizations.results });
}
export async function POST(request: Request) {
  await ensureDatabase();
  const user = await requireUser(request);
  const body = (await request.json()) as { name?: string };
  const name = (body.name ?? '').trim();
  if (name.length < 3)
    return Response.json(
      { error: 'El nombre debe tener al menos 3 caracteres.' },
      { status: 400 },
    );
  const id = crypto.randomUUID();
  const seasonId = crypto.randomUUID();
  const now = Date.now();
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
      .bind(id, name, slug, user.id, now),
    db()
      .prepare(
        "INSERT INTO organization_members (id,organization_id,user_id,role,joined_at) VALUES (?,?,?,'ADMIN',?)",
      )
      .bind(crypto.randomUUID(), id, user.id, now),
    db()
      .prepare(
        "INSERT INTO organization_seasons (id,organization_id,name,status,starts_at,created_by,created_at) VALUES (?,?,?,'ACTIVE',?,?,?)",
      )
      .bind(seasonId, id, 'Temporada 1', now, user.id, now),
  ]);
  return Response.json(
    { organization: { id, name, slug, role: 'ADMIN', memberCount: 1 } },
    { status: 201 },
  );
}
