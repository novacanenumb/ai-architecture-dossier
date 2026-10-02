import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import { verifyRuntime, runtimeModule } from '../experiments/runtime/tests/runtime-helper.mjs';
import { pairedBootstrap } from '../packages/lab/analytics.mjs';
const root=path.resolve(import.meta.dirname,'..'), protocolPath=path.join(root,'experiments/runtime/scheduler-protocol.json');
const verified=await verifyRuntime();
const { BoundedScheduler }=await runtimeModule('01_ASTRA_CONTROL_PLANE/routing.mjs');
const { analysePerformance }=await runtimeModule('07_PERFORMANCE_PLANE/performance.mjs');
const { hash, hashBytes }=await runtimeModule('shared/core.mjs');
const bytes=await readFile(protocolPath), protocol=JSON.parse(bytes), protocolHash=hashBytes(bytes);
assert.equal(protocol.id,'supplied-scheduler/1'); assert.equal(protocol.pairs,8); assert.equal(protocol.seed,1729); assert.equal(protocol.baselineConcurrency,1); assert.equal(protocol.candidateConcurrency,3);
const sourcePaths=['01_ASTRA_CONTROL_PLANE/routing.mjs','07_PERFORMANCE_PLANE/performance.mjs','shared/core.mjs'];
const sourceHashes=Object.fromEntries(await Promise.all(sourcePaths.map(async file=>[file,hashBytes(await readFile(path.join(verified.root,'plugins/hypervisor-standalone/runtime',file)))])));
const identity={version:verified.version,manifestHash:verified.manifestHash,contentRoot:verified.contentRoot,verifiedFiles:verified.verifiedFiles};
const attempts=[];
async function runArm(pairIndex,arm,concurrency,orderInPair) {
  const start=performance.now(),intervals=[]; let outcome=null,analysis=null,values=null,error=null;
  try {
    outcome=await new BoundedScheduler({...protocol.limits,concurrency}).run(protocol.tasks,async(current,{signal})=>{
      const start_ms=performance.now()-start; await delay(protocol.taskDelaysMs[current.id],undefined,{signal});
      const value={id:current.id,sum:[1,2,3,current.id.length].reduce((total,n)=>total+n,0)};
      intervals.push({id:current.id,start_ms,end_ms:performance.now()-start}); return {value,usageTokens:null};
    });
    if(outcome.results.every(r=>r.status==='fulfilled')) {
      assert.equal(outcome.summary.calls,protocol.tasks.length); assert.equal(intervals.length,protocol.tasks.length);
      assert.ok(outcome.summary.maxSimultaneous<=concurrency); assert.equal(outcome.summary.usageTokens,null);
      values=Object.fromEntries(outcome.results.map(r=>[r.id,r.value]));
      analysis=analysePerformance({workers:intervals,context:{dag:protocol.tasks.map(t=>({id:t.id,dependencies:t.dependencies}))}});
    }
  } catch(e) { error={code:e.code??'BENCHMARK_ARM_ERROR',message:String(e.message).slice(0,256)}; }
  const fulfilled=!error&&outcome?.results.every(r=>r.status==='fulfilled')&&analysis;
  const record={ordinal:attempts.length+1,pairIndex,arm,orderInPair,concurrency,status:fulfilled?'fulfilled':'failed',error,failureCodes:outcome?.results.filter(r=>r.status!=='fulfilled').map(r=>({id:r.id,code:r.code}))??[],actualSchedulerWallMs:outcome?.summary.observedWallMs??null,callbackIntervalsMs:intervals,outputHash:values?hash(values):null,schedulerSummary:outcome?.summary??null,dagAnalysis:analysis,serialEstimateMs:analysis?.metrics.serial_execution_estimate.value??null,criticalPathMs:analysis?.metrics.critical_path_duration.value??null,providerCalls:0,modelCost:null,modelTokens:null,providerLatencyMs:null,modelQuality:null};
  attempts.push(record);
}
for(let pair=0;pair<protocol.pairs;pair++) {
  const order=pair%2===0?[['baseline',1],['candidate',3]]:[['candidate',3],['baseline',1]];
  for(const [position,[arm,concurrency]] of order.entries()) await runArm(pair,arm,concurrency,position);
}
const pairs=Array.from({length:protocol.pairs},(_,pairIndex)=>{
  const baseline=attempts.find(a=>a.pairIndex===pairIndex&&a.arm==='baseline'),candidate=attempts.find(a=>a.pairIndex===pairIndex&&a.arm==='candidate');
  const eligible=baseline.status==='fulfilled'&&candidate.status==='fulfilled'&&baseline.outputHash===candidate.outputHash&&Number.isFinite(baseline.actualSchedulerWallMs)&&Number.isFinite(candidate.actualSchedulerWallMs);
  return {pairIndex,eligible,exclusionReason:eligible?null:baseline.status!=='fulfilled'||candidate.status!=='fulfilled'?'FAILED_ARM':baseline.outputHash!==candidate.outputHash?'OUTPUT_HASH_MISMATCH':'MISSING_WALL_MEASUREMENT',baselineOutputHash:baseline.outputHash,candidateOutputHash:candidate.outputHash,outputHashesEqual:Boolean(baseline.outputHash&&baseline.outputHash===candidate.outputHash),baselineWallMs:baseline.actualSchedulerWallMs,candidateWallMs:candidate.actualSchedulerWallMs,candidateMinusBaselineMs:eligible?candidate.actualSchedulerWallMs-baseline.actualSchedulerWallMs:null};
});
const eligible=pairs.filter(p=>p.eligible),mean=values=>values.reduce((a,b)=>a+b,0)/values.length;
const bootstrap=eligible.length>=2?pairedBootstrap({baseline:eligible.map(p=>p.baselineWallMs),candidate:eligible.map(p=>p.candidateWallMs),iterations:4000,confidence:.95,seed:protocol.seed}):null;
assert.equal(hashBytes(await readFile(protocolPath)),protocolHash,'Frozen protocol changed');
for(const file of sourcePaths) assert.equal(hashBytes(await readFile(path.join(verified.root,'plugins/hypervisor-standalone/runtime',file))),sourceHashes[file],'Runtime source changed');
const measured={baselineMeanMs:eligible.length?mean(eligible.map(p=>p.baselineWallMs)):null,candidateMeanMs:eligible.length?mean(eligible.map(p=>p.candidateWallMs)):null};
measured.ratioOfPairedMeans=measured.candidateMeanMs>0?measured.baselineMeanMs/measured.candidateMeanMs:null;
const result={schemaVersion:1,benchmarkId:protocol.id,classification:'local_asynchronous_scheduler_fixture',nodeVersion:process.version,platform:process.platform,frozenBeforeExecution:true,protocol:{path:'experiments/runtime/scheduler-protocol.json',byteHashBefore:protocolHash,byteHashAfter:protocolHash,parsed:protocol},runner:{path:'scripts/benchmark-supplied-scheduler.mjs',byteHash:hashBytes(await readFile(import.meta.filename))},suppliedRuntime:{identity,sourceByteHashes:sourceHashes},denominator:{declaredPairs:8,declaredAttempts:16,recordedAttempts:attempts.length,failedAttempts:attempts.filter(a=>a.status==='failed').length,eligiblePairs:eligible.length,excludedPairs:pairs.length-eligible.length},attempts,pairs,measured,pairedStatistic:{estimand:'candidate_minus_baseline_actual_scheduler_wall_ms',bootstrap},interpretationLimits:{actualSerialBaselineExecuted:true,wallTimingDeterministic:false,bootstrapDeterministicConditionalOnObservedVector:true,neuralComputeDemonstrated:false,providerLatencyMeasured:false,billedCostMeasured:false,modelTokensMeasured:false,modelQualityMeasured:false,populationInferenceEstablished:false}};
await writeFile(path.join(root,'experiments/runtime/scheduler-results.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({denominator:result.denominator,measured,bootstrap}));
