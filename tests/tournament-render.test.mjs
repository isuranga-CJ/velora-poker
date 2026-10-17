import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler/package.json'));
const {build}=wr('esbuild');await mkdir('node_modules/.cache',{recursive:true});
const dir=await mkdtemp(join(process.cwd(),'node_modules/.cache/cup-render-'));
try {
 const file=join(dir,'cup.cjs');await build({entryPoints:['components/TournamentLobby.tsx'],bundle:true,platform:'node',format:'cjs',packages:'external',outfile:file,jsx:'automatic',logLevel:'silent'});
 const {default:Lobby,CupTimer,CupStandings}=require(file);
 const cup={id:'cup',name:'Friday <script>',owner:'a',status:'registration',capacity:6,startingStack:5000,levelMs:360000,level:1,small:25,big:50,nextLevelAt:400000,createdAt:0,startedAt:null,finishedAt:null,totalChips:0,entries:[{id:'a',name:'Alice',connected:true,stack:0},{id:'b',name:'Bob',connected:false,stack:0}]};
 const props={cups:[cup],userId:'a',connected:true,supported:true,busy:false,clock:100000,inviteId:'cup',send(){},watch(){},notify(){},signIn(){}};
 test('Tournament lobby has honest sign-in and unsupported-service gates',()=>{
 const render=p=>renderToStaticMarkup(React.createElement(Lobby,p));assert.match(render({...props,connected:false}),/Sign in to create a Cup/);assert.doesNotMatch(render({...props,connected:false}),/Register · Free entry/);assert.match(render({...props,supported:false}),/service is updating/);
 });
 test('Host start requires every entrant online; names escape correctly and no late register is offered',()=>{
 const render=p=>renderToStaticMarkup(React.createElement(Lobby,p));const html=render(props);assert.match(html,/Friday &lt;script&gt;/);assert.match(html,/<button class="primary" disabled="">Start Cup/);assert.match(html,/Withdraw registration/);
 const running=render({...props,cups:[{...cup,status:'running'}]});assert.match(running,/Return to table/);assert.doesNotMatch(running,/Register · Free entry|Start Cup<|Withdraw registration/);
 const guest=render({...props,userId:'observer'});assert.doesNotMatch(guest,/Start Cup</);
 });
 test('Timer announces deferred blind changes and final standings name a champion',()=>{
 assert.match(renderToStaticMarkup(React.createElement(CupTimer,{cup:{...cup,status:'running'},clock:400001})),/Blinds rise next hand/);
 const complete={...cup,status:'complete',entries:cup.entries.map((p,i)=>({...p,rank:i+1,stack:i?0:10000}))};const html=renderToStaticMarkup(React.createElement(CupStandings,{cup:complete,userId:'a'}));assert.match(html,/Champion/);assert.match(html,/#2/);assert.match(html,/YOU/);
 });
}finally{await rm(dir,{recursive:true,force:true});}
