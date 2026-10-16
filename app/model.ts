export type Side = 'a' | 'b';
export type PlayerMeta = {gender: '' | 'male' | 'female'; grade: '' | '1' | '2' | '3'};
export type Game = {
 a: number[]; b: number[]; scoreA: string; scoreB: string; winner: '' | Side; court: string;
 category?: 'doubles' | 'mixed' | 'mens'; round?: number; time?: string;
};
export type EventData = {
 title: string; date: string; time: string; court: string; secondaryCourt: string; roundTimes: string[];
 reservation: string; format: 0 | 3 | 5 | 6; notice: string;
 rosters: {a: string[]; b: string[]}; playerMeta: {a: PlayerMeta[]; b: PlayerMeta[]};
 playerIds: {a: string[]; b: string[]};
 submitted: {a: boolean; b: boolean}; locked: boolean; games: Game[];
};
export type EventRecord = {id:string; event:EventData; revision:number};
export type PlayerRecord = PlayerMeta & {id:string; name:string; side:Side; lastDate:string};
export type PlayerStanding = PlayerRecord & {events:number; played:number; wins:number; losses:number; gamesFor:number; gamesAgainst:number; winRate:number|null};
export const genderLabel: Record<PlayerMeta['gender'], string> = {'': '미입력', male: '남자', female: '여자'};
export const gradeLabel: Record<PlayerMeta['grade'], string> = {'': '미입력', '1': '1직급·처장', '2': '2직급·부장', '3': '3직급·차장'};
const sides: Side[] = ['a', 'b'];
const defaultMeta = (): PlayerMeta[] => [
 {gender: 'male', grade: '1'}, {gender: 'male', grade: '2'},
 {gender: 'male', grade: '3'}, {gender: 'female', grade: '3'},
];
export const newGame = (): Game => ({a: [], b: [], scoreA: '', scoreB: '', winner: '', court: ''});
export function initialEvent(rosters?: {a: string[]; b: string[]}): EventData {
 return {
  title: '송변전 × 배전 친선 대항전', date: '2026-10-14', time: '', court: '', secondaryCourt: '',
  roundTimes: ['', '', ''], reservation: '미확인', format: 3,
  notice: '각 팀 4명으로 복식 대항전을 진행합니다. 경기 수와 세부 규칙은 진행자가 확정 후 안내합니다.',
  rosters: structuredClone(rosters || {a: ['', '', '', ''], b: ['', '', '', '']}),
  playerMeta: {a: defaultMeta(), b: defaultMeta()}, playerIds: {a: ['', '', '', ''], b: ['', '', '', '']}, submitted: {a: false, b: false}, locked: false,
  games: Array.from({length: 3}, newGame),
 };
}

// Announcements start independently of previous rosters and results.
export function newAnnouncement(value: Partial<EventData> = {}): EventData {
 const blankMeta = (): PlayerMeta[] => Array.from({length:4},()=>({gender:'',grade:''}));
 return normalizeEvent({...initialEvent(),date:'',format:0,notice:'참가 선수와 대진은 확정 후 안내합니다.',
  rosters:{a:['','','',''],b:['','','','']},playerMeta:{a:blankMeta(),b:blankMeta()},
  games:[],submitted:{a:false,b:false},locked:false,...structuredClone(value)});
}
// Preserve legacy scores and fixtures. Identity backfill is deterministic per event.
export function normalizeEvent(raw: any, eventId = 'first'): EventData {
 const defaults = initialEvent();
 const e: EventData = {...defaults, ...structuredClone(raw || {})};
 e.rosters = {a: [...(raw?.rosters?.a || defaults.rosters.a)], b: [...(raw?.rosters?.b || defaults.rosters.b)]};
 e.playerMeta = {
  a: structuredClone(raw?.playerMeta?.a ?? defaults.playerMeta.a),
  b: structuredClone(raw?.playerMeta?.b ?? defaults.playerMeta.b),
 };
 e.playerIds = {a:[],b:[]};
 for(const side of sides)e.playerIds[side]=e.rosters[side].map((name,index)=>{
  if(!name.trim())return '';
  const id=raw?.playerIds?.[side]?.[index];
  return typeof id==='string'&&id.trim()?id:'legacy-'+eventId+'-'+side+'-'+index;
 });
 e.secondaryCourt = raw?.secondaryCourt ?? '';
 e.roundTimes = [...(raw?.roundTimes ?? ['', '', ''])];
 e.submitted = {...defaults.submitted, ...raw?.submitted};
 e.games = (raw?.games ?? Array.from({length: e.format}, newGame)).map((g: Game) => ({...newGame(), ...structuredClone(g)}));
 return e;
}

