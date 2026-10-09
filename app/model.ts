export type Side = 'a'|'b';
export type Game = {a:number[];b:number[];scoreA:string;scoreB:string;winner:''|Side;court:string};
export type EventData = {title:string;date:string;time:string;court:string;reservation:string;format:3|5;notice:string;rosters:{a:string[];b:string[]};submitted:{a:boolean;b:boolean};locked:boolean;games:Game[]};
export const newGame=():Game=>({a:[],b:[],scoreA:'',scoreB:'',winner:'',court:''});
export function initialEvent(rosters?:{a:string[];b:string[]}):EventData { return {title:'송변전 × 배전 친선 대항전',date:'2026-10-14',time:'',court:'',reservation:'미확인',format:3,notice:'각 팀 4명으로 복식 대항전을 진행합니다. 경기 수와 세부 규칙은 진행자가 확정 후 안내합니다.',rosters:rosters||{a:['','','',''],b:['','','','']},submitted:{a:false,b:false},locked:false,games:Array.from({length:3},newGame)}; }
export function summary(e:EventData) {const a=e.games.filter(g=>g.winner==='a').length,b=e.games.filter(g=>g.winner==='b').length,target=Math.floor(e.format/2)+1;return {a,b,done:a+b,champion:a>=target?'송변전':b>=target?'배전':''};}
function fail(message:string):never{throw Error(message);}
export function applyChange(e:EventData, action:any, role:string):EventData {
 const n=structuredClone(e);
 if(role==='viewer')fail('입력 권한이 없습니다. 전용 관리 링크로 접속해주세요.');
 if(action.type==='settings') {
  if(role!=='admin')fail('진행자만 대회 정보를 변경할 수 있습니다.');
  const v=action.value;
  if(!v||![3,5].includes(v.format)||typeof v.title!=='string'||!v.title.trim()||v.title.length>80)fail('대회명과 경기 수를 확인해주세요.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(v.date)||Number.isNaN(Date.parse(v.date)))fail('날짜를 확인해주세요.');
  if(typeof v.time!=='string'||(v.time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(v.time)))fail('시간을 확인해주세요.');
  if(!['','1','2','3','4','5','6'].includes(v.court)||!['미확인','신청 중','승인 완료'].includes(v.reservation))fail('코트 정보를 확인해주세요.');
  if(typeof v.notice!=='string'||v.notice.length>2000)fail('안내문은 2,000자 이내로 입력해주세요.');
  if(v.format!==n.format&&(n.locked||n.games.some(g=>g.winner)))fail('오더가 확정되거나 결과가 있는 대회는 경기 수를 바꿀 수 없습니다.');
  if(v.format!==n.format){n.games=Array.from({length:v.format},(_,i)=>n.games[i]||newGame());n.submitted={a:false,b:false};}
  Object.assign(n,{title:v.title.trim(),date:v.date,time:v.time,court:v.court,reservation:v.reservation,format:v.format,notice:v.notice});
 } else if(action.type==='order') {
  const side:Side=action.side;if(!['a','b'].includes(side)||role!==side)fail('자기 팀의 대표만 오더를 제출할 수 있습니다.');
  if(n.locked)fail('오더가 확정되었습니다. 진행자에게 수정 요청해주세요.');
  const {roster,pairs}=action;
  if(!Array.isArray(roster)||roster.length!==4||roster.some((x:any)=>typeof x!=='string'||!x.trim()||x.length>30))fail('참가자 4명의 이름을 입력해주세요.');
  if(new Set(roster.map((x:string)=>x.trim())).size!==4)fail('동명이인은 이름 뒤에 구분자를 붙여주세요.');
  if(!Array.isArray(pairs)||pairs.length!==n.format||pairs.some((p:any)=>!Array.isArray(p)||p.length!==2||p[0]===p[1]||p.some((x:any)=>!Number.isInteger(x)||x<0||x>3)))fail('매 경기 서로 다른 선수 2명을 선택해주세요.');
  n.rosters[side]=roster.map((x:string)=>x.trim());n.games.forEach((g,i)=>g[side]=pairs[i]);n.submitted[side]=true;
 } else if(action.type==='lock') {
  if(role!=='admin')fail('진행자만 오더를 확정할 수 있습니다.');
  if(typeof action.locked!=='boolean')fail('잘못된 요청입니다.');
  if(action.locked&&(!n.submitted.a||!n.submitted.b))fail('양 팀 오더 제출 후 확정할 수 있습니다.');
  if(!action.locked&&n.games.some(g=>g.winner))fail('결과를 모두 초기화한 후 오더를 수정할 수 있습니다.');
  n.locked=action.locked;
 } else if(action.type==='result') {
  if(role!=='admin')fail('진행자만 결과를 기록할 수 있습니다.');
  if(!n.locked)fail('먼저 양 팀 오더를 확정해주세요.');
  const g=n.games[action.index];if(!g||!Number.isInteger(action.index))fail('경기를 찾을 수 없습니다.');
  if(action.clear){Object.assign(g,{scoreA:'',scoreB:'',winner:''});return n;}
  const a=String(action.scoreA),b=String(action.scoreB);
  if(!/^\d{1,2}$/.test(a)||!/^\d{1,2}$/.test(b)||Number(a)===Number(b))fail('0~99의 서로 다른 최종 게임 스코어를 입력해주세요.');
  Object.assign(g,{scoreA:String(Number(a)),scoreB:String(Number(b)),winner:Number(a)>Number(b)?'a':'b'});
 } else fail('지원하지 않는 요청입니다.');
 return n;
}
