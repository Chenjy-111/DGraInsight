import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const fixture = JSON.parse(fs.readFileSync('tests/fixtures/evaluation/functions.json'));
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(process.env.PERFORMANCE_URL || 'http://127.0.0.1:5181/DGraInsight/', { waitUntil: 'domcontentloaded' });
  const upload = async d => page.locator('input[type=file]').setInputFiles({ name:'evaluation.json', mimeType:'application/json', buffer:Buffer.from(JSON.stringify(d)) });
  await page.getByRole('button', {name:'Explore MTGNN',exact:true}).click();
  const work = page.getByTestId('evaluation-workspace');
  await work.waitFor();
  assert.equal(await work.locator('[data-change]').count(), 28);
  await work.getByRole('button', {name:'EX1 → EX2',exact:true}).click();
  await page.getByLabel('Evaluation sample', {exact:true}).selectOption('1');
  assert.equal(await work.locator('button[aria-pressed=true]').count(),1);
  await page.getByLabel('Evaluation output',{exact:true}).selectOption('2');
  await upload(fixture);
  await page.waitForFunction(() => document.querySelector('[data-testid="evaluation-workspace"]')?.textContent.includes('4 graph nodes'));
  assert.equal(await page.getByLabel('Evaluation output',{exact:true}).inputValue(),'-1');
  for (const metric of ['mae','mse']) {
    await page.getByLabel('Evaluation metric',{exact:true}).selectOption(metric);
    const rows = await work.locator('[data-change]').evaluateAll(rows => rows.map(row => ({status:row.dataset.change,color:getComputedStyle(row.querySelector('button')).color})));
    const order = {Improved:0,Degraded:1,'No noticeable change':2,Unavailable:3};
    assert.deepEqual(rows.map(r=>order[r.status]),rows.map(r=>order[r.status]).sort((a,b)=>a-b));
    for (const r of rows) assert.equal(r.color,r.status==='Improved'?'rgb(4, 120, 87)':r.status==='Degraded'?'rgb(220, 38, 38)':'rgb(100, 116, 139)');
  }
  assert.doesNotMatch(await work.innerText(),/Integration source:|Graph and selected relation|Injection contexts:|Current sample, all|No noticeable change: \|/);
  await page.getByLabel('Filter relations',{exact:true}).fill('no-such-edge');
  assert.equal(await work.locator('[data-change]').count(),0);
  await page.getByLabel('Filter relations',{exact:true}).fill('');
  await work.locator('[data-change] button').first().click();
  assert.equal(await work.locator('.echarts-for-react').count(), 1);
  assert.match(await work.getByTestId('removal-change-chart').innerText(), /MSE change after edge removal/);
  await work.screenshot({path:'.tmp/evaluation-clean.png'});
  const missing = structuredClone(fixture);
  missing.runStatus='partial'; missing.records=missing.records.filter(r=>r.sampleId==='0');
  await upload(missing);
  await page.getByLabel('Evaluation sample',{exact:true}).selectOption('1');
  assert.equal(await work.locator('button[aria-pressed=true]').count(),0);
  assert.match(await work.innerText(),/No stored removal selected/);
  assert.match(await work.innerText(),/run is incomplete/);
  const invalid=structuredClone(fixture); invalid.records[0].metrics.mae=999;
  await upload(invalid);
  await page.getByRole('heading',{name:'Invalid or incompatible result file'}).waitFor();
  assert.equal(await page.getByLabel('Evaluation sample',{exact:true}).inputValue(),'1');
  const aggregate=structuredClone(fixture);
  for(const s of aggregate.samples) { delete s.truth; delete s.baselinePrediction; s.contexts=[]; }
  aggregate.nodes=[];
  for(const r of aggregate.records) { delete r.prediction; delete r.source; delete r.target; r.contextIds=[]; }
  await upload(aggregate);
  await page.waitForFunction(() => document.querySelector('[data-testid="evaluation-workspace"]')?.textContent.includes('0 graph nodes'));
  assert.match(await work.innerText(),/Forecast-step error changes unavailable/);
  assert.equal(await page.getByLabel('Evaluation output',{exact:true}).locator('option:disabled').count(),2);
  await page.getByRole('button',{name:'Return to Built-in Demo',exact:true}).first().click();
  assert.equal(await work.count(),0);
  assert.deepEqual(errors,[]);
  console.log('Evaluation browser PASS: grouping, colors, metric switching, search, result selection, partial results, invalid import, aggregate-only results and demo restoration.');
} finally { await browser.close(); }
