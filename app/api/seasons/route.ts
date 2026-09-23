import { requireUser } from '@/lib/server-auth';
import { db, ensureDatabase } from '@/lib/server-store';
import { calculateScore } from '@/lib/scoring';
import type { ImportedCharacter } from '@/lib/botc-script-importer';

type PredictionRow = {
  userId: string;
  displayName: string;
  characterIdsJson: string;
  actualJson: string;
  charactersJson: string;
  playerCount: number;
};

export async function GET(request: Request) {
  await ensureDatabase();
  const user = await requireUser(request);
  const organizationId = new URL(request.url).searchParams.get(
    'organizationId',
  );
  const membership = await db()
    .prepare(
      'SELECT role FROM organization_members WHERE organization_id=? AND user_id=?',
    )
    .bind(organizationId, user.id)
    .first<{ role: 'ADMIN' | 'MEMBER' }>();
  if (!membership)
    return Response.json(
      { error: 'No perteneces a esta organización.' },
      { status: 403 },
    );

  const seasons = await db()
    .prepare(
      "SELECT s.id,s.name,s.status,s.prize_text AS prizeText,s.penalty_text AS penaltyText,s.starts_at AS startsAt,s.ends_at AS endsAt,(SELECT COUNT(*) FROM app_games g WHERE g.season_id=s.id) AS gameCount FROM organization_seasons s WHERE s.organization_id=? ORDER BY CASE WHEN s.status='ACTIVE' THEN 0 ELSE 1 END,s.created_at DESC",
    )
    .bind(organizationId)
    .all();
  const seasonId =
    new URL(request.url).searchParams.get('seasonId') ??
    (seasons.results[0] as { id?: string } | undefined)?.id;
  const predictions = seasonId
    ? await db()
        .prepare(
          "SELECT u.id AS userId,u.display_name AS displayName,p.character_ids_json AS characterIdsJson,g.actual_character_ids_json AS actualJson,g.characters_json AS charactersJson,g.player_count AS playerCount FROM app_predictions p JOIN app_games g ON g.id=p.game_id JOIN users u ON u.id=p.user_id WHERE g.season_id=? AND g.status='FINISHED' AND g.actual_character_ids_json IS NOT NULL",
        )
        .bind(seasonId)
        .all<PredictionRow>()
    : { results: [] as PredictionRow[] };
  const totals = new Map<
    string,
    { userId: string; displayName: string; points: number; gamesPlayed: number }
  >();
  for (const row of predictions.results) {
    const predicted = JSON.parse(row.characterIdsJson) as string[];
    const actual = JSON.parse(row.actualJson) as string[];
    const current = totals.get(row.userId) ?? {
      userId: row.userId,
      displayName: row.displayName,
      points: 0,
      gamesPlayed: 0,
    };
    current.points += calculateScore(
      predicted,
      actual,
      JSON.parse(row.charactersJson) as ImportedCharacter[],
      Number(row.playerCount),
    ).total;
    current.gamesPlayed += 1;
    totals.set(row.userId, current);
  }
  const standings = [...totals.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.gamesPlayed - a.gamesPlayed ||
      a.displayName.localeCompare(b.displayName),
  );
  return Response.json({
    seasons: seasons.results,
    selectedSeasonId: seasonId ?? null,
    standings,
  });
}

export async function POST(request: Request) {
  await ensureDatabase();
  const user = await requireUser(request);
  const body = (await request.json()) as {
    organizationId?: string;
    name?: string;
    action?: 'create' | 'updateRewards';
    seasonId?: string;
    prizeText?: string;
    penaltyText?: string;
  };
  const membership = await db()
    .prepare(
      "SELECT id FROM organization_members WHERE organization_id=? AND user_id=? AND role='ADMIN'",
    )
    .bind(body.organizationId, user.id)
    .first();
  if (!membership)
    return Response.json(
      { error: 'Solo un administrador puede crear temporadas.' },
      { status: 403 },
    );
  if (body.action === 'updateRewards') {
    const season = await db()
      .prepare(
        'SELECT id FROM organization_seasons WHERE id=? AND organization_id=?',
      )
      .bind(body.seasonId, body.organizationId)
      .first();
    if (!season)
      return Response.json({ error: 'La temporada no existe.' }, { status: 404 });
    await db()
      .prepare(
        'UPDATE organization_seasons SET prize_text=?,penalty_text=? WHERE id=?',
      )
      .bind(
        (body.prizeText ?? '').trim().slice(0, 200),
        (body.penaltyText ?? '').trim().slice(0, 200),
        body.seasonId,
      )
      .run();
    return Response.json({ ok: true });
  }
  const name = (body.name ?? '').trim();
  if (name.length < 3)
    return Response.json(
      { error: 'El nombre debe tener al menos 3 caracteres.' },
      { status: 400 },
    );
  if (
    await db()
      .prepare(
        'SELECT id FROM organization_seasons WHERE organization_id=? AND name=?',
      )
      .bind(body.organizationId, name)
      .first()
  )
    return Response.json(
      { error: 'Ya existe una temporada con ese nombre.' },
      { status: 409 },
    );
  const id = crypto.randomUUID();
  const now = Date.now();
  await db().batch([
    db()
      .prepare(
        "UPDATE organization_seasons SET status='CLOSED',ends_at=? WHERE organization_id=? AND status='ACTIVE'",
      )
      .bind(now, body.organizationId),
    db()
      .prepare(
        "INSERT INTO organization_seasons (id,organization_id,name,status,starts_at,created_by,created_at) VALUES (?,?,?,'ACTIVE',?,?,?)",
      )
      .bind(id, body.organizationId, name, now, user.id, now),
  ]);
  return Response.json(
    {
      season: {
        id,
        name,
        status: 'ACTIVE',
        startsAt: now,
        endsAt: null,
        gameCount: 0,
      },
    },
    { status: 201 },
  );
}
