import test from 'node:test';
import assert from 'node:assert/strict';
import { runtimeModule } from './runtime-helper.mjs';
const R = await runtimeModule('01_ASTRA_CONTROL_PLANE/routing.mjs');
const G = await runtimeModule('03_GENERATION_PLANE/generation.mjs');
const limits = { concurrency: 2, maxCalls: 8, maxRounds: 2, maxTokens: 4096, timeoutMs: 1000, totalTimeoutMs: 5000 };
const task = (id, dependencies = [], extra = {}) => ({ id, dependencies, round: 1, reservedTokens: 128, ...extra });
const code = expected => error => error.code === expected;
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
async function waitUntil(predicate) { const deadline = Date.now()+2000; while (!predicate()) { assert.ok(Date.now()<deadline, 'Rendezvous exceeded deadline'); await new Promise(resolve=>setImmediate(resolve)); } }
function observation(expertId, extra = {}) {
  return { scope: 'anchor', targetId: 'anchor-1', expertId, role: 'Sol', measurementId: 'measurement-'+expertId, sampleCount: 4, measurementProvenance: 'locally_observed', metrics: { quality: .8, domainCompetency: .7, reliability: .9, contextSuitability: .75, toolAccuracy: .85, cost: .2, latency: .3, contextOverhead: .1, ...(extra.metrics??{}) }, ...Object.fromEntries(Object.entries(extra).filter(([k])=>k!=='metrics')) };
}
test('C01 validates scheduler integer bounds', () => {
  assert.deepEqual(R.validateLimits(limits), limits);
  for (const [key,value] of [['concurrency',0],['concurrency',65],['maxCalls',-1],['maxRounds',0],['maxTokens',-1],['timeoutMs',0],['totalTimeoutMs',0],['maxCalls',1.5]]) assert.throws(()=>R.validateLimits({...limits,[key]:value}),code('INVALID_INTEGER'));
});
test('C01 stable launch ordering respects concurrency', async () => {
  const gates = new Map(['a','b','c'].map(id=>[id,deferred()])), started=[]; let active=0,maximum=0;
  const pending = new R.BoundedScheduler(limits).run(['c','a','b'].map(id=>task(id)),async current=>{
    started.push(current.id); maximum=Math.max(maximum,++active); await gates.get(current.id).promise; active--; return {value:current.id,usageTokens:10};
  });
  try { await waitUntil(()=>started.length===2); assert.deepEqual(started,['a','b']); gates.get('a').resolve(); gates.get('b').resolve(); await waitUntil(()=>started.length===3); assert.equal(started[2],'c'); }
  finally { for(const gate of gates.values()) gate.resolve(); }
  const result=await pending; assert.equal(maximum,2); assert.equal(result.summary.maxSimultaneous,2); assert.equal(result.summary.calls,3); assert.equal(result.summary.usageTokens,30); assert.equal(result.summary.externalExecutorConfinement,'UNAVAILABLE'); assert.equal(result.summary.cancellationEnforcement,'BEST_EFFORT');
});
test('C01 dependencies wait and failed parents block descendants', async () => {
  const gate=deferred(), events=[];
  const pending=new R.BoundedScheduler(limits).run([task('child',['parent']),task('parent')],async current=>{ events.push('start:'+current.id); if(current.id==='parent') await gate.promise; events.push('end:'+current.id); return {value:current.id,usageTokens:1}; });
  try { await waitUntil(()=>events.length===1); assert.deepEqual(events,['start:parent']); } finally { gate.resolve(); }
  await pending; assert.deepEqual(events,['start:parent','end:parent','start:child','end:child']);
  const calls=[]; const failed=await new R.BoundedScheduler(limits).run([task('root'),task('child',['root'])],async current=>{calls.push(current.id);throw Object.assign(new Error('fixture'),{code:'FIXTURE_FAILURE'});});
  assert.deepEqual(calls,['root']); assert.equal(failed.results.find(r=>r.id==='child').code,'DEPENDENCY_FAILED');
});
test('C01 malformed DAGs fail before dispatch', async () => {
  let calls=0; const execute=async()=>{calls++;return {value:null,usageTokens:0};};
  await assert.rejects(new R.BoundedScheduler(limits).run([task('a',['absent'])],execute),code('MISSING_TASK_DEPENDENCY'));
  await assert.rejects(new R.BoundedScheduler(limits).run([task('a',['b']),task('b',['a'])],execute),code('TASK_CYCLE')); assert.equal(calls,0);
});
test('C01 unknown usage stays null and token overruns stop work', async () => {
  const unknown=await new R.BoundedScheduler(limits).run([task('a')],async()=>({value:true,usageTokens:null})); assert.equal(unknown.summary.usageTokens,null); assert.equal(unknown.summary.tokenAccountingComplete,false);
  const missing=await new R.BoundedScheduler(limits).run([task('a')],async()=>({value:true})); assert.equal(missing.results[0].code,'INVALID_INTEGER');
  const overrun=await new R.BoundedScheduler(limits).run([task('a',[],{reservedTokens:2})],async()=>({value:true,usageTokens:3})); assert.equal(overrun.summary.stopCode,'TOKEN_RESERVATION_EXCEEDED'); assert.equal(overrun.summary.uncooperativeExecutorMayContinue,true);
});
test('C01 call round token timeout and cancellation limits prevent acceptance', async () => {
  const execute=async current=>({value:current.id,usageTokens:1});
  for(const [setting,tasks,expected] of [[{maxCalls:1},[task('a'),task('b')],'CALL_LIMIT'],[{maxRounds:1},[task('a',[],{round:2})],'ROUND_LIMIT'],[{maxTokens:64},[task('a')],'TOKEN_LIMIT']]) { const result=await new R.BoundedScheduler({...limits,...setting}).run(tasks,execute); assert.ok(result.results.some(r=>r.code===expected)); }
  const timed=await new R.BoundedScheduler({...limits,timeoutMs:10}).run([task('a',[],{timeoutMs:5})],async(_,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true}))); assert.equal(timed.results[0].code,'TASK_TIMEOUT');
  const controller=new AbortController(); controller.abort(); const canceled=await new R.BoundedScheduler(limits).run([task('a')],execute,{signal:controller.signal}); assert.equal(canceled.results[0].code,'CANCELED');
});
test('C15 measured routing requires complete observations and provenance', () => {
  const result=R.routeScore(observation('a'),{weights:{quality:2}}); assert.equal(result.score,2*.8+.7+.9+.75+.85-.2-.3-.1);
  assert.throws(()=>R.routeScore(observation('estimated',{measurementProvenance:'estimated'})),code('MEASURED_ROUTING_REQUIRED'));
  const missing=observation('missing'); delete missing.metrics.toolAccuracy; assert.throws(()=>R.routeScore(missing),code('MEASURED_ROUTING_METRICS_REQUIRED'));
  assert.throws(()=>R.routeScore({...observation('unknown'),confidence:.9}),code('INVALID_ROUTING_OBSERVATION'));
});
test('C15 eligible expert filtering and ties are deterministic', () => {
  const a=observation('a'),b=observation('b'),other=observation('z',{targetId:'other'}), target={scope:'anchor',targetId:'anchor-1',role:'Sol'};
  const result=R.selectMeasuredExpert([b,other,a],target); assert.equal(result.selected.expertId,'a'); assert.deepEqual(result.rankings.map(r=>r.expertId),['a','b']); assert.equal(R.selectMeasuredExpert([other],target).selected,null); assert.throws(()=>R.selectMeasuredExpert([a,a],target),code('DUPLICATE_ID'));
});
test('C15 escalation needs positive measured net gain', () => {
  assert.equal(R.shouldEscalate({qualityGain:.5,costDelta:.1,latencyDelta:.1,contextTokensDelta:.1,measurementProvenance:'provider_reported',minNetGain:.1}).allowed,true);
  assert.equal(R.shouldEscalate({qualityGain:0,costDelta:0,latencyDelta:0,contextTokensDelta:0,measurementProvenance:'locally_observed'}).allowed,false);
  assert.equal(R.shouldEscalate({qualityGain:1,measurementProvenance:'estimated'}).netGain,null);
});
test('C15 feedback creates an immutable future-only revision', () => {
  const profile=Object.freeze({revision:1,weights:Object.freeze({quality:1})}), before=structuredClone(profile); const updated=R.updateRoutingProfile(profile,{runId:'run-fixture',measurementProvenance:'locally_observed',metrics:{quality:.8}});
  assert.deepEqual(profile,before); assert.equal(updated.revision,2); assert.equal(updated.appliesTo,'future_runs_only'); assert.ok(updated.previousProfileHash); assert.ok(updated.profileHash);
  assert.throws(()=>R.updateRoutingProfile(profile,{runId:'run-bad',measurementProvenance:'locally_observed',metrics:{modelConfidence:.9}}),code('INVALID_FEEDBACK_METRICS'));
});
test('C07 FAST plan retains dependency and proposal authority boundaries', () => {
  const authority={capabilities:['context.read','proposal.submit'],network:false,mutation:false};
  const graph=G.compileAnchorGraph({request:{objective:'Bounded proposals',requirements:[{id:'rp',text:'Parent'},{id:'rc',text:'Child'}]},anchors:[{id:'parent',objective:'Parent',requirementIds:['rp']},{id:'child',objective:'Child',requirementIds:['rc'],dependencies:['parent']}],authority});
  const input={graph,profile:'FAST',authority,budget:limits}; const plan=R.compileRoutingPlan(input), parent=graph.anchors.find(a=>a.logicalId==='parent'), child=graph.anchors.find(a=>a.logicalId==='child');
  const parentTask=plan.anchorTasks.find(t=>t.anchorId===parent.id), childTask=plan.anchorTasks.find(t=>t.anchorId===child.id); assert.ok(childTask.dependencies.includes(parentTask.id)); assert.ok(plan.anchorTasks.every(t=>t.kind==='candidate'&&t.authority.proposalOnly&&!t.authority.network&&!t.authority.mutation));
  assert.equal(plan.routingPlanHash,R.compileRoutingPlan(input).routingPlanHash); assert.throws(()=>R.compileRoutingPlan({...input,budget:{...limits,invented:1}}),code('UNKNOWN_BUDGET_KEY'));
});
