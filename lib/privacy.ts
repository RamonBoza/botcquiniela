export type SafeGame={id:string;code:string;name:string;playerCount:number;status:'OPEN'|'LOCKED'|'FINISHED';script:unknown;receivedCount:number;participants:{id:string;displayName:string}[];predictions?:unknown[];actualCharacterIds?:string[]};

/** Única frontera pública: las elecciones solo salen del servidor al finalizar. */
export function serializePublicGame(game:SafeGame):SafeGame{
  const safe:SafeGame={id:game.id,code:game.code,name:game.name,playerCount:game.playerCount,status:game.status,script:game.script,receivedCount:game.receivedCount,participants:game.participants};
  if(game.status==='FINISHED'){safe.predictions=game.predictions??[];safe.actualCharacterIds=game.actualCharacterIds??[]}
  return safe;
}
export function canWritePrediction(status:string){return status==='OPEN'}
