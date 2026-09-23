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
  const predictedSet = new Set(predicted);
  const actualSet = new Set(actual);
  const actualByType = (type: ImportedCharacter['type']) =>
    characters
      .filter((character) => character.type === type && actualSet.has(character.id))
      .map((character) => character.id);
  const completed = (ids: string[]) =>
    ids.length > 0 && ids.every((id) => predictedSet.has(id));
  const hits = [...predictedSet].filter((id) => actualSet.has(id)).length;
  const townsfolkBonus = completed(actualByType('TOWNSFOLK')) ? 2 : 0;
  const outsiderBonus = completed(actualByType('OUTSIDER')) ? 1 : 0;
  const minionBonus = completed(actualByType('MINION')) ? 1 : 0;
  const fullHouse15Bonus =
    playerCount === 15 &&
    actualSet.size === 15 &&
    predictedSet.size === 15 &&
    [...actualSet].every((id) => predictedSet.has(id))
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
