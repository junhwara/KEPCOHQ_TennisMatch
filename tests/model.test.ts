import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialEvent,applyChange,summary} from '../app/model.ts';
const roster=['선수1','선수2','선수3','선수4'];
const order=(side:string)=>({type:'order',side,roster,pairs:[[0,1],[2,3],[0,2]]});
test('team representatives can only submit their own team',()=>{assert.throws(()=>applyChange(initialEvent(),order('a'),'b'));assert.throws(()=>applyChange(initialEvent(),order('a'),'viewer'));assert.equal(applyChange(initialEvent(),order('a'),'a').submitted.a,true);});
test('duplicate player in a pair is rejected',()=>{const o=order('a');o.pairs[0]=[0,0];assert.throws(()=>applyChange(initialEvent(),o,'a'));});
test('both teams must submit before locking',()=>assert.throws(()=>applyChange(initialEvent(),{type:'lock',locked:true},'admin')));
function locked(){let e=applyChange(initialEvent(),order('a'),'a');e=applyChange(e,order('b'),'b');return applyChange(e,{type:'lock',locked:true},'admin');}
test('locked orders cannot change and captains cannot record results',()=>{assert.throws(()=>applyChange(locked(),order('a'),'a'));assert.throws(()=>applyChange(locked(),{type:'result',index:0,scoreA:6,scoreB:2},'a'));});
test('3 match winner, ties, score correction and reset',()=>{let e=locked();assert.throws(()=>applyChange(e,{type:'result',index:0,scoreA:6,scoreB:6},'admin'));e=applyChange(e,{type:'result',index:0,scoreA:6,scoreB:2},'admin');e=applyChange(e,{type:'result',index:1,scoreA:7,scoreB:5},'admin');assert.equal(summary(e).champion,'송변전');assert.throws(()=>applyChange(e,{type:'lock',locked:false},'admin'));e=applyChange(e,{type:'result',index:1,scoreA:3,scoreB:6},'admin');assert.equal(summary(e).champion,'');e=applyChange(e,{type:'result',index:0,clear:true},'admin');assert.equal(summary(e).a,0);});
test('changing match count requires resubmission and five games needs three wins',()=>{let e=applyChange(initialEvent(),order('a'),'a');e=applyChange(e,{type:'settings',value:{...e,format:5}},'admin');assert.equal(e.games.length,5);assert.equal(e.submitted.a,false);e.games[0].winner='b';e.games[1].winner='b';assert.equal(summary(e).champion,'');e.games[2].winner='b';assert.equal(summary(e).champion,'배전');});
