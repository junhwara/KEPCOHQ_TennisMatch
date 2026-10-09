export type Side = 'a' | 'b';
export type PlayerMeta = {gender: '' | 'male' | 'female'; grade: '' | '1' | '2' | '3'};
export type Game = {
 a: number[]; b: number[]; scoreA: string; scoreB: string; winner: '' | Side; court: string;
 category?: 'doubles' | 'mixed' | 'mens'; round?: number; time?: string;
};
export type EventData = {
 title: string; date: string; time: string; court: string; secondaryCourt: string; roundTimes: string[];
 reservation: string; format: 3 | 5 | 6; notice: string;
 rosters: {a: string[]; b: string[]}; playerMeta: {a: PlayerMeta[]; b: PlayerMeta[]};
 submitted: {a: boolean; b: boolean}; locked: boolean; games: Game[];
};
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
  playerMeta: {a: defaultMeta(), b: defaultMeta()}, submitted: {a: false, b: false}, locked: false,
  games: Array.from({length: 3}, newGame),
 };
}

// Old events keep their format, fixtures and scores; only newly introduced fields are filled.
export function normalizeEvent(raw: any): EventData {
 const defaults = initialEvent();
 const e: EventData = {...defaults, ...structuredClone(raw || {})};
 e.rosters = {a: [...(raw?.rosters?.a || defaults.rosters.a)], b: [...(raw?.rosters?.b || defaults.rosters.b)]};
 e.playerMeta = {
  a: structuredClone(raw?.playerMeta?.a ?? defaults.playerMeta.a),
  b: structuredClone(raw?.playerMeta?.b ?? defaults.playerMeta.b),
 };
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
 } else {
  const target = Math.floor(e.format / 2) + 1;
  champion = a >= target ? '송변전' : b >= target ? '배전' : '';
  if (champion) decidedBy = 'wins';
 }
 return {a, b, done: complete.length, gamesA, gamesB, champion, decidedBy};
}
function fail(message: string): never {throw Error(message);}
function hasResults(e: EventData) {return e.games.some(g => g.winner || g.scoreA !== '' || g.scoreB !== '');}
function validTime(value: any) {return typeof value === 'string' && (!value || /^([01]\d|2[0-3]):[0-5]\d$/.test(value));}
function validateRoster(roster: any): string[] {
 if (!Array.isArray(roster) || roster.length !== 4 || roster.some(x => typeof x !== 'string' || !x.trim() || x.length > 30)) fail('참가자 4명의 이름을 입력해주세요.');
 const names = roster.map((x: string) => x.trim());
 if (new Set(names).size !== 4) fail('동명이인은 이름 뒤에 구분자를 붙여주세요.');
 return names;
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
export function applyChange(e: EventData, action: any, role: string): EventData {
 const n = normalizeEvent(e);
 if (!['admin', 'a', 'b'].includes(role)) fail('입력 권한이 없습니다. 전용 관리 링크로 접속해주세요.');
 if (action.type === 'settings') {
  if (role !== 'admin') fail('진행자만 대회 정보를 변경할 수 있습니다.');
  const v = action.value;
  if (!v || ![3, 5, 6].includes(v.format) || typeof v.title !== 'string' || !v.title.trim() || v.title.length > 80) fail('대회명과 경기 수를 확인해주세요.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date) || Number.isNaN(Date.parse(v.date))) fail('날짜를 확인해주세요.');
  if (!validTime(v.time)) fail('시간을 확인해주세요.');
  const secondaryCourt = v.secondaryCourt ?? n.secondaryCourt;
  const roundTimes = v.roundTimes ?? n.roundTimes;
  if (!['', '1', '2', '3', '4', '5', '6'].includes(v.court) || !['', '1', '2', '3', '4', '5', '6'].includes(secondaryCourt) || !['미확인', '신청 중', '승인 완료'].includes(v.reservation)) fail('코트 정보를 확인해주세요.');
  if (!Array.isArray(roundTimes) || roundTimes.length !== 3 || roundTimes.some(t => !validTime(t))) fail('라운드별 시간은 24시간 형식으로 입력해주세요.');
  if (typeof v.notice !== 'string' || v.notice.length > 2000) fail('안내문은 2,000자 이내로 입력해주세요.');
  const changedFormat = v.format !== n.format;
  if (changedFormat && hasResults(n)) fail('결과를 모두 초기화한 후 경기 방식을 바꿀 수 있습니다.');
  Object.assign(n, {title: v.title.trim(), date: v.date, time: v.time, court: v.court, secondaryCourt, roundTimes: [...roundTimes], reservation: v.reservation, format: v.format, notice: v.notice});
  if (n.format === 6) {
   const fixtures = generateSixGames(n);
   n.games = changedFormat ? fixtures : fixtures.map((fixture, i) => ({...fixture, ...n.games[i], category: fixture.category, round: fixture.round, court: fixture.court, time: fixture.time}));
   n.locked = true;
   n.submitted = {a: true, b: true};
  } else if (changedFormat) {
   n.games = Array.from({length: n.format}, newGame);
   n.locked = false;
   n.submitted = {a: false, b: false};
  }
 } else if (action.type === 'roster') {
  const side: Side = action.side;
  if (!sides.includes(side) || (role !== 'admin' && role !== side)) fail('자기 팀의 대표 또는 진행자만 선수 정보를 수정할 수 있습니다.');
  const roster = validateRoster(action.roster);
  const meta = validateMeta(action.playerMeta ?? n.playerMeta[side]);
  if (JSON.stringify(roster) === JSON.stringify(n.rosters[side]) && JSON.stringify(meta) === JSON.stringify(n.playerMeta[side])) return n;
  if (hasResults(n)) fail('결과를 모두 초기화한 후 선수 정보를 수정할 수 있습니다.');
  if (n.format !== 6 && n.locked) fail('오더 확정을 해제한 후 선수 정보를 수정해주세요.');
  n.rosters[side] = roster;
  n.playerMeta[side] = meta;
  if (n.format === 6) {
   n.games = generateSixGames(n);
   n.locked = true;
   n.submitted = {a: true, b: true};
  } else {
   n.submitted[side] = false;
   n.games.forEach(g => {g[side] = [];});
  }
 } else if (action.type === 'order') {
  const side: Side = action.side;
  if (!sides.includes(side) || role !== side) fail('자기 팀의 대표만 오더를 제출할 수 있습니다.');
  if (n.format === 6) fail('6복은 성별과 직급으로 자동 편성되어 별도 오더 제출이 필요하지 않습니다.');
  if (n.locked || hasResults(n)) fail('오더가 확정되었습니다. 진행자에게 수정 요청해주세요.');
  const roster = validateRoster(action.roster);
  const meta = validateMeta(action.playerMeta ?? n.playerMeta[side]);
  const pairs = action.pairs;
  if (!Array.isArray(pairs) || pairs.length !== n.format || pairs.some((p: any) => !Array.isArray(p) || p.length !== 2 || p[0] === p[1] || p.some((x: any) => !Number.isInteger(x) || x < 0 || x > 3))) fail('매 경기 서로 다른 선수 2명을 선택해주세요.');
  n.rosters[side] = roster;
  n.playerMeta[side] = meta;
  n.games.forEach((g, i) => {g[side] = [...pairs[i]];});
  n.submitted[side] = true;
 } else if (action.type === 'lock') {
  if (role !== 'admin') fail('진행자만 오더를 확정할 수 있습니다.');
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
