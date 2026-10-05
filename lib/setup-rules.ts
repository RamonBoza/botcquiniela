import type { ImportedCharacter } from '@/lib/botc-script-importer';
import { getRoleDistribution } from '@/lib/role-distribution';

export type SetupLimits = Record<ImportedCharacter['type'], number>;

export const VILLAGE_IDIOT_ID = 'villageidiot';
export const MAX_VILLAGE_IDIOTS = 3;
export const LEGION_ID = 'legion';

export function getLegionDistribution(playerCount: number) {
  const standard = getRoleDistribution(playerCount);
  return {
    legion: standard.townsfolk + standard.outsiders,
    good: standard.minions + standard.demons,
  };
}

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
  if (selected.has(LEGION_ID)) {
    const legion = getLegionDistribution(playerCount);
    return {
      TOWNSFOLK: legion.good,
      OUTSIDER: legion.good,
      MINION: 0,
      DEMON: legion.legion,
    };
  }
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
  if (!allowDuplicates) {
    const copies = new Map<string, number>();
    for (const id of selectedIds) copies.set(id, (copies.get(id) ?? 0) + 1);
    for (const [id, count] of copies) {
      if (count <= 1) continue;
      if (id === VILLAGE_IDIOT_ID && count <= MAX_VILLAGE_IDIOTS) continue;
      if (
        id === LEGION_ID &&
        count <= getLegionDistribution(playerCount).legion
      )
        continue;
      if (id === VILLAGE_IDIOT_ID)
        return {
          valid: false,
          error: `Puede haber entre 1 y ${MAX_VILLAGE_IDIOTS} Village Idiots.`,
        };
      if (id === LEGION_ID)
        return {
          valid: false,
          error: `Este setup admite como máximo ${getLegionDistribution(playerCount).legion} Legion.`,
        };
      return { valid: false, error: 'No se permiten personajes duplicados.' };
    }
  }
  const byId = new Map(characters.map((character) => [character.id, character]));
  if (selectedIds.some((id) => !byId.has(id)))
    return { valid: false, error: 'La selección contiene personajes no válidos.' };
  if (
    selectedIds.includes(LEGION_ID) &&
    selectedIds.some(
      (id) => id !== LEGION_ID && byId.get(id)?.type === 'DEMON',
    )
  )
    return {
      valid: false,
      error: 'Si Legion está en juego, no puede haber otros demonios.',
    };
  const limits = getSetupLimits(playerCount, selectedIds);
  const counts: SetupLimits = {
    TOWNSFOLK: 0,
    OUTSIDER: 0,
    MINION: 0,
    DEMON: 0,
  };
  for (const id of selectedIds) counts[byId.get(id)!.type] += 1;
  if (
    selectedIds.includes(LEGION_ID) &&
    counts.TOWNSFOLK + counts.OUTSIDER >
      getLegionDistribution(playerCount).good
  )
    return {
      valid: false,
      error: `Con Legion puede haber como máximo ${getLegionDistribution(playerCount).good} personajes buenos.`,
    };
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
