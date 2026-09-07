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
  const upload = async (d, name = 'evaluation.json') => page.locator('input[type=file]').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(d)) });
  await page.getByRole('button', {name: 'Explore MTGNN', exact: true}).click();
  const work = page.getByTestId('evaluation-workspace');
  const clickEdge = async name => {
    const edge = work.getByRole('button', {name, exact:true});
    // Imports intentionally smooth-scroll the workspace; wait for that scroll to settle.
    await page.waitForFunction(() => !document.getAnimations().some(a => a.playState === 'running'));
    await edge.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => {
      const w = window;
      w.__stillScroll = w.__lastScroll === w.scrollY ? (w.__stillScroll || 0) + 1 : 0;
      w.__lastScroll = w.scrollY;
      return w.__stillScroll > 5;
    }, null, {polling:100});
    const point = await edge.evaluate(g => {
      const path = g.querySelector('path');
      for(const fraction of Array.from({length:90},(_,i)=>(i+5)/100)) {
        const p=path.getPointAtLength(path.getTotalLength()*fraction);
        const screen=new DOMPoint(p.x,p.y).matrixTransform(path.getScreenCTM());
        if(g.contains(document.elementFromPoint(screen.x,screen.y))) return {x:screen.x,y:screen.y};
      }
      return null;
    });
    if (!point) {
      await page.screenshot({path:'.tmp/evaluation-click-debug.png'});
      console.log(await edge.evaluate(g => { const p=g.querySelector('path'), v=p.getPointAtLength(p.getTotalLength()*.25), s=new DOMPoint(v.x,v.y).matrixTransform(p.getScreenCTM()); return {x:s.x,y:s.y,hit:document.elementFromPoint(s.x,s.y)?.outerHTML.slice(0,500),rect:g.getBoundingClientRect().toJSON()}; }));
    }
    assert.ok(point, 'The edge needs an unobstructed clickable segment');
    await page.mouse.click(point.x, point.y);
  };
  await work.waitFor();
  assert.match(await work.innerText(), /8 graph nodes · 8 forecast outputs · 1 forecast steps/);
  assert.equal(await page.getByLabel('Evaluation context', {exact:true}).locator('option').count(), 1);
  assert.equal(await page.getByLabel('Evaluation removal', {exact:true}).locator('option').count(), 29);
  assert.doesNotMatch(await work.innerText(), /matched controls|positive D|p\/q|All scales|All windows/);
  await clickEdge('Select edge 1 to 2');
  assert.match(await work.innerText(), /EX1 → EX2/);
  await page.getByLabel('Evaluation sample', {exact:true}).selectOption('1');
  assert.notEqual(await page.getByLabel('Evaluation removal', {exact:true}).inputValue(), '');
  await page.getByLabel('Evaluation output', {exact:true}).selectOption('2');
  await work.screenshot({ path: '.tmp/evaluation-mtgnn.png' });

  await upload(fixture);
  await page.waitForFunction(() => document.querySelector('[data-testid="evaluation-workspace"]')?.textContent.includes('4 graph nodes'));
  assert.equal(await page.getByLabel('Evaluation output', {exact:true}).inputValue(), '-1');
  assert.equal(await work.locator('[aria-label="Select edge latent-b to latent-c"]').count(), 1);
  await clickEdge('Select edge latent-b to latent-c');
  await page.getByLabel('Evaluation output', {exact:true}).selectOption('0');
  assert.match(await work.innerText(), /Forecast A/);
  await work.screenshot({ path: '.tmp/evaluation-functions.png' });

  const missing = structuredClone(fixture);
  missing.runStatus='partial'; missing.records=missing.records.filter(r=>r.sampleId==='0');
  await upload(missing); await page.getByLabel('Evaluation sample', {exact:true}).selectOption('1');
  assert.equal(await page.getByLabel('Evaluation removal', {exact:true}).inputValue(), '');
  assert.match(await work.innerText(), /No stored removal selected/);
  assert.match(await work.innerText(), /run is incomplete/);

  const invalid = structuredClone(fixture); invalid.records[0].metrics.mae=999;
  await upload(invalid, 'invalid.json');
  await page.getByRole('heading', {name:'Invalid or incompatible result file'}).waitFor();
  assert.equal(await page.getByLabel('Evaluation sample', {exact:true}).inputValue(), '1');

  const aggregate = structuredClone(fixture);
  for(const s of aggregate.samples) { delete s.truth; delete s.baselinePrediction; s.contexts=[]; }
  aggregate.nodes=[];
  for(const r of aggregate.records) { delete r.prediction; delete r.source; delete r.target; r.contextIds=[]; }
  await upload(aggregate);
  await page.waitForFunction(() => document.querySelector('[data-testid="evaluation-workspace"]')?.textContent.includes('Graph unavailable'));
  assert.match(await work.innerText(), /Prediction curves unavailable/);
  assert.equal(await page.getByLabel('Evaluation output', {exact:true}).locator('option:disabled').count(), 2);
  await work.screenshot({ path: '.tmp/evaluation-metrics-only.png' });
  const contract = JSON.parse(fs.readFileSync('tests/fixtures/evaluation/contract.json'));
  await upload(contract, 'contract.json');
  await page.waitForFunction(() => document.querySelector('[data-testid="evaluation-workspace"]')?.textContent.includes('Integration source: adapter'));
  assert.match(await work.innerText(), /Fixture encoder/);
  assert.match(await work.innerText(), /Weights are optional/);
  await page.getByRole('button', {name:'Return to Built-in Demo',exact:true}).first().click();
  assert.equal(await work.count(),0);
  assert.deepEqual(errors, []);
  console.log('Evaluation browser PASS: MTGNN canonical edges, sample identity, independent dimensions, negative edges, raw/metrics-only capability views, partial gaps, invalid import preserves active source, same-name import resets state, demo restoration.');
} finally { await browser.close(); }
