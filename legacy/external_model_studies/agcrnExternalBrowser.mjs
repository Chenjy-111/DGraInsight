import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const data=JSON.parse(fs.readFileSync('public/data/evaluation/agcrn.json'));
const js=ts.transpileModule(fs.readFileSync('src/data/evaluation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {validateEvaluation}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
assert.equal(validateEvaluation(data).ok,true);
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.PERFORMANCE_URL || 'http://127.0.0.1:5181/DGraInsight/',{waitUntil:'domcontentloaded'});
 await page.locator('input[type=file]').setInputFiles('public/data/evaluation/agcrn.json');
 const work=page.getByTestId('evaluation-workspace');await work.waitFor();
 await page.getByRole('heading',{name:'AGCRN · PeMSD8 test split',exact:true}).waitFor();
 assert.match(await work.innerText(),/170 graph nodes · 170 forecast outputs · 3 forecast steps/);
 assert.match(await work.innerText(),/Integration source: adapter/);
 assert.match(await work.innerText(),/Dense graph/);
 assert.equal(await page.getByLabel('Evaluation context',{exact:true}).locator('option').count(),1);
 const select=page.getByLabel('Evaluation removal',{exact:true});
 for(const sid of ['0','1','2']) {
  await page.getByLabel('Evaluation sample',{exact:true}).selectOption(sid);
  const record=data.records.find(r=>r.sampleId===sid && r.source==='0' && r.target==='1');
  await select.selectOption(record.id);
  const row=work.locator('#validation-workspace tbody tr').first();
  const fmt=x=>Number(x.toPrecision(6)).toString();
  assert.equal(await row.locator('td').nth(0).innerText(),fmt(data.samples.find(s=>s.id===sid).baselineMetrics.mae));
  assert.equal(await row.locator('td').nth(1).innerText(),fmt(record.metrics.mae));
 }
 await page.getByLabel('Evaluation metric',{exact:true}).selectOption('mse');
 await page.getByLabel('Evaluation output',{exact:true}).selectOption('3');
 assert.match(await work.innerText(),/Sensor 3 flow/);
 await page.getByLabel('Filter relations',{exact:true}).fill('Sensor 0');
 await page.getByText('Data checks, native verification and provenance',{exact:true}).click();
 assert.match(await work.innerText(),/nativeIntervention: passed/);
 await work.screenshot({path:'.tmp/agcrn-generic-web.png'});
 assert.deepEqual(errors,[]);
 const report={status:'PASS',model:'AGCRN',genericWorkspace:'EvaluationWorkspace',samples:3,records:9,metricRowsChecked:3,outputSelector:true,contextSelector:true,relationTable:true,forecastStepProfile:true,crossSampleProfile:true,provenance:true,pageErrors:errors};
 fs.writeFileSync('integrations/agcrn_external/web_validation.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
} finally { await browser.close(); }
