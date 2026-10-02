import assert from 'node:assert/strict';
import { serializeCommits } from '../../packages/lab/serialized-commit.mjs';
const seeds = Object.freeze(Array.from({length:12},(_,i)=>2048+i));
const failure = error => ({name:error.name,code:error.code??null,message:String(error.message).slice(0,256)});
async function verify(Simulator,trace) { try { return {valid:(await Simulator.verify(trace)).valid===true,error:null}; } catch(error) { return {valid:false,error:failure(error)}; } }
async function duplicateRun(Simulator,seed,serialized) {
  const sim=new Simulator({seed,budget:1},{}); await sim.init(); if(serialized) serializeCommits(sim);
  const p=await sim.propose(), outcomes=await Promise.allSettled([sim.commit(p),sim.commit(p)]), accepted=outcomes.filter(o=>o.status==='fulfilled'&&o.value===true).length;
  const trace=sim.export(), verification=await verify(Simulator,trace);
  return {seed,serialized,accepted,outcomes:outcomes.map(o=>o.status==='fulfilled'?{status:o.status,accepted:o.value===true}:{status:o.status,error:failure(o.reason)}),prefixVersion:sim.prefixVersion,fragmentCount:sim.fragments.length,prefixHash:sim.prefixHash,verification,requirementPass:accepted===1&&sim.prefixVersion===1&&sim.fragments.length===1&&verification.valid};
}
export async function runProbe({Simulator,originalVersion}) {
  const runs=[]; for(const seed of seeds) runs.push({seed,baseline:await duplicateRun(Simulator,seed,false),adapted:await duplicateRun(Simulator,seed,true)});
  async function sentence() { const sim=serializeCommits(new Simulator({seed:4096,budget:1},{})); await sim.init(); for(let i=0;i<5;i++) assert.equal(await sim.step(),true); assert.equal(sim.status,'complete'); assert.equal(sim.fragments.length,5); const trace=sim.export(); assert.equal((await Simulator.verify(trace)).valid,true); return trace; }
  const trace=await sentence(), repeat=await sentence(); assert.deepEqual(trace.events,repeat.events); assert.equal(trace.transcript,repeat.transcript);
  // Exercise the adapter itself: thrown attempts remain visible, and the queue recovers.
  const calls=[], fake=serializeCommits({async commit(value){calls.push(value);if(value==='throw')throw new Error('public synthetic failure');return value;}});
  const queueCheck=await Promise.allSettled([fake.commit('throw'),fake.commit('next')]); assert.equal(queueCheck[0].status,'rejected'); assert.equal(queueCheck[1].value,'next'); assert.deepEqual(calls,['throw','next']); assert.equal(serializeCommits(fake),fake);
  const baselineFailures=runs.filter(r=>!r.baseline.requirementPass).length,adaptedFailures=runs.filter(r=>!r.adapted.requirementPass).length;
  const report={schemaVersion:1,probeId:'headspace-serialized-commit/c13-t01',originalVersion,classification:'actual_original_fixture_engine_with_new_in_process_adapter',fixture:{seeds,inventory:'empty',simultaneousAttemptsPerRun:2},requirement:{id:'C13-T01',text:'Exactly one concurrent duplicate commit becomes the unique next span with valid trace lineage',baseline:{failures:baselineFailures,denominator:runs.length,status:baselineFailures?'FAILED_BY_REQUIREMENT':'PASSED'},adapted:{failures:adaptedFailures,denominator:runs.length,status:adaptedFailures?'FAILED_BY_REQUIREMENT':'PASSED'}},runs,syntheticTrace:{seed:4096,sentences:1,fragments:5,events:trace.events.length,eventChainRoot:trace.events.at(-1).event_hash,prefixHash:await Simulator.verify(trace).then(r=>r.prefix_hash??null),eventsAndTranscriptDeterministic:true,timingTelemetryDeterministic:false},adapterQueueFailureRecovery:'PASSED',provenance:{providerCalls:0,hostedTokens:null,billedCost:null,hostedLatencyMs:null,modelQuality:null,originalSourceChanged:false,sourceCodeRedistributed:false},interpretationLimits:{nativeModelDemonstrated:false,generalSemanticValidation:false,rollback:false,durableTransaction:false,crossProcessExclusion:false,fixtureNotModelGeneration:true}};
  // Keep adverse original results while still requiring the new adapter to satisfy its narrow contract.
  if(adaptedFailures) {const error=new Error('Serialized adapter failed its declared contract');error.report=report;throw error;}
  return {report,replayTrace:trace};
}
