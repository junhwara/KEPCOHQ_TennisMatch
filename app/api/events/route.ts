import { newAnnouncement, playerDirectory, playerStandings } from '../../model';
import { json, getRole, linksFor, readRecords, readEvent, runtime, visible, readAction, HttpError, errorResponse, validatedChange } from '../event/store';
export const dynamic='force-dynamic';
export async function GET(req:Request) {
 try {
  const role=await getRole(req);
  const records=await readRecords();
  // Stats only derive from completed, publicly available matches.
  const publicRecords=records.map(record=>({...record,event:visible(record.event,'viewer')}));
  return json({events:records.map(record=>({...record,event:visible(record.event,role)})),players:playerDirectory(records),standings:playerStandings(publicRecords),role,links:await linksFor(role)});
 } catch(error) {return errorResponse(error);}
}
export async function POST(req:Request) {
 try {
  const {role,action}=await readAction(req);
  if(role!=='admin')throw new HttpError('진행자만 새 대회를 공지할 수 있습니다.',403);
  if(action.type!=='create'||typeof action.requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(action.requestId))throw new HttpError('새 대회 요청을 확인해주세요.',400);
  const id='evt-'+action.requestId.toLowerCase();
  const base=newAnnouncement();
  // Settings selects allowed fields; rosters and results are never copied on creation.
  const event=validatedChange(base,{type:'settings',value:{...base,...action.value}},'admin');
  const result=await runtime().DB.prepare('INSERT OR IGNORE INTO events (id,data,revision) VALUES (?,?,0)').bind(id,JSON.stringify(event)).run();
  const record=await readEvent(id);
  return json({eventId:id,event:visible(record.event,role),revision:record.revision,role,links:await linksFor(role)},result.meta.changes?201:200);
 } catch(error) {return errorResponse(error);}
}
