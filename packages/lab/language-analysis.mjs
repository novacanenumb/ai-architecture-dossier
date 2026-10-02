import {tokenize,mattr,sampleCV,jensenShannon,safeRatio} from './analytics.mjs';

const kinds=['authored','quotation','required_term'], participants=['synthetic','model','human'];
const nullMetric=reason=>({value:null,reason});
function required(value,name){if(typeof value!=='string'||!value.trim())throw new TypeError(name+' must be a nonempty string');return value;}
function bounded(value,name,min,max){if(!Number.isSafeInteger(value)||value<min||value>max)throw new RangeError(name+' outside '+min+'..'+max);return value;}
function completeSentences(text,retained){const lengths=[];let consumed=0;for(const sentence of text.match(/[^.!?]+[.!?]+/gu)??[]){const n=tokenize(sentence).length;if(!n)continue;if(consumed+n>retained)break;consumed+=n;lengths.push(n);}return lengths;}

export function analyseLanguageWindow(input,{sampleTokens=32,mattrWindow=8}={}) {
  bounded(sampleTokens,'sampleTokens',3,4096);bounded(mattrWindow,'mattrWindow',1,sampleTokens);
  if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('input object required');
  const identity=Object.fromEntries(['id','arm','topicId','taskId'].map(key=>[key,required(input[key],key)]));
  required(input.participant?.id,'participant.id');if(!participants.includes(input.participant?.kind))throw new TypeError('Unsupported participant kind');
  if(!Array.isArray(input.segments)||!input.segments.length||input.segments.length>256)throw new RangeError('Expected 1..256 segments');
  const counts={authored:0,quotation:0,required_term:0,whole:0}, segmentCounts={authored:0,quotation:0,required_term:0,whole:input.segments.length}, retained=[], sample=[], quoteSources=[];
  let characters=0,remaining=sampleTokens,authoredIndex=0;
  for(const segment of input.segments){
    if(!kinds.includes(segment?.kind))throw new TypeError('Unsupported segment kind');required(segment.text,'segment.text');characters+=segment.text.length;if(characters>1000000)throw new RangeError('Combined text exceeds 1000000 UTF-16 code units');
    if(segment.kind==='quotation')quoteSources.push(required(segment.sourceId,'quotation.sourceId'));
    const tokens=tokenize(segment.text);counts[segment.kind]+=tokens.length;counts.whole+=tokens.length;segmentCounts[segment.kind]++;
    if(segment.kind==='authored'){
      const kept=tokens.slice(0,remaining);remaining-=kept.length;sample.push(...kept);
      if(kept.length)retained.push({authoredSegmentIndex:authoredIndex,tokens:kept,originalTokenCount:tokens.length,retainedTokenCount:kept.length,truncated:kept.length<tokens.length,sentenceLengths:completeSentences(segment.text,kept.length)});
      authoredIndex++;
    }
  }
  const eligible=sample.length===sampleTokens,status=eligible?'READY':'INSUFFICIENT_AUTHORED_TOKENS';
  let trigramOccurrences=0;const grams=new Map();
  for(const segment of retained)for(let i=0;i+2<segment.tokens.length;i++){const key=JSON.stringify(segment.tokens.slice(i,i+3));grams.set(key,(grams.get(key)??0)+1);trigramOccurrences++;}
  const repeatCount=[...grams.values()].reduce((sum,n)=>sum+n-1,0),sentenceLengths=retained.flatMap(s=>s.sentenceLengths);
  return {
    schemaVersion:1,dossierReference:'C14',implementationProvenance:'New dossier reference; original C14 source not recovered',status,eligible,...identity,
    participant:{id:input.participant.id,kind:input.participant.kind},synthetic:input.participant.kind==='synthetic',measurementConfig:{sampleTokens,mattrWindow},counts,segmentCounts,
    authored:{tokensSample:[...sample],mattr:eligible?{...mattr(sample.join(' '),mattrWindow),convention:'MATTR over fixed pooled authored tokens; windows may cross authored segment boundaries'}:nullMetric(status),
      repeatedTrigramRate:eligible?{...safeRatio(repeatCount,trigramOccurrences),numerator:repeatCount,denominator:trigramOccurrences,segmentBoundaryPolicy:'No trigram crosses an authored segment boundary'}:nullMetric(status),
      sentenceLengthCV:eligible?{...sampleCV(sentenceLengths),observations:sentenceLengths.length,sentenceTokenLengths:sentenceLengths,truncationPolicy:'Terminal punctuation must be observed within the retained segment prefix; abbreviations are not modeled'}:nullMetric(status)},
    sampling:{strategy:'First authored tokens in segment order',requestedTokens:sampleTokens,observedAuthoredTokens:counts.authored,retainedTokens:sample.length,truncated:counts.authored>sample.length,pooledForMATTR:true,segmentBoundariesPreservedForTrigrams:true,retainedSegments:retained.map(({tokens,sentenceLengths,...metadata})=>metadata)},
    annotations:{quotationSourceIds:quoteSources,quotationSourceIdsIndependentlyVerified:false,requiredTermsManuallyAnnotated:true},
    interpretationLimits:{lexicalDistributionIsModelLogits:false,humanOutcomeInferred:false,semanticAlignmentMeasured:false,transferBenefitMeasured:false,cognitiveOrModelBenefitEstablished:false}
  };
}