export function summary(e: EventData) {
 const complete = e.games.filter(g => g.winner === 'a' || g.winner === 'b');
 const a = complete.filter(g => g.winner === 'a').length;
 const b = complete.length - a;
 const gamesA = complete.reduce((total, g) => total + (Number(g.scoreA) || 0), 0);
 const gamesB = complete.reduce((total, g) => total + (Number(g.scoreB) || 0), 0);
 let champion = '';
 let decidedBy: '' | 'wins' | 'games' | 'draw' = '';
 if (e.format === 6) {
  if (complete.length === 6) {
   if (a !== b) {champion = a > b ? '송변전' : '배전'; decidedBy = 'wins';}
   else if (gamesA !== gamesB) {champion = gamesA > gamesB ? '송변전' : '배전'; decidedBy = 'games';}
   else {champion = '무승부'; decidedBy = 'draw';}
  }
 } else if (e.format !== 0) {
  const target = Math.floor(e.format / 2) + 1;
  champion = a >= target ? '송변전' : b >= target ? '배전' : '';
  if (champion) decidedBy = 'wins';
 }
 return {a, b, done: complete.length, gamesA, gamesB, champion, decidedBy};
}
function fail(message: string): never {throw Error(message);}
function hasResults(e: EventData) {return e.games.some(g => g.winner || g.scoreA !== '' || g.scoreB !== '');}
function validTime(value: any) {return typeof value === 'string' && (!value || /^([01]\d|2[0-3]):[0-5]\d$/.test(value));}
function validDate(value:any) {
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||value.startsWith('0000'))return false;
 const date=new Date(value+'T00:00:00Z');
 return !Number.isNaN(date.valueOf())&&date.toISOString().slice(0,10)===value;
}
function validateRoster(roster:any,complete=true):string[] {
 if(!Array.isArray(roster)||roster.length!==4||roster.some(x=>typeof x!=='string'||x.length>30||(complete&&!x.trim())))
  fail(complete?'참가자 4명의 이름을 입력해주세요.':'선수 이름은 30자 이내로 입력해주세요.');
 const names=roster.map((x:string)=>x.trim()),entered=names.filter(Boolean);
 if(new Set(entered).size!==entered.length)fail('동명이인은 이름 뒤에 구분자를 붙여주세요.');
 return names;
}
function resolvePlayerIds(e:EventData,side:Side,names:string[],supplied:any):string[] {
 if(supplied!==undefined&&(!Array.isArray(supplied)||supplied.length!==4||supplied.some(id=>typeof id!=='string'||id.length>160||/[\s\x00-\x1f]/.test(id))))fail('선수 식별 정보를 확인해주세요.');
 const ids=names.map((name,index)=>{
  if(!name)return '';
  // Explicit blanks register a new person. Only old clients fall back to names.
  if(supplied!==undefined)return supplied[index]||crypto.randomUUID();
  if(e.rosters[side][index]===name&&e.playerIds[side][index])return e.playerIds[side][index];
  const matches=e.rosters[side].flatMap((previous,i)=>previous===name?[i]:[]);
  if(matches.length===1&&e.playerIds[side][matches[0]])return e.playerIds[side][matches[0]];
  return crypto.randomUUID();
 });
 const allIds=[...ids,...e.playerIds[side==='a'?'b':'a']].filter(Boolean);
 if(new Set(allIds).size!==allIds.length)fail('같은 선수를 한 대회에 두 번 등록할 수 없습니다.');
 return ids;
}
function validateMeta(meta: any): PlayerMeta[] {
 if (!Array.isArray(meta) || meta.length !== 4 || meta.some(p => !p || !['', 'male', 'female'].includes(p.gender) || !['', '1', '2', '3'].includes(p.grade))) fail('선수 4명의 성별과 직급을 확인해주세요.');
 return meta.map(p => ({gender: p.gender, grade: p.grade}));
}
function validateSixTeam(roster: string[], meta: PlayerMeta[]) {
 validateRoster(roster);
 validateMeta(meta);
 if (meta.filter(p => p.gender === 'female').length !== 1 || meta.some(p => !p.grade) ||
  ['1', '2', '3'].some(grade => meta.filter(p => p.gender === 'male' && p.grade === grade).length !== 1)) {
  fail('6복은 각 팀에 1·2·3직급 남자 선수 각 1명과 여자 선수 1명이 필요합니다. 성별과 직급을 확인해주세요.');
 }
}
export function generateSixGames(e: EventData): Game[] {
 for (const side of sides) validateSixTeam(e.rosters[side], e.playerMeta[side]);
 if (e.court && e.secondaryCourt && e.court === e.secondaryCourt) fail('혼합복식과 남자복식은 서로 다른 코트를 선택해주세요.');
 return ['1', '2', '3'].flatMap((grade, index) => {
  const mixed = {...newGame(), category: 'mixed' as const, round: index + 1, court: e.court, time: e.roundTimes[index] || (index === 0 ? e.time : '')};
  const mens = {...newGame(), category: 'mens' as const, round: index + 1, court: e.secondaryCourt, time: mixed.time};
  for (const side of sides) {
   const man = e.playerMeta[side].findIndex(p => p.gender === 'male' && p.grade === grade);
   const woman = e.playerMeta[side].findIndex(p => p.gender === 'female');
   mixed[side] = [man, woman];
   mens[side] = e.playerMeta[side].flatMap((p, i) => p.gender === 'male' && i !== man ? [i] : []);
  }
  return [mixed, mens];
 });
}
function prepareSix(e:EventData,preserveResults=false) {
 if(e.court&&e.secondaryCourt&&e.court===e.secondaryCourt)fail('혼합복식과 남자복식은 서로 다른 코트를 선택해주세요.');
 let ready=true;
 for(const side of sides){
  if(e.rosters[side].filter(name=>name.trim()).length===4)validateSixTeam(e.rosters[side],e.playerMeta[side]);
  else ready=false;
 }
 if(!ready){e.games=[];e.locked=false;e.submitted={a:false,b:false};return;}
 const fixtures=generateSixGames(e);
 e.games=preserveResults?fixtures.map((fixture,i)=>({...fixture,...e.games[i],category:fixture.category,round:fixture.round,court:fixture.court,time:fixture.time})):fixtures;
 e.locked=true;e.submitted={a:true,b:true};
}
export function applyChange(e: EventData, action: any, role: string): EventData {
 const n = normalizeEvent(e);
 if (!['admin', 'a', 'b'].includes(role)) fail('입력 권한이 없습니다. 전용 관리 링크로 접속해주세요.');
 if (action.type === 'settings') {
  if (role !== 'admin') fail('진행자만 대회 정보를 변경할 수 있습니다.');
  const v = action.value;
  if (!v || ![0, 3, 5, 6].includes(v.format) || typeof v.title !== 'string' || !v.title.trim() || v.title.length > 80) fail('대회명과 경기 수를 확인해주세요.');
  if (!validDate(v.date)) fail('날짜를 확인해주세요.');
  if (!validTime(v.time)) fail('시간을 확인해주세요.');
  const secondaryCourt = v.secondaryCourt ?? n.secondaryCourt;
  const roundTimes = v.roundTimes ?? n.roundTimes;
  if (!['', '1', '2', '3', '4', '5', '6'].includes(v.court) || !['', '1', '2', '3', '4', '5', '6'].includes(secondaryCourt) || !['미확인', '신청 중', '승인 완료'].includes(v.reservation)) fail('코트 정보를 확인해주세요.');
  if (!Array.isArray(roundTimes) || roundTimes.length !== 3 || roundTimes.some(t => !validTime(t))) fail('라운드별 시간은 24시간 형식으로 입력해주세요.');
  if (typeof v.notice !== 'string' || v.notice.length > 2000) fail('안내문은 2,000자 이내로 입력해주세요.');
  const changedFormat = v.format !== n.format;
  if (changedFormat && hasResults(n)) fail('결과를 모두 초기화한 후 경기 방식을 바꿀 수 있습니다.');
  Object.assign(n, {title: v.title.trim(), date: v.date, time: v.time, court: v.court, secondaryCourt, roundTimes: [...roundTimes], reservation: v.reservation, format: v.format, notice: v.notice});
  if (n.format === 6) prepareSix(n, !changedFormat);
  else if (changedFormat) {
   n.games = Array.from({length: n.format}, newGame);
   n.locked = false;
   n.submitted = {a: false, b: false};
  }
 } else if (action.type === 'roster') {
  const side: Side = action.side;
  if (!sides.includes(side) || (role !== 'admin' && role !== side)) fail('자기 팀의 대표 또는 진행자만 선수 정보를 수정할 수 있습니다.');
  const roster = validateRoster(action.roster, false);
  const meta = validateMeta(action.playerMeta ?? n.playerMeta[side]);
  const ids = resolvePlayerIds(n, side, roster, action.playerIds);
  if (JSON.stringify(roster) === JSON.stringify(n.rosters[side]) && JSON.stringify(meta) === JSON.stringify(n.playerMeta[side]) && JSON.stringify(ids) === JSON.stringify(n.playerIds[side])) return n;
  if (hasResults(n)) fail('결과를 모두 초기화한 후 선수 정보를 수정할 수 있습니다.');
  if (n.format !== 6 && n.locked) fail('오더 확정을 해제한 후 선수 정보를 수정해주세요.');
  n.rosters[side] = roster;
  n.playerMeta[side] = meta;
  n.playerIds[side] = ids;
  if (n.format === 6) prepareSix(n);
  else {
   n.submitted[side] = false;
   n.games.forEach(g => {g[side] = [];});
  }
 } else if (action.type === 'order') {
  const side: Side = action.side;
  if (!sides.includes(side) || role !== side) fail('자기 팀의 대표만 오더를 제출할 수 있습니다.');
  if (n.format === 0) fail('경기 방식을 먼저 정해주세요.');
  if (n.format === 6) fail('6복은 성별과 직급으로 자동 편성되어 별도 오더 제출이 필요하지 않습니다.');
  if (n.locked || hasResults(n)) fail('오더가 확정되었습니다. 진행자에게 수정 요청해주세요.');
  const roster = validateRoster(action.roster);
  const meta = validateMeta(action.playerMeta ?? n.playerMeta[side]);
  const ids = resolvePlayerIds(n, side, roster, action.playerIds);
  const pairs = action.pairs;
  if (!Array.isArray(pairs) || pairs.length !== n.format || pairs.some((p: any) => !Array.isArray(p) || p.length !== 2 || p[0] === p[1] || p.some((x: any) => !Number.isInteger(x) || x < 0 || x > 3))) fail('매 경기 서로 다른 선수 2명을 선택해주세요.');
  n.rosters[side] = roster;
  n.playerMeta[side] = meta;
  n.playerIds[side] = ids;
  n.games.forEach((g, i) => {g[side] = [...pairs[i]];});
  n.submitted[side] = true;
 } else if (action.type === 'lock') {
  if (role !== 'admin') fail('진행자만 오더를 확정할 수 있습니다.');
  if (n.format === 0) fail('경기 방식을 먼저 정해주세요.');
  if (n.format === 6) fail('6복은 자동 편성되므로 별도 오더 확정이 필요하지 않습니다.');
  if (typeof action.locked !== 'boolean') fail('잘못된 요청입니다.');
  if (action.locked && (!n.submitted.a || !n.submitted.b)) fail('양 팀 오더 제출 후 확정할 수 있습니다.');
  if (!action.locked && hasResults(n)) fail('결과를 모두 초기화한 후 오더를 수정할 수 있습니다.');
  n.locked = action.locked;
 } else if (action.type === 'result') {
  if (role !== 'admin') fail('진행자만 결과를 기록할 수 있습니다.');
  if (!n.locked) fail('먼저 양 팀 오더를 확정해주세요.');
  const g = n.games[action.index];
  if (!g || !Number.isInteger(action.index)) fail('경기를 찾을 수 없습니다.');
  if (action.clear) {Object.assign(g, {scoreA: '', scoreB: '', winner: ''}); return n;}
  const a = String(action.scoreA), b = String(action.scoreB);
  if (!/^\d{1,2}$/.test(a) || !/^\d{1,2}$/.test(b) || Number(a) === Number(b)) fail('0~99의 서로 다른 최종 게임 스코어를 입력해주세요.');
  Object.assign(g, {scoreA: String(Number(a)), scoreB: String(Number(b)), winner: Number(a) > Number(b) ? 'a' : 'b'});
 } else fail('지원하지 않는 요청입니다.');
 return n;
}

