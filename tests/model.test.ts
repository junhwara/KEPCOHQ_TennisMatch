import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialEvent,applyChange,summary,normalizeEvent,generateSixGames,genderLabel,gradeLabel,newAnnouncement,playerDirectory,playerStandings} from '../app/model.ts';
import type {EventData,Side,PlayerMeta} from '../app/model.ts';
const roster=['선수1','선수2','선수3','선수4'];
const order=(side:string)=>({type:'order',side,roster,pairs:[[0,1],[2,3],[0,2]]});
test('team representatives can only submit their own team',()=>{assert.throws(()=>applyChange(initialEvent(),order('a'),'b'));assert.throws(()=>applyChange(initialEvent(),order('a'),'viewer'));assert.equal(applyChange(initialEvent(),order('a'),'a').submitted.a,true);});
test('duplicate player in a pair is rejected',()=>{const o=order('a');o.pairs[0]=[0,0];assert.throws(()=>applyChange(initialEvent(),o,'a'));});
test('both teams must submit before locking',()=>assert.throws(()=>applyChange(initialEvent(),{type:'lock',locked:true},'admin')));
function locked(){let e=applyChange(initialEvent(),order('a'),'a');e=applyChange(e,order('b'),'b');return applyChange(e,{type:'lock',locked:true},'admin');}
test('locked orders cannot change and captains cannot record results',()=>{assert.throws(()=>applyChange(locked(),order('a'),'a'));assert.throws(()=>applyChange(locked(),{type:'result',index:0,scoreA:6,scoreB:2},'a'));});
test('3 match winner, ties, score correction and reset',()=>{let e=locked();assert.throws(()=>applyChange(e,{type:'result',index:0,scoreA:6,scoreB:6},'admin'));e=applyChange(e,{type:'result',index:0,scoreA:6,scoreB:2},'admin');e=applyChange(e,{type:'result',index:1,scoreA:7,scoreB:5},'admin');assert.equal(summary(e).champion,'송변전');assert.throws(()=>applyChange(e,{type:'lock',locked:false},'admin'));e=applyChange(e,{type:'result',index:1,scoreA:3,scoreB:6},'admin');assert.equal(summary(e).champion,'');e=applyChange(e,{type:'result',index:0,clear:true},'admin');assert.equal(summary(e).a,0);});
test('changing match count requires resubmission and five games needs three wins',()=>{let e=applyChange(initialEvent(),order('a'),'a');e=applyChange(e,{type:'settings',value:{...e,format:5}},'admin');assert.equal(e.games.length,5);assert.equal(e.submitted.a,false);e.games[0].winner='b';e.games[1].winner='b';assert.equal(summary(e).champion,'');e.games[2].winner='b';assert.equal(summary(e).champion,'배전');});

function six() {
 const e=initialEvent({a:roster,b:roster.map(name=>'상대'+name)});
 return applyChange(e,{type:'settings',value:{...e,format:6,court:'1',secondaryCourt:'2',time:'18:00',roundTimes:['','18:40','19:20']}},'admin');
}
function result(e:EventData,index:number,scoreA:number,scoreB:number) {
 return applyChange(e,{type:'result',index,scoreA,scoreB},'admin');
}
const rosterAction=(e:EventData,side:Side,meta:PlayerMeta[]=e.playerMeta[side])=>({type:'roster',side,roster:e.rosters[side],playerMeta:meta});

test('six matches are ready without orders, with each round on two courts at the same time',()=>{
 const e=six();
 assert.equal(e.locked,true);
 assert.deepEqual(e.submitted,{a:true,b:true});
 assert.equal(e.games.length,6);
 assert.deepEqual(e.games.map(g=>[g.round,g.category,g.court,g.time]),[
  [1,'mixed','1','18:00'],[1,'mens','2','18:00'],
  [2,'mixed','1','18:40'],[2,'mens','2','18:40'],
  [3,'mixed','1','19:20'],[3,'mens','2','19:20'],
 ]);
 for(const side of ['a','b'] as Side[]){
  assert.deepEqual(e.games.filter(g=>g.category==='mixed').map(g=>g[side]),[[0,3],[1,3],[2,3]]);
  assert.deepEqual(e.games.filter(g=>g.category==='mens').map(g=>g[side]),[[1,2],[0,2],[0,1]]);
  for(let round=0;round<3;round++)assert.deepEqual([...e.games[round*2][side],...e.games[round*2+1][side]].sort(),[0,1,2,3]);
 }
 assert.equal(result(e,0,6,2).games[0].winner,'a');
 assert.throws(()=>applyChange(e,order('a'),'a'),/자동 편성/);
 assert.throws(()=>applyChange(e,{type:'lock',locked:false},'admin'),/자동 편성/);
});

