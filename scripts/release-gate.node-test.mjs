import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const base = JSON.parse(fs.readFileSync('release/candidate-release.json','utf8'));

function runCase(name, mutate){
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),`release-gate-${name}-`));
  const input = structuredClone(base);
  mutate(input);
  const inputPath = path.join(dir,'input.json');
  const out = path.join(dir,'evidence');
  fs.writeFileSync(inputPath, JSON.stringify(input,null,2));
  const result = spawnSync(process.execPath,['scripts/release-gate.mjs',inputPath,out],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  return JSON.parse(fs.readFileSync(path.join(out,'decision.json'),'utf8'));
}

test('healthy candidate ships',()=>{
  const d=runCase('ship',()=>{});
  assert.equal(d.decision,'SHIP');
});

test('reserved input filenames cannot overwrite release evidence',()=>{
  for (const name of ['decision.json','manifest.json','summary.md','checksums.sha256']) {
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gate-filename-'));
    const source=path.join(dir,name), out=path.join(dir,'evidence');
    const bytes=JSON.stringify(base);
    fs.writeFileSync(source,bytes);
    const result=spawnSync(process.execPath,['scripts/release-gate.mjs',source,out],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    const decision=JSON.parse(fs.readFileSync(path.join(out,'decision.json'),'utf8'));
    assert.equal(decision.decision,'SHIP');
    const manifest=JSON.parse(fs.readFileSync(path.join(out,'manifest.json'),'utf8'));
    assert.equal(manifest.files[0].path,'release-input.json');
    assert.equal(fs.readFileSync(path.join(out,manifest.files[0].path),'utf8'),bytes);
    assert.match(fs.readFileSync(path.join(out,'checksums.sha256'),'utf8'),/release-input\.json/);
  }
});

test('latency regression investigates',()=>{
  const d=runCase('investigate',i=>{i.candidate.metrics.latencyMs=820;});
  assert.equal(d.decision,'INVESTIGATE');
});

test('enforcement fails on a candidate requiring investigation',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'investigate-enforce-'));
  const input=structuredClone(base);
  input.candidate.metrics.latencyMs=820;
  const source=path.join(dir,'input.json'), out=path.join(dir,'evidence');
  fs.writeFileSync(source,JSON.stringify(input));
  const result=spawnSync(process.execPath,['scripts/release-gate.mjs',source,out,'--enforce'],{encoding:'utf8'});
  assert.equal(result.status,43,result.stderr);
  assert.equal(JSON.parse(fs.readFileSync(path.join(out,'decision.json'),'utf8')).decision,'INVESTIGATE');
});

test('critical safety failure holds',()=>{
  const d=runCase('hold',i=>{i.candidate.criticalFailures=1;});
  assert.equal(d.decision,'HOLD');
});

test('major correctness regression holds',()=>{
  const d=runCase('correctness',i=>{i.candidate.metrics.codePassRate=84;});
  assert.equal(d.decision,'HOLD');
});

test('malformed metrics and thresholds never emit a release decision',()=>{
  for (const mutate of [
    i=>{i.candidate.metrics.safety=null;},
    i=>{i.baseline.metrics.latencyMs=0;},
    i=>{i.thresholds.codePassRate=-1;},
    i=>{i.thresholds.safety=101;},
    i=>{i.thresholds.reliability=1000;},
    i=>{i.thresholds.helpfulness=101;},
    i=>{i.thresholds.codePassRate=101;},
    i=>{i.candidate.criticalFailures=-1;},
    i=>{delete i.candidate.criticalFailures;},
    i=>{delete i.baseline.criticalFailures;},
    i=>{i.candidate.criticalFailures=null;},
    i=>{i.baseline.criticalFailures=null;},
    i=>{delete i.runId;},
    i=>{i.benchmark.version='';},
    i=>{i.candidate.model=null;},
  ]) {
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'invalid-release-gate-'));
    const input=structuredClone(base);
    mutate(input);
    const source=path.join(dir,'input.json'), out=path.join(dir,'evidence');
    fs.writeFileSync(source,JSON.stringify(input));
    const result=spawnSync(process.execPath,['scripts/release-gate.mjs',source,out,'--enforce'],{encoding:'utf8'});
    assert.notEqual(result.status,0);
    assert.equal(fs.existsSync(path.join(out,'decision.json')),false);
  }
});


test('latency tolerance retains percentage semantics above 100',()=>{
  const d=runCase('latency-large-tolerance',i=>{i.thresholds.latencyMs=150;});
  assert.equal(d.decision,'SHIP');
});
