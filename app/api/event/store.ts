import { env } from 'cloudflare:workers';
import { initialEvent, normalizeEvent, applyChange, type EventData, type EventRecord } from '../../model';

export const runtime = () => env as unknown as {DB:D1Database; ADMIN_KEY?:string; INITIAL_ROSTER?:string};
export const json = (value:unknown,status=200) => Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export class HttpError extends Error { constructor(message:string, public status:number) { super(message); } }
export function errorResponse(error:unknown) {
 return json({error:error instanceof HttpError ? error.message : '정보를 불러오거나 저장하지 못했습니다. 잠시 후 다시 시도해주세요.'},error instanceof HttpError ? error.status : 503);
}
export async function roleKey(role:string) {
 const secret=runtime().ADMIN_KEY;
 if(!secret)return '';
 if(role==='admin')return secret;
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const bytes=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('captain-'+role));
 return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
}
export async function getRole(req:Request) {
 const token=req.headers.get('authorization')?.replace(/^Bearer /,'');
 if(!token)return 'viewer';
 for(const role of ['admin','a','b'])if(token===await roleKey(role))return role;
 return 'viewer';
}
export async function linksFor(role:string) {
 return role==='admin'?{a:await roleKey('a'),b:await roleKey('b')}:undefined;
}
export function validEventId(id:unknown):string {
 if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(id))throw new HttpError('대회 주소를 확인해주세요.',400);
 return id;
}
async function ensureFirst() {
 const db=runtime().DB;
 if(!db)throw new HttpError('데이터 저장소가 준비되지 않았습니다.',503);
 const existing=await db.prepare('SELECT id FROM events WHERE id=?').bind('first').first();
 if(existing)return;
 let roster;
 try {roster=JSON.parse(runtime().INITIAL_ROSTER||'null');} catch {}
 await db.prepare('INSERT OR IGNORE INTO events (id,data,revision) VALUES (?,?,0)').bind('first',JSON.stringify(initialEvent(roster||undefined))).run();
}
export async function readEvent(id:string):Promise<EventRecord> {
 await ensureFirst();
 const row=await runtime().DB.prepare('SELECT id,data,revision FROM events WHERE id=?').bind(validEventId(id)).first<{id:string;data:string;revision:number}>();
 if(!row)throw new HttpError('대회를 찾을 수 없습니다. 대회 목록에서 다시 선택해주세요.',404);
 return {id:row.id,event:normalizeEvent(JSON.parse(row.data),row.id),revision:row.revision};
}
export async function readRecords():Promise<EventRecord[]> {
 await ensureFirst();
 const result=await runtime().DB.prepare('SELECT id,data,revision FROM events').all<{id:string;data:string;revision:number}>();
 return result.results.map(row=>({id:row.id,event:normalizeEvent(JSON.parse(row.data),row.id),revision:row.revision}))
  .sort((a,b)=>b.event.date.localeCompare(a.event.date)||a.id.localeCompare(b.id));
}
export function visible(event:EventData,role:string):EventData {
 const n=structuredClone(event);
 if(n.format!==6&&!n.locked&&role!=='admin')for(const side of ['a','b'] as const)if(role!==side)n.games.forEach(game=>{game[side]=[];});
 return n;
}
export async function readAction(req:Request) {
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)throw new HttpError('허용되지 않은 요청입니다.',403);
 if(!req.headers.get('content-type')?.includes('application/json'))throw new HttpError('JSON 요청이 필요합니다.',415);
 const role=await getRole(req);
 if(role==='viewer')throw new HttpError('전용 관리 링크가 필요합니다.',403);
 const text=await req.text();
 if(text.length>16000)throw new HttpError('입력 내용이 너무 큽니다.',413);
 let action;
 try {action=JSON.parse(text);} catch {throw new HttpError('요청 내용을 확인해주세요.',400);}
 if(!action||typeof action!=='object'||Array.isArray(action))throw new HttpError('요청 내용을 확인해주세요.',400);
 return {role,action};
}

export function validatedChange(event:EventData,action:unknown,role:string) {
 try {return applyChange(event,action,role);} catch(error) {throw new HttpError(error instanceof Error?error.message:'입력 내용을 확인해주세요.',400);}
}
