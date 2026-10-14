import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const require=createRequire(import.meta.url);
const wranglerRequire=createRequire(require.resolve('wrangler/package.json'));
const {Miniflare}=wranglerRequire('miniflare');
const directory=await mkdtemp(join(tmpdir(),'velora-worker-'));
const run=promisify(execFile);
await run(process.execPath,['node_modules/wrangler/bin/wrangler.js','deploy','--dry-run','--config','workers/wrangler.jsonc','--outdir',directory],{env:{...process.env,WRANGLER_SEND_METRICS:'false'},maxBuffer:1024*1024});
const origin='https://velora-poker-cj.dewybow7.chatgpt.site';
const identities=new Map();
function identity(){const id=randomUUID();const claims={exp:Math.floor(Date.now()/1000)+3600,sub:id};const token='header.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.test-signature';identities.set(token,{id,email_confirmed_at:new Date().toISOString()});return{id,token};}
function runtime(persist,configured=true){return new Miniflare({rootPath:directory,modulesRoot:directory,modules:true,scriptPath:join(directory,'index.js'),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],durableObjects:{POKER:{className:'PokerWorld',useSQLite:true}},durableObjectsPersist:persist,bindings:{ALLOWED_ORIGINS:origin,...configured?{SUPABASE_URL:'https://auth.test',SUPABASE_PUBLISHABLE_KEY:'test-public-key'}:{}},outboundService:async request=>{
 if(new URL(request.url).hostname!=='auth.test')return new Response('Blocked test network',{status:403});
 const bearer=request.headers.get('Authorization')||'';const user=identities.get(bearer.replace(/^Bearer /,''));return Response.json(user||{error:'Invalid token'},{status:user?200:401});
 }});}