function permutations(values:number[]):number[][] {
 return values.length===0?[[]]:values.flatMap((value,i)=>permutations(values.filter((_,j)=>j!==i)).map(tail=>[value,...tail]));
}
test('all 576 independent roster permutations pair equal grades and use every player exactly once per round',()=>{
 const original=six();
 const permutations4=permutations([0,1,2,3]);
 for(const pa of permutations4)for(const pb of permutations4){
  const e=structuredClone(original);
  for(const [side,positions] of [['a',pa],['b',pb]] as [Side,number[]][]){
   e.rosters[side]=positions.map(i=>original.rosters[side][i]);
   e.playerMeta[side]=positions.map(i=>original.playerMeta[side][i]);
  }
  const games=generateSixGames(e);
  for(const side of ['a','b'] as Side[]){
   for(let round=0;round<3;round++){
    const mixed=games[round*2],mens=games[round*2+1];
    assert.deepEqual([...mixed[side],...mens[side]].sort(),[0,1,2,3]);
    assert.equal(e.playerMeta[side][mixed[side][0]].grade,String(round+1));
    assert.equal(e.playerMeta[side][mixed[side][0]].gender,'male');
    assert.equal(e.playerMeta[side][mixed[side][1]].gender,'female');
    assert.ok(mens[side].every(i=>e.playerMeta[side][i].gender==='male'));
   }
   e.playerMeta[side].forEach((player,i)=>{
    assert.equal(games.filter(g=>g[side].includes(i)).length,3);
    assert.equal(games.filter(g=>g.category==='mixed'&&g[side].includes(i)).length,player.gender==='female'?3:1);
   });
  }
 }
});

test('six-match winner is decided only at completion, with wins taking priority over total games',()=>{
 let e=six();
 for(let i=0;i<4;i++)e=result(e,i,6,5);
 assert.equal(summary(e).champion,'');
 assert.equal(summary(e).decidedBy,'');
 e=result(e,4,0,6);
 assert.equal(summary(e).champion,'');
 e=result(e,5,0,6);
 assert.deepEqual(summary(e),{a:4,b:2,done:6,gamesA:24,gamesB:32,champion:'송변전',decidedBy:'wins'});
});

test('three wins each uses total games; equal totals draw; correction and clearing recalculate',()=>{
 let e=six();
 for(let i=0;i<6;i++)e=result(e,i,i<3?6:4,i<3?4:6);
 assert.deepEqual(summary(e),{a:3,b:3,done:6,gamesA:30,gamesB:30,champion:'무승부',decidedBy:'draw'});
 e=result(e,0,6,3);
 assert.equal(summary(e).champion,'송변전');
 assert.equal(summary(e).decidedBy,'games');
 e=result(e,0,6,5);
 assert.equal(summary(e).champion,'배전');
 assert.equal(summary(e).decidedBy,'games');
 e=applyChange(e,{type:'result',index:0,clear:true},'admin');
 assert.equal(summary(e).champion,'');
 assert.equal(summary(e).done,5);
 assert.equal(summary(e).gamesA,24);
 assert.equal(summary(e).gamesB,26);
});

test('score totals include completed matches only',()=>{
 const e=six();e.games[0].scoreA='99';e.games[0].scoreB='1';
 assert.equal(summary(e).gamesA,0);
 assert.equal(summary(e).gamesB,0);
});

test('legacy hydration preserves all orders, format and scores and fills index-based metadata',()=>{
 const current=result(locked(),0,6,3);
 const {playerMeta,secondaryCourt,roundTimes,...legacy}=current;
 const normalized=normalizeEvent(legacy);
 assert.equal(normalized.format,3);
 assert.equal(normalized.locked,true);
 assert.deepEqual(normalized.games,legacy.games);
 assert.deepEqual(normalized.rosters,legacy.rosters);
 assert.deepEqual(normalized.playerMeta.a,[{gender:'male',grade:'1'},{gender:'male',grade:'2'},{gender:'male',grade:'3'},{gender:'female',grade:'3'}]);
 assert.deepEqual(normalized.playerMeta.b,normalized.playerMeta.a);
 assert.equal(normalized.secondaryCourt,'');
 assert.deepEqual(normalized.roundTimes,['','','']);
 normalized.games[0].a[0]=3;
 assert.equal(legacy.games[0].a[0],0);
 assert.equal(genderLabel.female,'여자');
 assert.equal(gradeLabel['3'],'3직급·차장');
});

