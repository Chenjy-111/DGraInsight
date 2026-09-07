import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync('src/data/evaluation.ts', 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { validateEvaluation, metricChange, displayedMetrics } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const d = JSON.parse(fs.readFileSync('tests/fixtures/evaluation/functions.json'));
assert.equal(validateEvaluation(d).ok, true);
assert.equal(d.nodes.length, 4); assert.equal(d.outputs.length, 2); assert.equal(d.horizon, 3);
for (const mutate of [
  x => x.records[0].prediction.pop(),
  x => x.records[0].metrics.mae = 99,
  x => x.records[0].source = 'unknown',
  x => x.records[0].protocolId = 'all',
  x => x.records[0].contextIds = ['unknown'],
  x => x.records.push(structuredClone(x.records[0])),
  x => x.records[0].prediction[0][0] = Infinity,
  x => x.samples[0].contexts[0].edges.push(structuredClone(x.samples[0].contexts[0].edges[0])),
  x => x.measurement.aggregation = 'sum',
]) {
  const bad = structuredClone(d); mutate(bad); assert.equal(validateEvaluation(bad).ok, false);
}
for (const bad of [null, [], {}, {version:'evaluation.v1'}, {...d, validation:null}, {...d, records:[null]}]) assert.equal(validateEvaluation(bad).ok, false);
const aggregate = structuredClone(d);
for(const s of aggregate.samples) { delete s.truth; delete s.baselinePrediction; s.contexts=[]; }
aggregate.nodes=[];
for(const r of aggregate.records) { delete r.prediction; delete r.source; delete r.target; r.contextIds=[]; }
assert.equal(validateEvaluation(aggregate).ok, true);
assert.equal(displayedMetrics(aggregate.samples[0],aggregate.records[0],0),null);
assert.deepEqual(displayedMetrics(aggregate.samples[0],aggregate.records[0],-1).after,aggregate.records[0].metrics);
assert.equal(metricChange(0,1).improvement,null);
assert.equal(metricChange(0,0).label,'No noticeable change');
assert.equal(metricChange(1000,1001).label,'No noticeable change');
assert.equal(metricChange(1,0.5).label,'Improved');
assert.equal(metricChange(1,1.5).label,'Degraded');
assert.equal(validateEvaluation(JSON.parse(fs.readFileSync('public/data/evaluation/mtgnn.json'))).ok,true);
console.log('Evaluation import: independent dimensions, signed graphs, raw recomputation, partial capabilities, invalid identities and metric semantics PASS');

const contract = JSON.parse(fs.readFileSync('tests/fixtures/evaluation/contract.json'));
assert.equal(validateEvaluation(contract).ok, true);
contract.records[0].forecastStepErrorChange[0].mae += 1;
assert.equal(validateEvaluation(contract).ok, false);
