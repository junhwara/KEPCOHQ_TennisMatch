'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, CalendarDays, Clock3, MapPin, ChevronRight, Check, Copy, Users, Trophy, Settings2, X, RefreshCw, LockKeyhole, Download, Flag, CircleDot, ClipboardList, Plus } from 'lucide-react';
import { type EventData, type EventRecord, type PlayerRecord, type PlayerStanding, type Side, type PlayerMeta, summary, genderLabel, gradeLabel, newAnnouncement } from './model';
const team = { a: '송변전', b: '배전' };
const sides: Side[] = ['a', 'b'];
type Collection = { events: EventRecord[]; players: PlayerRecord[]; standings: PlayerStanding[]; role: string; links?: { a: string; b: string } };
type Snapshot = { eventId: string; event: EventData; revision: number; role: string };
const koreanToday = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const displayDate = (date: string) => new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'long', timeZone: 'Asia/Seoul' }).format(new Date(date + 'T12:00:00+09:00'));
function eventStatus(event: EventData) {
 const result = summary(event);
 if (event.games.length > 0 && result.done === event.games.length) return '경기 종료';
 if (result.done > 0) return '결과 기록 중';
 if (event.date < koreanToday()) return '결과 미기록';
 if (!event.format || !event.games.length) return '대회 공지 · 준비 중';
 return event.locked ? '대진 확정 · 경기 예정' : '대진 준비 중';
}
function downloadCsv(rows: (string | number)[][], name: string) {
 const csv = rows.map(row => row.map(value => '"' + String(value).replace(/^[=+@-]/, "'").replaceAll('"', '""') + '"').join(',')).join('\r\n');
 const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
 const link = document.createElement('a'); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url);
}
export default function MatchApp() {
 const [collection, setCollection] = useState<Collection | null>(null);
 const [selectedId, setSelectedId] = useState('');
 const selectedRef = useRef('');
 const requestSequence = useRef(0);
 const createRequestId = useRef('');
 const [token, setToken] = useState('');
 const [tab, setTab] = useState('overview');
 const [error, setError] = useState('');
 const [toast, setToast] = useState('');
 const [busy, setBusy] = useState(false);
 const [modal, setModal] = useState('');
 const [edit, setEdit] = useState<EventData | null>(null);
 const [rosterSide, setRosterSide] = useState<Side>('a');
 const [score, setScore] = useState({ index: 0, a: '', b: '' });
 const [copiedLink, setCopiedLink] = useState('');
 const snapshot = collection?.events.find(item => item.id === selectedId);
 const e = snapshot?.event;
 const role = collection?.role || 'viewer';
 const s = e ? summary(e) : null;
 const isSix = e?.format === 6;
 const isManual = e?.format === 3 || e?.format === 5;
 const isCaptain = role === 'a' || role === 'b';
 const hasResults = !!e?.games.some(g => g.winner);
 const hasFixtures = !!e?.games.length;
 const pending = !e?.format || !hasFixtures;
 const standings = collection?.standings || [];
 function selectEvent(id: string, changeTab = true) {
  selectedRef.current = id; setSelectedId(id); if (changeTab) setTab('overview');
  const url = new URL(location.href); url.searchParams.set('event', id);
  history.replaceState(null, '', url.pathname + url.search + url.hash); setError('');
 }
 async function load(key = token) {
  const sequence = ++requestSequence.current;
  try {
   const r = await fetch('/api/events', { headers: key ? { Authorization: 'Bearer ' + key } : {}, cache: 'no-store' });
   const d = await r.json() as Collection & { error: string };
   if (!r.ok) throw Error(d.error); if (sequence !== requestSequence.current) return;
   setCollection(d);
   if (!d.events.some(item => item.id === selectedRef.current)) {
    const today = koreanToday();
    const future = d.events.filter(item => item.event.date >= today).sort((a, b) => a.event.date.localeCompare(b.event.date));
    const latest = [...d.events].sort((a, b) => b.event.date.localeCompare(a.event.date));
    const fallback = future[0] || latest[0]; if (fallback) selectEvent(fallback.id, false);
   }
   setError('');
  } catch (err) { if (sequence === requestSequence.current) setError((err as Error).message || '연결을 확인해주세요.'); }
 }
 useEffect(() => {
  const key = new URLSearchParams(location.hash.slice(1)).get('key') || '';
  const id = new URLSearchParams(location.search).get('event') || '';
  selectedRef.current = id; setSelectedId(id); setToken(key); load(key);
  return () => { requestSequence.current++; };
 }, []);
 useEffect(() => { if (modal || busy) return; const id = setInterval(() => load(token), 30000); return () => clearInterval(id); }, [token, modal, busy]);
 useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(''), 3500); return () => clearTimeout(id); }, [toast]);
 useEffect(() => {
  if (!modal) return;
  function close(ev: KeyboardEvent) { if (ev.key === 'Escape' && !busy) { setModal(''); setError(''); } }
  document.addEventListener('keydown', close); const previous = document.activeElement as HTMLElement;
  const timer = setTimeout(() => document.querySelector<HTMLButtonElement>('.dialog .close')?.focus(), 0);
  return () => { clearTimeout(timer); document.removeEventListener('keydown', close); previous?.focus(); };
 }, [modal, busy]);
 async function save(action: unknown) {
  if (!snapshot || busy) return; setBusy(true); setError(''); requestSequence.current++; const targetId = snapshot.id;
  try {
   const r = await fetch('/api/event', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ ...(action as object), eventId: targetId, revision: snapshot.revision }) });
   const d = await r.json() as Snapshot & { error: string }; if (!r.ok) throw Error(d.error);
   setCollection(old => old ? { ...old, events: old.events.map(item => item.id === targetId ? { id: targetId, event: d.event, revision: d.revision } : item) } : old);
   setModal(''); setToast('변경 내용을 저장했습니다.'); await load(token);
  } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
 }
 async function createEvent() {
  if (!edit || busy) return; setBusy(true); setError(''); requestSequence.current++;
  try {
   const r = await fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ type: 'create', requestId: createRequestId.current, value: edit }) });
   const d = await r.json() as Snapshot & { error: string }; if (!r.ok) throw Error(d.error);
   selectEvent(d.eventId); setModal(''); setToast('새 대회 공지를 등록했습니다.'); await load(token);
  } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
 }
 function open(kind: string, side?: Side) {
  requestSequence.current++;
  if (kind === 'create') { createRequestId.current = crypto.randomUUID(); setEdit(newAnnouncement({ date: '', title: '송변전 × 배전 친선 대항전', notice: '다음 친선 대항전을 진행할 예정입니다. 참가 선수와 경기 방식, 대진 및 시작 시간은 확정 후 안내하겠습니다.' })); }
  else { if (!e) return; if (side) setRosterSide(side); else if (isCaptain) setRosterSide(role as Side); setEdit(structuredClone(e)); }
  setError(''); setModal(kind);
 }
 function publicLink(id = selectedId) { return location.origin + '/?event=' + encodeURIComponent(id); }
 async function copy(text: string) { try { await navigator.clipboard.writeText(text); setToast('링크를 복사했습니다.'); } catch { setCopiedLink(text); } }
 function pair(side: Side, index: number) { const players = e!.games[index][side]; return players.length === 2 ? players.map(n => e!.rosters[side][n] || '선수 미정').join(' · ') : e!.submitted[side] ? '확정 후 공개' : '오더 제출 대기'; }
 function playerDetails(meta: PlayerMeta) { return genderLabel[meta.gender] + ' · ' + gradeLabel[meta.grade]; }
 function exportResults() {
  if (!e) return; const pairWithMeta = (side: Side, index: number) => e.games[index][side].map(n => e.rosters[side][n] + ' (' + playerDetails(e.playerMeta[side][n]) + ')').join(' / ');
  downloadCsv([['대회', '날짜', '경기', '라운드', '종목', '코트', '시작 시간', '송변전 선수 (성별·직급)', '배전 선수 (성별·직급)', '송변전 게임수', '배전 게임수', '승리팀'], ...e.games.map((g, i) => [e.title, e.date, i + 1, g.round || '', g.category === 'mixed' ? '혼합복식' : g.category === 'mens' ? '남자복식' : '복식', g.court || e.court, g.time || '', pairWithMeta('a', i), pairWithMeta('b', i), g.scoreA, g.scoreB, g.winner ? team[g.winner] : '미기록'])], '대항전-' + e.date + '.csv');
 }
 function exportStandings() { downloadCsv([['선수', '최근 참가팀', '성별', '직급', '기록 대회', '경기', '승', '패', '승률 (%)', '획득 게임', '허용 게임'], ...standings.map(p => [p.name, team[p.side], genderLabel[p.gender], gradeLabel[p.grade], p.events, p.played, p.wins, p.losses, p.winRate === null ? '' : p.winRate.toFixed(1), p.gamesFor, p.gamesAgainst])], '선수별-누적성적.csv'); }
 function updatePlayer(side: Side, index: number, field: 'name' | 'gender' | 'grade', value: string) {
  if (!edit) return; const next = structuredClone(edit);
  if (field === 'name') next.rosters[side][index] = value; else if (field === 'gender') next.playerMeta[side][index].gender = value as PlayerMeta['gender']; else next.playerMeta[side][index].grade = value as PlayerMeta['grade']; setEdit(next);
 }
 function choosePlayer(side: Side, index: number, id: string) {
  if (!edit) return; const next = structuredClone(edit), person = collection?.players.find(p => p.id === id);
  next.playerIds[side][index] = person?.id || ''; next.rosters[side][index] = person?.name || '';
  next.playerMeta[side][index] = { gender: person?.gender || '', grade: person?.grade || '' }; setEdit(next);
 }
 function rosterFields(side: Side) {
  if (!edit) return null;
  return <div className="player-fields">{edit.rosters[side].map((name, i) => <fieldset className="player-field" key={i}><legend>선수 {i + 1}</legend>
   <label className="player-choice">기존 선수 선택<select aria-label={team[side] + ' 선수 ' + (i + 1) + ' 기존 선수 선택'} value={edit.playerIds[side][i] || ''} onChange={ev => choosePlayer(side, i, ev.target.value)}><option value="">새 선수 직접 입력 / 미정</option>{collection?.players.map(p => <option key={p.id} value={p.id} disabled={edit.playerIds.a.concat(edit.playerIds.b).includes(p.id) && edit.playerIds[side][i] !== p.id}>{p.name} · {team[p.side]} · {gradeLabel[p.grade]}</option>)}</select></label>
   <label>이름<input readOnly={!!edit.playerIds[side][i]} placeholder="미정이면 비워두세요" maxLength={30} aria-label={team[side] + ' 선수 ' + (i + 1) + ' 이름'} value={name} onChange={ev => updatePlayer(side, i, 'name', ev.target.value)} /></label>
   <label>성별<select aria-label={team[side] + ' 선수 ' + (i + 1) + ' 성별'} value={edit.playerMeta[side][i].gender} onChange={ev => updatePlayer(side, i, 'gender', ev.target.value)}><option value="">미입력</option><option value="male">남자</option><option value="female">여자</option></select></label>
   <label>직급<select aria-label={team[side] + ' 선수 ' + (i + 1) + ' 직급'} value={edit.playerMeta[side][i].grade} onChange={ev => updatePlayer(side, i, 'grade', ev.target.value)}><option value="">미입력</option><option value="1">1직급 · 처장</option><option value="2">2직급 · 부장</option><option value="3">3직급 · 차장</option></select></label>
  </fieldset>)}</div>;
 }
 function resultControl(index: number) { if (!e) return null; const g = e.games[index]; return role === 'admin' ? <button className="result-button" disabled={!e.locked} onClick={() => { setScore({ index, a: g.scoreA, b: g.scoreB }); open('result'); }}>{g.winner ? '결과 수정' : '결과 입력'}</button> : <span className={'status ' + (g.winner ? 'complete' : '')}>{g.winner ? '종료' : '미기록'}</span>; }
 const dateText = e ? displayDate(e.date) : '';
 const championText = s?.decidedBy === 'draw' ? '무승부' : s?.champion;
 const editableRoster = !hasResults && (isSix || !e?.locked);
 const orderedEvents = [...(collection?.events || [])].sort((a, b) => { const today = koreanToday(), futureA = a.event.date >= today, futureB = b.event.date >= today; return futureA !== futureB ? futureA ? -1 : 1 : futureA ? a.event.date.localeCompare(b.event.date) : b.event.date.localeCompare(a.event.date); });

  return <div className="app-shell">
    <aside className="sidebar">
      <button className="brand" onClick={() => setTab('overview')} aria-label="코트사이드 홈"><span className="brandmark">◉</span><span>코트사이드<small>KEPCO TENNIS CLUB</small></span></button>
      <div className="side-caption">CLUB HOUSE</div>
      <nav>
        <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}><CircleDot size={19} />대항전 홈<ChevronRight size={16} /></button>
        <button className={tab === 'matches' ? 'active' : ''} onClick={() => setTab('matches')}><ClipboardList size={19} />경기 일정·결과</button>
        <button className={tab === 'teams' ? 'active' : ''} onClick={() => setTab('teams')}><Users size={19} />참가 팀</button><button className={tab === 'standings' ? 'active' : ''} onClick={() => setTab('standings')}><Trophy size={19} />누적 성적</button>
      </nav>
      <div className="side-note"><div className="tiny-court"><i /><i /></div><strong>함께 치고, 함께 기록하는<br />우리의 테니스.</strong><p>한전 본사 테니스 코트</p></div>
      <div className="sidebar-bottom"><span className="avatar">K</span><div>한전 본사 테니스<small>함께 쌓아가는 경기 기록</small></div></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><span>클럽하우스 <ChevronRight size={14} /><b>송변전 × 배전</b></span><div><span className="role-pill"><span />{role === 'admin' ? '진행자' : isCaptain ? team[role as Side] + ' 대표' : '공개 열람'}</span><button className="icon-button" aria-label="새로고침" onClick={() => load()}><RefreshCw size={17} /></button></div></header>
      <main>{!e ? <div className="loading"><CircleDot size={40} /><h1>코트에서 만나요.</h1><p>{error || '대회 정보를 불러오고 있습니다.'}</p><button onClick={() => load()}>다시 불러오기</button></div> : <>
        <div className="page-heading"><div><p className="eyebrow">KEPCO HQ · TENNIS CLUB</p><h1>{tab === 'standings' ? '함께 쌓아가는 기록' : tab === 'teams' ? '함께 뛰는 사람들' : tab === 'matches' ? '한 경기씩, 함께 기록해요.' : '다음 만남도, 코트에서.'}</h1><p className="subheading">{tab === 'standings' ? '모든 대회의 기록된 경기 결과를 선수별로 모았습니다.' : tab === 'overview' ? '다음 대회를 준비하고, 지난 경기의 순간을 함께 남겨요.' : tab === 'teams' ? '참가 선수와 정보를 확인하세요. 미정인 자리는 추후 안내합니다.' : '경기 편성과 마지막 포인트까지, 이곳에서 확인하세요.'}</p></div><button className="button secondary" aria-label="대회 링크 복사" onClick={() => copy(publicLink())}><Copy size={16} />대회 링크 복사</button></div>
        {error && !modal && <div className="alert" role="alert">{error}<button onClick={() => load()}>새로고침</button></div>}


<div className="event-toolbar"><label>대회 선택<select aria-label="대회 선택" value={selectedId} disabled={busy || !!modal} onChange={ev => selectEvent(ev.target.value, false)}>{orderedEvents.map(item => <option key={item.id} value={item.id}>{item.event.date} · {item.event.title}</option>)}</select></label>{role === 'admin' && <button className="button primary" onClick={() => open('create')}><Plus size={16} />새 대회 공지</button>}</div>
{tab === 'standings' && <section className="panel standings-panel"><div className="section-heading"><div><h2>선수별 누적 성적</h2><p>결과가 기록된 복식 경기만 집계합니다. 결과를 수정하면 누적 성적에도 반영됩니다.</p></div><button className="text-button" disabled={!standings.length} onClick={exportStandings}><Download size={15} />성적 저장</button></div>{standings.some(p => p.played > 0) ? <><div className="standings-scroll" tabIndex={0} role="region" aria-label="선수별 누적 성적 표"><table><thead><tr><th scope="col">선수</th><th scope="col">대회</th><th scope="col">경기</th><th scope="col">승</th><th scope="col">패</th><th scope="col">승률</th><th scope="col">획득 / 허용 게임</th></tr></thead><tbody>{standings.map(p => <tr key={p.id}><th scope="row"><strong>{p.name}</strong><small>{team[p.side]} · {genderLabel[p.gender]} · {gradeLabel[p.grade]}</small></th><td>{p.events}</td><td>{p.played}</td><td>{p.wins}</td><td>{p.losses}</td><td>{p.winRate === null ? '—' : p.winRate.toFixed(1) + '%'}</td><td>{p.gamesFor} / {p.gamesAgainst}</td></tr>)}</tbody></table></div><p className="standings-note">대회 수는 기록된 경기에 출전한 대회 수입니다. 복식 결과는 출전 선수 두 명에게 각각 반영하며, 선수 정보는 최근 참가 기록 기준입니다.</p></> : <div className="empty-state"><Trophy size={29} /><h3>첫 경기 기록을 기다리고 있어요.</h3><p>진행자가 경기 결과를 입력하면<br />이곳에 선수별 승패와 게임수가 쌓입니다.</p></div>}</section>}
        {tab !== 'standings' && <>
        {tab === 'overview' && <section className="hero">
          <div className="hero-copy"><span className="hero-tag"><span />{eventStatus(e)}</span><p className="hero-kicker">KEPCO HQ · FRIENDLY DOUBLES</p><h2>{e.title}</h2><p>업무의 동료가, 코트 위의 파트너로.</p><button className="button lime" onClick={() => { setTab('matches'); if (isCaptain && isManual && !e.locked) open('order'); }}>{isCaptain && isManual && !e.locked ? '우리 팀 오더 제출' : pending ? '대회 준비 현황' : '경기 편성 확인'}<ArrowUpRight size={18} /></button></div>
          <div className="court-art" aria-hidden="true"><div className="court-plane"><div className="doubles-line" /><div className="service-top" /><div className="service-bottom" /><div className="net" /><div className="center-service" /></div><div className="tennis-ball" /><span className="court-label">SAME COURT.<br />ONE TEAM SPIRIT.</span></div>
          <div className="hero-bottom"><span><CalendarDays size={16} />{dateText}</span><span><Clock3 size={16} />{e.time || '시간 미정'} <small>KST</small></span><span><MapPin size={16} />본사 테니스장{isSix ? ` · ${e.court || '?'}·${e.secondaryCourt || '?'}번 코트` : e.court ? ` · ${e.court}번 코트` : ''}</span></div>
        </section>}

        <section className="announcement-note"><div><span className="announcement-label"><Flag size={14} />대회 공지</span><h2>{dateText} 대회 안내</h2><p>{e.notice || '세부 안내를 준비 중입니다. 일정 변경 시 이곳에 공지합니다.'}</p></div>{role === 'admin' && <button className="text-button" onClick={() => open('settings')}><Settings2 size={15} />공지 수정</button>}</section><div className="stats-row">
          <div><span className="stat-icon"><Users size={19} /></span><div><small>참가 선수</small><strong>{e.rosters.a.concat(e.rosters.b).filter(n => n.trim()).length}<em>명 · 2개 팀</em></strong></div></div>
          <div><span className="stat-icon"><CircleDot size={19} /></span><div><small>대회 방식</small><strong>{!e.format ? '미정' : isSix ? '6복' : `복식 ${e.format}`}<em>{!e.format ? '추후 안내' : isSix ? '3라운드 · 2코트' : '경기'}</em></strong></div></div>
          <div><span className="stat-icon"><Trophy size={19} /></span><div><small>{championText ? '최종 결과' : '팀 승수'}</small><strong>{pending ? '준비 중' : championText || `${s!.a} : ${s!.b}`}<em>{pending ? '결과 기록 전' : championText ? `${s!.a} : ${s!.b}` : '송변전 · 배전'}</em></strong></div></div>
          <div><span className="stat-icon"><Flag size={19} /></span><div><small>진행 현황</small><strong>{pending ? '미정' : s!.done}<em>{pending ? '대진 확정 전' : `/ ${e.format} 경기 완료`}</em></strong></div></div>
        </div>

        <div className="content-grid"><div className="main-column">
          {tab !== 'teams' && <section className="panel match-panel">
            <div className="section-heading"><div><h2>경기 일정 & 결과 {!!e.format && <span className="count">{e.format}</span>}</h2><p>{pending ? '일정은 먼저 공지하고, 참가자와 대진은 확정 후 안내합니다.' : isSix ? '각 라운드에 혼합복식과 남자복식을 두 코트에서 동시에 진행합니다.' : e.locked ? '확정된 오더입니다. 최종 게임 스코어와 승패를 기록합니다.' : '양 팀 오더는 진행자 확정 후 함께 공개됩니다.'}</p></div>{isManual && isCaptain && <button disabled={e.locked} className="text-button" onClick={() => open('order')}>{e.submitted[role as Side] ? '오더 수정' : '오더 제출'}<ChevronRight size={16} /></button>}{isManual && role === 'admin' && <button className="text-button" onClick={() => open('lock')}><LockKeyhole size={15} />{e.locked ? '확정 해제' : '오더 확정'}</button>}</div>
            {pending ? <div className="empty-state"><CalendarDays size={30} /><h3>참가 선수와 대진을 준비하고 있어요.</h3><p>{e.format === 6 ? '양 팀 선수 구성이 완료되면 6복 대진이 자동으로 표시됩니다.' : '경기 방식과 대진이 정해지면 이곳에서 확인할 수 있습니다.'}</p>{role === 'admin' && <button className="button secondary" onClick={() => open('settings')}>대회 정보 설정</button>}</div> : isSix ? <>
              <div className="auto-format-note"><Check size={16} /><span><strong>오더 제출 없이 자동 편성</strong>1·2·3직급 남자 선수가 차례로 여자 선수와 혼합복식을 치르고, 나머지 두 남자 선수가 남자복식을 치릅니다.</span></div>
              <div className="competition-score" aria-label="팀별 종합 결과">
                <div className="competition-score-heading"><strong>{championText ? championText === '무승부' ? '이번 대항전은 무승부입니다.' : `${championText}팀 승리` : s!.done ? '대항전 진행 중' : '첫 경기를 기다리고 있어요.'}</strong><span>{s!.done} / 6 경기 완료</span></div>
                <div className="score-totals"><span className="score-team-name">송변전</span><span className="score-total-label">팀 집계</span><span className="score-team-name">배전</span><b>{s!.a}</b><span>승수</span><b>{s!.b}</b><strong>{s!.gamesA}</strong><span>합산 게임수</span><strong>{s!.gamesB}</strong></div>
                <p>{s!.done < 6 ? '6경기 종료 후 승수 → 합산 게임수 순서로 최종 승패를 가립니다.' : s!.decidedBy === 'draw' ? '승수와 합산 게임수가 모두 같아 무승부로 종료되었습니다.' : s!.decidedBy === 'games' ? '승수는 같고, 합산 게임수가 더 많은 팀이 승리했습니다.' : '승수가 더 많은 팀이 승리했습니다.'}</p>
              </div>
              <div className="round-list">{[1, 2, 3].map(round => <section className="round-block" key={round} aria-label={`${round}라운드`}>
                <div className="round-heading"><div><span className="round-number">0{round}</span><div><h3>{round}라운드</h3><p>{round}직급 남자 + 여자 혼합복식</p></div></div><span><Clock3 size={13} />{e.roundTimes[round - 1] || (round === 1 && e.time) || '시간 미정'}</span></div>
                <div className="round-games">{e.games.map((g, index) => ({ g, index })).filter(({ g, index }) => (g.round || Math.floor(index / 2) + 1) === round).map(({ g, index }) => <article className={'court-match ' + (g.winner ? 'finished' : '')} key={index}>
                  <div className="court-match-heading"><span className={'category-pill ' + (g.category === 'mixed' ? 'mixed' : 'mens')}>{g.category === 'mixed' ? '혼합복식' : '남자복식'}</span><span><MapPin size={12} />{g.court ? `${g.court}번 코트` : '코트 미정'}</span></div>
                  <div className="court-match-sides"><div className={g.winner === 'a' ? 'winner' : ''}><span>송변전{g.winner === 'a' && <i className="win">W</i>}</span><strong>{pair('a', index)}</strong></div><div className="score-display">{g.winner ? <><b>{g.scoreA}</b><span>:</span><b>{g.scoreB}</b></> : <span className="vs">VS</span>}</div><div className={g.winner === 'b' ? 'winner' : ''}><span>배전{g.winner === 'b' && <i className="win">W</i>}</span><strong>{pair('b', index)}</strong></div></div>
                  <div className="court-match-footer"><span>{index + 1}경기{g.winner ? ` · ${team[g.winner]} 승` : ' · 경기 예정'}</span>{resultControl(index)}</div>
                </article>)}</div>
              </section>)}</div>
            </> : <>
              <div className="table-head"><span>경기</span><span>송변전</span><span>스코어</span><span>배전</span><span>상태</span></div>
              {e.games.map((g, i) => <div className={'match-row ' + (g.winner ? 'finished' : '')} key={i}><div className="match-number"><span>{String(i + 1).padStart(2, '0')}</span><small>복식</small></div><div className={g.winner === 'a' ? 'winner' : ''}>{pair('a', i)}{g.winner === 'a' && <span className="win">W</span>}</div><div className="score-display">{g.winner ? <><b>{g.scoreA}</b><span>:</span><b>{g.scoreB}</b></> : <span className="vs">VS</span>}</div><div className={g.winner === 'b' ? 'winner' : ''}>{pair('b', i)}{g.winner === 'b' && <span className="win">W</span>}</div><div>{resultControl(i)}</div></div>)}
            </>}
            <div className="panel-footer"><span><CircleDot size={14} />{pending ? '확정되는 내용을 순차적으로 안내합니다.' : isSix ? '승수 동률이면 합산 게임수 비교 · 모두 같으면 무승부' : `${Math.floor(e.format / 2) + 1}승을 먼저 거두는 팀이 대항전에서 승리합니다.`}</span><button className="text-button" disabled={!hasFixtures} onClick={exportResults}><Download size={15} />결과 저장</button></div>
          </section>}

          <section className="teams-section"><div className="section-heading"><div><h2>이번 대회의 두 팀</h2><p>파트너와 호흡을 맞추고, 서로를 위한 경기를.</p></div><span className="small-label">4 PLAYERS EACH</span></div><div className="team-grid">{sides.map(side => <div className={'team-card team-' + side} key={side}>
            <div className="team-top"><span className="team-emblem">{side === 'a' ? '송' : '배'}</span><div><small>{side === 'a' ? 'TRANSMISSION' : 'DISTRIBUTION'}</small><h3>{team[side]}팀</h3></div><span className={'submission ' + ((isSix && hasFixtures) || e.submitted[side] ? 'submitted' : '')}>{pending ? '선수 구성 중' : isSix ? <><Check size={12} />자동 편성</> : e.submitted[side] ? <><Check size={12} />제출 완료</> : '오더 대기'}</span></div>
            <div className="roster">{e.rosters[side].map((name, i) => <div key={i}><span className="player-avatar">{name ? name.slice(0, 1) : '?'}</span><div className="player-info"><span>{name || '참가 미정'}</span><span className="player-details">{name ? playerDetails(e.playerMeta[side][i]) : '확정 후 안내'}</span></div><small>{String(i + 1).padStart(2, '0')}</small></div>)}</div>
            {(role === 'admin' || role === side) && <button className="team-edit" disabled={!editableRoster} onClick={() => open('roster', side)}>{hasResults ? '경기 시작 후 선수 정보 고정' : !editableRoster ? '오더 확정 후 선수 정보 고정' : '이름·성별·직급 수정'}<ArrowUpRight size={15} /></button>}
            {isManual && role === side && <button className="team-edit" disabled={e.locked} onClick={() => open('order', side)}>선수 및 오더 {e.locked ? '확정됨' : '입력'}<ArrowUpRight size={15} /></button>}
          </div>)}</div></section>
        </div><aside className="detail-column">
          <section className="panel details"><div className="section-heading"><h2>대회 안내</h2>{role === 'admin' && <button className="icon-button" aria-label="대회 설정" onClick={() => open('settings')}><Settings2 size={18} /></button>}</div><h3>{e.title}</h3><dl>
            <div><dt><CalendarDays size={16} />일정</dt><dd>{dateText}<small>{e.time || '시작 시간 미정'} · 한국 시간</small></dd></div>
            <div><dt><MapPin size={16} />장소</dt><dd>한전 본사 테니스장{isSix ? <><small>혼합복식 · {e.court ? `${e.court}번 코트` : '미정'}</small><small>남자복식 · {e.secondaryCourt ? `${e.secondaryCourt}번 코트` : '미정'}</small></> : <small>{e.court ? e.court + '번 코트' : '사용 코트 미정'}</small>}</dd></div>
            <div><dt><Check size={16} />코트 예약</dt><dd><span className={'reservation ' + (e.reservation === '승인 완료' ? 'approved' : '')}>{e.reservation}</span></dd></div>
          </dl><div className="notice"><p>진행자 안내</p><div>{e.notice || '등록된 안내가 없습니다.'}</div></div><p className="reservation-note">코트 예약과 승인은 기존 사내 시스템에서 별도로 진행해주세요.</p></section>
          <section className="checklist"><h3>경기 전, 이렇게 준비해요.</h3>{(!e.format ? [['01', '대회 일정 공지', '일정과 안내 내용을 먼저 공유해요.'], ['02', '참가자와 방식 결정', '지난 선수 기록을 이어서 등록해요.'], ['03', '대진과 결과 기록', '경기 결과가 누적 성적에 반영돼요.']] : isSix ? [['01', '선수 정보 확인', '남자 직급별 1명과 여자 1명을 확인해요.'], ['02', '자동 편성 확인', '3라운드, 두 코트의 파트너를 확인해요.'], ['03', '진행자가 결과 기록', '6경기의 승수와 게임수를 합산해요.']] : [['01', '참가 선수 확인', '팀원 4명의 정보를 확인해요.'], ['02', '대표가 오더 제출', '경기마다 복식 파트너를 정해요.'], ['03', '진행자가 확정·기록', '함께 응원하고 결과를 남겨요.']]).map(x => <div key={x[0]}><span>{x[0]}</span><div><strong>{x[1]}</strong><p>{x[2]}</p></div></div>)}</section>
          {role === 'admin' && <section className="panel manage-links"><h3>팀 대표 초대</h3><p>각 팀 대표에게 해당 팀의 링크를 전달해주세요.{isSix ? ' 대표는 경기 시작 전 선수 정보를 수정할 수 있습니다.' : ''}</p>{sides.map(side => <button key={side} className="button secondary" onClick={() => collection?.links && copy(publicLink() + '#key=' + collection.links[side])}><Copy size={14} />{team[side]} 대표 링크</button>)}</section>}
        </aside></div>
        </>}
{tab === 'overview' && <section className="event-archive"><div className="section-heading"><div><h2>우리의 대회 기록</h2><p>새 공지와 지난 대회를 한곳에서 확인하세요. 지난 기록은 계속 보관됩니다.</p></div><span className="count">{orderedEvents.length}</span></div><div className="event-list">{orderedEvents.map(item => {
 const totals = summary(item.event), active = item.id === selectedId;
 return <button className={'event-card ' + (active ? 'selected' : '')} key={item.id} onClick={() => { selectEvent(item.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><span className="event-date"><b>{item.event.date.slice(5).replace('-', '.')}</b><small>{item.event.date.slice(0, 4)}</small></span><span className="event-card-copy"><small>{eventStatus(item.event)}{active ? ' · 현재 선택' : ''}</small><strong>{item.event.title}</strong><span>{totals.done ? '송변전 ' + totals.a + ' : ' + totals.b + ' 배전 · ' + totals.done + '경기 기록' + (totals.champion ? ' · ' + (totals.champion === '무승부' ? '무승부' : totals.champion + ' 승') : '') : item.event.time ? item.event.time + ' · 한국 시간' : '시작 시간 미정'}</span></span><ChevronRight size={18} /></button>;
})}</div></section>}
        <footer><span>◉ 코트사이드 <small>KEPCO HQ TENNIS</small></span><p>좋은 경기, 함께 만드는 곳.</p></footer>
      </>}</main>
    </div>

    {toast && <div className="toast" role="status"><Check size={17} />{toast}</div>}
    {copiedLink && <div className="copy-fallback"><label>아래 링크를 직접 복사해주세요.<input readOnly value={copiedLink} onFocus={ev => ev.target.select()} /></label><button onClick={() => setCopiedLink('')}>닫기</button></div>}
    {modal && e && edit && <div className="modal-overlay" onClick={ev => { if (ev.target === ev.currentTarget && !busy) setModal(''); }}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onKeyDown={ev => {
      if (ev.key === 'Tab') {
        const els = Array.from(ev.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)'));
        const first = els[0], last = els[els.length - 1];
        if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last?.focus(); }
        else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first?.focus(); }
      }
    }}>
      <button className="icon-button close" disabled={busy} aria-label="닫기" onClick={() => { setModal(''); setError(''); }}><X size={20} /></button><p className="eyebrow">MATCH MANAGEMENT</p><h2 id="dialog-title">{modal === 'create' ? '새 대회 공지' : modal === 'settings' ? '대회 정보 설정' : modal === 'roster' ? `${team[rosterSide]}팀 선수 정보` : modal === 'order' ? `${team[rosterSide]}팀 오더 제출` : modal === 'result' ? `${score.index + 1}경기 결과 기록` : '경기 오더 확정'}</h2>
      {error && <div className="alert" role="alert">{error}{error.includes('새로고침') && <button onClick={() => { setModal(''); load(); }}>새로고침</button>}</div>}
      {(modal === 'settings' || modal === 'create') && <form onSubmit={ev => { ev.preventDefault(); if (modal === 'create') createEvent(); else save({ type: 'settings', value: edit }); }}><p className="dialog-description">{modal === 'create' ? '날짜와 대회명만 정해져도 공지할 수 있습니다. 새 대회는 선수와 대진이 비어 있는 상태로 시작하며, 지난 경기 기록은 그대로 남습니다.' : ''}</p>
        <label>대회명<input required maxLength={80} value={edit.title} onChange={ev => setEdit({ ...edit, title: ev.target.value })} /></label>
        <div className="form-grid"><label>날짜<input type="date" required value={edit.date} onChange={ev => setEdit({ ...edit, date: ev.target.value })} /></label><label>시작 시간 (한국 시간)<input type="time" value={edit.time} onChange={ev => setEdit({ ...edit, time: ev.target.value })} /></label></div>
        <label>대회 방식<select value={edit.format} disabled={modal !== 'create' && hasResults} onChange={ev => {
          const format = Number(ev.target.value) as 0 | 3 | 5 | 6;
          const court = format === 6 ? edit.court || '1' : edit.court;
          const secondaryCourt = format === 6 ? edit.secondaryCourt && edit.secondaryCourt !== court ? edit.secondaryCourt : court === '2' ? '1' : '2' : edit.secondaryCourt;
          setEdit({ ...edit, format, court, secondaryCourt });
        }}><option value="0">미정 · 일정 먼저 공지</option><option value="3">3복 · 오더 제출 · 2승 선취</option><option value="5">5복 · 오더 제출 · 3승 선취</option><option value="6">6복 · 자동 편성 · 3라운드 / 2코트</option></select></label>
        <p className="help">{modal !== 'create' && hasResults ? '결과가 기록된 대회는 경기 방식을 변경할 수 없습니다.' : '경기 방식을 바꾸면 기존 편성과 오더를 초기화합니다. 6복은 선수 성별·직급에 따라 다시 편성됩니다.'}</p>
        <div className="form-grid"><label>{edit.format === 6 ? '혼합복식 코트' : '사용 코트'}<select value={edit.court} onChange={ev => setEdit({ ...edit, court: ev.target.value })}><option value="">미정</option>{[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}번 코트</option>)}</select></label>
          {edit.format === 6 && <label>남자복식 코트<select value={edit.secondaryCourt} onChange={ev => setEdit({ ...edit, secondaryCourt: ev.target.value })}><option value="">미정</option>{[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}번 코트</option>)}</select></label>}
          <label>예약 상태<select value={edit.reservation} onChange={ev => setEdit({ ...edit, reservation: ev.target.value })}>{['미확인', '신청 중', '승인 완료'].map(value => <option key={value}>{value}</option>)}</select></label>
        </div>
        {edit.format === 6 && <><div className="settings-format-description"><strong>혼합 3경기 + 남자 3경기</strong><p>각 팀 남자는 1·2·3직급 각 1명, 여자는 1명이 필요합니다. 두 종목을 동시에 진행하므로 서로 다른 코트를 선택해주세요.</p><p>6경기 종료 후 승수, 합산 게임수 순서로 비교하고 모두 같으면 무승부로 종료합니다.</p></div><div className="round-time-fields">{[0, 1, 2].map(index => <label key={index}>{index + 1}라운드 시간<input type="time" value={edit.roundTimes[index] || ''} onChange={ev => { const times = [...edit.roundTimes]; times[index] = ev.target.value; setEdit({ ...edit, roundTimes: times }); }} /></label>)}</div><p className="help">라운드 시간은 선택 사항입니다. 같은 라운드의 두 경기에 함께 표시됩니다.</p></>}
        <label>안내 및 경기 규칙<textarea rows={4} maxLength={2000} value={edit.notice} onChange={ev => setEdit({ ...edit, notice: ev.target.value })} /></label>
        <button className="button primary full" disabled={busy}>{busy ? '저장 중…' : modal === 'create' ? '새 대회 공지 등록' : '대회 정보 저장'}</button>
      </form>}
      {modal === 'roster' && <form onSubmit={ev => { ev.preventDefault(); save({ type: 'roster', side: rosterSide, roster: edit.rosters[rosterSide], playerMeta: edit.playerMeta[rosterSide], playerIds: edit.playerIds[rosterSide] }); }}>
        <p className="dialog-description">지난 선수를 선택하면 누적 기록을 이어갑니다. 새 선수는 직접 입력하고, 미정인 자리는 비워두세요. {isSix ? '남자 1·2·3직급 각 1명과 여자 1명으로 구성해주세요. 저장하면 혼합복식과 남자복식 편성이 함께 갱신됩니다.' : '선수 이름, 성별과 직급을 입력해주세요. 선수 정보를 수정하면 이 팀의 오더 제출 상태가 초기화됩니다.'} 경기 결과가 기록된 뒤에는 선수 정보를 변경할 수 없습니다.</p>
        {rosterFields(rosterSide)}<button className="button primary full" disabled={busy || !editableRoster}>{busy ? '저장 중…' : '선수 정보 저장'}</button>
      </form>}
      {modal === 'order' && isCaptain && isManual && <form onSubmit={ev => { ev.preventDefault(); save({ type: 'order', side: rosterSide, roster: edit.rosters[rosterSide], playerMeta: edit.playerMeta[rosterSide], playerIds: edit.playerIds[rosterSide], pairs: edit.games.map(g => g[rosterSide]) }); }}>
        <p className="dialog-description">경기마다 서로 다른 선수 2명을 선택해주세요. 확정 전에는 수정할 수 있으며, 상대 팀 오더는 확정 후 공개됩니다.</p>
        {rosterFields(rosterSide)}
        <div className="order-list">{edit.games.map((g, i) => <div className="order-edit-row" key={i}><strong>{i + 1}경기</strong>{[0, 1].map(j => <select key={j} aria-label={`${i + 1}경기 선수 ${j + 1}`} required value={g[rosterSide][j] ?? ''} onChange={ev => { const next = structuredClone(edit); next.games[i][rosterSide][j] = ev.target.value === '' ? -1 : Number(ev.target.value); setEdit(next); }}><option value="">선수 선택</option>{edit.rosters[rosterSide].map((name, k) => <option key={k} value={k}>{name || '선수 ' + (k + 1)}</option>)}</select>)}</div>)}</div>
        <button className="button primary full" disabled={busy || e.locked}>{busy ? '저장 중…' : '우리 팀 오더 제출'}</button>
      </form>}
      {modal === 'lock' && isManual && <><p className="dialog-description">{e.locked ? '확정을 해제하면 팀 대표가 명단과 오더를 다시 수정할 수 있습니다. 결과가 있는 경우 먼저 경기 결과를 초기화해주세요.' : '양 팀 오더를 확인한 뒤 확정해주세요. 확정하면 전체 오더가 공개되고 경기 결과를 기록할 수 있습니다.'}</p><div className="lock-state"><span>송변전 {e.submitted.a ? '✓ 제출' : '· 대기'}</span><span>배전 {e.submitted.b ? '✓ 제출' : '· 대기'}</span></div><button className="button primary full" disabled={busy || (!e.locked && (!e.submitted.a || !e.submitted.b))} onClick={() => save({ type: 'lock', locked: !e.locked })}>{busy ? '처리 중…' : e.locked ? '확정 해제' : '양 팀 오더 확정·공개'}</button></>}
      {modal === 'result' && <form onSubmit={ev => { ev.preventDefault(); save({ type: 'result', index: score.index, scoreA: score.a, scoreB: score.b }); }}>
        {isSix && <p className="result-context">{e.games[score.index].round}라운드 · {e.games[score.index].category === 'mixed' ? '혼합복식' : '남자복식'} · {e.games[score.index].court ? `${e.games[score.index].court}번 코트` : '코트 미정'}</p>}
        <p className="dialog-description">최종 게임 스코어를 입력하세요. 높은 스코어의 팀이 이 경기에서 승리합니다.{isSix ? ' 대항전 전체 승패는 6경기 종료 후 계산합니다.' : ''} 개별 경기의 동점 결과는 저장할 수 없습니다.</p>
        <div className="score-form"><label>송변전<small>{pair('a', score.index)}</small><input aria-label="송변전 스코어" type="number" required min="0" max="99" step="1" value={score.a} onChange={ev => setScore({ ...score, a: ev.target.value })} /></label><span>:</span><label>배전<small>{pair('b', score.index)}</small><input aria-label="배전 스코어" type="number" required min="0" max="99" step="1" value={score.b} onChange={ev => setScore({ ...score, b: ev.target.value })} /></label></div>
        <button className="button primary full" disabled={busy}>{busy ? '저장 중…' : '결과 저장'}</button>{e.games[score.index].winner && <button className="text-button danger reset" type="button" disabled={busy} onClick={() => { if (confirm('이 경기의 결과를 초기화할까요?')) save({ type: 'result', index: score.index, clear: true }); }}>이 경기 결과 초기화</button>}
      </form>}
    </section></div>}
  </div>;
}
