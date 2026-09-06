import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync('src/data/performance.ts','utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {conclusion,mean,percent}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const e=(mae,mse=mae)=>({mae:[mae],mse:[mse]});
assert.equal(conclusion(e(1),e(.9)),'Performance improved');
assert.equal(conclusion(e(1),e(1.1)),'Performance degraded');
assert.equal(conclusion(e(1),e(1.0005)),'No noticeable change');
assert.equal(conclusion(e(1),e(.9,1)),'MAE improved only');
assert.equal(conclusion(e(1),e(1,1.1)),'MSE degraded only');
assert.equal(conclusion(e(1),e(.9,1.1)),'Mixed metric changes');
assert.equal(conclusion(undefined,e(1)),'Results unavailable');
assert.equal(conclusion(e(NaN),e(1)),'Results unavailable');
assert.ok(Number.isNaN(percent(0,1)));
assert.equal(mean([1,3]),2);
assert.equal(conclusion({mae:[1,1],mse:[1,1]},{mae:[.5,1.5],mse:[.5,1.5]}),'No noticeable change');
for(const model of ['dgraformer','msgnet']){
 const d=JSON.parse(fs.readFileSync(`public/data/performance/v1/${model}.json`));
 assert.equal(d.version,'performance.v1');assert.equal(d.thresholdFloor,0);
 const keys=new Set();let expected=0;
 for(const s of d.samples){
  const union=new Set(s.contexts.flatMap(c=>c.edges.map(e=>e.slice(0,2).join('-'))));
  expected+=s.contexts.reduce((a,c)=>a+c.edges.length,0)+union.size;
  for(const m of ['mae','mse'])assert.equal(s.baseline[m].length,96);
 }
 assert.equal(d.records.length,expected);
 for(const r of d.records){
  const key=JSON.stringify([r.sample,r.context,r.source,r.target,r.scope]);assert.ok(!keys.has(key));keys.add(key);
  const s=d.samples.find(s=>s.id===r.sample);assert.ok(s);
  assert.ok(s.contexts.some(c=>(r.scope==='all'||c.index===r.context)&&c.edges.some(e=>e[0]===r.source&&e[1]===r.target)));
  for(const m of ['mae','mse']){assert.equal(r.after[m].length,96);assert.ok(r.after[m].every(v=>Number.isFinite(v)&&v>=0));}
  const contexts=s.contexts.filter(c=>c.edges.some(e=>e[0]===r.source&&e[1]===r.target));
  if(contexts.length===1&&r.scope==='all')assert.deepEqual(r.after,d.records.find(x=>x.sample===r.sample&&x.source===r.source&&x.target===r.target&&x.scope==='single').after);
 }
 console.log(`${model}: ${d.samples.length} samples, ${expected} complete unique cases PASS`);
}
console.log('Performance formulas, raw mean, missing data, exact identity and equivalent scopes PASS');
const windowSource = fs.readFileSync('src/data/selectableWindows.ts','utf8');
const windowJs = ts.transpileModule(windowSource,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {selectableWindows} = await import('data:text/javascript;base64,'+Buffer.from(windowJs).toString('base64'));
const performance = JSON.parse(fs.readFileSync('public/data/performance/v1/dgraformer.json'));
for(let i=0;i<5;i++) {
 const sample=JSON.parse(fs.readFileSync(`public/data/samples/ETTh1_${String(i).padStart(3,'0')}_h96.json`));
 const p=performance.samples.find(s=>s.id===sample.provenance.testSampleIndex);
 assert.deepEqual(selectableWindows(sample,null),p.contexts.map(c=>sample.windows.findIndex(w=>w.window_id===c.index)));
 for(let source=0;source<7;source++)for(let target=0;target<7;target++)if(source!==target){
  const expected=p.contexts.filter(c=>c.edges.some(e=>e[0]===source&&e[1]===target)).map(c=>sample.windows.findIndex(w=>w.window_id===c.index));
  assert.deepEqual(selectableWindows(sample,{source,target}),expected);
 }
}
assert.ok(!/[\p{Script=Han}]/u.test(fs.readFileSync('src/components/evidence/PerformanceSummary.tsx','utf8')));
console.log('Effective-window options match native graph results for all web samples and directed relations: PASS');
