import { playerDirectory } from '../../model';
import { json, getRole, linksFor, readEvent, readRecords, runtime, visible, readAction, validEventId, HttpError, errorResponse, validatedChange } from './store';
export const dynamic='force-dynamic';
export async function GET(req:Request) {
 try {
  const role=await getRole(req);
  // Legacy links and open v0.2 browser tabs continue to address the original event.
  const id=validEventId(new URL(req.url).searchParams.get('eventId')??'first');
  const record=await readEvent(id);
  return json({eventId:id,event:visible(record.event,role),revision:record.revision,role,links:await linksFor(role)});
 } catch(error) {return errorResponse(error);}
}
export async function POST(req:Request) {
 try {
  const {role,action}=await readAction(req);
  const id=validEventId(action.eventId??'first');
  const {event,revision}=await readEvent(id);
  if(action.revision!==revision)throw new HttpError('다른 사용자가 정보를 변경했습니다. 새로고침 후 다시 입력해주세요.',409);
  if((action.type==='roster'||action.type==='order')&&action.playerIds!==undefined) {
   if(!Array.isArray(action.playerIds)||action.playerIds.length!==4||action.playerIds.some((id:unknown)=>typeof id!=='string'))throw new HttpError('선수 선택을 확인해주세요.',400);
   const directory=playerDirectory(await readRecords());
   for(let index=0;index<4;index++) {
    const playerId=action.playerIds[index];
    if(!playerId)continue;
    const player=directory.find(p=>p.id===playerId);
    if(!player||player.name!==action.roster?.[index]?.trim())throw new HttpError('기존 선수는 목록에서 선택해주세요. 다른 선수는 새 선수로 등록해주세요.',400);
   }
  }
  const next=validatedChange(event,action,role);
  const result=await runtime().DB.prepare('UPDATE events SET data=?,revision=revision+1 WHERE id=? AND revision=?')
   .bind(JSON.stringify(next),id,revision).run();
  if(!result.meta.changes)throw new HttpError('다른 변경과 겹쳤습니다. 새로고침 후 다시 시도해주세요.',409);
  return json({eventId:id,event:visible(next,role),revision:revision+1,role,links:await linksFor(role)});
 } catch(error) {return errorResponse(error);}
}
