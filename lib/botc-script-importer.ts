export type CharacterType = 'TOWNSFOLK' | 'OUTSIDER' | 'MINION' | 'DEMON';
export type ImportedCharacter = { id: string; name: string; localizedName?: string; type: CharacterType };
export type ImportedScript = { name: string; author?: string; characters: ImportedCharacter[]; source: 'BOTC_JSON' };

export interface ScriptImporter { import(source: unknown): Promise<ImportedScript> }

type ScriptCharacter = string | { id: string; name?: string; team?: string };

const catalog: Record<string, { name: string; type: CharacterType }> = {
  washerwoman:{name:'Lavandera',type:'TOWNSFOLK'}, librarian:{name:'Bibliotecario',type:'TOWNSFOLK'}, investigator:{name:'Investigador',type:'TOWNSFOLK'}, chef:{name:'Chef',type:'TOWNSFOLK'}, empath:{name:'Empático',type:'TOWNSFOLK'}, fortuneteller:{name:'Adivina',type:'TOWNSFOLK'}, undertaker:{name:'Enterrador',type:'TOWNSFOLK'}, monk:{name:'Monje',type:'TOWNSFOLK'}, ravenkeeper:{name:'Guardián del Cuervo',type:'TOWNSFOLK'}, virgin:{name:'Virgen',type:'TOWNSFOLK'}, slayer:{name:'Cazador',type:'TOWNSFOLK'}, soldier:{name:'Soldado',type:'TOWNSFOLK'}, mayor:{name:'Alcalde',type:'TOWNSFOLK'},
  butler:{name:'Mayordomo',type:'OUTSIDER'}, drunk:{name:'Borracho',type:'OUTSIDER'}, recluse:{name:'Recluso',type:'OUTSIDER'}, saint:{name:'Santo',type:'OUTSIDER'},
  poisoner:{name:'Envenenador',type:'MINION'}, spy:{name:'Espía',type:'MINION'}, scarletwoman:{name:'Mujer Escarlata',type:'MINION'}, baron:{name:'Barón',type:'MINION'}, imp:{name:'Imp',type:'DEMON'},
};

const teamMap: Record<string, CharacterType> = {
  townsfolk: 'TOWNSFOLK',
  outsider: 'OUTSIDER',
  minion: 'MINION',
  demon: 'DEMON',
};

let officialCatalogPromise: Promise<Record<string, { name: string; type: CharacterType }>> | undefined;

function loadOfficialCatalog() {
  officialCatalogPromise ??= fetch(
    'https://release.botc.app/resources/data/roles.json',
  )
    .then(async (response) => {
      if (!response.ok) throw new Error('No se ha podido consultar el catálogo oficial de BOTC.');
      const roles = (await response.json()) as unknown;
      if (!Array.isArray(roles)) throw new Error('El catálogo oficial de BOTC no tiene el formato esperado.');
      return Object.fromEntries(
        roles.flatMap((role) => {
          if (typeof role !== 'object' || role === null) return [];
          const value = role as { id?: unknown; name?: unknown; team?: unknown };
          const type = teamMap[typeof value.team === 'string' ? value.team.toLowerCase() : ''];
          if (typeof value.id !== 'string' || !type) return [];
          return [[value.id.toLowerCase(), { name: typeof value.name === 'string' ? value.name : value.id, type }]];
        }),
      );
    })
    .catch((error) => {
      officialCatalogPromise = undefined;
      throw error;
    });
  return officialCatalogPromise;
}

export class BotcJsonScriptImporter implements ScriptImporter {
  async import(source: unknown): Promise<ImportedScript> {
    if (!Array.isArray(source)) throw new Error('El archivo debe contener una lista JSON de personajes.');
    const meta = source.find((item): item is { id:string; name?:string; author?:string } => typeof item === 'object' && item !== null && (item as {id?:string}).id === '_meta');
    const entries = source.filter((item): item is ScriptCharacter =>
      (typeof item === 'string' && Boolean(item.trim())) ||
      (typeof item === 'object' && item !== null && typeof (item as { id?: unknown }).id === 'string' && (item as { id: string }).id !== '_meta'),
    );
    const needsOfficialCatalog = entries.some((entry) => {
      const item = typeof entry === 'string' ? { id: entry } : entry;
      return !catalog[item.id.toLowerCase()] && !teamMap[item.team?.toLowerCase() ?? ''];
    });
    const officialCatalog = needsOfficialCatalog ? await loadOfficialCatalog() : {};
    const characters = entries.map((entry) => {
      const item = typeof entry === 'string' ? { id: entry } : entry;
      const local = catalog[item.id.toLowerCase()];
      const official = officialCatalog[item.id.toLowerCase()];
      const type = teamMap[item.team?.toLowerCase() ?? ''] ?? local?.type ?? official?.type;
      if (!type) {
        throw new Error(
          `El personaje casero «${item.id}» debe incluir team: townsfolk, outsider, minion o demon.`,
        );
      }
      return {
        id: item.id,
        name: item.name ?? local?.name ?? official?.name ?? item.id,
        localizedName: local?.name,
        type,
      };
    });
    if (!characters.length) throw new Error('El guion no contiene personajes reconocibles.');
    return { name:meta?.name ?? 'Guion sin nombre', author:meta?.author, characters, source:'BOTC_JSON' };
  }
}

export const troubleBrewing:ImportedScript = { name:'Trouble Brewing', source:'BOTC_JSON', characters:Object.entries(catalog).map(([id,value])=>({id,name:value.name,localizedName:value.name,type:value.type})) };
