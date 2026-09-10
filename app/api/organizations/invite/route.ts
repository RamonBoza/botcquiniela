import { randomToken, requireUser } from '@/lib/server-auth';
import { db } from '@/lib/server-store';

async function authorizeAdministrator(
  organizationId: string | undefined | null,
  userId: string,
) {
  if (!organizationId) return false;
  const organization = await db()
    .prepare(
      'SELECT o.created_by AS createdBy,m.role FROM organizations o LEFT JOIN organization_members m ON m.organization_id=o.id AND m.user_id=? WHERE o.id=?',
    )
    .bind(userId, organizationId)
    .first<{ createdBy: string; role: string | null }>();
  if (
    !organization ||
    (organization.createdBy !== userId && organization.role !== 'ADMIN')
  )
    return false;
  if (organization.createdBy === userId && organization.role !== 'ADMIN')
    await db()
      .prepare(
        "INSERT INTO organization_members (id,organization_id,user_id,role,joined_at) VALUES (?,?,?,'ADMIN',?) ON CONFLICT(organization_id,user_id) DO UPDATE SET role='ADMIN'",
      )
      .bind(crypto.randomUUID(), organizationId, userId, Date.now())
      .run();
  return true;
}

export async function GET(request: Request) {
  const user = await requireUser(request);
  const organizationId = new URL(request.url).searchParams.get(
    'organizationId',
  );
  if (!(await authorizeAdministrator(organizationId, user.id)))
    return Response.json(
      { error: 'Solo un administrador puede consultar invitaciones.' },
      { status: 403 },
    );
  const invite = await db()
    .prepare(
      'SELECT code FROM organization_invites WHERE organization_id=? AND (expires_at IS NULL OR expires_at>?) AND (max_uses IS NULL OR used_count<max_uses) ORDER BY created_at DESC LIMIT 1',
    )
    .bind(organizationId, Date.now())
    .first<{ code: string }>();
  return Response.json({ code: invite?.code ?? null });
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  const body = (await request.json()) as { organizationId?: string };
  if (!(await authorizeAdministrator(body.organizationId, user.id)))
    return Response.json(
      { error: 'Solo un administrador puede crear invitaciones.' },
      { status: 403 },
    );
  const code = randomToken(4).toUpperCase();
  await db()
    .prepare(
      'INSERT INTO organization_invites (id,organization_id,code,created_by,used_count,created_at) VALUES (?,?,?,?,0,?)',
    )
    .bind(crypto.randomUUID(), body.organizationId, code, user.id, Date.now())
    .run();
  return Response.json({ code });
}
