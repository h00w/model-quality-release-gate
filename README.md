# AI Model Release Control Center

[![Phase 4 CI](https://github.com/h00w/model-quality-release-gate/actions/workflows/deploy.yml/badge.svg)](https://github.com/h00w/model-quality-release-gate/actions/workflows/deploy.yml)
[![Model Release Gate](https://github.com/h00w/model-quality-release-gate/actions/workflows/release-gate.yml/badge.svg)](https://github.com/h00w/model-quality-release-gate/actions/workflows/release-gate.yml)
![Reference decision](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/h00w/model-quality-release-gate/main/badges/release-gate.json)

A production-oriented AI evaluation and release-engineering control plane for deciding whether a candidate model is ready to ship, preserving evidence, enforcing policy in CI, evaluating real provider outputs, ingesting production traces and promoting models through explicit lifecycle states.

> **Evaluate → Compare → Investigate → Gate → Promote → Operate**

## Phase status

**Phase 1 — Essential release gate: COMPLETE**  
**Phase 2 — Interactive evaluation & release simulation: COMPLETE**  
**Phase 3 — Enforceable release engineering: COMPLETE**  
**Phase 4 — Production evaluation & model lifecycle: COMPLETE**

## Phase 4 capabilities

Phase 4 connects the Phase 3 evidence contract to real model-provider execution and production lifecycle signals:

- **Hardened Hugging Face inference adapter** running server-side in the Space
- **No client-side provider tokens**; `HF_TOKEN` is read only from the Space environment
- **Normalized provider results** before release policy consumes them
- **Deterministic security scanner** for shell injection, SQL injection patterns, unsafe deserialization, weak crypto and hard-coded secrets
- **Task-aware deterministic correctness checks** for benchmark-style evaluation
- **Optional LLM judge** for subjective qualities only; it cannot override deterministic critical safety/correctness evidence
- **Output and prompt SHA-256 identities** for evidence provenance
- **Production trace ingestion** from JSONL with required schema validation and latency/error aggregation
- **Historical model registry semantics** with explicit `candidate → approved → production` promotion and a `blocked` state
- **Evidence-linked promotion records** so lifecycle transitions reference the release evidence that authorized them
- **Phase 4 unit tests** independent of live provider availability

> Generated model code is intentionally **not executed inside the Hugging Face Space process**. Real executable-code evaluation should use an isolated sandbox or worker boundary with resource, network and filesystem controls.

## Phase 4 architecture

```text
Real model provider
      ↓
Server-side adapter
      ↓
Normalized model output
      ├── deterministic security checks
      ├── deterministic correctness checks
      ├── latency/provenance measurements
      └── optional subjective LLM judge
      ↓
Evaluation evidence
      ↓
Phase 3 release policy + audit contract
      ↓
SHIP / INVESTIGATE / HOLD
      ↓
Evidence-linked model registry
      ↓
candidate → approved → production
             or
           blocked

Production traces ───────────────→ trace ingestion / operational evidence
```

## Live Hugging Face evaluation

The public Space exposes a live evaluation tab using server-side Hugging Face inference.

Default examples:

- baseline: `Qwen/Qwen2.5-Coder-1.5B-Instruct`
- candidate: `Qwen/Qwen2.5-Coder-3B-Instruct`
- optional judge: `Qwen/Qwen2.5-7B-Instruct` or `JUDGE_MODEL`

The live path requires `HF_TOKEN` configured as a **Hugging Face Space secret**. The GitHub Actions `HF_TOKEN` used to publish the Space is a separate secret and does not automatically populate the Space runtime environment.

## Deterministic authority vs LLM judge

The release design deliberately separates objective and subjective evidence:

```text
Security / correctness / critical failures
→ deterministic checks
→ release authority

Helpfulness / clarity
→ optional LLM judge or heuristic
→ supporting evidence
```

A judge score cannot turn a deterministic critical safety failure into a passing release.

## Production trace ingestion

Example accepted JSONL record:

```json
{"trace_id":"trace-001","model":"CodeGen-7B-v1.5","latency_ms":742,"status":"ok"}
```

Required fields:

- `trace_id`
- `model`
- `latency_ms`
- `status`

The ingestion layer reports accepted/rejected records, average latency and observed error rate. A versioned example is stored under `production-traces/example.jsonl`.

## Historical model registry

The reference registry is stored in:

```text
registry/model-registry.json
```

Lifecycle states:

```text
candidate --SHIP--> approved --SHIP--> production
    |                   |
   HOLD                HOLD
    ↓                   ↓
 blocked             blocked
```

`INVESTIGATE` does not automatically promote a model. Each transition carries an `evidenceId` tying it back to the release-control evidence.

## Phase 3 release evidence bundle

Running:

```bash
node scripts/release-gate.mjs release/candidate-release.json artifacts/release-gate
```

produces:

```text
artifacts/release-gate/
├── candidate-release.json
├── decision.json
├── manifest.json
├── checksums.sha256
└── summary.md
```

The manifest records benchmark version, policy version, commit/run identity and checksums. `HOLD` exits non-zero in the enforcement workflow while the evidence artifact is retained.

## Release policy

1. Critical safety failure → `HOLD`
2. Major safety regression → `HOLD`
3. Major reliability regression → `HOLD`
4. Major code-correctness regression → `HOLD`
5. Performance regression beyond tolerance → `INVESTIGATE`
6. Minor adverse trade-off → `INVESTIGATE`
7. All critical constraints pass and quality is stable/improved → `SHIP`

Overall quality score:

```text
0.25 × helpfulness + 0.20 × safety + 0.20 × reliability + 0.35 × codePassRate
```

Latency remains an independent release constraint.

## CI validation

```bash
npm install
npm test
node --test scripts/release-gate.node-test.mjs
cd huggingface-space && python -m unittest -v test_phase4_engine.py
cd ..
node scripts/release-gate.mjs release/candidate-release.json artifacts/release-gate
cd artifacts/release-gate && sha256sum --check checksums.sha256
cd ../..
npm run build
python -m py_compile huggingface-space/app.py huggingface-space/phase4_engine.py
```

The Phase 4 CI deliberately tests deterministic provider-normalization, security, correctness, trace-validation and promotion logic without making network inference a CI prerequisite.

## Public proof chain

| Layer | Purpose | Link |
|---|---|---|
| GitHub | Source, CI, release gate, registry, trace schema | https://github.com/h00w/model-quality-release-gate |
| Hugging Face Space | Reference gate + live inference + traces + promotion demo | https://huggingface.co/spaces/h0000w/model-quality-release-gate |
| Hugging Face dataset | Versioned evaluation benchmark/evidence | https://huggingface.co/datasets/h0000w/model-quality-release-gate |
| Hugging Face methodology card | Release policy and artifact index | https://huggingface.co/h0000w/model-quality-release-gate |
| Portfolio case study | Recruiter-facing engineering narrative | https://hendarmawan.se/projects/model-quality-release-gate/ |
| Agentic AI Academy | Evaluation/release-control cross-link | https://hendarmawan.se/agentic-ai/ |

## What Phase 4 does not pretend to be

- It does not claim in-process execution of arbitrary generated code is safe.
- It does not treat an LLM judge as ground truth for deterministic security or correctness.
- It does not claim the demo registry is a transactional production database.
- It does not claim GitHub Actions artifacts are WORM-compliant immutable storage.

Production hardening beyond this reference architecture would typically add an isolated code-execution service, signed/attested artifacts, durable registry storage, access control and production observability connectors.

## Author

**Hendarmawan, PhD Eng.** · [Website](https://hendarmawan.se) · [LinkedIn](https://www.linkedin.com/in/hender/) · [GitHub](https://github.com/h00w)

MIT License.