test('hydration preserves explicitly entered metadata including blank values',()=>{
 const e=six();e.playerMeta.a[0]={gender:'',grade:''};
 const normalized=normalizeEvent(e);
 assert.deepEqual(normalized.playerMeta.a[0],{gender:'',grade:''});
 assert.deepEqual(normalized.games,e.games);
});

test('roster edits follow role boundaries and reordered metadata regenerates the six fixtures',()=>{
 const e=six();
 const positions=[1,0,2,3];
 const action={type:'roster',side:'a',roster:positions.map(i=>e.rosters.a[i]),playerMeta:positions.map(i=>e.playerMeta.a[i])};
 assert.throws(()=>applyChange(e,action,'b'));
 assert.throws(()=>applyChange(e,action,'viewer'));
 assert.throws(()=>applyChange(e,action,'unknown'));
 for(const role of ['a','admin']){
  const changed=applyChange(e,action,role);
  assert.deepEqual(changed.games[0].a,[1,3]);
  assert.deepEqual(changed.games[2].a,[0,3]);
  assert.deepEqual(changed.games[0].b,[0,3]);
 }
 assert.deepEqual(e.games[0].a,[0,3]);
});

test('six requires one man at each grade and one woman with an entered grade',()=>{
 const e=six();
 const invalidMetas=[
  [{gender:'male',grade:'1'},{gender:'male',grade:'1'},{gender:'male',grade:'3'},{gender:'female',grade:'3'}],
  [{gender:'male',grade:'1'},{gender:'male',grade:'2'},{gender:'female',grade:'3'},{gender:'female',grade:'3'}],
  [{gender:'male',grade:'1'},{gender:'male',grade:'2'},{gender:'male',grade:'3'},{gender:'female',grade:''}],
  [{gender:'',grade:'1'},{gender:'male',grade:'2'},{gender:'male',grade:'3'},{gender:'female',grade:'3'}],
  [{gender:'other',grade:'1'},...e.playerMeta.a.slice(1)],
  e.playerMeta.a.slice(0,3),
 ];
 for(const meta of invalidMetas)assert.throws(()=>applyChange(e,{...rosterAction(e,'a'),playerMeta:meta},'admin'));
 for(const grade of ['1','2','3'] as const){
  const meta=structuredClone(e.playerMeta.a);meta[3].grade=grade;
  assert.equal(applyChange(e,rosterAction(e,'a',meta),'a').playerMeta.a[3].grade,grade);
 }
 assert.throws(()=>applyChange(e,{...rosterAction(e,'a'),roster:['동일','동일','셋','넷']},'a'));
});

test('recorded results protect names, metadata and format; settings retain results and pairs',()=>{
 const e=result(six(),0,6,2);
 assert.throws(()=>applyChange(e,{...rosterAction(e,'a'),roster:['변경',...e.rosters.a.slice(1)]},'admin'),/초기화/);
 const meta=structuredClone(e.playerMeta.a);meta[3].grade='2';
 assert.throws(()=>applyChange(e,rosterAction(e,'a',meta),'a'),/초기화/);
 assert.throws(()=>applyChange(e,{type:'settings',value:{...e,format:5}},'admin'),/초기화/);
 const changed=applyChange(e,{type:'settings',value:{...e,time:'19:00',roundTimes:['19:00','19:40','20:20'],court:'3',secondaryCourt:'4'}},'admin');
 assert.deepEqual(changed.games.map(g=>[g.a,g.b,g.scoreA,g.scoreB,g.winner]),e.games.map(g=>[g.a,g.b,g.scoreA,g.scoreB,g.winner]));
 assert.equal(changed.games[0].court,'3');assert.equal(changed.games[1].court,'4');
 assert.equal(changed.games[0].time,'19:00');
 assert.deepEqual(applyChange(e,rosterAction(e,'a'),'admin'),e);
 assert.throws(()=>result(e,-1,6,3));
 assert.throws(()=>result(e,1,6,6));
 assert.throws(()=>applyChange(e,{type:'result',index:1,scoreA:6,scoreB:3},'a'));
});

