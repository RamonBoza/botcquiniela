import { requireUser } from '@/lib/server-auth';
import { db } from '@/lib/server-store';

export async function GET(request:Request){
  const user=await requireUser(request);
  const gameId=new URL(request.url).searchParams.get('gameId');
  const game=await db().prepare("SELECT g.status,g.actual_character_ids_json AS actualJson FROM app_games g JOIN organization_members m ON m.organization_id=g.organization_id WHERE g.id=? AND m.user_id=?").bind(gameId,user.id).first<{status:string;actualJson:string|null}>();
  if(!game)return Response.json({error:'No perteneces a esta organización.'},{status:403});
  if(game.status!=='FINISHED'||!game.actualJson)return Response.json({error:'Los resultados permanecen ocultos hasta finalizar la partida.'},{status:409});
  const actual=JSON.parse(game.actualJson) as string[];const rows=await db().prepare('SELECT u.id AS userId,u.display_name AS displayName,p.character_ids_json AS characterIdsJson FROM app_predictions p JOIN users u ON u.id=p.user_id WHERE p.game_id=?').bind(gameId).all<{userId:string;displayName:string;characterIdsJson:string}>();
  const ranking=rows.results.map(row=>{const characterIds=JSON.parse(row.characterIdsJson) as string[];return {userId:row.userId,displayName:row.displayName,characterIds,score:characterIds.filter(id=>actual.includes(id)).length}}).sort((a,b)=>b.score-a.score||a.displayName.localeCompare(b.displayName));
  return Response.json({actualCharacterIds:actual,ranking});
}