async function client(mf,g){const result=await mf.dispatchFetch('https://poker.test/ws',{headers:{Upgrade:'websocket',Origin:origin}});assert.equal(result.status,101);const ws=result.webSocket;assert.ok(ws);const inbox=[];let state;
 ws.addEventListener('message',event=>{if(event.data==='pong'){inbox.push({type:'auto-pong'});return;}const value=JSON.parse(event.data);inbox.push(value);if(value.type==='state')state=value;});ws.accept();
 const wait=async (predicate,timeout=1500)=>{for(let i=0;i<Math.ceil(timeout/5);i++){const index=inbox.findIndex(predicate);if(index>=0)return inbox.splice(index,1)[0];await new Promise(r=>setTimeout(r,5));}throw Error('Worker message timeout: '+JSON.stringify(inbox));};
 const send=value=>ws.send(JSON.stringify(value));send({type:'auth',token:g.token});await wait(m=>m.type==='authenticated');await wait(m=>m.type==='state');
 return{ws,send,wait,get state(){return state;},async command(value){const id=randomUUID();send({...value,id});const response=await wait(m=>m.type==='error'||m.type==='ack'&&m.id===id);await new Promise(r=>setTimeout(r,10));return response;}};
}
test('Cloudflare runtime: three WebSocket clients play a complete authoritative hand with private cards',{timeout:20000},async()=>{
 const mf=runtime(join(directory,'play'));const sockets=[];
 try{const [ga,gb,gc]=[identity(),identity(),identity()];const [a,b,c]=await Promise.all([ga,gb,gc].map(g=>client(mf,g)));sockets.push(a,b,c);
 assert.equal((await a.command({type:'join',room:'aurora',buyIn:1000})).type,'ack');assert.equal((await b.command({type:'join',room:'aurora',buyIn:1000})).type,'ack');await c.command({type:'watch',room:'aurora'});
 let t=a.state.table;await a.command({type:'start',version:t.version,handId:t.handId});await new Promise(r=>setTimeout(r,20));assert.ok(c.state.table.seats.every(p=>p.cards.every(card=>card===null)));assert.equal(a.state.table.seats.find(p=>p.id===gb.id).cards[0],null);assert.ok(!('deck' in c.state.table));
 assert.equal((await c.command({type:'action',move:{type:'fold'},version:c.state.table.version,handId:c.state.table.handId})).type,'error');
 let actions=0;while(a.state.table.phase!=='complete'){assert.ok(actions++<50);t=a.state.table;const actor=t.seats[t.turn].id===ga.id?a:b;const response=await actor.command({type:'action',move:{type:actor.state.table.legal.call?'call':'check'},version:t.version,handId:t.handId});assert.equal(response.type,'ack',JSON.stringify(response));}
 assert.equal(a.state.table.board.length,5);assert.equal(a.state.table.seats.reduce((s,p)=>s+p.stack,0),2000);
 const id=randomUUID();a.send({type:'daily',id});a.send({type:'daily',id});await a.wait(m=>m.type==='ack'&&m.id===id);assert.equal((await a.wait(m=>m.type==='ack'&&m.id===id)).duplicate,true);await new Promise(r=>setTimeout(r,20));assert.equal(a.state.user.wallet,10000);
 const illegal=await a.command({type:'action',move:{type:'fold'},version:0,handId:'old-hand'});assert.equal(illegal.type,'error');
 a.ws.send('ping');await a.wait(m=>m.type==='auto-pong');
 await a.command({type:'leave'});await b.command({type:'leave'});assert.equal(a.state.user.wallet+b.state.user.wallet,21000);
 await a.command({type:'create',name:'Private beta',password:'friends-only-2026'});const room=a.state.table.id;assert.ok(!a.state.lobby.some(r=>r.id===room));assert.equal((await c.command({type:'watch',room,password:'wrong'})).type,'error');assert.equal((await c.command({type:'watch',room,password:'friends-only-2026'})).type,'ack');
 }finally{for(const c of sockets)c.ws.close();await mf.dispose();}
});
test('Cloudflare durable storage survives a cold runtime restart and restores an account and seat',{timeout:20000},async()=>{
 const persist=join(directory,'restart');let mf=runtime(persist);const g=identity();let c;
 try{c=await client(mf,g);await c.command({type:'join',room:'aurora',buyIn:1000});assert.equal(c.state.user.wallet,9000);c.ws.close();await new Promise(r=>setTimeout(r,30));await mf.dispose();mf=runtime(persist);c=await client(mf,g);assert.equal(c.state.user.wallet,9000);assert.equal(c.state.table.seats.find(p=>p.id===g.id).stack,1000);assert.equal(c.state.table.seats.find(p=>p.id===g.id).connected,true);
 }finally{c?.ws.close();await mf.dispose();}
});
test('Cloudflare denies unconfigured gameplay, bad origins and invalid identity tokens',{timeout:20000},async()=>{
 let mf=runtime(join(directory,'closed'),false);
 try{assert.equal((await mf.dispatchFetch('https://poker.test/ready')).status,503);assert.equal((await mf.dispatchFetch('https://poker.test/ws',{headers:{Upgrade:'websocket',Origin:origin}})).status,503);}finally{await mf.dispose();}
 mf=runtime(join(directory,'auth'));try{
 assert.equal((await mf.dispatchFetch('https://poker.test/ws',{headers:{Upgrade:'websocket',Origin:'https://evil.test'}})).status,403);
 const result=await mf.dispatchFetch('https://poker.test/ws',{headers:{Upgrade:'websocket',Origin:origin}});const ws=result.webSocket;ws.accept();const next=new Promise(resolve=>ws.addEventListener('message',event=>resolve(JSON.parse(event.data)),{once:true}));ws.send(JSON.stringify({type:'auth',token:'invalid'}));assert.equal((await next).message,'Authentication failed');ws.close();
 }finally{await mf.dispose();}
});
test('Cloudflare alarms automatically deal and settle an unattended heads-up turn',{timeout:45000},async()=>{
 const mf=runtime(join(directory,'alarms'));const sockets=[];
 try{const a=await client(mf,identity()),b=await client(mf,identity());sockets.push(a,b);await a.command({type:'join',room:'duel',buyIn:1000});await b.command({type:'join',room:'duel',buyIn:1000});
 await a.wait(m=>m.type==='state'&&m.table?.phase==='preflop',11000);
 await a.wait(m=>m.type==='state'&&m.table?.phase==='complete',35000);
 assert.equal(a.state.table.seats.reduce((s,p)=>s+p.stack,0),2000);assert.equal(a.state.table.turn,-1);assert.equal(Object.values(a.state.table.payouts).reduce((s,n)=>s+n,0),30);
 }finally{for(const c of sockets)c.ws.close();await mf.dispose();}
});
test.after(async()=>{await rm(directory,{recursive:true,force:true});});
