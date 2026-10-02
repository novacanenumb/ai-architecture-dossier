import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {runLanguageFixture} from '../packages/lab/language-fixture.mjs';

export async function verifyLanguageEvidence(root,catalog,referenceReceipt) {
  const bytes=file=>readFile(path.join(root,file)),json=async file=>JSON.parse(await bytes(file)),hash=data=>'sha256:'+createHash('sha256').update(data).digest('hex');
  const r=await json('experiments/language/results.json'),protocol=await json('experiments/language/protocol.json'),coverage=await json('experiments/language/coverage.json');
  assert.equal(r.status,'PASSED');assert.equal(r.classification,'new_dossier_reference_implementation');assert.equal(r.referenceTests,40);assert.equal(referenceReceipt.passed,40);assert.equal(r.replayEqual,true);
  assert.deepEqual(r.protocol,protocol);assert.equal(r.protocolHash,hash(await bytes('experiments/language/protocol.json')));
  for(const [file,digest]of Object.entries(r.sourceHashes))assert.equal(hash(await bytes(file)),digest,'Stale language source '+file);
  assert.equal(r.runs.length,4);assert.deepEqual(r.denominator,{configurations:4,comparisonAttempts:12,eligibleComparisons:6,ineligibleComparisons:6,providerCalls:0});
  let attempts=0,eligible=0,ineligible=0;
  for(const run of r.runs){
    assert.deepEqual(run,runLanguageFixture(run.config));assert.equal(run.records.length,9);assert.equal(run.analyses.length,9);assert.equal(run.comparisons.length,3);
    assert.ok(run.records.every(x=>x.participant.kind==='synthetic'));assert.ok(run.analyses.every(x=>x.synthetic===true&&x.participant.kind==='synthetic'));
    assert.equal(run.provenance.providerCalls,0);for(const key of ['hostedTokens','billedCost','hostedLatencyMs','modelQuality','humanOutcome','semanticAlignment','transferTaskScore'])assert.equal(run.provenance[key],null);
    for(const c of run.comparisons){attempts++;assert.equal(c.humanOutcome,null);assert.equal(c.semanticAlignment,null);assert.equal(c.transferTaskScore,null);if(c.eligible){eligible++;assert.equal(c.matchedTokens,32);assert.ok(Number.isFinite(c.lexicalJSD.value));}else{ineligible++;assert.ok(c.reasons.length);assert.equal(c.lexicalJSD.value,null);assert.equal(c.authoredMATTRDifference.value,null);assert.equal(c.matchedTokens,null);}}
  }
  assert.equal(attempts,12);assert.equal(eligible,6);assert.equal(ineligible,6);
  assert.equal(coverage.fullComponentAcceptance,false);assert.equal(coverage.status,'PARTIAL_NEW_REFERENCE_EVIDENCE');const c14=catalog.components.find(c=>c.id==='C14');assert.deepEqual(coverage.acceptance.map(a=>a.id),c14.acceptance.map(a=>a.id));
  for(const a of coverage.acceptance){assert.equal(a.testFile,'tests/language-analysis.test.mjs');assert.equal(a.command,'npm test');assert.ok(a.boundary);}
  assert.deepEqual(await json('dist/data/language-results.json'),{...r,coverage});
  for(const file of ['language-analysis.mjs','language-fixture.mjs'])assert.equal(hash(await bytes('dist/lib/'+file)),hash(await bytes('packages/lab/'+file)));
  const native=await json('experiments/language/native/receipt.json'),text=(await bytes('experiments/language/native/validated-source.txt')).toString('utf8');
  assert.equal(hash(JSON.stringify(text.slice(0,native.sourceCharacters))),native.sourceTextHash);assert.equal(native.completionState,'REPORTED');assert.equal(native.persisted,false);assert.equal(native.nativeCandidateContracts,2);assert.equal(native.hostProposalTurns,2);
  let sourceMatches=0;for(const match of text.matchAll(/```\n([\s\S]*?)\n```/g)){const node=JSON.parse(match[1]);assert.ok(['packages/lab/language-analysis.mjs','tests/language-analysis.test.mjs'].includes(node.path));assert.equal((await bytes(node.path)).toString('utf8'),node.content);sourceMatches++;}
  assert.equal(sourceMatches,2);assert.equal((await json('experiments/language/native/manifest.json')).final_artifact_hash,native.artifactHash);assert.equal((await json('experiments/language/native/performance.json')).gtfl.collapse_validity,'VALID');
  const focused=await json('experiments/language/history/initial-focused-check/receipt.json');assert.equal(focused.status,'FAILED');assert.equal(focused.total,16);assert.equal(focused.passed,15);assert.equal(focused.failed,1);assert.equal(hash(await bytes('experiments/language/history/initial-focused-check/tests-source.txt')),focused.sourceHash);
  const failed=await json('experiments/language/history/initial-full-check/test-receipt.json');assert.equal(failed.total,40);assert.equal(failed.passed,39);assert.equal(failed.failed,1);
  for(const [file,digest]of Object.entries(failed.sourceHashes)){const retained=file==='tests/language-analysis.test.mjs'?'experiments/language/history/initial-focused-check/tests-source.txt':file;assert.equal(hash(await bytes(retained)).slice(7),digest);}
  const previous=await json('experiments/language/history/reference-24/test-receipt.json');assert.equal(previous.passed,24);assert.equal(previous.failed,0);for(const [file,digest]of Object.entries(previous.sourceHashes))assert.equal(hash(await bytes(file)).slice(7),digest);
  const tap=(await bytes('experiments/test-output.tap')).toString('utf8');assert.equal([...tap.matchAll(/^ok \d+ - C14/gm)].length,16);
  return{languageTests:16,languageFixtureConfigurations:4,languageComparisonAttempts:12,languageEligibleComparisons:6,languageIneligibleComparisons:6,languageSourceMatches:sourceMatches,languageHistoricalAssertionFailures:1,languageDeterministicReplay:true};
}
