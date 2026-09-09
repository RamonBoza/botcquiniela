import { db, ensureDatabase } from '@/lib/server-store';

const encoder=new TextEncoder();
const bytesToHex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const hexToBytes=(hex:string)=>new Uint8Array(hex.match(/.{2}/g)?.map(byte=>parseInt(byte,16))??[]);
async function sha256(value:string){return bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))))}
export function randomToken(size=32){const value=new Uint8Array(size);crypto.getRandomValues(value);return bytesToHex(value)}
export async function hashPassword(password:string,saltHex?:string){const salt=saltHex?hexToBytes(saltHex):crypto.getRandomValues(new Uint8Array(16));const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations:100000},key,256);return {hash:bytesToHex(new Uint8Array(bits)),salt:bytesToHex(salt)}}
export async function verifyPassword(password:string,salt:string,expected:string){return (await hashPassword(password,salt)).hash===expected}
export const sessionCookie=(token:string,maxAge=60*60*24*30)=>`qc_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.NODE_ENV==='production'?'; Secure':''}`;

export async function createSession(userId:string){await ensureDatabase();const token=randomToken();const now=Date.now();await db().prepare('INSERT INTO sessions (id,user_id,token_hash,expires_at,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),userId,await sha256(token),now+30*86400000,now).run();return token}
export async function currentUser(request:Request){await ensureDatabase();const token=request.headers.get('cookie')?.match(/(?:^|; )qc_session=([^;]+)/)?.[1];if(!token)return null;return await db().prepare('SELECT u.id,u.username,u.display_name AS displayName FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(await sha256(token),Date.now()).first<{id:string;username:string;displayName:string}>()}
export async function requireUser(request:Request){const user=await currentUser(request);if(!user)throw new Response(JSON.stringify({error:'Debes iniciar sesión.'}),{status:401,headers:{'content-type':'application/json'}});return user}