function validateAnalysis(record,side){
  const reasons=[];
  if(!record||typeof record!=='object'||Array.isArray(record))return [side+': analysis object required'];
  for(const key of ['id','arm','topicId','taskId'])if(typeof record[key]!=='string'||!record[key].trim())reasons.push(side+': invalid '+key);
  if(typeof record.participant?.id!=='string'||!record.participant.id.trim()||!participants.includes(record.participant?.kind))reasons.push(side+': invalid participant');
  if(!['READY','INSUFFICIENT_AUTHORED_TOKENS'].includes(record.status)||record.eligible!==(record.status==='READY'))reasons.push(side+': inconsistent status');
  const n=record.measurementConfig?.sampleTokens,w=record.measurementConfig?.mattrWindow;
  if(!Number.isSafeInteger(n)||n<3||n>4096||!Number.isSafeInteger(w)||w<1||w>n)reasons.push(side+': invalid measurement configuration');
  if([...kinds,'whole'].some(k=>!Number.isSafeInteger(record.counts?.[k])||record.counts[k]<0))reasons.push(side+': invalid token counts');
  else if(record.counts.whole!==kinds.reduce((sum,k)=>sum+record.counts[k],0))reasons.push(side+': whole token count differs from segment categories');
  const tokens=record.authored?.tokensSample;
  if(!Array.isArray(tokens)||tokens.length>4096||tokens.some(t=>typeof t!=='string'||tokenize(t).length!==1||tokenize(t)[0]!==t))reasons.push(side+': invalid sampled tokens');
  else {
    if(record.counts?.authored<tokens.length||tokens.length!==Math.min(record.counts?.authored,n))reasons.push(side+': sample differs from authored token count');
    if(record.status==='READY'&&tokens.length!==n||record.status==='INSUFFICIENT_AUTHORED_TOKENS'&&tokens.length>=n)reasons.push(side+': invalid sample length');
    if(record.status==='READY'&&Number.isSafeInteger(w)&&w>=1&&w<=tokens.length){const expected=mattr(tokens.join(' '),w).value;if(!Number.isFinite(record.authored?.mattr?.value)||record.authored.mattr.value!==expected)reasons.push(side+': MATTR differs from sampled tokens');}
  }
  if(record.status==='INSUFFICIENT_AUTHORED_TOKENS')for(const metric of ['mattr','repeatedTrigramRate','sentenceLengthCV'])if(record.authored?.[metric]?.value!==null)reasons.push(side+': insufficient metric must be null');
  return reasons;
}
function rejected(reasons){return{eligible:false,status:'INELIGIBLE',reasons,lexicalJSD:nullMetric('COMPARISON_INELIGIBLE'),authoredMATTRDifference:nullMetric('COMPARISON_INELIGIBLE'),matchedTokens:null,humanOutcome:null,semanticAlignment:null,transferTaskScore:null};}

export function compareLanguageWindows(baseline,candidate) {
  const reasons=[...validateAnalysis(baseline,'baseline'),...validateAnalysis(candidate,'candidate')];
  if(reasons.length)return rejected(reasons);
  if(baseline.status!=='READY'||candidate.status!=='READY')reasons.push('Insufficient authored sample');
  if(baseline.id===candidate.id)reasons.push('Record IDs must differ');
  for(const key of ['topicId','taskId'])if(baseline[key]!==candidate[key])reasons.push(key+' mismatch');
  if(baseline.participant.kind!==candidate.participant.kind)reasons.push('participant.kind mismatch');
  for(const key of ['sampleTokens','mattrWindow'])if(baseline.measurementConfig[key]!==candidate.measurementConfig[key])reasons.push(key+' mismatch');
  if(reasons.length)return rejected(reasons);
  const support=[...new Set([...baseline.authored.tokensSample,...candidate.authored.tokensSample])].sort();
  const frequency=tokens=>{const counts=new Map();for(const token of tokens)counts.set(token,(counts.get(token)??0)+1);return support.map(t=>(counts.get(t)??0)/tokens.length);};
  return {eligible:true,status:'READY',reasons:[],lexicalJSD:{...jensenShannon(frequency(baseline.authored.tokensSample),frequency(candidate.authored.tokensSample)),support,provenance:'Observed authored word frequencies; not model logits'},authoredMATTRDifference:{value:candidate.authored.mattr.value-baseline.authored.mattr.value,reason:null,direction:'candidate_minus_baseline'},matchedTokens:baseline.measurementConfig.sampleTokens,humanOutcome:null,semanticAlignment:null,transferTaskScore:null};
}
