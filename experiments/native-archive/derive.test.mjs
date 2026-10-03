import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { deriveArchiveResults } from './derive.mjs';
const source=JSON.parse(await readFile(new URL('./summary.json',import.meta.url),'utf8'));
test('archive comparison preserves observed negative timing effect and matched bytes',()=>{
  const result=deriveArchiveResults(structuredClone(source));
  assert.equal(result.denominators.eligiblePairs,8);
  assert.ok(result.localInferenceTime.bootstrap.interval[0]>0);
  assert.ok(result.localInferenceTime.candidateToBaselineRatio.value>1);
  assert.ok(result.returnedJson.reduction.value>0);
  assert.equal(result.storedArchive.baselineBytes,null);assert.equal(result.storedArchive.ratio,null);
});
test('failed measured arm remains in total denominator while excluded from paired statistics',()=>{
  const changed=structuredClone(source), arm=changed.arms.find(a=>a.pair===0&&a.mode==='sealed_archive_v2');
  arm.status='FAILED';arm.sharedHashes=null;arm.reopenedSharedHashesEqual=null;
  changed.pairs[0].eligible=false;changed.pairs[0].sharedHashesEqual=false;changed.pairs[0].reason='ARM_FAILURE_OR_SHARED_SEMANTICS_DIFFER';
  changed.qualityGate.eligiblePairs=7;changed.qualityGate.failedPairs=1;
  const result=deriveArchiveResults(changed);
  assert.deepEqual(result.denominators,{totalPairs:8,eligiblePairs:7,excludedPairs:1,failedArms:1});
  assert.equal(result.pairs.length,8);assert.equal(result.localInferenceTime.bootstrap.sampleSize,7);
});
test('semantic mismatch cannot retain a claimed successful pair',()=>{
  const changed=structuredClone(source);
  changed.arms.find(a=>a.pair===0&&a.mode==='sealed_archive_v2').sharedHashes.distribution='sha256:'+'0'.repeat(64);
  assert.throws(()=>deriveArchiveResults(changed));
});
test('missing measured arm and altered order or bootstrap controls are rejected',()=>{
  const missing=structuredClone(source);missing.arms.pop();assert.throws(()=>deriveArchiveResults(missing));
  const order=structuredClone(source);order.arms.reverse();assert.throws(()=>deriveArchiveResults(order));
  const controls=structuredClone(source);controls.measurementProtocol.bootstrap.seed=1;assert.throws(()=>deriveArchiveResults(controls));
});
