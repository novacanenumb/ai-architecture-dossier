import {analyseLanguageWindow,compareLanguageWindows} from './language-analysis.mjs';

export function createLanguageFixture() {
  const positions=['initial','middle','late'];
  const vocabulary=['archive','evidence','context','boundary','source','worker','scope','revision','packet','review','budget','trace','record','anchor','query','result'];
  const arms=['single_voice_fixture','pooled_vocabulary_fixture','polyphonic_fixture'];
  return arms.flatMap(arm=>positions.map((position,index)=>{
    const width=arm==='single_voice_fixture'?[8,4,2][index]:arm==='pooled_vocabulary_fixture'?16:12;
    const words=Array.from({length:64},(_,i)=>vocabulary[(i+(arm==='polyphonic_fixture'?index*3:0))%width]);
    const text=Array.from({length:4},(_,i)=>words.slice(i*16,(i+1)*16).join(' ')+'.').join(' ');
    return {id:`${arm}:${position}`,arm,position,topicId:'synthetic-agent-design',taskId:'synthetic-explain-evidence',participant:{id:`synthetic:${arm}`,kind:'synthetic'},segments:[
      {kind:'authored',text},
      {kind:'quotation',text:'Evidence must retain its source. Evidence must retain its source.',sourceId:'synthetic:authored-quotation'},
      {kind:'required_term',text:'SHA256 sealed anchor'}
    ]};
  }));
}

export function runLanguageFixture({sampleTokens=32,mattrWindow=8,candidateArm='polyphonic_fixture',injectTopicMismatch=false}={}) {
  if(!['pooled_vocabulary_fixture','polyphonic_fixture'].includes(candidateArm)) throw new TypeError('Unsupported synthetic candidate arm');
  if(typeof injectTopicMismatch!=='boolean') throw new TypeError('Topic injection must be boolean');
  const records=createLanguageFixture();
  if(injectTopicMismatch) for(const record of records) if(record.arm===candidateArm)record.topicId='synthetic-different-topic';
  const analyses=records.map(record=>({...analyseLanguageWindow(record,{sampleTokens,mattrWindow}),position:record.position}));
  const comparisons=['initial','middle','late'].map(position=>{
    const baseline=analyses.find(a=>a.arm==='single_voice_fixture'&&a.position===position),candidate=analyses.find(a=>a.arm===candidateArm&&a.position===position);
    return {position,baselineId:baseline.id,candidateId:candidate.id,...compareLanguageWindows(baseline,candidate)};
  });
  return {schemaVersion:1,componentId:'C14',classification:'new_dossier_reference_synthetic_output_analysis',config:{sampleTokens,mattrWindow,candidateArm,injectTopicMismatch},records,analyses,comparisons,provenance:{providerCalls:0,hostedTokens:null,billedCost:null,hostedLatencyMs:null,modelQuality:null,humanOutcome:null,semanticAlignment:null,transferTaskScore:null,topicLabels:'caller-declared; no semantic topic verifier',quotes:'manually authored annotations; no external source verification'},boundary:'Authored synthetic word patterns demonstrate the analyser, not generated model diversity, cognitive effects or Headspace improvement.'};
}