test('manual formats accept metadata and require fresh orders after roster or format changes',()=>{
 const e=applyChange(initialEvent(),order('a'),'a');
 const meta=structuredClone(e.playerMeta.a);meta[0]={gender:'',grade:''};
 const changed=applyChange(e,rosterAction(e,'a',meta),'admin');
 assert.equal(changed.submitted.a,false);
 assert.ok(changed.games.every(g=>g.a.length===0));
 const submitted=applyChange(changed,{...order('a'),playerMeta:meta},'a');
 assert.deepEqual(submitted.playerMeta.a[0],{gender:'',grade:''});
 assert.throws(()=>applyChange(locked(),{...rosterAction(locked(),'a'),roster:['변경',...roster.slice(1)]},'admin'),/확정/);
 const sixFromLocked=applyChange(locked(),{type:'settings',value:{...locked(),format:6}},'admin');
 assert.equal(sixFromLocked.games.length,6);
 const manual=applyChange(sixFromLocked,{type:'settings',value:{...sixFromLocked,format:5}},'admin');
 assert.equal(manual.locked,false);
 assert.deepEqual(manual.submitted,{a:false,b:false});
 assert.ok(manual.games.every(g=>g.a.length===0&&g.b.length===0));
});

test('courts and round times are validated, while unassigned courts are allowed',()=>{
 const e=six();
 for(const value of [
  {...e,secondaryCourt:'1'}, {...e,secondaryCourt:'7'},
  {...e,roundTimes:['24:00','','']}, {...e,roundTimes:['18:00']},
  {...e,roundTimes:['18:00',null,'']},
 ])assert.throws(()=>applyChange(e,{type:'settings',value},'admin'));
 assert.doesNotThrow(()=>applyChange(e,{type:'settings',value:{...e,court:'',secondaryCourt:'',roundTimes:['','','']}},'admin'));
 assert.throws(()=>applyChange(e,{type:'settings',value:e},'a'));
});
test('announcements contain no players, fixtures or false winner',()=>{
 const e=newAnnouncement({date:'2026-10-28'});
 assert.equal(e.format,0);assert.deepEqual(e.games,[]);assert.equal(summary(e).champion,'');
 assert.ok(e.rosters.a.concat(e.rosters.b).every(n=>!n));assert.ok(e.playerMeta.a.every(m=>!m.gender&&!m.grade));
 assert.deepEqual(playerStandings([{id:'next',event:e,revision:0}]),[]);
 assert.throws(()=>applyChange(e,order('a'),'a'));assert.throws(()=>applyChange(e,{type:'lock',locked:true},'admin'));
});
test('settings validate real dates and allow undecided format',()=>{
 const e=newAnnouncement({date:'2026-10-28'});
 for(const date of ['', '2026-02-29','2026-04-31','0000-01-01'])assert.throws(()=>applyChange(e,{type:'settings',value:{...e,date}},'admin'));
 assert.equal(applyChange(e,{type:'settings',value:{...e,date:'2028-02-29'}},'admin').date,'2028-02-29');
 assert.deepEqual(applyChange(six(),{type:'settings',value:{...six(),format:0}},'admin').games,[]);
});
test('six fixtures wait for both complete valid rosters',()=>{
 let e=newAnnouncement({date:'2026-10-28'});
 e=applyChange(e,{type:'settings',value:{...e,format:6}},'admin');
 e=applyChange(e,{type:'roster',side:'a',roster:['가','','',''],playerMeta:initialEvent().playerMeta.a},'a');
 assert.deepEqual(e.games,[]);assert.equal(e.locked,false);
 e=applyChange(e,{type:'roster',side:'a',roster,playerMeta:initialEvent().playerMeta.a},'a');assert.deepEqual(e.games,[]);
 e=applyChange(e,{type:'roster',side:'b',roster:roster.map(n=>'상대'+n),playerMeta:initialEvent().playerMeta.b},'b');
 assert.equal(e.games.length,6);assert.equal(e.locked,true);
 e=applyChange(e,{type:'roster',side:'b',roster:['','','',''],playerMeta:e.playerMeta.b},'b');
 assert.deepEqual(e.games,[]);assert.equal(e.locked,false);
});
test('legacy IDs are deterministic and event-scoped without changing scores',()=>{
 const {playerIds,...raw}=result(six(),0,6,3);
 const a=normalizeEvent(raw,'first'),b=normalizeEvent(raw,'other');
 assert.equal(a.playerIds.a[0],'legacy-first-a-0');assert.equal(b.playerIds.a[0],'legacy-other-a-0');
 assert.deepEqual(a.playerIds,normalizeEvent(raw,'first').playerIds);assert.deepEqual(a.games,raw.games);
});
test('legacy roster reorders preserve identity but explicit blanks create a new person',()=>{
 const e=six(),positions=[1,0,2,3];
 const changed=applyChange(e,{type:'roster',side:'a',roster:positions.map(i=>e.rosters.a[i]),playerMeta:positions.map(i=>e.playerMeta.a[i])},'a');
 assert.deepEqual(changed.playerIds.a,positions.map(i=>e.playerIds.a[i]));
 const newer=applyChange(e,{...rosterAction(e,'a'),playerIds:['',...e.playerIds.a.slice(1)]},'a');
 assert.notEqual(newer.playerIds.a[0],e.playerIds.a[0]);
 const scored=result(e,0,6,3);
 assert.throws(()=>applyChange(scored,{...rosterAction(scored,'a'),playerIds:['',...e.playerIds.a.slice(1)]},'admin'));
});
test('duplicate IDs are rejected within and across teams',()=>{
 const e=six();
 for(const id of [e.playerIds.a[1],e.playerIds.b[0]])assert.throws(()=>applyChange(e,{...rosterAction(e,'a'),playerIds:[id,...e.playerIds.a.slice(1)]},'admin'));
});
test('returning players accumulate by ID and score corrections and resets recalculate',()=>{
 const first=result(six(),0,6,3);let next=structuredClone(first);next.date='2026-10-28';next=result(next,0,4,6);
 const records=[{id:'first',event:first,revision:1},{id:'next',event:next,revision:1}];
 const get=()=>playerStandings(records).find(p=>p.id===first.playerIds.a[0])!;
 assert.deepEqual([get().events,get().played,get().wins,get().losses,get().gamesFor,get().gamesAgainst],[2,2,1,1,10,9]);
 records[1].event=result(next,0,6,2);assert.equal(get().wins,2);assert.equal(get().gamesFor,12);
 records[1].event=applyChange(next,{type:'result',index:0,clear:true},'admin');assert.equal(get().played,1);assert.equal(get().events,1);
 assert.equal(first.games[0].scoreA,'6');
});
test('directory preserves snapshots and separates same names with different identities',()=>{
 const first=six(),next=structuredClone(first);next.date='2026-10-28';next.playerMeta.a[0].grade='2';
 const other=normalizeEvent({...first,playerIds:undefined},'other');
 const records=[{id:'first',event:first,revision:0},{id:'next',event:next,revision:0},{id:'other',event:other,revision:0}];
 const people=playerDirectory(records);assert.equal(people.length,16);assert.equal(people.filter(p=>p.name===first.rosters.a[0]).length,2);
 assert.equal(people.find(p=>p.id===first.playerIds.a[0])!.grade,'2');assert.equal(first.playerMeta.a[0].grade,'1');
 assert.ok(playerStandings(records).every(p=>p.winRate===null));
});
test('stats ignore malformed and duplicate result snapshots',()=>{
 const e=result(six(),0,6,3),r={id:'first',event:e,revision:1};
 assert.equal(playerStandings([r,r]).find(p=>p.id===e.playerIds.a[0])!.played,1);
 for(const change of [{scoreA:''},{winner:'b'},{a:[0,0]},{b:[0]},{a:[0,8]}]){
  const event=structuredClone(e);Object.assign(event.games[0],change);
  assert.ok(playerStandings([{...r,event}]).every(p=>p.played===0));
 }
 const cleared=applyChange(e,{type:'result',index:0,clear:true},'admin');
 assert.ok(playerStandings([r,{...r,event:cleared,revision:2}]).every(p=>p.played===0));
});
test('manual orders require complete participants after a partial roster save',()=>{
 const e=applyChange(initialEvent(),{type:'roster',side:'a',roster:['한 명','','','']},'a');
 assert.throws(()=>applyChange(e,{...order('a'),roster:e.rosters.a},'a'));
});

