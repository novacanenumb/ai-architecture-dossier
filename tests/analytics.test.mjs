import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptedTPS,aggregateCosts,aggregateUsage,jensenShannon,mattr,pairedBootstrap,reductionRatio,repeatedTrigramRate,safeRatio,sampleCV,sentenceCV,tokenAmplification,tokenize } from '../packages/lab/analytics.mjs';
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<=1e-12,`${actual} != ${expected}`);
test('ratios preserve missing/nonfinite/zero denominators; amplification and accepted throughput units',()=>{
  assert.deepEqual(safeRatio(6,3),{value:2,reason:null});
  for (const [n,d] of [[1,0],[null,1],[1,null],[Infinity,1],[1,NaN]]) assert.equal(safeRatio(n,d).value,null);
  assert.equal(reductionRatio(100,25).value,.75); assert.equal(reductionRatio(100,125).value,-.25); assert.equal(reductionRatio(0,0).value,null);
  assert.equal(tokenAmplification(250,100).value,2.5); assert.equal(tokenAmplification(10,0).value,null); assert.throws(()=>tokenAmplification(1,2));
  assert.equal(acceptedTPS(20,4).value,5); assert.equal(acceptedTPS(20,4).unit,'accepted_tokens/second'); assert.equal(acceptedTPS(20,0).value,null);
  assert.throws(()=>acceptedTPS(20,-1)); assert.throws(()=>tokenAmplification(1.5,1));
});
test('workflow usage includes failed/retry/review calls without double counting reasoning or cache subsets',()=>{
  const calls=[{inputTokens:100,cachedInputTokens:40,outputTokens:30,reasoningTokens:10,cacheWriteTokens:5,cost:.2,status:'failed'}, {inputTokens:50,cachedInputTokens:10,outputTokens:20,reasoningTokens:5,cacheWriteTokens:3,cost:.1,status:'review'}];
  const r=aggregateUsage(calls); assert.equal(r.callCount,2); assert.equal(r.totalModelTokens,200);
  assert.deepEqual(r.totals,{inputTokens:150,cachedInputTokens:50,outputTokens:50,reasoningTokens:15,cacheWriteTokens:8,cost:.30000000000000004});
  assert.equal(r.coverage.inputTokens,2); assert.equal(r.coverage.cost,2);
  assert.throws(()=>aggregateUsage([{inputTokens:5,cachedInputTokens:6}])); assert.throws(()=>aggregateUsage([{outputTokens:2,reasoningTokens:3}]));
});
test('missing usage is null with explicit observed coverage; empty calls cannot mean free execution',()=>{
  const r=aggregateUsage([{inputTokens:10,outputTokens:4},{inputTokens:null,outputTokens:null,status:'failed'}]);
  for (const v of Object.values(r.totals)) assert.equal(v,null);
  assert.equal(r.coverage.inputTokens,1); assert.equal(r.coverage.cost,0); assert.equal(r.totalModelTokens,null);
  assert.equal(aggregateUsage([]).totalModelTokens,null);
});
test('costs reject duplicate charge IDs; unknown charges propagate null',()=>{
  const entries=[{id:'a',category:'model',cost:1.25},{id:'b',category:'storage',cost:.75}];
  assert.deepEqual(aggregateCosts(entries),{total:2,byCategory:{model:1.25,storage:.75}});
  assert.throws(()=>aggregateCosts([...entries,entries[0]]));
  const unknown=aggregateCosts([{id:'a',category:'model',cost:1},{id:'b',category:'model',cost:null},{id:'c',category:'model',cost:2}]);
  assert.equal(unknown.total,null); assert.equal(unknown.byCategory.model,null); assert.equal(aggregateCosts([]).total,null);
});
test('paired bootstrap is seeded and exact for a constant paired effect',()=>{
  const options={baseline:[1,2,3,4,5],candidate:[2,3,4,5,6],iterations:2000,confidence:.95,seed:1729};
  const r=pairedBootstrap(options); assert.deepEqual(r,pairedBootstrap(options)); assert.equal(r.meanDifference,1); assert.deepEqual(r.interval,[1,1]); assert.equal(r.sampleSize,5);
  const varying={...options,candidate:[0,4,3,9,4]}; assert.deepEqual(pairedBootstrap(varying),pairedBootstrap(varying));
});
test('paired bootstrap rejects short, nonfinite, unaligned and invalid control inputs',()=>{
  for (const options of [{baseline:[1],candidate:[2]}, {baseline:[1,2],candidate:[2]}, {baseline:[1,NaN],candidate:[2,3]}, {baseline:[1,2],candidate:[2,3],iterations:0},{baseline:[1,2],candidate:[2,3],confidence:1}]) assert.throws(()=>pairedBootstrap(options));
});
test('Unicode words and apostrophes tokenize precisely',()=>{
  assert.deepEqual(tokenize("Café 東京 O'Reilly l’amour DON'T"),['café','東京',"o'reilly",'l’amour',"don't"]);
});
test('MATTR matches hand computed windows; insufficient samples remain null',()=>{
  close(mattr('a b a c',3).value,5/6); close(mattr('a a a',2).value,.5);
  assert.equal(mattr('',2).value,null); assert.throws(()=>mattr('a',0));
});
test('repeated trigram rate counts overlapping occurrences beyond their first use',()=>{
  const r=repeatedTrigramRate('a b c a b c a b c'); assert.equal(r.totalOccurrences,7); assert.equal(r.repeatedBeyondFirst,4); close(r.value,4/7);
  assert.equal(repeatedTrigramRate('a b').value,null); assert.equal(repeatedTrigramRate('a b c').value,0);
});
test('sample and sentence CV use sample deviation and declared punctuation segmentation',()=>{
  close(sampleCV([1,2,3,4]).value,Math.sqrt(5/3)/2.5); assert.equal(sampleCV([0,0,0]).value,null); assert.equal(sampleCV([1]).value,null);
  close(sentenceCV('one two. one two three four!').value,Math.sqrt(2)/3); assert.equal(sentenceCV('one sentence only.').value,null);
});
test('Jensen Shannon matches base 2 known vectors and rejects nonnormalized or misaligned support',()=>{
  const r=jensenShannon([1,0],[0,1]); close(r.value,1); assert.equal(r.unit,'bits'); assert.equal(r.base,2); assert.equal(r.supportSize,2);
  close(jensenShannon([.5,.5],[.5,.5]).value,0); close(jensenShannon([.5,.5],[.75,.25]).value,.0487949406953985);
  for (const [p,q] of [[[1,1],[.5,.5]],[[1],[.5,.5]],[[-1,2],[.5,.5]],[[],[]]]) assert.throws(()=>jensenShannon(p,q));
});
