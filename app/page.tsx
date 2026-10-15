'use client';
import { useCallback, useEffect, useRef, useState, Component, type ReactNode, type ComponentType } from 'react';
import { ArrowUpRight, ArrowLeft, Check, ChevronRight, Club, Crown, Globe2, Lock, Menu, Plus, Settings2, ShieldCheck, Spade, Users, Volume2, VolumeX, Wifi, X, ZoomIn, ZoomOut, Gift, Copy, Eye } from 'lucide-react';
import CasinoTable from '../components/CasinoTable';
import PracticeTable from '../components/PracticeTable';
import type { TableView } from '../game/engine';
type Lobby = {
    id: string;
    name: string;
    capacity: number;
    seated: number;
    blinds: string;
    phase: string;
};
type User = {
    id: string;
    name: string;
    wallet: number;
    daily: string;
};
type Config = {
    gameUrl: string;
    supabaseUrl: string;
    publishableKey: string;
    transport?: string;
};
const rooms: Lobby[] = [{ id: 'aurora', name: 'Aurora Lounge', capacity: 6, seated: 0, blinds: '10 / 20', phase: 'waiting' }, { id: 'meridian', name: 'The Meridian', capacity: 9, seated: 0, blinds: '10 / 20', phase: 'waiting' }, { id: 'duel', name: 'Heads-up Club', capacity: 2, seated: 0, blinds: '10 / 20', phase: 'waiting' }];
class SceneBoundary extends Component<{
    children: ReactNode;
}, {
    failed: boolean;
}> {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    render() { return this.state.failed ? <div className="scene-fallback">3D could not load on this device. Use the 2D view to play.</div> : this.props.children; }
}
function PlayingCard({ card }: {
    card: string | null;
}) { return <span className={`playing-card ${card && 'hd'.includes(card[1]) ? 'red' : ''}`}>{card ? <>{card[0] === 'T' ? '10' : card[0]}<small>{{ s: '♠', h: '♥', d: '♦', c: '♣' }[card[1]]}</small></> : 'V'}</span>; }
export default function Home() {
    const [Scene, setScene] = useState<ComponentType<{
        table?: TableView | null;
        quality?: string;
        zoom?: number;
    }> | null>(null);
    const [config, setConfig] = useState<Config>({ gameUrl: '', supabaseUrl: '', publishableKey: '' });
    const [endpoint, setEndpoint] = useState('');
    const [user, setUser] = useState<User | null>(null);
    const [table, setTable] = useState<TableView | null>(null);
    const [lobby, setLobby] = useState<Lobby[]>(rooms);
    const [connected, setConnected] = useState(false);
    const [status, setStatus] = useState('Early access preview');
    const [latency, setLatency] = useState<number | null>(null);
    const [page, setPage] = useState('lobby');
    const [modal, setModal] = useState('');
    const [toast, setToast] = useState('');
    const [quality, setQuality] = useState('high');
    const [twoD, setTwoD] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [sound, setSound] = useState(false);
    const [filter, setFilter] = useState('all');
    const [raise, setRaise] = useState(40);
    const [clock, setClock] = useState(Date.now());
    const [busy, setBusy] = useState(false);
    const [authMode, setAuthMode] = useState('login');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [roomCode, setRoomCode] = useState('');
    const [roomPassword, setRoomPassword] = useState('');
    const [roomName, setRoomName] = useState('My private table');
    const [buyIn, setBuyIn] = useState(1000);
    const [devUrl, setDevUrl] = useState('http://localhost:8080');
    const dialogRef = useRef<HTMLElement | null>(null);
    useEffect(() => {
        if (!modal)
            return;
        const previous = document.activeElement as HTMLElement | null;
        const dialog = dialogRef.current;
        const selector = 'button:not(:disabled),input,select,summary,[tabindex="0"]';
        (dialog?.querySelector(selector) as HTMLElement | null)?.focus();
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape')
                setModal('');
            if (e.key === 'Tab' && dialog) {
                const nodes = Array.from(dialog.querySelectorAll<HTMLElement>(selector));
                const first = nodes[0], last = nodes[nodes.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last?.focus();
                }
                else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first?.focus();
                }
            }
        };
        document.addEventListener('keydown', handler);
        return () => { document.removeEventListener('keydown', handler); previous?.focus(); };
    }, [modal]);
    const pingAt = useRef(0);
    const socket = useRef<WebSocket | null>(null);
    const reconnect = useRef<ReturnType<typeof setTimeout> | null>(null);
    const auth = useRef<{
        token: string;
        url: string;
    } | null>(null);
    const intentional = useRef(false);
    const audioRef = useRef<AudioContext | null>(null);
    const previous = useRef('');
    const notify = useCallback((text: string) => setToast(text), []);
    useEffect(() => {
        import('../components/PokerScene').then(m => setScene(() => m.default)).catch(() => setTwoD(true));
        fetch('/api/config').then(r => r.json()).then(value => { const c = value as Config; setConfig(c); setEndpoint(c.gameUrl); }).catch(() => notify('Connection configuration could not load'));
        const q = localStorage.getItem('velora-quality');
        if (q)
            setQuality(q);
        if (matchMedia('(prefers-reduced-motion: reduce)').matches)
            setTwoD(true);
        const query = new URLSearchParams(location.search);
        if (query.get('view') === 'table') setPage('table');
        if (query.get('view') === 'practice') setPage('practice');
        const code = query.get('room');
        if (code) {
            setRoomCode(code);
            setModal('private');
        }
        const timer = setInterval(() => setClock(Date.now()), 1000);
        return () => {
            clearInterval(timer);
            intentional.current = true;
            if (reconnect.current)
                clearTimeout(reconnect.current);
            socket.current?.close();
            audioRef.current?.close();
        };
    }, [notify]);
    useEffect(() => {
        if (!toast)
            return;
        const t = setTimeout(() => setToast(''), 5000);
        return () => clearTimeout(t);
    }, [toast]);
    const connect = useCallback((token: string, url: string) => {
        intentional.current = false;
        auth.current = { token, url };
        if (socket.current) {
            socket.current.onclose = null;
            socket.current.close();
        }
        setStatus('Connecting…');
        const ws = new WebSocket(url.replace(/^http/, 'ws').replace(/\/$/, '') + '/ws');
        socket.current = ws;
        ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', token }));
        ws.onmessage = e => {
            if (e.data === 'pong') {
                setLatency(Date.now() - pingAt.current);
                return;
            }
            const m = JSON.parse(e.data);
            if (m.type === 'authenticated') {
                setConnected(true);
                setStatus('Connected');
                sessionStorage.setItem(`velora-session:${url}`, token);
            }
            if (m.type === 'state') {
                setUser(m.user);
                setLobby(m.lobby);
                setTable(m.table);
                if (m.table) {
                    setPage('table');
                    if (m.table.legal)
                        setRaise(Math.min(m.table.legal.min, m.table.legal.max));
                }
            }
            if (m.type === 'error') {
                notify(m.message);
                setBusy(false);
                if (m.message === 'Authentication failed') {
                    sessionStorage.removeItem(`velora-session:${url}`);
                    intentional.current = true;
                    ws.close();
                    setStatus('Sign in again');
                }
            }
            if (m.type === 'ack')
                setBusy(false);
            if (m.type === 'pong')
                setLatency(Date.now() - m.at);
        };
        ws.onerror = () => setStatus('Server unavailable');
        ws.onclose = (event) => {
            setConnected(false);
            setBusy(false);
            if (event.reason === 'Session replaced') {
                intentional.current = true;
                setStatus('Signed in elsewhere');
                notify('This account connected in another tab. Sign in again to return.');
            }
            if (!intentional.current) {
                setStatus('Reconnecting…');
                reconnect.current = setTimeout(() => connect(token, url), 3000);
            }
        };
    }, [notify]);
    useEffect(() => {
        if (endpoint) {
            const token = sessionStorage.getItem(`velora-session:${endpoint}`);
            if (token)
                connect(token, endpoint);
        }
        return () => {
            if (reconnect.current)
                clearTimeout(reconnect.current);
        };
    }, [endpoint, connect]);
    useEffect(() => {
        if (!connected)
            return;
        const t = setInterval(() => { pingAt.current = Date.now(); socket.current?.send(config.transport === 'cloudflare' ? 'ping' : JSON.stringify({ type: 'ping', at: pingAt.current })); }, 15000);
        return () => clearInterval(t);
    }, [connected, config.transport]);
    useEffect(() => {
        const key = table ? `${table.handId}:${table.phase}` : '';
        if (sound && key && key !== previous.current && audioRef.current) {
            const ctx = audioRef.current;
            const osc = ctx.createOscillator(), g = ctx.createGain();
            osc.connect(g);
            g.connect(ctx.destination);
            osc.frequency.value = 520;
            g.gain.setValueAtTime(.03, ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .12);
            osc.start();
            osc.stop(ctx.currentTime + .12);
        }
        previous.current = key;
    }, [table, sound]);
    function send(message: Record<string, unknown>) {
        if (!connected) {
            setModal('auth');
            return;
        }
        setBusy(true);
        socket.current?.send(JSON.stringify({ ...message, id: crypto.randomUUID(), version: table?.version, handId: table?.handId }));
    }
    async function login(e: React.FormEvent) {
        e.preventDefault();
        setBusy(true);
        try {
            const url = endpoint || devUrl;
            if (!config.supabaseUrl) {
                const parsed = new URL(url);
                if (!['localhost', '127.0.0.1'].includes(parsed.hostname))
                    throw Error('Development guest access is limited to localhost. Configure the production server to open online play.');
                const response = await fetch(`${url}/guest`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
                const data = await response.json() as {
                    error?: string;
                    token: string;
                    msg?: string;
                    error_description?: string;
                    access_token?: string;
                };
                if (!response.ok)
                    throw Error(data.error || 'Could not join');
                setEndpoint(url);
                connect(data.token, url);
            }
            else {
                if (!config.supabaseUrl)
                    throw Error('Account registration is not open yet');
                const response = await fetch(`${config.supabaseUrl}/auth/v1/${authMode === 'signup' ? 'signup' : 'token?grant_type=password'}`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: config.publishableKey }, body: JSON.stringify({ email, password }) });
                const data = await response.json() as {
                    error?: string;
                    token: string;
                    msg?: string;
                    error_description?: string;
                    access_token?: string;
                };
                if (!response.ok)
                    throw Error(data.msg || data.error_description || 'Sign in failed');
                if (!data.access_token) {
                    notify('Check your email to confirm your account.');
                    setBusy(false);
                    return;
                }
                connect(data.access_token, url);
            }
            setModal('');
        }
        catch (e) {
            notify((e as Error).message);
        }
        finally {
            setBusy(false);
        }
    }
    function join(id: string, watch = false) {
        if (!connected) {
            setModal('auth');
            return;
        }
        send({ type: watch ? 'watch' : 'join', room: id, buyIn, password: roomPassword });
        setModal('');
    }
    function toggleSound() {
        if (!sound) {
            audioRef.current ??= new AudioContext();
            audioRef.current.resume();
        }
        setSound(!sound);
    }
    const me = table?.seats.find(p => p.id === user?.id);
    const legal = table?.legal;
    const seatCount = lobby.reduce((n, r) => n + r.seated, 0);
    const activeTable = !!table && !['waiting', 'complete'].includes(table.phase);
    const number = (n: number) => n.toLocaleString();
    return <div className={`app-shell ${(page === 'table' || page === 'practice') ? 'at-table' : ''}`}><aside className="sidebar"><a className="brand" href="/" aria-label="Velora home"><span className="brand-mark">V</span><span>VELORA<small>P O K E R</small></span></a><span className="nav-caption">THE CLUB</span><nav><button className={page === 'lobby' ? 'selected' : ''} onClick={() => setPage('lobby')}><Spade size={18}/> Poker lobby</button><button className={page === 'table' ? 'selected' : ''} onClick={() => setPage('table')}><Club size={18}/> {table ? 'Your table' : 'Explore the room'}</button><button onClick={() => setModal('private')}><Users size={18}/> Play with friends</button><button onClick={() => setModal('rewards')}><Gift size={18}/> Daily chips</button></nav><div className="sidebar-bottom"><div className="free-badge"><ShieldCheck size={22}/><strong>All play. No stakes.</strong><p>Free virtual chips.<br />Good company.</p></div><button className="settings-nav" onClick={() => setModal('settings')}><Settings2 size={17}/> Preferences</button><span className="version">FOUNDATION · 0.1</span></div></aside>
 <main><header className="topbar"><span className="mobile-brand">V <b>VELORA</b></span><span className="breadcrumb">THE CLUB <ChevronRight size={13}/> {page === 'lobby' ? 'Poker lobby' : 'Poker room'}</span><div className="top-actions"><span className={`connection ${connected ? 'online' : ''}`}><i />{connected ? `${latency === null ? 'Live' : latency + ' ms'}` : status}</span>{user ? <button className="balance" onClick={() => setModal('rewards')}><span>◉</span>{number(user.wallet)}<small>FREE CHIPS</small></button> : <button className="sign-in" onClick={() => setModal('auth')}>Sign in <ArrowUpRight size={15}/></button>}<button className="avatar" aria-label="Open profile" onClick={() => setModal(user ? 'profile' : 'auth')}>{user?.name.slice(0, 1).toUpperCase() || 'V'}</button></div></header>
 {page === 'lobby' ? <div className="lobby-page"><section className="hero"><div className="hero-copy"><div className="eyebrow"><span /> A NEW KIND OF POKER NIGHT</div><h1>Great hands.<br /><em>Better company.</em></h1><p>Your seat at a world of poker.<br />Real people. Beautiful tables. Always free to play.</p><div className="hero-buttons"><button className="primary" onClick={() => connected ? document.getElementById('tables')?.scrollIntoView({ behavior: 'smooth' }) : setModal('auth')}>Find your table <ArrowUpRight size={18}/></button><button className="text-button" onClick={() => setPage('practice')}>Practice with bots <ChevronRight size={15}/></button></div><div className="hero-foot"><ShieldCheck size={15}/> Virtual chips only <span>·</span> Texas Hold’em</div></div><div className="hero-scene"><SceneBoundary>{Scene && !twoD ? <Scene quality={quality}/> : <div className="felt-preview"><Spade size={50}/><span>VELORA</span></div>}</SceneBoundary><div className="scene-label"><i /> THE AURORA ROOM <span>Interactive 3D preview</span></div></div></section>
 <section className="benefits"><div><span className="benefit-icon"><Globe2 /></span><p><strong>One table. A world of friends.</strong><span>Built for shared poker nights.</span></p></div><div><span className="benefit-icon"><Crown /></span><p><strong>A little more extraordinary.</strong><span>A room designed around the game.</span></p></div><div><span className="benefit-icon"><Club /></span><p><strong>Play for the love of it.</strong><span>10,000 free chips when you join.</span></p></div></section>
 <section className="tables-section" id="tables"><div className="section-title"><div><span className="eyebrow">FIND YOUR PEOPLE</span><h2>Take a seat.</h2></div><button className="secondary" onClick={() => setModal('create')}><Plus size={16}/> Create private table</button></div><div className="table-toolbar"><div className="tabs">{[['all', 'All tables'], ['6', '6 players'], ['9', '9 players'], ['2', 'Heads-up']].map(([id, label]) => <button className={filter === id ? 'active' : ''} key={id} onClick={() => setFilter(id)}>{label}</button>)}</div><span className="live-count">{connected ? <><i />{seatCount} seated now</> : 'Online play opens after server setup'}</span></div><div className="room-grid">{lobby.filter(r => filter === 'all' || r.capacity === Number(filter)).map((r, i) => <article className={'room-card room-' + i} key={r.id}><div className="room-art"><div className="mini-table"><span>V</span><i /><i /><i /></div><span className="room-tag">{r.capacity === 2 ? 'HEADS-UP' : 'TEXAS HOLD’EM'}</span><span className="room-number">0{i + 1}</span></div><div className="room-body"><div className="room-heading"><h3>{r.name}</h3><span>{r.capacity} seats</span></div><div className="room-specs"><div><small>BLINDS</small><strong>{r.blinds}</strong></div><div><small>BUY-IN</small><strong>400 – 2K</strong></div><div><small>SEATED</small><strong>{connected ? `${r.seated} / ${r.capacity}` : '—'}</strong></div></div><button className="room-join" onClick={() => connected ? join(r.id) : setPage('table')}>{connected ? 'Join table' : 'Explore table'}<ArrowUpRight size={16}/></button></div></article>)}</div></section><div className="friends-banner"><div className="friends-symbol"><Users size={30}/></div><div><h3>Your friends. Your table.</h3><p>Make room for your favourite people. Private tables with a password and invite link.</p></div><button className="secondary" onClick={() => setModal('private')}>Join a private room <ArrowUpRight size={15}/></button></div><footer><span>© 2026 Velora Poker</span><span>Free-to-play · Virtual chips have no monetary value</span><button onClick={() => setModal('about')}>About this release</button></footer></div> :
            page === 'practice' ? <PracticeTable onExit={() => setPage('lobby')}/> : <div className="game-page"><CasinoTable table={table} userId={user?.id} clock={clock} toolbar={<><button className="casino-tool" onClick={() => setPage('lobby')} aria-label="Back to lobby"><ArrowLeft size={20}/></button><span className={`casino-connection ${connected ? 'online' : ''}`}>{connected ? '● LIVE' : 'PREVIEW'}</span><button className="casino-tool" onClick={toggleSound} aria-label={sound ? 'Mute sound' : 'Enable sound'}>{sound ? <Volume2 size={18}/> : <VolumeX size={18}/>}</button><button className="casino-tool" onClick={() => setModal('private')} aria-label="Invite friends"><Users size={18}/></button><button className="casino-tool" onClick={() => setModal('settings')} aria-label="Preferences"><Settings2 size={18}/></button></>} actions={<div className="actions">{!table ? <><button className="secondary" onClick={() => setModal('auth')}>Online play</button><button className="primary" onClick={() => setPage('practice')}>Practice with bots <ArrowUpRight size={17}/></button></> : !me ? <button className="primary" onClick={() => join(table.id)}>Take a seat</button> : !activeTable ? <><button className="secondary" onClick={() => send({ type: 'leave' })}>Leave table</button><button className="primary" disabled={busy || !connected || table.seats.filter(p => p.connected && p.stack > 0).length < 2} onClick={() => send({ type: 'start' })}>Deal next hand</button></> : <><button disabled={!legal || busy || !connected} className="fold-button" onClick={() => send({ type: 'action', move: { type: 'fold' } })}>Fold</button><button className="secondary" disabled={!legal || busy || !connected} onClick={() => send({ type: 'action', move: { type: legal?.call ? 'call' : 'check' } })}>{legal?.call ? 'Call ' + number(legal.call) : 'Check'}</button><div className="raise-control"><input aria-label="Raise to amount" type="number" value={raise} min={Math.min(legal?.min || 40, legal?.max || 40)} max={legal?.max || 2000} onChange={e => setRaise(Number(e.target.value))}/><button className="primary" disabled={!legal?.canRaise || busy || !connected} onClick={() => send({ type: 'action', move: { type: 'raise', amount: raise } })}>Raise to</button></div><button className="secondary" disabled={!legal || busy || !connected || (!legal.canRaise && legal.call === 0)} onClick={() => send({ type: 'action', move: legal?.canRaise ? { type: 'raise', amount: legal.max } : { type: 'call' } })}>{legal?.canRaise || (legal && me && legal.call === me.stack) ? 'All-in' : 'Call'}</button></>}</div>}/>{table && <details className="history"><summary>Hand activity · {table.handId.slice(0, 8) || 'Waiting for players'}</summary>{table.history.map((h, i) => <p key={i}>{h}</p>)}</details>}<div className="game-note">{table ? activeTable ? 'Turns last 30 seconds. Disconnected players check or fold automatically.' : 'Two connected players are needed. The next hand starts automatically.' : 'Room preview. Online tables require the game server to be connected.'}</div></div>}

 </main><nav className="mobile-nav"><button onClick={() => setPage('lobby')}><Spade size={20}/>Lobby</button><button onClick={() => setPage('table')}><Club size={20}/>Table</button><button onClick={() => setModal('private')}><Users size={20}/>Friends</button><button onClick={() => setModal('settings')}><Settings2 size={20}/>Settings</button></nav>
 {modal && <div className="modal-backdrop" onClick={() => setModal('')}><section ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-label={modal} onClick={e => e.stopPropagation()}><button className="close-modal" aria-label="Close dialog" onClick={() => setModal('')}><X size={20}/></button><span className="modal-brand">V</span>
 {modal === 'auth' ? <><span className="eyebrow">WELCOME TO THE CLUB</span><h2>Your next great hand.</h2>{endpoint && config.supabaseUrl ? <form onSubmit={login}><p>{authMode === 'signup' ? 'Start with 10,000 free virtual chips.' : 'Sign in to take your seat.'}</p><label>Email<input required type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email"/></label><label>Password<input required type="password" minLength={10} value={password} onChange={e => setPassword(e.target.value)} autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}/></label><button className="primary wide" disabled={busy}>{authMode === 'signup' ? 'Create account' : 'Sign in'}</button><button type="button" className="text-button" onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}>{authMode === 'login' ? 'New here? Create an account' : 'Already a member? Sign in'}</button></form> : <><p>Online registration is not open yet. The 3D room is ready to explore while multiplayer hosting is being connected.</p><button className="primary wide" onClick={() => { setModal(''); setPage('table'); }}>Explore the room <ArrowUpRight size={17}/></button><details className="dev-settings"><summary>Local development connection</summary><p>For testing with the separately running local game server.</p><form onSubmit={login}><label>Local server<input value={devUrl} onChange={e => setDevUrl(e.target.value)} type="url" required/></label><label>Player name<input value={name} onChange={e => setName(e.target.value)} minLength={2} maxLength={20} required/></label><button className="secondary wide" disabled={busy}>Connect local player</button></form></details></>}</> :
                modal === 'settings' ? <><h2>Make yourself comfortable.</h2><label>Graphics quality<select value={quality} onChange={e => { setQuality(e.target.value); localStorage.setItem('velora-quality', e.target.value); }}><option value="high">High — cinematic lighting</option><option value="low">Low — lighter on your device</option></select></label><button className="setting-row" onClick={() => setTwoD(!twoD)}>2D table view <span>{twoD ? 'On' : 'Off'}</span></button><button className="setting-row" onClick={toggleSound}>Game sounds <span>{sound ? 'On' : 'Off'}</span></button><p>Use low graphics or the 2D view on older phones. Landscape gives you more room at the table.</p></> :
                    modal === 'create' ? <><h2>A table of your own.</h2><p>Invite your friends to a password-protected room.</p><label>Room name<input value={roomName} maxLength={30} onChange={e => setRoomName(e.target.value)}/></label><label>Room password<input type="password" value={roomPassword} onChange={e => setRoomPassword(e.target.value)} minLength={8}/></label><button disabled={busy || roomPassword.length < 8} className="primary wide" onClick={() => {
                            if (!connected) {
                                setModal('auth');
                                return;
                            }
                            send({ type: 'create', name: roomName, password: roomPassword });
                            setModal('');
                        }}>Create table <Plus size={17}/></button></> :
                        modal === 'private' ? <><h2>Bring your people.</h2><p>Enter the room code and password shared by your host.</p><label>Room code<input value={roomCode} onChange={e => setRoomCode(e.target.value)}/></label><label>Password<input type="password" value={roomPassword} onChange={e => setRoomPassword(e.target.value)}/></label><label>Virtual chip buy-in<input type="number" value={buyIn} min={400} max={2000} onChange={e => setBuyIn(Number(e.target.value))}/></label><button className="primary wide" onClick={() => join(roomCode)}>Join room <ArrowUpRight size={17}/></button><button className="text-button" onClick={() => setModal('create')}>Create a new private table</button>{table && <button className="secondary wide" onClick={() => navigator.clipboard.writeText(`${location.origin}/?room=${table.id}`).then(() => notify('Invite link copied. Share the password separately.')).catch(() => notify('Clipboard unavailable'))}><Copy size={16}/>Copy current table invite</button>}</> :
                            modal === 'rewards' ? <><h2>Keep the good hands coming.</h2><div className="reward-amount">◉ 1,000</div><p>Free daily chips. One claim per UTC calendar day. Virtual chips cannot be purchased, transferred, or redeemed.</p><button className="primary wide" disabled={busy || user?.daily === new Date().toISOString().slice(0, 10)} onClick={() => {
                                    if (!connected) {
                                        setModal('auth');
                                        return;
                                    }
                                    send({ type: 'daily' });
                                }}>{user?.daily === new Date().toISOString().slice(0, 10) ? 'Claimed today' : 'Claim daily chips'}</button></> :
                                modal === 'profile' ? <><h2>{user?.name}</h2><p>Available balance</p><div className="reward-amount">◉ {number(user?.wallet || 0)}</div><p>Chips at a table are separate from your available balance.</p><button className="secondary wide" onClick={() => {
                                        intentional.current = true;
                                        if (reconnect.current)
                                            clearTimeout(reconnect.current);
                                        socket.current?.close();
                                        sessionStorage.removeItem(`velora-session:${endpoint}`);
                                        auth.current = null;
                                        setUser(null);
                                        setTable(null);
                                        setConnected(false);
                                        setStatus('Signed out');
                                        setModal('');
                                    }}>Sign out</button></> :
                                    <><h2>A new table. A fresh start.</h2><p>Velora is an independent social poker project. This foundation release includes an original 3D room and a separately runnable multiplayer game server.</p><p>Public multiplayer hosting and account provisioning are pending. Tournaments, friends lists, chat, moderation, and production security review are planned for later milestones.</p><div className="release-note"><ShieldCheck size={20}/>Free virtual chips only. No deposits, cash-out, or prizes.</div></>}
 </section></div>}{toast && <div className="toast" role="status">{toast}<button onClick={() => setToast('')} aria-label="Dismiss"><X size={16}/></button></div>}
 </div>;
}
