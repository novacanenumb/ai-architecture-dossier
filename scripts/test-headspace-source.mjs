import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { lstat,mkdir,mkdtemp,readFile,realpath,rm,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyRuntime } from '../experiments/runtime/tests/runtime-helper.mjs';
const root=path.resolve(import.meta.dirname,'..'), output=path.join(root,'experiments/headspace');
const sourceInput=path.resolve(process.env.HEADSPACE_SOURCE_PATH||'N:/Development/Architecture/Headspace/prsr-sites');
const digest=bytes=>'sha256:'+createHash('sha256').update(bytes).digest('hex');
const within=(parent,target)=>{const relative=path.relative(parent,target);return relative!==''&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative);};
async function noLinks(target) {let cursor=path.parse(target).root;for(const part of target.slice(cursor.length).split(path.sep).filter(Boolean)){cursor=path.join(cursor,part);assert.equal((await lstat(cursor)).isSymbolicLink(),false,'Links are not permitted');}}
const runtime=await verifyRuntime();
const manifestBytes=await readFile(path.join(output,'source-manifest.json')), manifest=JSON.parse(manifestBytes);
assert.equal(manifest.schemaVersion,1); assert.equal(manifest.files.length,13); assert.equal(new Set(manifest.files.map(f=>f.path)).size,13);
const required=['dist/engine.mjs','dist/validators.mjs','dist/comparison-core.mjs','dist/source-inventory.json','server/comparison.mjs','tests/runtime.test.mjs','tests/comparison.test.mjs','tests/prsr_matrix_probability_frame.schema.json','tests/prsr_five_agent_ensemble.example.json','tests/prsr_ensemble_config.schema.json','tests/prsr_agent_config.schema.json','tests/prsr_agent_config.example.json','package.json'];
assert.deepEqual(manifest.files.map(f=>f.path).sort(),required.sort());
await noLinks(sourceInput); const sourceRoot=await realpath(sourceInput), repositoryRoot=await realpath(root), files=[];
for(const entry of manifest.files) {
  const source=path.join(sourceRoot,...entry.path.split('/')); assert.ok(within(sourceRoot,source)); await noLinks(source); assert.equal((await lstat(source)).isFile(),true);
  const bytes=await readFile(source); assert.equal(bytes.length,entry.bytes); assert.equal(digest(bytes),entry.hash,'Original Headspace source differs: '+entry.path); files.push({...entry,bytes,source});
}
const temp=await mkdtemp(path.join(repositoryRoot,'.headspace-source-check-'));
let report=null, trace=null, terminalError=null;
try {
  assert.ok(within(repositoryRoot,temp));
  for(const file of files) {const destination=path.join(temp,file.path);await mkdir(path.dirname(destination),{recursive:true});await writeFile(destination,file.bytes,{flag:'wx'});}
  await mkdir(path.join(temp,'reports'));
  const childEnvironment={}; for(const name of ['SystemRoot','SYSTEMROOT','WINDIR','PATH','Path','TEMP','TMP']) if(process.env[name])childEnvironment[name]=process.env[name];
  const commands=[];
  for(const testFile of ['tests/runtime.test.mjs','tests/comparison.test.mjs']) {
    const execution=spawnSync(process.execPath,['--import',pathToFileURL(path.join(output,'no-network.mjs')).href,path.join(temp,testFile)],{cwd:temp,env:childEnvironment,encoding:'utf8',timeout:120000,maxBuffer:2*1024*1024,windowsHide:true});
    const text=(execution.stdout||'')+(execution.stderr||'');
    commands.push({testFile,exitCode:execution.status,error:execution.error?.code??null,reportedCheckNames:text.split(/\r?\n/).filter(line=>/^(PASS|FAIL) /.test(line)).map(line=>({status:line.startsWith('PASS')?'PASSED':'FAILED',name:line.slice(5)}))});
  }
  const originalFixture=JSON.parse(await readFile(path.join(temp,'reports/validation.json'),'utf8'));
  const originalComparison=JSON.parse(await readFile(path.join(temp,'reports/comparison-validation.json'),'utf8'));
  const engine=await import(pathToFileURL(path.join(temp,'dist/engine.mjs')).href);
  const {runProbe}=await import('../experiments/headspace/probe.mjs');
  const probe=await runProbe({Simulator:engine.Simulator,originalVersion:engine.VERSION}); trace=probe.replayTrace;
  const canonicalHash=digest(Buffer.from(engine.stable(trace.canonical))), eventRoot=trace.events.at(-1).event_hash;
  const sourceHashes={}; for(const file of ['scripts/test-headspace-source.mjs','experiments/headspace/probe.mjs','packages/lab/serialized-commit.mjs','experiments/headspace/no-network.mjs','experiments/headspace/source-manifest.json'])sourceHashes[file]=digest(await readFile(path.join(root,file)));
  report={schemaVersion:1,kind:'original-headspace-source-evidence',status:commands.every(c=>c.exitCode===0)&&originalFixture.failed===0&&originalComparison.passed===true?'PASSED':'FAILED',nodeVersion:process.version,platform:process.platform,sourcePackage:manifest.sourcePackage,sourceManifestHash:digest(manifestBytes),sourceFiles:manifest.files,sourceHashes,sourceUnchanged:null,hypervisorDependency:{version:runtime.version,manifestHash:runtime.manifestHash,contentRoot:runtime.contentRoot},originalFixtureChecks:{passed:originalFixture.passed,failed:originalFixture.failed,total:originalFixture.results.length,results:originalFixture.results.map(r=>({name:r.name,status:r.status}))},originalComparisonChecks:{total:originalComparison.checks,passed:originalComparison.passed,adapter:originalComparison.adapter,liveProviderVerified:false},commands,diagnostic:probe.report,publicTrace:{path:'experiments/headspace/public-trace.json',bytes:Buffer.byteLength(JSON.stringify(trace,null,2)+'\n'),rawHash:digest(Buffer.from(JSON.stringify(trace,null,2)+'\n')),canonicalHash,eventRoot,inventory:'empty synthetic default fixture inventory',sourceMetadataIncluded:false},controls:{defaultFetchGuard:'BEST_EFFORT',operatingSystemNetworkConfinement:'UNAVAILABLE',childEnvironment:'allowlisted noncredential variables',originalWrites:false},provenance:{providerCalls:0,hostedTokens:null,billedCost:null,hostedLatencyMs:null,modelQuality:null,sourceCodeRedistributed:false}};
} catch(error) { terminalError=error; }
finally {
  for(const file of files) {assert.equal(digest(await readFile(file.source)),file.hash,'Original source changed during checks');} if(report) report.sourceUnchanged=true;
  const checked=await realpath(temp); assert.ok(within(repositoryRoot,checked)&&path.dirname(checked)===repositoryRoot&&path.basename(checked).startsWith('.headspace-source-check-'),'Refusing unsafe cleanup'); await noLinks(checked); await rm(checked,{recursive:true,force:true});
}
if(terminalError)throw terminalError;
await writeFile(path.join(output,'test-receipt.json'),JSON.stringify(report,null,2)+'\n');
await writeFile(path.join(output,'public-trace.json'),JSON.stringify(trace,null,2)+'\n');
console.log(JSON.stringify({status:report.status,originalFixtureChecks:report.originalFixtureChecks.passed,originalComparisonChecks:report.originalComparisonChecks.total,requirement:report.diagnostic.requirement,sourceUnchanged:report.sourceUnchanged,traceBytes:report.publicTrace.bytes}));
if(report.status!=='PASSED')process.exitCode=1;