function latestEventRecords(records:EventRecord[]):EventRecord[] {
 const events=new Map<string,EventRecord>();
 for(const record of records)if(!events.has(record.id)||record.revision>=events.get(record.id)!.revision)events.set(record.id,record);
 return [...events.values()];
}
export function playerDirectory(records:EventRecord[]):PlayerRecord[] {
 const players=new Map<string,PlayerRecord>();
 const ordered=latestEventRecords(records).sort((l,r)=>l.event.date.localeCompare(r.event.date)||l.id.localeCompare(r.id));
 for(const record of ordered){
  const event=normalizeEvent(record.event,record.id);
  for(const side of sides)event.rosters[side].forEach((name,index)=>{
   const id=event.playerIds[side][index];if(!name.trim()||!id)return;
   const meta=event.playerMeta[side][index]||{gender:'',grade:''};
   players.set(id,{id,name,gender:meta.gender,grade:meta.grade,side,lastDate:event.date});
  });
 }
 return [...players.values()].sort((l,r)=>l.name.localeCompare(r.name,'ko')||l.id.localeCompare(r.id));
}
export function playerStandings(records:EventRecord[]):PlayerStanding[] {
 const standings=new Map(playerDirectory(records).map(player=>[player.id,{...player,events:0,played:0,wins:0,losses:0,gamesFor:0,gamesAgainst:0,winRate:null} as PlayerStanding]));
 const appearances=new Map<string,Set<string>>();
 for(const record of latestEventRecords(records)){
  const event=normalizeEvent(record.event,record.id);
  for(const game of event.games){
   if(!['a','b'].includes(game.winner)||!/^\d{1,2}$/.test(String(game.scoreA))||!/^\d{1,2}$/.test(String(game.scoreB)))continue;
   const scoreA=Number(game.scoreA),scoreB=Number(game.scoreB);
   if(scoreA===scoreB||game.winner!==(scoreA>scoreB?'a':'b'))continue;
   if(sides.some(side=>!Array.isArray(game[side])||game[side].length!==2||game[side].some(index=>!Number.isInteger(index)||index<0||index>3||!event.rosters[side][index]?.trim()||!event.playerIds[side][index])))continue;
   const ids=sides.flatMap(side=>game[side].map(index=>event.playerIds[side][index]));
   if(new Set(ids).size!==4)continue;
   for(const side of sides)for(const index of game[side]){
    const id=event.playerIds[side][index],player=standings.get(id)!;
    player.played++;if(game.winner===side)player.wins++;else player.losses++;
    player.gamesFor+=side==='a'?scoreA:scoreB;player.gamesAgainst+=side==='a'?scoreB:scoreA;
    if(!appearances.has(id))appearances.set(id,new Set());appearances.get(id)!.add(record.id);
   }
  }
 }
 for(const player of standings.values()){
  player.events=appearances.get(player.id)?.size??0;
  player.winRate=player.played?Math.round(player.wins/player.played*1000)/10:null;
 }
 return [...standings.values()];
}

