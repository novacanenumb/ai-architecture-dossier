import assert from 'node:assert/strict';
import { readFile, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
export async function verifyReadmeEvidence(root) {
  const read=relative=>readFile(path.join(root,relative),'utf8');
  const json=async relative=>JSON.parse(await read(relative));
  const hash=value=>'sha256:'+createHash('sha256').update(value).digest('hex');
  const receipt=await json('experiments/readme/native/receipt.json');
  const artifact=(await read('experiments/readme/native/validated-source.txt')).slice(0,receipt.sourceCharacters);
  assert.equal(hash(JSON.stringify(artifact)),receipt.sourceTextHash);
  assert.equal(receipt.completionState,'REPORTED'); assert.equal(receipt.persisted,false);
  assert.equal(receipt.nativeCandidateContracts,2); assert.equal(receipt.actualHostProposalTurns,2);
  assert.equal((await json('experiments/readme/native/manifest.json')).final_artifact_hash,receipt.artifactHash);
  assert.equal((await json('experiments/readme/native/performance.json')).gtfl.collapse_validity,'VALID');
  const fragments=[...artifact.matchAll(/```\n([\s\S]*?)\n```/g)].map(match=>JSON.parse(match[1]));
  assert.equal(fragments.length,2);
  const integration=await json('experiments/readme/integration-receipt.json');
  const latest=await read('README.md');
  const nativeModel=await json('experiments/native-model/readme-integration.json');
  assert.equal(hash(latest),nativeModel.currentReadmeHash);
  assert.equal(latest.split(nativeModel.addition.content).length,2);
  let priorRotor=latest.replace(nativeModel.addition.content+'\n','');
  assert.deepEqual(nativeModel.replacements,[{from:'Across the wider source work, 21 components',to:'Across the wider source work, 24 components'}]);
  for(const replacement of nativeModel.replacements){assert.equal(priorRotor.split(replacement.to).length,2);priorRotor=priorRotor.replace(replacement.to,replacement.from);}
  assert.equal(hash(priorRotor),nativeModel.previousReadmeHash);
  const rotor=await json('experiments/rotor/readme-integration.json');
  assert.equal(hash(priorRotor),rotor.currentReadmeHash);
  assert.equal(priorRotor.split(rotor.addition.content).length,2);
  let current=priorRotor.replace(rotor.addition.content+'\n','');
  assert.deepEqual(rotor.replacements,[{from:'Across the wider source work, 20 components',to:'Across the wider source work, 21 components'}]);
  for(const replacement of rotor.replacements){assert.equal(current.split(replacement.to).length,2);current=current.replace(replacement.to,replacement.from);}
  assert.equal(hash(current),rotor.previousReadmeHash);
  let previous=current;
  assert.equal(hash(current),integration.currentReadmeHash);
  assert.equal(current.trim().split(/\s+/).length,integration.currentWords);
  assert.deepEqual(integration.fragmentCorrections.map(({from,to})=>({from,to})),[{from:'experiments/results.json',to:'dist/data/results.json'}]);
  for(const [i,nativeFragment] of fragments.entries()) {
    assert.equal(hash(nativeFragment.content),integration.fragments[i].nativeContentHash);
    const fragment={...nativeFragment,content:nativeFragment.content.replaceAll('experiments/results.json','dist/data/results.json')};
    assert.equal(fragment.path,'README.md');
    assert.equal(hash(fragment.content),integration.fragments[i].contentHash);
    assert.equal(fragment.content.trim().split(/\s+/).length,integration.fragments[i].words);
    assert.equal(current.split(fragment.content).length,2,'Native fragment missing or duplicated');
    previous=previous.replace(fragment.content+'\n','');
  }
  assert.equal(current.split(integration.hostNavigation.content).length,2);
  previous=previous.replace(integration.hostNavigation.content+'\n','');
  assert.equal(hash(previous),integration.previousReadmeHash,'Prior README was modified beyond declared additions');
  assert.equal(previous.trim().split(/\s+/).length,integration.previousWords);
  let links=0;
  for(const match of latest.matchAll(/\]\(([^)]+)\)/g)) {
    const target=match[1]; if(target.startsWith('http')||target.startsWith('#'))continue;
    const resolved=path.resolve(root,target); assert.ok(resolved.startsWith(root+path.sep));
    assert.ok(!(await lstat(resolved)).isSymbolicLink()); links++;
  }
  assert.equal(integration.newModelMeasurements,false);
  assert.equal(integration.pendingRotorDraftsIncluded,false);
  return {readmeExpansionNativeFragments:2,readmePriorTextPreserved:true,readmeInternalFileLinksChecked:links,readmeExpansionRunId:receipt.runId};
}
