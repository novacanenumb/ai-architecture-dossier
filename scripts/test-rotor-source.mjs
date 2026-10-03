import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { verifyRuntime } from '../experiments/runtime/tests/runtime-helper.mjs';
const root=await realpath(path.resolve(import.meta.dirname,'..')), output=path.join(root,'experiments/rotor');
const digest=value=>'sha256:'+createHash('sha256').update(value).digest('hex');
const within=(base,target)=>{const relative=path.relative(base,target);return relative!==''&&relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative);};
async function noLinks(target) {let cursor=path.parse(target).root;for(const part of target.slice(cursor.length).split(path.sep).filter(Boolean)){cursor=path.join(cursor,part);assert.equal((await lstat(cursor)).isSymbolicLink(),false,'Source paths may not traverse links');}}
async function noTreeLinks(target) {assert.equal((await lstat(target)).isSymbolicLink(),false);for(const item of await readdir(target,{withFileTypes:true})){const file=path.join(target,item.name),state=await lstat(file);assert.equal(state.isSymbolicLink(),false);if(state.isDirectory())await noTreeLinks(file);}}
const dependency=await verifyRuntime();
const manifestBytes=await readFile(path.join(output,'source-manifest.json')), manifest=JSON.parse(manifestBytes);
const protocolBytes=await readFile(path.join(output,'protocol.json')), protocol=JSON.parse(protocolBytes);
const required=['04_NEURAL_CORE/rtl360_gtfl/__init__.py','04_NEURAL_CORE/rtl360_gtfl/canonical.py','04_NEURAL_CORE/rtl360_gtfl/numeric.py','04_NEURAL_CORE/rtl360_gtfl/config.py','04_NEURAL_CORE/rtl360_gtfl/rotor.py','04_NEURAL_CORE/rtl360_gtfl/lattice.py','tests/test_gtfl_rotor_lattice.py'];
assert.equal(manifest.schemaVersion,1);assert.deepEqual(manifest.files.map(f=>f.path).sort(),required.sort());assert.equal(manifest.files.length,7);
assert.equal(manifest.sourcePackage.name,'neo-sfr-lab');assert.equal(manifest.sourcePackage.version,'0.1.0');assert.equal(manifest.sourcePackage.sourceRedistributed,false);
const sourceInput=path.resolve(process.env.ROTOR_SOURCE_PATH||'N:/Development/Production/[NEO]');await noLinks(sourceInput);const sourceRoot=await realpath(sourceInput);
const pinned=[];
for(const entry of [...manifest.files,manifest.metadata]) {const source=path.join(sourceRoot,...entry.path.split('/'));assert.ok(within(sourceRoot,source));await noLinks(source);assert.equal((await lstat(source)).isFile(),true);const bytes=await readFile(source);assert.equal(bytes.length,entry.bytes);assert.equal(digest(bytes),entry.hash,'Original source hash mismatch: '+entry.path);pinned.push({...entry,source,bytes});}
const python=path.resolve(process.env.DOSSIER_PYTHON_PATH||'N:/Development/Production/Hypervisor Standalone/01_AGENT_DATABASE/.venv/Scripts/python.exe');await noLinks(python);assert.equal((await lstat(python)).isFile(),true);
const interpreterHash=digest(await readFile(python)), temporary=await mkdtemp(path.join(root,'.rotor-source-check-'));
let report=null,terminalError=null;
try {
  for(const entry of pinned.filter(f=>f.path!==manifest.metadata.path)) {const target=path.join(temporary,entry.path);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,entry.bytes,{flag:'wx'});}
  for(const file of ['execute.py','probe.py','protocol.json'])await writeFile(path.join(temporary,file),await readFile(path.join(output,file)),{flag:'wx'});
  await mkdir(path.join(temporary,'reports'));await mkdir(path.join(temporary,'tmp'));
  const env={PYTEST_DISABLE_PLUGIN_AUTOLOAD:'1',PYTHONDONTWRITEBYTECODE:'1',TEMP:path.join(temporary,'tmp'),TMP:path.join(temporary,'tmp')};
  for(const name of ['SystemRoot','SYSTEMROOT','WINDIR','PATH','Path'])if(process.env[name])env[name]=process.env[name];
  const result=spawnSync(python,['-I','-B',path.join(temporary,'execute.py'),temporary],{cwd:temporary,env,encoding:'utf8',timeout:120000,maxBuffer:1024*1024,windowsHide:true});
  let captured=null;try {captured=JSON.parse(await readFile(path.join(temporary,'reports/execution.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  const sourceHashes={};for(const file of ['scripts/test-rotor-source.mjs','experiments/rotor/execute.py','experiments/rotor/probe.py','experiments/rotor/source-manifest.json','experiments/rotor/protocol.json','experiments/runtime/tests/runtime-helper.mjs'])sourceHashes[file]=digest(await readFile(path.join(root,file)));
  const tests=captured?.tests??{collected:0,passed:0,failed:0,skipped:0,errors:1,results:[]};
  const original=tests.results.filter(t=>t.id.includes('test_gtfl_rotor_lattice.py')), added=tests.results.filter(t=>t.id.includes('probe.py'));
  report={schemaVersion:1,kind:'original-rotor-lattice-source-evidence',status:result.status===0&&captured?.status==='PASSED'?'PASSED':'FAILED',command:'npm run test:rotor',nodeVersion:process.version,platform:process.platform,sourcePackage:manifest.sourcePackage,sourceManifestHash:digest(manifestBytes),sourceFiles:manifest.files,sourceMetadata:manifest.metadata,sourceHashes,sourceUnchanged:null,temporaryCopyRemoved:null,hypervisorDependency:{version:dependency.version,manifestHash:dependency.manifestHash,contentRoot:dependency.contentRoot,verifiedFiles:dependency.verifiedFiles},protocol:{path:'experiments/rotor/protocol.json',hashBefore:digest(protocolBytes),hashAfter:digest(await readFile(path.join(output,'protocol.json'))),parsed:protocol},execution:{exitCode:result.status,error:result.error?.code??null,signal:result.signal,timeoutMs:120000,interpreterHash,pythonVersion:captured?.pythonVersion??null,libraries:captured?.libraries??null,pytestExitCode:captured?.pytestExitCode??null,stdoutBytes:Buffer.byteLength(result.stdout||''),stderrBytes:Buffer.byteLength(result.stderr||'')},tests,originalTests:{total:original.length,passed:original.filter(t=>t.status==='PASSED').length},additionalTests:{total:added.length,passed:added.filter(t=>t.status==='PASSED').length},traces:captured?.traces??null,executionError:captured?.executionError??null,controls:{auditHook:'BEST_EFFORT',operatingSystemConfinement:'UNAVAILABLE',childEnvironment:'allowlisted noncredential variables with owned TEMP/TMP',pytestPluginAutoload:false,originalWrites:false,legacyProjectLaunch:false,training:false,modelWeights:false},provenance:{providerCalls:0,hostedTokens:null,billedCost:null,hostedLatencyMs:null,modelQuality:null,defaultModelBaseline:null,sourceCodeRedistributed:false}};
  assert.equal(report.protocol.hashBefore,report.protocol.hashAfter);
  if(report.status==='PASSED'){assert.equal(report.originalTests.passed,9);assert.equal(report.additionalTests.passed,6);assert.equal(report.traces.denominator.recordedRouteCalls,8);}
}catch(error){terminalError=error;}
finally {
  for(const entry of pinned)assert.equal(digest(await readFile(entry.source)),entry.hash,'Original source changed during execution');
  assert.equal(digest(await readFile(path.join(output,'source-manifest.json'))),digest(manifestBytes),'Source manifest changed');
  if(report)report.sourceUnchanged=true;
  const checked=await realpath(temporary);assert.ok(within(root,checked)&&path.dirname(checked)===root&&path.basename(checked).startsWith('.rotor-source-check-'),'Refusing cleanup outside the owned repository');await noLinks(checked);await noTreeLinks(checked);await rm(checked,{recursive:true,force:false});if(report)report.temporaryCopyRemoved=true;
}
if(terminalError)throw terminalError;
if(report.status==='PASSED') {
  const trace=Buffer.from(JSON.stringify(report.traces,null,2)+'\n');report.traceFile={path:'experiments/rotor/trace.json',hash:digest(trace),bytes:trace.length};delete report.traces;
  await writeFile(path.join(output,'trace.json'),trace);await writeFile(path.join(output,'test-receipt.json'),JSON.stringify(report,null,2)+'\n');
} else {
  const history=path.join(output,'history','attempt-'+Date.now());await mkdir(history,{recursive:true});await writeFile(path.join(history,'test-receipt.json'),JSON.stringify(report,null,2)+'\n');
  for(const [file,source] of [['runner-source.txt',path.join(root,'scripts/test-rotor-source.mjs')],['probe-source.txt',path.join(output,'probe.py')],['execute-source.txt',path.join(output,'execute.py')]])await writeFile(path.join(history,file),await readFile(source));
}
console.log(JSON.stringify({status:report.status,tests:report.tests,originalTests:report.originalTests,additionalTests:report.additionalTests,sourceUnchanged:report.sourceUnchanged,temporaryCopyRemoved:report.temporaryCopyRemoved,routeCalls:report.traceFile?8:null,executionError:report.executionError}));
if(report.status!=='PASSED')process.exitCode=1;
