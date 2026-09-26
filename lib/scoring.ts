import type { ImportedCharacter } from '@/lib/botc-script-importer';

export type ScoreBreakdown = {
  hits: number;
  townsfolkBonus: number;
  outsiderBonus: number;
  minionBonus: number;
  fullHouse15Bonus: number;
  total: number;
};

export function calculateScore(
  predicted: string[],
  actual: string[],
  characters: ImportedCharacter[],
  playerCount: number,
): ScoreBreakdown {
  const countById = (ids: string[]) => {
    const counts = new Map<string, number>();
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
    return counts;
  };
  const predictedCounts = countById(predicted);
  const actualCounts = countById(actual);
  const actualByType = (type: ImportedCharacter['type']) =>
    actual.filter(
      (id) => characters.find((character) => character.id === id)?.type === type,
    );
  const completed = (ids: string[]) =>
    ids.length > 0 &&
    [...countById(ids)].every(
      ([id, count]) => (predictedCounts.get(id) ?? 0) >= count,
    );
  const hits = [...actualCounts].reduce(
    (total, [id, count]) =>
      total + Math.min(count, predictedCounts.get(id) ?? 0),
    0,
  );
  const townsfolkBonus = completed(actualByType('TOWNSFOLK')) ? 2 : 0;
  const outsiderBonus = completed(actualByType('OUTSIDER')) ? 1 : 0;
  const minionBonus = completed(actualByType('MINION')) ? 1 : 0;
  const fullHouse15Bonus =
    playerCount === 15 &&
    actual.length === 15 &&
    predicted.length === 15 &&
    [...actualCounts].every(
      ([id, count]) => (predictedCounts.get(id) ?? 0) === count,
    )
      ? 3
      : 0;
  return {
    hits,
    townsfolkBonus,
    outsiderBonus,
    minionBonus,
    fullHouse15Bonus,
    total:
      hits +
      townsfolkBonus +
      outsiderBonus +
      minionBonus +
      fullHouse15Bonus,
  };
}
