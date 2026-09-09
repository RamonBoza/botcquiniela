import { serializePublicGame, type SafeGame } from '@/lib/privacy';

export async function POST(request:Request){
  const payload=await request.json() as SafeGame;
  return Response.json(serializePublicGame(payload));
}
