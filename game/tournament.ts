import { active, newTable, start, type Table } from './engine.ts';
import { randomInt } from './random.ts';

export const CUP_STACK = 5000;
export const CUP_LEVEL_MS = 6 * 60 * 1000;
export const CUP_BLINDS = [[25,50],[50,100],[75,150],[100,200],[150,300],[200,400],[300,600],[500,1000],[750,1500],[1000,2000],[1500,3000],[2500,5000],[5000,10000],[10000,20000]] as const;
export type Entrant = { id: string; name: string; rank?: number; eliminatedAt?: number };
export type Cup = {
    owner: string; status: 'registration' | 'running' | 'complete' | 'cancelled';
    entries: Entrant[]; createdAt: number; startedAt?: number; finishedAt?: number;
    level: number; settledHand: string; handStacks: Record<string,number>;
};
export function newCup(owner: string, now = Date.now()): Cup {
    return { owner, status:'registration', entries:[], createdAt:now, level:0, settledHand:'', handStacks:{} };
}
export function cupLevel(c: Cup, now: number) {
    return Math.min(CUP_BLINDS.length - 1, Math.max(0, Math.floor((now - (c.startedAt ?? now)) / CUP_LEVEL_MS)));
}
export function registerCup(c: Cup, id: string, name: string) {
    if (c.status !== 'registration') throw Error('Registration is closed');
    if (c.entries.some(p => p.id === id)) throw Error('Already registered');
    if (c.entries.length >= 6) throw Error('Friends Cup is full');
    c.entries.push({id,name});
}
export function unregisterCup(c: Cup, id: string) {
    if (c.status !== 'registration') throw Error('Registration is closed');
    if (!c.entries.some(p => p.id === id)) throw Error('You are not registered');
    c.entries = c.entries.filter(p => p.id !== id);
}
export function beginCup(c: Cup, t: Table, actor: string, connected: Set<string>, now = Date.now()) {
    if (actor !== c.owner) throw Error('Only the host can start this Cup');
    if (c.status !== 'registration') throw Error('Cup has already started or closed');
    if (c.entries.length < 2) throw Error('Register at least two players');
    if (c.entries.some(p => !connected.has(p.id))) throw Error('All registered players must be online to start');
    const order = [...c.entries];
    for (let i = order.length - 1; i > 0; i--) { const j = randomInt(i+1); [order[i],order[j]] = [order[j],order[i]]; }
    const fresh = newTable(t.id,t.name,6);
    fresh.version = t.version + 1;
    fresh.seats = order.map(p => ({id:p.id,name:p.name,stack:CUP_STACK,bet:0,total:0,cards:[],folded:false,acted:false,actedAt:-1,connected:true}));
    Object.assign(t, fresh);
    c.status = 'running'; c.startedAt = now;
    dealCup(c,t,now);
}
export function assertCupChips(c: Cup, t: Table) {
    if (c.status === 'registration' || c.status === 'cancelled') return;
    const chips = t.seats.reduce((n,p) => n+p.stack+p.total,0);
    if (chips !== c.entries.length * CUP_STACK || t.seats.some(p => !Number.isSafeInteger(p.stack) || p.stack < 0 || !Number.isSafeInteger(p.total) || p.total < 0))
        throw Error('Tournament chip integrity check failed');
}
export function settleCup(c: Cup, t: Table, now = Date.now()) {
    assertCupChips(c,t);
    if (c.status !== 'running' || t.phase !== 'complete' || c.settledHand === t.handId) return;
    c.settledHand = t.handId;
    const alive = t.seats.filter(p => p.stack > 0);
    const busted = c.entries.filter(p => !p.rank && t.seats.some(s => s.id === p.id && s.stack === 0))
        .sort((a,b) => c.handStacks[b.id] - c.handStacks[a.id]);
    let rank = alive.length + 1;
    busted.forEach((p,i) => {
        if (i && c.handStacks[p.id] !== c.handStacks[busted[i-1].id]) rank = alive.length+1+i;
        p.rank = rank; p.eliminatedAt = now;
    });
    if (alive.length === 1) {
        c.entries.find(p => p.id === alive[0].id)!.rank = 1;
        c.status = 'complete'; c.finishedAt = now;
    }
}
export function dealCup(c: Cup, t: Table, now = Date.now()) {
    settleCup(c,t,now);
    if (c.status !== 'running') throw Error('Cup is not running');
    if (active(t)) throw Error('Hand already running');
    c.level = cupLevel(c,now);
    [t.small,t.big] = CUP_BLINDS[c.level];
    c.handStacks = Object.fromEntries(t.seats.map(p => [p.id,p.stack]));
    start(t,{includeDisconnected:true});
    // A forced all-in from the blinds can settle immediately.
    settleCup(c,t,now);
}
export function cupView(c: Cup, t: Table, online: Set<string>) {
    const total = c.entries.length * CUP_STACK;
    return {
        id:t.id, name:t.name, owner:c.owner, status:c.status, capacity:6,
        startingStack:CUP_STACK, levelMs:CUP_LEVEL_MS, level:c.level+1,
        small:CUP_BLINDS[c.level][0], big:CUP_BLINDS[c.level][1],
        nextLevelAt:c.startedAt !== undefined && c.level < CUP_BLINDS.length-1 ? c.startedAt+(c.level+1)*CUP_LEVEL_MS : null,
        createdAt:c.createdAt, startedAt:c.startedAt ?? null, finishedAt:c.finishedAt ?? null,
        totalChips:c.status === 'registration' ? 0 : total,
        entries:c.entries.map(p => ({...p, connected:online.has(p.id), stack:t.seats.find(s => s.id===p.id)?.stack ?? 0})),
    };
}
export type CupView = ReturnType<typeof cupView>;
