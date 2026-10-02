import { cp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import path from 'node:path';
const root=await realpath(path.resolve(import.meta.dirname,'..'));
const workspace=await realpath(path.dirname(root));
const target=path.join(workspace,'.dossier-public-check-'+randomUUID());
await mkdir(target);
const files=['package.json','LICENSE','README.md','SECURITY.md','CITATION.cff','.gitignore','.gitattributes','component-registry.json','packages','scripts','tests','docs','experiments','dist','.openai'];
try {
  // Keep the public copy one directory deeper so its parent contains no private master.
  const isolated=path.join(target,'checkout'); await mkdir(isolated);
  for(const file of files) await cp(path.join(root,file),path.join(isolated,file),{recursive:true,errorOnExist:true,force:false});
  assert.equal(await readFile(path.join(isolated,'../MASTER_SPEC.md'),'utf8').then(()=>true,error=>{if(error.code!=='ENOENT')throw error;return false;}),false,'Private master must be absent');
  for(const script of ['scripts/test-and-record.mjs','scripts/build.mjs','scripts/verify-release.mjs']) {
    const result=spawnSync(process.execPath,[script],{cwd:isolated,encoding:'utf8'});
    if(result.status!==0) throw new Error(script+' failed in public checkout: '+result.stdout+result.stderr);
  }
  const report={schemaVersion:1,status:'PASSED',privateMasterPresent:false,suppliedRuntimePresent:false,testCommand:'node scripts/test-and-record.mjs',buildCommand:'node scripts/build.mjs',verifyCommand:'node scripts/verify-release.mjs',claim:'Source copy without original documents or runtime rebuilt and passed all checks.'};
  await writeFile(path.join(root,'experiments/public-checkout-verification.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
} finally {
  const resolved=await realpath(target);
  if(resolved!==target || path.dirname(resolved)!==workspace || !path.basename(resolved).startsWith('.dossier-public-check-')) throw new Error('Refusing cleanup outside checked workspace');
  await rm(resolved,{recursive:true,force:false});
}
