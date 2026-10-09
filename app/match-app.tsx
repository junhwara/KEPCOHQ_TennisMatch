'use client';

import { useEffect, useState } from 'react';
import {
  ArrowUpRight, CalendarDays, Clock3, MapPin, ChevronRight, Check, Copy, Users,
  Trophy, Settings2, X, RefreshCw, LockKeyhole, Download, Flag, CircleDot, ClipboardList,
} from 'lucide-react';
import { type EventData, type Side, type PlayerMeta, summary, genderLabel, gradeLabel } from './model';

const team = { a: '송변전', b: '배전' };
const sides: Side[] = ['a', 'b'];
type Snapshot = { event: EventData; revision: number; role: string; links?: { a: string; b: string } };

export default function MatchApp() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
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
  const e = snapshot?.event;
  const role = snapshot?.role || 'viewer';
  const s = e ? summary(e) : null;
  const isSix = e?.format === 6;
  const isCaptain = role === 'a' || role === 'b';
  const hasResults = !!e?.games.some(g => g.winner);

  async function load(key = token) {
    try {
      const r = await fetch('/api/event', { headers: key ? { Authorization: 'Bearer ' + key } : {}, cache: 'no-store' });
      const d = await r.json() as Snapshot & { error: string };
      if (!r.ok) throw Error(d.error);
      setSnapshot(d);
      setError('');
    } catch (err) {
      setError((err as Error).message || '연결을 확인해주세요.');
    }
  }

  useEffect(() => {
    const key = new URLSearchParams(location.hash.slice(1)).get('key') || '';
    setToken(key);
    load(key);
  }, []);
  useEffect(() => {
    if (modal) return;
    const id = setInterval(() => load(token), 30000);
    return () => clearInterval(id);
  }, [token, modal]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    if (!modal) return;
    function close(ev: KeyboardEvent) {
      if (ev.key === 'Escape' && !busy) { setModal(''); setError(''); }
    }
    document.addEventListener('keydown', close);
    const previous = document.activeElement as HTMLElement;
    const focusTimer = setTimeout(() => document.querySelector<HTMLButtonElement>('.dialog .close')?.focus(), 0);
    return () => { clearTimeout(focusTimer); document.removeEventListener('keydown', close); previous?.focus(); };
  }, [modal, busy]);

  async function save(action: unknown) {
    if (!snapshot || busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ ...(action as object), revision: snapshot.revision }),
      });
      const d = await r.json() as Snapshot & { error: string };
      if (!r.ok) throw Error(d.error);
      setSnapshot({ ...d, links: snapshot.links });
      setModal('');
      setToast('변경 내용을 저장했습니다.');
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  function open(kind: string, side?: Side) {
    if (!e) return;
    if (side) setRosterSide(side);
    else if (isCaptain) setRosterSide(role as Side);
    setEdit(structuredClone(e));
    setError('');
    setModal(kind);
  }

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setToast('링크를 복사했습니다.'); }
    catch { setCopiedLink(text); }
  }

  function pair(side: Side, index: number) {
    const players = e!.games[index][side];
    return players.length === 2 ? players.map(n => e!.rosters[side][n] || `선수 ${n + 1}`).join(' · ')
      : e!.submitted[side] ? '확정 후 공개' : '오더 제출 대기';
  }

  function playerDetails(meta: PlayerMeta) {
    return `${genderLabel[meta.gender]} · ${gradeLabel[meta.grade]}`;
  }

  function exportResults() {
    if (!e) return;
    const pairWithMeta = (side: Side, index: number) => e.games[index][side]
      .map(n => `${e.rosters[side][n]} (${playerDetails(e.playerMeta[side][n])})`).join(' / ');
    const rows = [
      ['경기', '라운드', '종목', '코트', '시작 시간', '송변전 선수 (성별·직급)', '배전 선수 (성별·직급)', '송변전 게임수', '배전 게임수', '승리팀'],
      ...e.games.map((g, i) => [i + 1, g.round || '', g.category === 'mixed' ? '혼합복식' : g.category === 'mens' ? '남자복식' : '복식', g.court || e.court, g.time || '', pairWithMeta('a', i), pairWithMeta('b', i), g.scoreA, g.scoreB, g.winner ? team[g.winner] : '미기록']),
    ];
    const csv = rows.map(row => row.map(value => '"' + String(value).replace(/^[=+@-]/, "'").replaceAll('"', '""') + '"').join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = '대항전-' + e.date + '.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  function updatePlayer(side: Side, index: number, field: 'name' | 'gender' | 'grade', value: string) {
    if (!edit) return;
    const next = structuredClone(edit);
    if (field === 'name') next.rosters[side][index] = value;
    else if (field === 'gender') next.playerMeta[side][index].gender = value as PlayerMeta['gender'];
    else next.playerMeta[side][index].grade = value as PlayerMeta['grade'];
    setEdit(next);
  }

  function rosterFields(side: Side) {
    if (!edit) return null;
    return <div className="player-fields">{edit.rosters[side].map((name, i) =>
      <fieldset className="player-field" key={i}>
        <legend>선수 {i + 1}</legend>
        <label>이름<input required maxLength={30} aria-label={`${team[side]} 선수 ${i + 1} 이름`} value={name} onChange={ev => updatePlayer(side, i, 'name', ev.target.value)} /></label>
        <label>성별<select aria-label={`${team[side]} 선수 ${i + 1} 성별`} value={edit.playerMeta[side][i].gender} onChange={ev => updatePlayer(side, i, 'gender', ev.target.value)}>
          <option value="">미입력</option><option value="male">남자</option><option value="female">여자</option>
        </select></label>
        <label>직급<select aria-label={`${team[side]} 선수 ${i + 1} 직급`} value={edit.playerMeta[side][i].grade} onChange={ev => updatePlayer(side, i, 'grade', ev.target.value)}>
          <option value="">미입력</option><option value="1">1직급 · 처장</option><option value="2">2직급 · 부장</option><option value="3">3직급 · 차장</option>
        </select></label>
      </fieldset>)}</div>;
  }

  function resultControl(index: number) {
    if (!e) return null;
    const g = e.games[index];
    return role === 'admin'
      ? <button className="result-button" disabled={!e.locked} onClick={() => { setScore({ index, a: g.scoreA, b: g.scoreB }); open('result'); }}>{g.winner ? '결과 수정' : '결과 입력'}</button>
      : <span className={'status ' + (g.winner ? 'complete' : '')}>{g.winner ? '종료' : '예정'}</span>;
  }

  const dateText = e ? new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'long', timeZone: 'Asia/Seoul' }).format(new Date(e.date + 'T12:00:00+09:00')) : '';
  const championText = s?.decidedBy === 'draw' ? '무승부' : s?.champion;
  const editableRoster = !hasResults && (isSix || !e?.locked);

  return <div className="app-shell">
    <aside className="sidebar">
      <button className="brand" onClick={() => setTab('overview')} aria-label="코트사이드 홈"><span className="brandmark">◉</span><span>코트사이드<small>KEPCO TENNIS CLUB</small></span></button>
      <div className="side-caption">CLUB HOUSE</div>
      <nav>
        <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}><CircleDot size={19} />대항전 홈<ChevronRight size={16} /></button>
        <button className={tab === 'matches' ? 'active' : ''} onClick={() => setTab('matches')}><ClipboardList size={19} />경기 일정·결과</button>
        <button className={tab === 'teams' ? 'active' : ''} onClick={() => setTab('teams')}><Users size={19} />참가 팀</button>
      </nav>
      <div className="side-note"><div className="tiny-court"><i /><i /></div><strong>함께 치고, 함께 기록하는<br />우리의 테니스.</strong><p>한전 본사 테니스 코트</p></div>
      <div className="sidebar-bottom"><span className="avatar">K</span><div>한전 본사 테니스<small>친선 대항전 · 첫 번째 만남</small></div></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><span>클럽하우스 <ChevronRight size={14} /><b>송변전 × 배전</b></span><div><span className="role-pill"><span />{role === 'admin' ? '진행자' : isCaptain ? team[role as Side] + ' 대표' : '공개 열람'}</span><button className="icon-button" aria-label="새로고침" onClick={() => load()}><RefreshCw size={17} /></button></div></header>
      <main>{!e ? <div className="loading"><CircleDot size={40} /><h1>코트에서 만나요.</h1><p>{error || '대회 정보를 불러오고 있습니다.'}</p><button onClick={() => load()}>다시 불러오기</button></div> : <>
        <div className="page-heading"><div><p className="eyebrow">MATCH DAY / 01</p><h1>{tab === 'teams' ? '함께 뛰는 사람들' : tab === 'matches' ? '한 경기씩, 함께 기록해요.' : '코트에서 만나요.'}</h1><p className="subheading">{tab === 'overview' ? '서로 다른 업무, 같은 열정. 우리의 첫 번째 친선 대항전.' : tab === 'teams' ? '각 팀 4명, 코트를 함께 채울 8명의 동료.' : '경기 편성과 마지막 포인트까지, 이곳에서 확인하세요.'}</p></div><button className="button secondary" aria-label="대회 링크 복사" onClick={() => copy(location.origin)}><Copy size={16} />대회 링크 복사</button></div>
        {error && !modal && <div className="alert" role="alert">{error}<button onClick={() => load()}>새로고침</button></div>}

        {tab === 'overview' && <section className="hero">
          <div className="hero-copy"><span className="hero-tag"><span />{s!.done === e.format ? '경기 종료' : s!.done ? '대항전 진행 중' : isSix ? '6복 자동 편성 · 경기 준비' : e.locked ? '오더 확정 · 경기 준비' : e.rosters.a.concat(e.rosters.b).every(n => n.trim()) ? '참가 선수 등록 완료' : '참가 선수 준비 중'}</span><p className="hero-kicker">KEPCO HQ · FRIENDLY DOUBLES</p><h2>{e.title}</h2><p>업무의 동료가, 코트 위의 파트너로.</p><button className="button lime" onClick={() => { setTab('matches'); if (isCaptain && !isSix && !e.locked) open('order'); }}>{isCaptain && !isSix && !e.locked ? '우리 팀 오더 제출' : '경기 편성 확인'}<ArrowUpRight size={18} /></button></div>
          <div className="court-art" aria-hidden="true"><div className="court-plane"><div className="doubles-line" /><div className="service-top" /><div className="service-bottom" /><div className="net" /><div className="center-service" /></div><div className="tennis-ball" /><span className="court-label">SAME COURT.<br />ONE TEAM SPIRIT.</span></div>
          <div className="hero-bottom"><span><CalendarDays size={16} />{dateText}</span><span><Clock3 size={16} />{e.time || '시간 미정'} <small>KST</small></span><span><MapPin size={16} />본사 테니스장{isSix ? ` · ${e.court || '?'}·${e.secondaryCourt || '?'}번 코트` : e.court ? ` · ${e.court}번 코트` : ''}</span></div>
        </section>}

        <div className="stats-row">
          <div><span className="stat-icon"><Users size={19} /></span><div><small>참가 선수</small><strong>{e.rosters.a.concat(e.rosters.b).filter(n => n.trim()).length}<em>명 · 2개 팀</em></strong></div></div>
          <div><span className="stat-icon"><CircleDot size={19} /></span><div><small>대회 방식</small><strong>{isSix ? '6복' : `복식 ${e.format}`}<em>{isSix ? '3라운드 · 2코트' : '경기'}</em></strong></div></div>
          <div><span className="stat-icon"><Trophy size={19} /></span><div><small>{championText ? '최종 결과' : '팀 승수'}</small><strong>{championText || `${s!.a} : ${s!.b}`}<em>{championText ? `${s!.a} : ${s!.b}` : '송변전 · 배전'}</em></strong></div></div>
          <div><span className="stat-icon"><Flag size={19} /></span><div><small>진행 현황</small><strong>{s!.done}<em>/ {e.format} 경기 완료</em></strong></div></div>
        </div>

        <div className="content-grid"><div className="main-column">
          {tab !== 'teams' && <section className="panel match-panel">
            <div className="section-heading"><div><h2>경기 일정 & 결과 <span className="count">{e.format}</span></h2><p>{isSix ? '각 라운드에 혼합복식과 남자복식을 두 코트에서 동시에 진행합니다.' : e.locked ? '확정된 오더입니다. 최종 게임 스코어와 승패를 기록합니다.' : '양 팀 오더는 진행자 확정 후 함께 공개됩니다.'}</p></div>{!isSix && isCaptain && <button disabled={e.locked} className="text-button" onClick={() => open('order')}>{e.submitted[role as Side] ? '오더 수정' : '오더 제출'}<ChevronRight size={16} /></button>}{!isSix && role === 'admin' && <button className="text-button" onClick={() => open('lock')}><LockKeyhole size={15} />{e.locked ? '확정 해제' : '오더 확정'}</button>}</div>
            {isSix ? <>
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
            <div className="panel-footer"><span><CircleDot size={14} />{isSix ? '승수 동률이면 합산 게임수 비교 · 모두 같으면 무승부' : `${Math.floor(e.format / 2) + 1}승을 먼저 거두는 팀이 대항전에서 승리합니다.`}</span><button className="text-button" onClick={exportResults}><Download size={15} />결과 저장</button></div>
          </section>}

          <section className="teams-section"><div className="section-heading"><div><h2>이번 대회의 두 팀</h2><p>파트너와 호흡을 맞추고, 서로를 위한 경기를.</p></div><span className="small-label">4 PLAYERS EACH</span></div><div className="team-grid">{sides.map(side => <div className={'team-card team-' + side} key={side}>
            <div className="team-top"><span className="team-emblem">{side === 'a' ? '송' : '배'}</span><div><small>{side === 'a' ? 'TRANSMISSION' : 'DISTRIBUTION'}</small><h3>{team[side]}팀</h3></div><span className={'submission ' + (isSix || e.submitted[side] ? 'submitted' : '')}>{isSix ? <><Check size={12} />자동 편성</> : e.submitted[side] ? <><Check size={12} />제출 완료</> : '오더 대기'}</span></div>
            <div className="roster">{e.rosters[side].map((name, i) => <div key={i}><span className="player-avatar">{name ? name.slice(0, 1) : '?'}</span><div className="player-info"><span>{name || '선수 ' + (i + 1)}</span><span className="player-details">{playerDetails(e.playerMeta[side][i])}</span></div><small>{String(i + 1).padStart(2, '0')}</small></div>)}</div>
            {(role === 'admin' || role === side) && <button className="team-edit" disabled={!editableRoster} onClick={() => open('roster', side)}>{hasResults ? '경기 시작 후 선수 정보 고정' : !editableRoster ? '오더 확정 후 선수 정보 고정' : '이름·성별·직급 수정'}<ArrowUpRight size={15} /></button>}
            {!isSix && role === side && <button className="team-edit" disabled={e.locked} onClick={() => open('order', side)}>선수 및 오더 {e.locked ? '확정됨' : '입력'}<ArrowUpRight size={15} /></button>}
          </div>)}</div></section>
        </div><aside className="detail-column">
          <section className="panel details"><div className="section-heading"><h2>대회 안내</h2>{role === 'admin' && <button className="icon-button" aria-label="대회 설정" onClick={() => open('settings')}><Settings2 size={18} /></button>}</div><h3>{e.title}</h3><dl>
            <div><dt><CalendarDays size={16} />일정</dt><dd>{dateText}<small>{e.time || '시작 시간 미정'} · 한국 시간</small></dd></div>
            <div><dt><MapPin size={16} />장소</dt><dd>한전 본사 테니스장{isSix ? <><small>혼합복식 · {e.court ? `${e.court}번 코트` : '미정'}</small><small>남자복식 · {e.secondaryCourt ? `${e.secondaryCourt}번 코트` : '미정'}</small></> : <small>{e.court ? e.court + '번 코트' : '사용 코트 미정'}</small>}</dd></div>
            <div><dt><Check size={16} />코트 예약</dt><dd><span className={'reservation ' + (e.reservation === '승인 완료' ? 'approved' : '')}>{e.reservation}</span></dd></div>
          </dl><div className="notice"><p>진행자 안내</p><div>{e.notice || '등록된 안내가 없습니다.'}</div></div><p className="reservation-note">코트 예약과 승인은 기존 사내 시스템에서 별도로 진행해주세요.</p></section>
          <section className="checklist"><h3>경기 전, 이렇게 준비해요.</h3>{(isSix ? [['01', '선수 정보 확인', '남자 직급별 1명과 여자 1명을 확인해요.'], ['02', '자동 편성 확인', '3라운드, 두 코트의 파트너를 확인해요.'], ['03', '진행자가 결과 기록', '6경기의 승수와 게임수를 합산해요.']] : [['01', '참가 선수 확인', '팀원 4명의 정보를 확인해요.'], ['02', '대표가 오더 제출', '경기마다 복식 파트너를 정해요.'], ['03', '진행자가 확정·기록', '함께 응원하고 결과를 남겨요.']]).map(x => <div key={x[0]}><span>{x[0]}</span><div><strong>{x[1]}</strong><p>{x[2]}</p></div></div>)}</section>
          {role === 'admin' && <section className="panel manage-links"><h3>팀 대표 초대</h3><p>각 팀 대표에게 해당 팀의 링크를 전달해주세요.{isSix ? ' 대표는 경기 시작 전 선수 정보를 수정할 수 있습니다.' : ''}</p>{sides.map(side => <button key={side} className="button secondary" onClick={() => snapshot?.links && copy(location.origin + '/#key=' + snapshot.links[side])}><Copy size={14} />{team[side]} 대표 링크</button>)}</section>}
        </aside></div>
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
      <button className="icon-button close" disabled={busy} aria-label="닫기" onClick={() => { setModal(''); setError(''); }}><X size={20} /></button><p className="eyebrow">MATCH MANAGEMENT</p><h2 id="dialog-title">{modal === 'settings' ? '대회 정보 설정' : modal === 'roster' ? `${team[rosterSide]}팀 선수 정보` : modal === 'order' ? `${team[rosterSide]}팀 오더 제출` : modal === 'result' ? `${score.index + 1}경기 결과 기록` : '경기 오더 확정'}</h2>
      {error && <div className="alert" role="alert">{error}{error.includes('새로고침') && <button onClick={() => { setModal(''); load(); }}>새로고침</button>}</div>}
      {modal === 'settings' && <form onSubmit={ev => { ev.preventDefault(); save({ type: 'settings', value: edit }); }}>
        <label>대회명<input required maxLength={80} value={edit.title} onChange={ev => setEdit({ ...edit, title: ev.target.value })} /></label>
        <div className="form-grid"><label>날짜<input type="date" required value={edit.date} onChange={ev => setEdit({ ...edit, date: ev.target.value })} /></label><label>시작 시간 (한국 시간)<input type="time" value={edit.time} onChange={ev => setEdit({ ...edit, time: ev.target.value })} /></label></div>
        <label>대회 방식<select value={edit.format} disabled={hasResults} onChange={ev => {
          const format = Number(ev.target.value) as 3 | 5 | 6;
          const court = format === 6 ? edit.court || '1' : edit.court;
          const secondaryCourt = format === 6 ? edit.secondaryCourt && edit.secondaryCourt !== court ? edit.secondaryCourt : court === '2' ? '1' : '2' : edit.secondaryCourt;
          setEdit({ ...edit, format, court, secondaryCourt });
        }}><option value="3">3복 · 오더 제출 · 2승 선취</option><option value="5">5복 · 오더 제출 · 3승 선취</option><option value="6">6복 · 자동 편성 · 3라운드 / 2코트</option></select></label>
        <p className="help">{hasResults ? '결과가 기록된 대회는 경기 방식을 변경할 수 없습니다.' : '경기 방식을 바꾸면 기존 편성과 오더를 초기화합니다. 6복은 선수 성별·직급에 따라 다시 편성됩니다.'}</p>
        <div className="form-grid"><label>{edit.format === 6 ? '혼합복식 코트' : '사용 코트'}<select value={edit.court} onChange={ev => setEdit({ ...edit, court: ev.target.value })}><option value="">미정</option>{[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}번 코트</option>)}</select></label>
          {edit.format === 6 && <label>남자복식 코트<select value={edit.secondaryCourt} onChange={ev => setEdit({ ...edit, secondaryCourt: ev.target.value })}><option value="">미정</option>{[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}번 코트</option>)}</select></label>}
          <label>예약 상태<select value={edit.reservation} onChange={ev => setEdit({ ...edit, reservation: ev.target.value })}>{['미확인', '신청 중', '승인 완료'].map(value => <option key={value}>{value}</option>)}</select></label>
        </div>
        {edit.format === 6 && <><div className="settings-format-description"><strong>혼합 3경기 + 남자 3경기</strong><p>각 팀 남자는 1·2·3직급 각 1명, 여자는 1명이 필요합니다. 두 종목을 동시에 진행하므로 서로 다른 코트를 선택해주세요.</p><p>6경기 종료 후 승수, 합산 게임수 순서로 비교하고 모두 같으면 무승부로 종료합니다.</p></div><div className="round-time-fields">{[0, 1, 2].map(index => <label key={index}>{index + 1}라운드 시간<input type="time" value={edit.roundTimes[index] || ''} onChange={ev => { const times = [...edit.roundTimes]; times[index] = ev.target.value; setEdit({ ...edit, roundTimes: times }); }} /></label>)}</div><p className="help">라운드 시간은 선택 사항입니다. 같은 라운드의 두 경기에 함께 표시됩니다.</p></>}
        <label>안내 및 경기 규칙<textarea rows={4} maxLength={2000} value={edit.notice} onChange={ev => setEdit({ ...edit, notice: ev.target.value })} /></label>
        <button className="button primary full" disabled={busy}>{busy ? '저장 중…' : '대회 정보 저장'}</button>
      </form>}
      {modal === 'roster' && <form onSubmit={ev => { ev.preventDefault(); save({ type: 'roster', side: rosterSide, roster: edit.rosters[rosterSide], playerMeta: edit.playerMeta[rosterSide] }); }}>
        <p className="dialog-description">{isSix ? '남자 1·2·3직급 각 1명과 여자 1명으로 구성해주세요. 저장하면 혼합복식과 남자복식 편성이 함께 갱신됩니다.' : '선수 이름, 성별과 직급을 입력해주세요. 선수 정보를 수정하면 이 팀의 오더 제출 상태가 초기화됩니다.'} 경기 결과가 기록된 뒤에는 선수 정보를 변경할 수 없습니다.</p>
        {rosterFields(rosterSide)}<button className="button primary full" disabled={busy || !editableRoster}>{busy ? '저장 중…' : '선수 정보 저장'}</button>
      </form>}
      {modal === 'order' && isCaptain && !isSix && <form onSubmit={ev => { ev.preventDefault(); save({ type: 'order', side: rosterSide, roster: edit.rosters[rosterSide], playerMeta: edit.playerMeta[rosterSide], pairs: edit.games.map(g => g[rosterSide]) }); }}>
        <p className="dialog-description">경기마다 서로 다른 선수 2명을 선택해주세요. 확정 전에는 수정할 수 있으며, 상대 팀 오더는 확정 후 공개됩니다.</p>
        {rosterFields(rosterSide)}
        <div className="order-list">{edit.games.map((g, i) => <div className="order-edit-row" key={i}><strong>{i + 1}경기</strong>{[0, 1].map(j => <select key={j} aria-label={`${i + 1}경기 선수 ${j + 1}`} required value={g[rosterSide][j] ?? ''} onChange={ev => { const next = structuredClone(edit); next.games[i][rosterSide][j] = ev.target.value === '' ? -1 : Number(ev.target.value); setEdit(next); }}><option value="">선수 선택</option>{edit.rosters[rosterSide].map((name, k) => <option key={k} value={k}>{name || '선수 ' + (k + 1)}</option>)}</select>)}</div>)}</div>
        <button className="button primary full" disabled={busy || e.locked}>{busy ? '저장 중…' : '우리 팀 오더 제출'}</button>
      </form>}
      {modal === 'lock' && !isSix && <><p className="dialog-description">{e.locked ? '확정을 해제하면 팀 대표가 명단과 오더를 다시 수정할 수 있습니다. 결과가 있는 경우 먼저 경기 결과를 초기화해주세요.' : '양 팀 오더를 확인한 뒤 확정해주세요. 확정하면 전체 오더가 공개되고 경기 결과를 기록할 수 있습니다.'}</p><div className="lock-state"><span>송변전 {e.submitted.a ? '✓ 제출' : '· 대기'}</span><span>배전 {e.submitted.b ? '✓ 제출' : '· 대기'}</span></div><button className="button primary full" disabled={busy || (!e.locked && (!e.submitted.a || !e.submitted.b))} onClick={() => save({ type: 'lock', locked: !e.locked })}>{busy ? '처리 중…' : e.locked ? '확정 해제' : '양 팀 오더 확정·공개'}</button></>}
      {modal === 'result' && <form onSubmit={ev => { ev.preventDefault(); save({ type: 'result', index: score.index, scoreA: score.a, scoreB: score.b }); }}>
        {isSix && <p className="result-context">{e.games[score.index].round}라운드 · {e.games[score.index].category === 'mixed' ? '혼합복식' : '남자복식'} · {e.games[score.index].court ? `${e.games[score.index].court}번 코트` : '코트 미정'}</p>}
        <p className="dialog-description">최종 게임 스코어를 입력하세요. 높은 스코어의 팀이 이 경기에서 승리합니다.{isSix ? ' 대항전 전체 승패는 6경기 종료 후 계산합니다.' : ''} 개별 경기의 동점 결과는 저장할 수 없습니다.</p>
        <div className="score-form"><label>송변전<small>{pair('a', score.index)}</small><input aria-label="송변전 스코어" type="number" required min="0" max="99" step="1" value={score.a} onChange={ev => setScore({ ...score, a: ev.target.value })} /></label><span>:</span><label>배전<small>{pair('b', score.index)}</small><input aria-label="배전 스코어" type="number" required min="0" max="99" step="1" value={score.b} onChange={ev => setScore({ ...score, b: ev.target.value })} /></label></div>
        <button className="button primary full" disabled={busy}>{busy ? '저장 중…' : '결과 저장'}</button>{e.games[score.index].winner && <button className="text-button danger reset" type="button" disabled={busy} onClick={() => { if (confirm('이 경기의 결과를 초기화할까요?')) save({ type: 'result', index: score.index, clear: true }); }}>이 경기 결과 초기화</button>}
      </form>}
    </section></div>}
  </div>;
}
