import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {stableJSON} from '../packages/lab/core.mjs';
import {runLanguageFixture} from '../packages/lab/language-fixture.mjs';
const root=path.resolve(import.meta.dirname,'..');
const digest=data=>'sha256:'+createHash('sha256').update(data).digest('hex');
const protocolBytes=await readFile(path.join(root,'experiments/language/protocol.json')),protocol=JSON.parse(protocolBytes);
const configurations=[
  {sampleTokens:protocol.sampleTokens,mattrWindow:protocol.mattrWindow,candidateArm:'pooled_vocabulary_fixture'},
  {sampleTokens:protocol.sampleTokens,mattrWindow:protocol.mattrWindow,candidateArm:'polyphonic_fixture'},
  {sampleTokens:32,mattrWindow:8,candidateArm:'polyphonic_fixture',injectTopicMismatch:true},
  {sampleTokens:96,mattrWindow:8,candidateArm:'polyphonic_fixture'}
];
const runs=configurations.map(options=>runLanguageFixture(options)),repeat=configurations.map(options=>runLanguageFixture(options));
assert.equal(stableJSON(runs),stableJSON(repeat));
assert.ok(runs.slice(0,2).every(run=>run.comparisons.every(c=>c.eligible)));
assert.ok(runs.slice(2).every(run=>run.comparisons.every(c=>!c.eligible&&c.lexicalJSD.value===null&&c.authoredMATTRDifference.value===null)));
const sourceFiles=['packages/lab/language-analysis.mjs','packages/lab/language-fixture.mjs','tests/language-analysis.test.mjs','scripts/measure-language-fixture.mjs','experiments/language/protocol.json'];
const sourceHashes=Object.fromEntries(await Promise.all(sourceFiles.map(async file=>[file,digest(await readFile(path.join(root,file)))])));
const testReceipt=JSON.parse(await readFile(path.join(root,'experiments/test-receipt.json'),'utf8'));
assert.equal(testReceipt.exitCode,0,'Language measurement requires passing public tests');assert.equal(testReceipt.failed,0,'Language measurement requires passing public tests');
const result={schemaVersion:1,status:'PASSED',componentId:'C14',classification:'new_dossier_reference_implementation',protocolHash:digest(protocolBytes),protocol,sourceHashes,referenceTests:testReceipt.passed,replayEqual:true,runs,denominator:{configurations:4,comparisonAttempts:12,eligibleComparisons:6,ineligibleComparisons:6,providerCalls:0},boundary:'Seeded-free authored synthetic patterns. Fixed lexical measurement and explicit eligibility gates; no model or human-outcome evidence.'};
await writeFile(path.join(root,'experiments/language/results.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:result.status,configurations:4,eligibleComparisons:6,ineligibleComparisons:6,replayEqual:true,providerCalls:0}));
