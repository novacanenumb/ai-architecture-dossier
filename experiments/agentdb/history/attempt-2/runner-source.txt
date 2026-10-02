import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {lstat,mkdir,mkdtemp,readFile,realpath,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {verifyRuntime} from '../experiments/runtime/tests/runtime-helper.mjs';
import {pairedBootstrap} from '../packages/lab/analytics.mjs';
const root=path.resolve(import.meta.dirname,'..'), output=path.join(root,'experiments/agentdb');
const digest=bytes=>'sha256:'+createHash('sha256').update(bytes).digest('hex');
const within=(parent,target)=>{const relative=path.relative(parent,target);return relative!==''&&relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative);};
async function noLinks(target) {let cursor=path.parse(target).root;for(const part of target.slice(cursor.length).split(path.sep).filter(Boolean)){cursor=path.join(cursor,part);assert.equal((await lstat(cursor)).isSymbolicLink(),false,'Links are not permitted');}}
const runtime=await verifyRuntime(), manifestBytes=await readFile(path.join(output,'source-manifest.json')), manifest=JSON.parse(manifestBytes);
const protocolBytes=await readFile(path.join(output,'cache-protocol.json')), protocol=JSON.parse(protocolBytes);
const sourceInput=path.resolve(process.env.AGENTDB_SOURCE_PATH||'N:/Development/Production/Hypervisor Standalone/01_AGENT_DATABASE');
await noLinks(sourceInput); const sourceRoot=await realpath(sourceInput), repositoryRoot=await realpath(root);
const required=['orpheus_agents/__init__.py','orpheus_agents/storage.py','orpheus_agents/memory.py','orpheus_agents/collections.py','orpheus_agents/governance.py','orpheus_agents/schemas.py','orpheus_agents/signing.py','orpheus_agents/bootstrap.py','orpheus_agents/migrations/001_initial.sql','orpheus_agents/migrations/002_contracts.sql','orpheus_agents/migrations/003_services.sql','orpheus_agents/migrations/004_governance.sql','orpheus_agents/migrations/006_contract_approvals.sql','orpheus_agents/migrations/007_collections.sql','orpheus_agents/migrations/008_memory_gc.sql','tests/test_collections.py','tests/test_governance.py','tests/test_signing.py','pyproject.toml'];
assert.equal(manifest.schemaVersion,1); assert.equal(manifest.files.length,19); assert.equal(new Set(manifest.files.map(f=>f.path)).size,19); assert.deepEqual(manifest.files.map(f=>f.path).sort(),required.sort());
const files=[];
for(const entry of manifest.files) {const source=path.join(sourceRoot,...entry.path.split('/'));assert.ok(within(sourceRoot,source));await noLinks(source);assert.equal((await lstat(source)).isFile(),true);const bytes=await readFile(source);assert.equal(bytes.length,entry.bytes);assert.equal(digest(bytes),entry.hash,'Original source differs: '+entry.path);files.push({...entry,bytes,source});}
const python=path.resolve(process.env.DOSSIER_PYTHON_PATH||path.join(sourceRoot,'.venv/Scripts/python.exe'));await noLinks(python);assert.equal((await lstat(python)).isFile(),true);
const interpreterHash=digest(await readFile(python)), temp=await mkdtemp(path.join(repositoryRoot,'.agentdb-source-check-'));
let report=null, terminalError=null;
try {
  for(const file of files) {const destination=path.join(temp,file.path);await mkdir(path.dirname(destination),{recursive:true});await writeFile(destination,file.bytes,{flag:'wx'});}
  for(const file of ['execute.py','probe.py','cache-protocol.json'])await writeFile(path.join(temp,file),await readFile(path.join(output,file)),{flag:'wx'});
  await mkdir(path.join(temp,'reports'));
  const childEnvironment={PYTEST_DISABLE_PLUGIN_AUTOLOAD:'1',PYTHONDONTWRITEBYTECODE:'1'};
  for(const name of ['SystemRoot','SYSTEMROOT','WINDIR','PATH','Path','TEMP','TMP'])if(process.env[name])childEnvironment[name]=process.env[name];
  const execution=spawnSync(python,['-I','-B',path.join(temp,'execute.py'),temp],{cwd:temp,env:childEnvironment,encoding:'utf8',timeout:300000,maxBuffer:2*1024*1024,windowsHide:true});
  let captured=null;try{captured=JSON.parse(await readFile(path.join(temp,'reports/execution.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  const sourceHashes={};for(const file of ['scripts/test-agentdb-source.mjs','experiments/agentdb/execute.py','experiments/agentdb/probe.py','experiments/agentdb/source-manifest.json','experiments/agentdb/cache-protocol.json'])sourceHashes[file]=digest(await readFile(path.join(root,file)));
  const diagnosticClasses=['unrecognized arguments','PermissionError','ImportError','ModuleNotFoundError','UsageError','WRITE_OUTSIDE_OWNED_COPY','NETWORK_OR_SUBPROCESS_DISABLED','not found','No module named'].filter(label=>((execution.stdout||'')+(execution.stderr||'')).includes(label));
  report={schemaVersion:1,kind:'original-agentdb-source-evidence',status:execution.status===0&&captured?.status==='PASSED'?'PASSED':'FAILED',nodeVersion:process.version,platform:process.platform,sourcePackage:manifest.sourcePackage,sourceManifestHash:digest(manifestBytes),sourceFiles:manifest.files,sourceHashes,sourceUnchanged:null,hypervisorDependency:{version:runtime.version,manifestHash:runtime.manifestHash,contentRoot:runtime.contentRoot},execution:{exitCode:execution.status,error:execution.error?.code??null,signal:execution.signal,timeoutMs:300000,interpreterHash,pythonVersion:captured?.pythonVersion??null,libraries:captured?.libraries??null,pytestExitCode:captured?.pytestExitCode??null,diagnosticClasses,stdoutBytes:Buffer.byteLength(execution.stdout||''),stderrBytes:Buffer.byteLength(execution.stderr||'')},tests:captured?.tests??{collected:0,passed:0,failed:0,skipped:0,errors:1,results:[]},probe:captured?.probe??null,executionError:captured?.executionError??null,controls:{auditHook:'BEST_EFFORT',operatingSystemConfinement:'UNAVAILABLE',childEnvironment:'allowlisted noncredential variables',pytestPluginAutoload:false,originalWrites:false,realWorkers:false},provenance:{providerCalls:0,hostedTokens:null,billedCost:null,hostedLatencyMs:null,modelQuality:null,sourceCodeRedistributed:false}};
  const benchmark=report.probe?.benchmark;
  if(benchmark) {
    assert.deepEqual(benchmark.protocol,protocol,'Probe must use the frozen protocol');
    const eligible=benchmark.pairs.filter(p=>p.eligible);
    benchmark.pairedStatistic=pairedBootstrap({baseline:eligible.map(p=>p.baselineMeanMs),candidate:eligible.map(p=>p.candidateMeanMs),...protocol.bootstrap});
    benchmark.protocolHashBefore=digest(protocolBytes);benchmark.protocolHashAfter=digest(await readFile(path.join(output,'cache-protocol.json')));assert.equal(benchmark.protocolHashBefore,benchmark.protocolHashAfter);
  }
} catch(error) {terminalError=error;}
finally {
  for(const file of files)assert.equal(digest(await readFile(file.source)),file.hash,'Original changed during checks');if(report)report.sourceUnchanged=true;
  const checked=await realpath(temp);assert.ok(within(repositoryRoot,checked)&&path.dirname(checked)===repositoryRoot&&path.basename(checked).startsWith('.agentdb-source-check-'),'Refusing unsafe cleanup');await noLinks(checked);await rm(checked,{recursive:true,force:false});
}
if(terminalError)throw terminalError;
await writeFile(path.join(output,'test-receipt.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,testCounts:{collected:report.tests.collected,passed:report.tests.passed,failed:report.tests.failed,skipped:report.tests.skipped,errors:report.tests.errors},pytestExitCode:report.execution.pytestExitCode,diagnosticClasses:report.execution.diagnosticClasses,probeSummary:report.probe?.summary,benchmarkDenominator:report.probe?.benchmark?.denominator,pairedStatistic:report.probe?.benchmark?.pairedStatistic,sourceUnchanged:report.sourceUnchanged}));
if(report.status!=='PASSED')process.exitCode=1;
