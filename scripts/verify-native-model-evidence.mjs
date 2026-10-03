import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
export async function verifyNativeModelEvidence(root){
 const read=f=>readFile(path.join(root,f)),json=async f=>JSON.parse(await read(f)),hash=v=>'sha256:'+createHash('sha256').update(v).digest('hex');
 const receipt=await json('experiments/native-model/test-receipt.json'),manifest=await json('experiments/native-model/source-manifest.json');
 assert.equal(receipt.status,'PASSED');assert.equal(receipt.sourceUnchanged,true);assert.equal(receipt.temporaryCopyRemoved,true);
 assert.equal(receipt.tests.collected,62);assert.equal(receipt.tests.passed,62);for(const field of ['failed','skipped','errors'])assert.equal(receipt.tests[field],0);
 assert.equal(receipt.originalTests.total,58);assert.equal(receipt.originalTests.passed,58);assert.equal(receipt.additionalTests.total,4);assert.equal(receipt.additionalTests.passed,4);
 assert.equal(receipt.tests.results.length,62);assert.ok(receipt.tests.results.every(t=>t.status==='PASSED'));assert.equal(new Set(receipt.tests.results.map(t=>t.id)).size,62);
 for(const[file,count]of[['test_gtfl_model.py',13],['test_gtfl_reference.py',28],['test_gtfl_native_lowering.py',17],['probe.py',4]])assert.equal(receipt.tests.results.filter(t=>t.id.startsWith(file+'::')).length,count);
 assert.equal(manifest.files.length,20);assert.equal(new Set(manifest.files.map(f=>f.path)).size,20);assert.deepEqual(receipt.sourceFiles,manifest.files);assert.equal(hash(await read('experiments/native-model/source-manifest.json')),receipt.sourceManifestHash);
 assert.equal(manifest.sourcePackage.sourceRedistributed,false);assert.ok(manifest.files.every(f=>f.bytes>0&&/^sha256:[a-f0-9]{64}$/.test(f.hash)));
 for(const[file,digest]of Object.entries(receipt.sourceHashes))assert.equal(hash(await read(file)),digest,'Stale native-model source: '+file);
 assert.equal(receipt.hypervisorDependency.version,'2.1.0');assert.equal(receipt.hypervisorDependency.verifiedFiles,85);
 assert.equal(receipt.protocol.hashBefore,receipt.protocol.hashAfter);assert.equal(receipt.protocol.hashBefore,hash(await read(receipt.protocol.path)));assert.deepEqual(receipt.protocol.parsed,await json(receipt.protocol.path));
 assert.equal(receipt.execution.exitCode,0);assert.equal(receipt.execution.pytestExitCode,0);assert.deepEqual(receipt.execution.libraries,{numpy:'2.5.3',pytest:'9.1.1',safetensors:'0.8.0',torch:'2.14.0'});
 const bytes=await read(receipt.summaryFile.path),summary=JSON.parse(bytes),o=summary.observed;
 assert.equal(hash(bytes),receipt.summaryFile.hash);assert.equal(bytes.length,receipt.summaryFile.bytes);assert.equal(summary.fixture.seed,2718);assert.equal(summary.fixture.summaryRepeats,2);
 assert.deepEqual(o.defaultTinyFamilyCounts,{codebook:16384,eta:12,kappa:512,relations:32768,u_alpha:192,u_beta:192});assert.equal(Object.values(o.defaultTinyFamilyCounts).reduce((a,b)=>a+b,0),50060);assert.equal(o.defaultTinyActualParameters,50060);
 assert.equal(o.smallActualParameters,404);assert.equal(o.smallConfiguredParameters,404);assert.equal(o.reference25mConfiguredParameters,25005068);assert.equal(o.reference25mInstantiated,false);
 assert.deepEqual(o.prohibitedPartialInventoryTypesPresent,[]);assert.equal(o.sameSeedParameterRootsEqual,true);assert.equal(o.sameSeedRecordsEqual,true);assert.equal(o.inferenceDidNotChangeParameters,true);assert.deepEqual(o.parameterRootsBefore,o.parameterRootsAfter);assert.equal(o.recordHashes[0],o.recordHashes[1]);
 assert.ok([...o.parameterRootsBefore,...o.parameterRootsAfter,...o.recordHashes].every(v=>/^sha256:[a-f0-9]{64}$/.test(v)));
 assert.equal(summary.providerCalls,0);for(const f of ['hostedCost','modelTokens','hostedLatency','modelQuality','defaultModelBaseline'])assert.equal(summary[f],null);
 assert.equal(receipt.controls.auditHook,'BEST_EFFORT');assert.equal(receipt.controls.operatingSystemConfinement,'UNAVAILABLE');assert.equal(receipt.controls.optimizerSteps,0);assert.equal(receipt.controls.trainingJob,false);assert.equal(receipt.controls.externalCheckpointLoaded,false);
 const coverage=await json('experiments/native-model/coverage.json');assert.deepEqual(coverage.components.map(c=>c.componentId),['C23','C25','C26']);
 const catalog=await json('dist/data/catalog.json');for(const c of coverage.components){const original=catalog.components.find(o=>o.id===c.componentId);assert.ok(c.acceptanceIds.every(id=>original.acceptance.some(a=>a.id===id)));}
 assert.deepEqual(await json('dist/data/native-model-evidence.json'),{...receipt,coverage});assert.equal(hash(await read('dist/data/native-model-summary.json')),hash(bytes));
 const native=await json('experiments/native-model/native/receipt.json'),text=(await read('experiments/native-model/native/validated-source.txt')).toString('utf8').slice(0,native.sourceCharacters);
 assert.equal(hash(JSON.stringify(text)),native.sourceTextHash);assert.equal(native.completionState,'REPORTED');assert.equal(native.persisted,false);assert.equal(native.actualHostProposalTurns,2);
 const fragments=[...text.matchAll(/```\n([\s\S]*?)\n```/g)].map(m=>JSON.parse(m[1]));assert.equal(fragments.length,2);
 for(const f of fragments){assert.ok(['docs/NATIVE_MODEL_EVIDENCE.md','experiments/native-model/probe.py'].includes(f.path));assert.equal((await read(f.path)).toString('utf8'),f.content);}
 assert.equal((await json('experiments/native-model/native/manifest.json')).final_artifact_hash,native.artifactHash);assert.equal((await json('experiments/native-model/native/performance.json')).gtfl.collapse_validity,'VALID');
 const history=await readdir(path.join(root,'experiments/native-model/history')),attempts=[];
 for(const directory of history.filter(n=>n.startsWith('attempt-')).sort()){
  const base='experiments/native-model/history/'+directory,r=await json(base+'/test-receipt.json');assert.equal(r.status,'FAILED');assert.equal(r.tests.collected,62);assert.equal(r.tests.failed+r.tests.passed,62);assert.equal(r.sourceUnchanged,true);assert.equal(r.temporaryCopyRemoved,true);
  for(const[snapshot,file]of[['runner-source.txt','scripts/test-native-model-source.mjs'],['probe-source.txt','experiments/native-model/probe.py'],['execute-source.txt','experiments/native-model/execute.py']])assert.equal(hash(await read(base+'/'+snapshot)),r.sourceHashes[file]);
  attempts.push(r.tests.passed);
 }
 assert.deepEqual(attempts,[57,57,61]);assert.equal((await json('experiments/native-model/history/native-timeout/receipt.json')).code,'TASK_TIMEOUT');
 return {nativeModelOriginalCases:58,nativeModelAdditionalProbes:4,nativeModelTotalPassed:62,nativeModelSourcePins:20,nativeModelPartialComponents:3,nativeModelDefaultTinyParameters:50060,nativeModel25mInstantiated:false,nativeModelFailedAttempts:3,nativeModelSourceMatches:2,nativeModelPortableVerification:'Checks retained source bindings and counts; does not independently instantiate Torch or recompute original CBOR roots.'};
}
