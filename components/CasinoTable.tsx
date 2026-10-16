'use client';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { TableView } from '../game/engine';
import { Maximize, Minimize, Volume2, VolumeX, SlidersHorizontal, Trophy, Spade } from 'lucide-react';
import { usePokerAudio } from '../hooks/use-poker-audio';
import { useTableFullscreen } from '../hooks/use-table-fullscreen';
import { handLabel } from '../lib/hand-label';
import { bestVisibleFive, collectedBets, latestAction, winnerHandLabel } from '../lib/table-presentation';

function positions(count: number) {
  if (count === 5) return [[50, 74], [24, 65], [11, 39], [24, 18], [89, 39]];
  if (count === 6) return [[50, 74], [24, 65], [11, 40], [25, 19], [75, 19], [89, 40]];
  if (count === 9) return [[50, 74], [27, 65], [11, 54], [9, 36], [25, 18], [75, 18], [91, 36], [89, 54], [73, 65]];
  if (count === 2) return [[50, 74], [24, 24]];
  return Array.from({ length: count }, (_, i) => {
    const angle = i / count * Math.PI * 2;
    return [50 - Math.sin(angle) * 39, 46 + Math.cos(angle) * 28];
  });
}
const phaseNames: Record<string, string> = { waiting: 'Waiting for players', preflop: 'Pre-flop', flop: 'Flop', turn: 'Turn', river: 'River', complete: 'Hand complete' };
function Card({ card, index, highlight = false }: { card: string | null; index: number; highlight?: boolean }) {
  const suit = card ? { s: '♠', h: '♥', d: '♦', c: '♣' }[card[1]] : null;
  const rank = card?.[0] === 'T' ? '10' : card?.[0];
  return <span className="casino-card-shell" style={{ '--card-index': Math.min(index, 8) } as CSSProperties} aria-label={card ? `${rank} ${suit}${highlight ? ', best hand' : ''}` : 'Face-down card'}><span className={`casino-card ${card ? 'face' : 'back'} ${card && 'hd'.includes(card[1]) ? 'red' : ''} ${highlight ? 'best-card' : ''}`} aria-hidden="true">
    <svg className="casino-card-art" viewBox="0 0 72 100" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="70" height="98" rx="5" fill={card ? '#fffaf0' : '#452039'} stroke={highlight ? '#efc969' : '#e5d5ba'} strokeWidth="2" />
      {card ? <g fill="currentColor" fontFamily="Georgia, serif">
        <text x="7" y="25" fontSize="23" fontWeight="bold">{rank}</text>
        <text x="9" y="44" fontSize="20">{suit}</text>
        <text x="44" y="76" fontSize="39" textAnchor="middle">{suit}</text>
        <g transform="rotate(180 36 50)"><text x="7" y="19" fontSize="15" fontWeight="bold">{rank}</text><text x="9" y="33" fontSize="13">{suit}</text></g>
      </g> : <>
        <rect x="5" y="5" width="62" height="90" rx="3" fill="none" stroke="#e8c88c" />
        <path d="M6 20L60 94M6 40L46 94M6 60L32 94M12 6L66 80M27 6L66 60M42 6L66 40M6 80L60 6M6 60L46 6M6 40L32 6M12 94L66 20M27 94L66 40M42 94L66 60" fill="none" stroke="#d4ab69" strokeOpacity=".2" />
        <text x="36" y="62" textAnchor="middle" fontFamily="Georgia, serif" fontSize="34" fill="#f3d79f">V</text>
      </>}
    </svg>
  </span></span>;
}
function Chips({ amount }: { amount: number }) {
  return <span className="casino-wager" aria-label={`${amount.toLocaleString()} chips bet`}><span className="casino-chip-stack" key={amount}>{[0, 1, 2, 3].map(i => <i key={i} />)}</span><b key={`value-${amount}`}>◉ {amount.toLocaleString()}</b></span>;
}
export default function CasinoTable({ table, userId, clock, toolbar, actions }: { table: TableView | null; userId?: string; clock: number; toolbar: ReactNode; actions: ReactNode }) {
  const audio = usePokerAudio(table, userId, clock);
  const fullscreen = useTableFullscreen();
  const previous = useRef<TableView | null>(null);
  const [collection, setCollection] = useState<string[]>([]);
  const [payoutFlight, setPayoutFlight] = useState<string[]>([]);
  useEffect(() => {
    const ids = collectedBets(previous.current, table);
    const before = previous.current;
    const paid = before && table && before.id === table.id && before.handId === table.handId && before.phase !== 'complete' && table.phase === 'complete' ? Object.keys(table.payouts).filter(id => table.payouts[id] > 0) : [];
    previous.current = table;
    setCollection(ids);
    setPayoutFlight(paid);
    if (!ids.length && !paid.length) return;
    const timer = setTimeout(() => { setCollection([]); setPayoutFlight([]); }, 900);
    return () => clearTimeout(timer);
  }, [table]);
  const count = table?.capacity || 5;
  const myIndex = table?.seats.findIndex(p => p.id === userId) ?? -1;
  const me = myIndex >= 0 ? table?.seats[myIndex] : undefined;
  const coords = positions(count);
  const payouts = table?.phase === 'complete' ? Object.entries(table.payouts).filter(([, n]) => n > 0) : [];
  const displayPot = payouts.length ? payouts.reduce((sum, [, amount]) => sum + amount, 0) : table?.pot || 0;
  const bestCards = useMemo(() => table?.phase === 'complete' && me && !me.folded ? bestVisibleFive([...me.cards, ...table.board]) : [], [table, me]);
  const last = table ? latestAction(table) : null;
  const active = !!table && !['waiting', 'complete'].includes(table.phase);
  const myTurn = active && myIndex === table.turn;
  const turnPlayer = active ? table.seats[table.turn] : undefined;
  const remaining = Math.max(0, Math.ceil(((table?.deadline || 0) - clock) / 1000));
  const resultKey = `${table?.handId}-${table?.phase}`;
  return <section className="casino-view" aria-label="Poker table">
    <div ref={fullscreen.ref} data-table-ui="cards-v3" className={`casino-stage seats-${count} ${table?.phase === 'complete' ? 'hand-settled' : ''} ${fullscreen.theater ? 'casino-theater' : ''} ${myTurn ? 'my-turn' : ''}`} onPointerDownCapture={() => void audio.unlock()} onKeyDownCapture={() => void audio.unlock()}>
      <div className="casino-room-art" />
      <div className="casino-table-vignette" aria-hidden="true" />
      <div className="casino-toolbar">{toolbar}<div className="casino-media-tools">
        <button className="casino-tool" onClick={audio.toggle} aria-label={audio.enabled ? 'Mute sounds' : 'Enable sounds'} aria-pressed={audio.enabled} title={audio.enabled ? 'Mute sounds' : 'Enable sounds'}>{audio.enabled ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
        <details className="casino-volume"><summary className="casino-tool" aria-label="Sound volume" title="Sound volume"><SlidersHorizontal size={18} /></summary><label>Sound volume <output>{Math.round(audio.volume * 100)}%</output><input aria-label="Sound volume" type="range" min="0" max="100" value={Math.round(audio.volume * 100)} onChange={e => audio.changeVolume(Number(e.target.value) / 100)} /></label></details>
        <button className="casino-tool" onClick={() => void fullscreen.toggle()} aria-label={fullscreen.expanded ? 'Exit full screen' : 'Enter full screen'} aria-pressed={fullscreen.expanded} title={fullscreen.expanded ? 'Exit full screen' : 'Full screen'}>{fullscreen.expanded ? <Minimize size={18} /> : <Maximize size={18} />}</button>
      </div></div>
      {audio.enabled && !audio.ready && <button className="casino-sound-unlock" onClick={() => void audio.unlock()}>Tap for sound</button>}
      {(fullscreen.message || audio.error) && <div className="casino-media-message" role="status">{fullscreen.message || audio.error}</div>}
      <div className="casino-table-title"><b>{table?.name || 'VELORA LOUNGE'}</b><span>{table ? `${table.small} / ${table.big} · No-limit Hold’em` : 'TABLE PREVIEW · 5 SEATS'}</span></div>
      <div className="casino-pot" aria-live="polite"><span className="casino-pot-chip" aria-hidden="true">V</span><b key={`${table?.handId}-${displayPot}`}>{displayPot.toLocaleString()}</b><small>{payouts.length ? 'FINAL POT' : 'TOTAL POT'}</small></div>
      <div className="casino-street" key={`street-${resultKey}`}>{table ? phaseNames[table.phase] : 'Texas Hold’em'}<span>VIRTUAL CHIPS</span></div>
      <div className="casino-board" aria-label="Community cards">{Array.from({ length: 5 }, (_, i) => table?.board[i] ? <Card key={`${table.handId}-board-${i}`} card={table.board[i]} index={i < 3 ? i : 0} highlight={bestCards.includes(table.board[i])} /> : <span key={`placeholder-${i}`} className="casino-card-placeholder" aria-hidden="true"><Spade /></span>)}</div>
      {coords.map(([x, y], slot) => {
        const index = myIndex >= 0 ? (slot + myIndex) % count : slot;
        const p = table?.seats[index];
        const current = active && !!p && table?.turn === index;
        const mine = !!p && p.id === userId;
        const winner = payouts.find(([id]) => id === p?.id);
        const winningRank = winner && p && table ? winnerHandLabel(table, p.id) : null;
        const action = p && last?.name === p.name && table?.seats.filter(seat => seat.name === p.name).length === 1 && !current && active ? last : null;
        const seconds = current ? remaining : 0;
        return <div key={p?.id || `empty-${slot}`} className={`casino-seat slot-${slot} ${mine ? 'is-me' : ''} ${winner ? 'is-winner' : ''} ${current ? 'on-turn' : ''} ${current && seconds <= 5 ? 'time-critical' : current && seconds <= 10 ? 'time-low' : ''} ${p?.folded ? 'is-folded' : ''} ${!p ? 'is-empty' : ''}`} style={{ left: `${x}%`, top: `${y}%`, '--seat-hue': (index * 61 + 210) % 360, '--turn-progress': `${Math.min(100, seconds / 30 * 100)}%`, '--deal-x': `${(50 - x) * 1.5}px`, '--deal-y': `${(28 - y) * 1.5}px` } as CSSProperties}>
          <span className="casino-player-name">{p ? p.name + (mine && p.name.toLowerCase() !== 'you' ? ' · YOU' : '') : 'OPEN SEAT'}</span>
          <div className="casino-avatar">{current && <span className="casino-turn-ring" aria-hidden="true" />}{p ? <span>{p.name.slice(0, 2).toUpperCase()}</span> : <span>+</span>}{table?.button === index && p && <b className="casino-dealer-button" title="Dealer button">D</b>}{p && !p.connected && <span className="casino-offline-dot" title="Disconnected" />}{winner && <span className="casino-winner-ring" aria-hidden="true" />}{winner && <span className="casino-winner-crown" aria-label="Winner"><Trophy size={16} /></span>}</div>
          {p && <><div className="casino-player-cards">{!p.folded && p.cards.map((c, i) => <Card key={`${table?.handId}-${p.id}-${i}`} card={c} index={slot * 2 + i} highlight={!!c && mine && bestCards.includes(c)} />)}</div><b className="casino-balance">◉ {p.stack.toLocaleString()}</b>{winningRank && <span className="casino-winner-rank">{winningRank}</span>}<span className="casino-player-status">{winner ? `+${winner[1].toLocaleString()} · WON` : p.folded ? 'FOLDED' : !p.connected ? 'OFFLINE' : current ? `${seconds}s · ${mine ? 'YOUR TURN' : 'THINKING'}` : p.stack === 0 ? 'ALL-IN' : ''}</span>{action && <span className={`casino-action-badge action-${action.move}`} key={`${table?.handId}-${table?.history.length}-${action.label}`}>{action.label}</span>}{p.bet > 0 && <Chips amount={p.bet} />}</>}
        </div>;
      })}
      {[...collection, ...payoutFlight].map(id => {
        const index = table?.seats.findIndex(p => p.id === id) ?? -1;
        const slot = myIndex >= 0 ? (index - myIndex + count) % count : index;
        const pos = coords[slot];
        return pos ? <span key={`${resultKey}-${id}`} className={`casino-chip-flight ${payoutFlight.includes(id) ? 'casino-payout-flight' : ''}`} style={{ '--from-x': `${pos[0]}%`, '--from-y': `${pos[1]}%` } as CSSProperties} aria-hidden="true">◉</span> : null;
      })}
      {me && !me.folded && me.cards.length > 0 && <div className="casino-hand-label"><b>{handLabel([...me.cards, ...(table?.board || [])])}</b><small>{bestCards.length ? 'BEST FIVE HIGHLIGHTED' : 'YOUR HAND'}</small></div>}
      {payouts.length > 0 && <div className="casino-result" key={`winner-${table?.id}-${table?.handId}`} role="status"><Trophy aria-hidden="true" /><div><small>{payouts.length > 1 ? 'MULTIPLE WINNERS' : 'WINNER'}</small><b>{payouts.map(([id, n]) => `${table?.seats.find(p => p.id === id)?.name || 'Player'} +${n.toLocaleString()}`).join(' · ')}</b></div></div>}
      {!table && <div className="casino-preview-note">Your next great hand starts here.<span>Join an online table or warm up with practice.</span></div>}
      <div className={`casino-turn-prompt ${myTurn ? 'is-your-turn' : ''}`} role="status">{active ? myTurn ? 'Your move' : me?.folded ? 'You folded · watching the hand' : `${turnPlayer?.name || 'Player'} is thinking` : table?.phase === 'complete' ? 'Hand complete' : table ? 'Waiting for the next hand' : 'Take your seat'}{active && myTurn && <span>{remaining}s</span>}</div>
      <div className="casino-action-dock">{actions}</div>
    </div>
  </section>;
}
