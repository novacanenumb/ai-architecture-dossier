import assert from 'node:assert/strict';
import { pairedBootstrap, safeRatio, reductionRatio } from '../../packages/lab/analytics.mjs';
const mean=values=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
const modes=['full_capture_v1','sealed_archive_v2'];
export function deriveArchiveResults(summary) {
  assert.equal(summary.schemaVersion,1);
  assert.equal(summary.measurementProtocol.pairs,8);
  assert.equal(summary.arms.length,16);assert.equal(summary.warmups.length,2);
  assert.equal(summary.recordedArms,18);assert.equal(summary.requestedInferenceCalls,18);
  assert.equal(summary.measurementProtocol.bootstrap.iterations,4000);
  assert.equal(summary.measurementProtocol.bootstrap.seed,1729);
  assert.equal(summary.measurementProtocol.telemetryBothArms,true);
  const pairs=[];
  for(let index=0;index<8;index++) {
    const arms=summary.arms.filter(arm=>arm.pair===index);
    assert.equal(arms.length,2);assert.deepEqual(arms.map(a=>a.mode),index%2?[...modes].reverse():modes);
    const baseline=arms.find(a=>a.mode===modes[0]),candidate=arms.find(a=>a.mode===modes[1]);
    for(const arm of arms){assert.ok(['FULFILLED','FAILED'].includes(arm.status));if(arm.status==='FULFILLED'){assert.ok(Number.isFinite(arm.durationMs)&&arm.durationMs>=0);assert.ok(Number.isSafeInteger(arm.returnedJsonBytes)&&arm.returnedJsonBytes>0);assert.ok(arm.sharedHashes&&Object.keys(arm.sharedHashes).length===7);}}
    assert.equal(baseline.storedArchiveAndTimingBytes,null);
    const fulfilled=arms.every(a=>a.status==='FULFILLED');
    const equal=fulfilled&&JSON.stringify(baseline.sharedHashes)===JSON.stringify(candidate.sharedHashes);
    const eligible=equal&&candidate.reopenedSharedHashesEqual===true;
    const recorded=summary.pairs.find(pair=>pair.pair===index);assert.ok(recorded);
    assert.equal(recorded.eligible,eligible);assert.equal(recorded.sharedHashesEqual,equal);
    pairs.push({pair:index,eligible,baselineMs:baseline.durationMs,candidateMs:candidate.durationMs,baselineJsonBytes:baseline.returnedJsonBytes,candidateJsonBytes:candidate.returnedJsonBytes,candidateDiskBytes:candidate.storedArchiveAndTimingBytes,candidateTimingBytes:candidate.timingSidecarBytes,reason:eligible?null:recorded.reason});
  }
  const eligible=pairs.filter(p=>p.eligible),baselineMs=eligible.map(p=>p.baselineMs),candidateMs=eligible.map(p=>p.candidateMs);
  const baselineBytes=eligible.map(p=>p.baselineJsonBytes),candidateBytes=eligible.map(p=>p.candidateJsonBytes);
  assert.equal(summary.qualityGate.totalPairs,8);assert.equal(summary.qualityGate.eligiblePairs,eligible.length);assert.equal(summary.qualityGate.failedPairs,8-eligible.length);
  const baseMean=mean(baselineMs),candidateMean=mean(candidateMs),baseBytes=mean(baselineBytes),archiveBytes=mean(candidateBytes);
  return {schemaVersion:1,classification:summary.classification,measurementCalls:18,warmupArms:2,measuredArms:16,pairs,
    denominators:{totalPairs:8,eligiblePairs:eligible.length,excludedPairs:8-eligible.length,failedArms:summary.arms.filter(a=>a.status==='FAILED').length},
    localInferenceTime:{unit:'ms',baselineMean:baseMean,candidateMean,candidateToBaselineRatio:safeRatio(candidateMean,baseMean),bootstrap:eligible.length>=2?pairedBootstrap({baseline:baselineMs,candidate:candidateMs,iterations:4000,confidence:0.95,seed:1729}):null},
    returnedJson:{unit:'UTF8_bytes',baselineMean:baseBytes,candidateMean:archiveBytes,reduction:baseBytes===null?null:reductionRatio(baseBytes,archiveBytes),sameFormat:true},
    storedArchive:{candidateMeanBytes:mean(eligible.map(p=>p.candidateDiskBytes)),candidateTimingMeanBytes:mean(eligible.map(p=>p.candidateTimingBytes)),baselineBytes:null,ratio:null,inclusion:'Every sealed object and capture/manifest/seal plus separate observed timing sidecar; baseline creates no disk artifact.'},
    provenance:{qualityGate:'Exact shared synthetic distribution/record/collapse/frame/event hashes and read-only reopen parity',wallTimes:'Observed local CPU and disk fixture; allocation/directory preparation/reopen/semantic expansion/comparison hashing/byte enumeration excluded',statistics:'Deterministic derivation of frozen observations; timing remeasurement not deterministic',originalSuiteInferenceCalls:null,modelQuality:null,hostedTokens:null,hostedLatency:null,cost:null,providerCalls:0,telemetryOffArm:false,crscEvictionTested:false}};
}
