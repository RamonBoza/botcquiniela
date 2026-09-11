import officialRoles from './botc-official-roles.json';

export type CharacterType =
  | 'TOWNSFOLK'
  | 'OUTSIDER'
  | 'MINION'
  | 'DEMON'
  | 'TRAVELLER'
  | 'FABLED'
  | 'LORIC';
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
  traveller: 'TRAVELLER',
  traveler: 'TRAVELLER',
  fabled: 'FABLED',
  loric: 'LORIC',
};

const officialCatalog: Record<string, { name: string; type: CharacterType }> =
  Object.fromEntries(
    officialRoles.flatMap((role) => {
      const type = teamMap[role.team.toLowerCase()];
      return type ? [[role.id.toLowerCase(), { name: role.name, type }]] : [];
    }),
  );

export class BotcJsonScriptImporter implements ScriptImporter {
  async import(source: unknown): Promise<ImportedScript> {
    if (!Array.isArray(source)) throw new Error('El archivo debe contener una lista JSON de personajes.');
    const meta = source.find((item): item is { id:string; name?:string; author?:string } => typeof item === 'object' && item !== null && (item as {id?:string}).id === '_meta');
    const entries = source.filter((item): item is ScriptCharacter =>
      (typeof item === 'string' && Boolean(item.trim())) ||
      (typeof item === 'object' && item !== null && typeof (item as { id?: unknown }).id === 'string' && (item as { id: string }).id !== '_meta'),
    );
    const characters = entries.map((entry) => {
      const item = typeof entry === 'string' ? { id: entry } : entry;
      const local = catalog[item.id.toLowerCase()];
      const official = officialCatalog[item.id.toLowerCase()];
      const type = teamMap[item.team?.toLowerCase() ?? ''] ?? local?.type ?? official?.type;
      if (!type) {
        throw new Error(
          `El personaje casero «${item.id}» debe incluir un team válido.`,
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
