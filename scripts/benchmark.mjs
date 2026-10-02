import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { runComparison, stableJSON, createSyntheticHistory } from '../packages/lab/core.mjs';
import { pairedBootstrap, reductionRatio, mattr, repeatedTrigramRate, sentenceCV, jensenShannon } from '../packages/lab/analytics.mjs';
const root=path.resolve(import.meta.dirname,'..'), hash=data=>createHash('sha256').update(data).digest('hex');
const catalog=JSON.parse(await readFile(path.join(root,'component-registry.json'),'utf8'));
const tests=JSON.parse(await readFile(path.join(root,'experiments/test-receipt.json'),'utf8'));
if(tests.exitCode!==0||tests.failed!==0||!tests.passed) throw new Error('Passing executed test receipt required');
const sourceHashes={};
for(const file of Object.keys(tests.sourceHashes)) {
  sourceHashes[file]=hash(await readFile(path.join(root,file)));
  if(sourceHashes[file]!==tests.sourceHashes[file]) throw new Error('STALE_TEST_RECEIPT: '+file);
}
const configs=[];
for(const historySize of [8,32,64,128]) for(const workers of [1,2,4,8]) configs.push({historySize,workers,budgetBytes:6000,recentCount:12,retrievalLimit:12});
configs.push({historySize:64,workers:4,budgetBytes:100,recentCount:12,retrievalLimit:12});
const runs=[];
for(const [i,config] of configs.entries()) {
  const result=await runComparison(config), repeated=await runComparison(config);
  if(stableJSON(result)!==stableJSON(repeated)) throw new Error('FIXTURE_REPLAY_MISMATCH');
  runs.push({observationId:`E01-${String(i+1).padStart(2,'0')}`,config,datasetDigest:result.datasetDigest,replayDigest:hash(stableJSON(result)),arms:Object.fromEntries(Object.entries(result.arms).map(([name,a])=>[name,{status:a.status,noDispatch:a.noDispatch,bytes:a.bytes,exactFactRecall:a.exactFactRecall,reductionVsFull:a.noDispatch?null:reductionRatio(result.arms.full.bytes,a.bytes).value}]))});
}
const comparison=await runComparison({historySize:64,workers:4,budgetBytes:6000,recentCount:12,retrievalLimit:12});
const eligible=runs.filter(r=>!r.arms.combined.noDispatch&&!r.arms.sparse.noDispatch);
const bootstrap={pairedUnit:'fixture configuration',formulaVersion:'paired-percentile/1',byteDifference:pairedBootstrap({baseline:eligible.map(r=>r.arms.full.bytes),candidate:eligible.map(r=>r.arms.combined.bytes),seed:1729,iterations:2000,confidence:.95}),observationIds:eligible.map(r=>r.observationId),excludedFailedPairs:runs.length-eligible.length,limitation:'Fixed configuration sample, repeated histories; not independent population tasks, model quality, or noninferiority.'};
const failed=runs.filter(r=>r.arms.combined.noDispatch).length;
const partial={C02:['C02-T01','C02-T03','C02-T05'],C03:['C03-T01','C03-T02','C03-T03','C03-T04'],C27:['C27-T01','C27-T02','C27-T03','C27-T05']};
const coverage=catalog.components.map(c=>({componentId:c.id,mechanismStatus:['C02','C03','C27'].includes(c.id)?'TESTED_REFERENCE_SLICE':'SPECIFIED_NOT_IMPLEMENTED_HERE',acceptance:c.acceptance.map(a=>({id:a.id,status:partial[c.id]?.includes(a.id)?'PARTIAL_REFERENCE_EVIDENCE':'NOT_RUN',testFile:partial[c.id]?.includes(a.id)?(c.id==='C27'?'tests/analytics.test.mjs':'tests/core.test.mjs'):null,reason:'No full component acceptance claimed; see test names and limitations.'})),defaultModelComparison:null}));
const metricEndpoints=catalog.components.flatMap(c=>c.metrics.map(name=>({componentId:c.id,name,baseline:null,candidate:null,status:'UNAVAILABLE_MATCHED_COMPONENT_BACKEND_RUN',observationIds:[]})));
const output={schemaVersion:1,mode:'fixture',deterministic:true,tests,comparison,runs,coverage,metricEndpoints,statistics:{formulaVersion:'dossier-analytics/1',knownVectors:{mattr:mattr('a b a c',3),repeatedTrigrams:repeatedTrigramRate('a b c a b c a b c'),sentenceCV:sentenceCV('one two. one two three four!'),lexicalJSD:jensenShannon([.5,.5],[.75,.25])},bootstrap,failureRate:{value:failed/runs.length,numerator:failed,denominator:runs.length,formula:'failed combined configurations / all attempted configurations',observationIds:runs.map(r=>r.observationId)}},provenance:{providerCalls:0,synthetic:true,publicSafe:true,byteMethod:'UTF8 serialized input transport, headers and shared copies counted',formulaVersion:'dossier-context/1',defaultBaseline:'model-free full context; no standalone model executed',sourceHashes,configHash:hash(stableJSON(configs)),datasetHash:hash(stableJSON([8,32,64,128].map(size=>createSyntheticHistory({size})))),catalogHash:hash(stableJSON(catalog)),protocolHash:hash(await readFile(path.join(root,'experiments/protocol.json'))),benchmarkSourceHash:hash(await readFile(import.meta.filename)),hostedTokens:null,billedCost:null,hostedLatencyMs:null,streamedTPS:null,modelQuality:null}};
await mkdir(path.join(root,'dist/data'),{recursive:true});
await writeFile(path.join(root,'dist/data/results.json'),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({tests:tests.passed,configurations:runs.length,replayEqual:true,failedCombined:failed,primary:Object.fromEntries(Object.entries(comparison.arms).map(([k,a])=>[k,{bytes:a.bytes,exactFactRecall:a.exactFactRecall}]))}));
