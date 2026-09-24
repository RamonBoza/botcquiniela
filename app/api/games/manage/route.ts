import { requireUser } from '@/lib/server-auth';
import { db } from '@/lib/server-store';
import { validateSetupSelection } from '@/lib/setup-rules';
import type { ImportedCharacter } from '@/lib/botc-script-importer';

export async function POST(request: Request) {
  const user = await requireUser(request);
  const body = (await request.json()) as {
    gameId?: string;
    action?: 'lock' | 'reopen' | 'finish';
    actualCharacterIds?: string[];
  };
  const game = await db()
    .prepare(
      "SELECT g.status,g.player_count AS playerCount,g.characters_json AS charactersJson FROM app_games g JOIN organization_members m ON m.organization_id=g.organization_id WHERE g.id=? AND m.user_id=? AND m.role='ADMIN'",
    )
    .bind(body.gameId, user.id)
    .first<{ status: string; playerCount: number; charactersJson: string }>();
  if (!game)
    return Response.json(
      { error: 'No tienes permiso para gestionar esta quiniela.' },
      { status: 403 },
    );
  if (body.action === 'lock' && game.status === 'OPEN') {
    await db()
      .prepare("UPDATE app_games SET status='LOCKED' WHERE id=?")
      .bind(body.gameId)
      .run();
    return Response.json({ status: 'LOCKED' });
  }
  if (body.action === 'reopen' && game.status === 'LOCKED') {
    await db()
      .prepare("UPDATE app_games SET status='OPEN' WHERE id=?")
      .bind(body.gameId)
      .run();
    return Response.json({ status: 'OPEN' });
  }
  if (body.action === 'finish' && game.status === 'LOCKED') {
    const actual = body.actualCharacterIds;
    if (!Array.isArray(actual))
      return Response.json(
        { error: 'El setup contiene personajes no válidos.' },
        { status: 400 },
      );
    const characters = JSON.parse(game.charactersJson) as ImportedCharacter[];
    const validation = validateSetupSelection({
      playerCount: Number(game.playerCount),
      selectedIds: actual,
      characters,
      allowDuplicates: characters.some((character) => character.id === 'atheist'),
    });
    if (!validation.valid)
      return Response.json({ error: validation.error }, { status: 400 });
    await db()
      .prepare(
        "UPDATE app_games SET status='FINISHED',actual_character_ids_json=? WHERE id=?",
      )
      .bind(JSON.stringify(actual), body.gameId)
      .run();
    return Response.json({ status: 'FINISHED' });
  }
  return Response.json(
    { error: 'Cambio de estado no permitido.' },
    { status: 409 },
  );
}
