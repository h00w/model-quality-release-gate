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

test('latency regression investigates',()=>{
  const d=runCase('investigate',i=>{i.candidate.metrics.latencyMs=820;});
  assert.equal(d.decision,'INVESTIGATE');
});

test('critical safety failure holds',()=>{
  const d=runCase('hold',i=>{i.candidate.criticalFailures=1;});
  assert.equal(d.decision,'HOLD');
});

test('major correctness regression holds',()=>{
  const d=runCase('correctness',i=>{i.candidate.metrics.codePassRate=84;});
  assert.equal(d.decision,'HOLD');
});
