import type { ImportedCharacter } from '@/lib/botc-script-importer';
import { getRoleDistribution } from '@/lib/role-distribution';

export type SetupLimits = Record<ImportedCharacter['type'], number>;

export function getSetupLimits(
  playerCount: number,
  selectedIds: string[],
): SetupLimits {
  const base = getRoleDistribution(playerCount);
  const limits: SetupLimits = {
    TOWNSFOLK: base.townsfolk,
    OUTSIDER: base.outsiders,
    MINION: base.minions,
    DEMON: base.demons,
  };
  const selected = new Set(selectedIds);
  if (selected.has('atheist'))
    return {
      TOWNSFOLK: playerCount,
      OUTSIDER: playerCount,
      MINION: 0,
      DEMON: 0,
    };
  if (selected.has('baron')) {
    limits.TOWNSFOLK -= 2;
    limits.OUTSIDER += 2;
  }
  if (selected.has('fanggu')) {
    limits.TOWNSFOLK -= 1;
    limits.OUTSIDER += 1;
  }
  if (selected.has('vigormortis')) {
    limits.TOWNSFOLK += 1;
    limits.OUTSIDER -= 1;
  }
  if (selected.has('summoner')) {
    limits.TOWNSFOLK += 1;
    limits.DEMON = 0;
  }
  for (const role of Object.keys(limits) as ImportedCharacter['type'][])
    limits[role] = Math.max(0, limits[role]);
  return limits;
}

export function validateSetupSelection({
  playerCount,
  selectedIds,
  characters,
  allowDuplicates = false,
}: {
  playerCount: number;
  selectedIds: string[];
  characters: ImportedCharacter[];
  allowDuplicates?: boolean;
}) {
  if (selectedIds.length > playerCount)
    return { valid: false, error: `Puedes elegir como máximo ${playerCount} personajes.` };
  if (!allowDuplicates && new Set(selectedIds).size !== selectedIds.length)
    return { valid: false, error: 'No se permiten personajes duplicados.' };
  const byId = new Map(characters.map((character) => [character.id, character]));
  if (selectedIds.some((id) => !byId.has(id)))
    return { valid: false, error: 'La selección contiene personajes no válidos.' };
  const limits = getSetupLimits(playerCount, selectedIds);
  const counts: SetupLimits = {
    TOWNSFOLK: 0,
    OUTSIDER: 0,
    MINION: 0,
    DEMON: 0,
  };
  for (const id of selectedIds) counts[byId.get(id)!.type] += 1;
  const labels: Record<ImportedCharacter['type'], string> = {
    TOWNSFOLK: 'aldeanos',
    OUTSIDER: 'forasteros',
    MINION: 'esbirros',
    DEMON: 'demonios',
  };
  for (const role of Object.keys(limits) as ImportedCharacter['type'][])
    if (counts[role] > limits[role])
      return {
        valid: false,
        error: `Este setup admite como máximo ${limits[role]} ${labels[role]}.`,
      };
  return { valid: true, limits, counts };
}
