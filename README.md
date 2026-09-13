# AI Model Release Control Center

[![Phase 3 CI](https://github.com/h00w/model-quality-release-gate/actions/workflows/deploy.yml/badge.svg)](https://github.com/h00w/model-quality-release-gate/actions/workflows/deploy.yml)
[![Model Release Gate](https://github.com/h00w/model-quality-release-gate/actions/workflows/release-gate.yml/badge.svg)](https://github.com/h00w/model-quality-release-gate/actions/workflows/release-gate.yml)
![Reference decision](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/h00w/model-quality-release-gate/main/badges/release-gate.json)

A production-oriented AI evaluation and release-engineering project for deciding whether a candidate coding model is ready to ship.

> **Evaluate → Compare → Investigate → Simulate → Gate → Ship**

## Phase status

**Phase 1 — Essential release gate: COMPLETE**  
**Phase 2 — Interactive evaluation & release simulation: COMPLETE**  
**Phase 3 — Enforceable release engineering: COMPLETE**

## Phase 3 capabilities

Phase 3 moves the project from an interactive evaluation application into an auditable release-control plane:

- **Machine-readable release decisions** in `decision.json`
- **Tamper-evident evidence bundles** with SHA-256 checksums
- **Run manifests** tying benchmark version, policy version, source commit and workflow run to the decision
- **Enforceable CI gate**: a `HOLD` result exits non-zero and produces a failing GitHub status check
- **Evidence preservation on blocked releases** through GitHub Actions artifacts
- **Versioned benchmark datasets** under `benchmarks/codebench-safety/v1.0.0/`
- **Versioned Hugging Face publication** under `huggingface-dataset/versions/v1.0.0/`
- **Workflow and release-decision badges**
- **Automated tests** for SHIP / INVESTIGATE / HOLD machine-readable outcomes

> To make the gate a literal merge blocker, configure the `Enforce model release policy` status check as a required check in the repository's branch/ruleset settings. The workflow already fails on `HOLD`; repository policy determines whether GitHub forbids merging that failing check.

## Release evidence bundle

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

The manifest records an evidence identity built from the evaluation run and source commit, while `checksums.sha256` makes later modification detectable.

Example decision shape:

```json
{
  "decision": "SHIP",
  "policyVersion": "release-policy/v1.0.0",
  "run": {
    "benchmark": {
      "name": "CodeBench-Safety",
      "version": "1.0.0"
    },
    "sourceCommit": "<git-sha>",
    "workflowRunId": "<actions-run-id>"
  }
}
```

## CI enforcement model

`.github/workflows/release-gate.yml` executes the following sequence:

```text
Candidate release input
        ↓
Machine-readable gate
        ↓
Decision + manifest
        ↓
SHA-256 verification
        ↓
Upload evidence artifact
        ↓
Decision enforcement
        ↓
SHIP         → status check passes
INVESTIGATE  → status check passes, review required by process
HOLD         → status check fails
```

Evidence is uploaded **before** enforcement, so a blocked release retains the diagnostic record that caused the failure.

## Versioned benchmark strategy

Current benchmark:

```text
CodeBench-Safety v1.0.0
```

Repository definition:

```text
benchmarks/codebench-safety/v1.0.0/
├── manifest.json
└── cases.jsonl
```

Hugging Face publication:

```text
huggingface-dataset/versions/v1.0.0/
├── manifest.json
└── cases.jsonl
```

Benchmark changes should create a new semantic version instead of replacing historical cases. This keeps old release decisions reproducible and prevents silent benchmark drift.

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

## Interactive Phase 2 workbench

The live app still provides:

- Evaluation Playground
- baseline/candidate comparison
- version trends
- release-policy simulator
- What-If Mode
- safety dashboard
- P50/P90/P95/P99 performance view
- dataset coverage explorer
- failure explorer

The deterministic demo is intentionally separated from unsupported claims about real foundation-model performance.

## Live publication stack

| Layer | Purpose | Link |
|---|---|---|
| GitHub | Source, release engine, CI enforcement, evidence workflow | https://github.com/h00w/model-quality-release-gate |
| Hugging Face Space | Interactive evaluation/control demo | https://huggingface.co/spaces/h0000w/model-quality-release-gate |
| Hugging Face dataset | Versioned evaluation benchmark/evidence | https://huggingface.co/datasets/h0000w/model-quality-release-gate |
| Hugging Face methodology card | Release policy and artifact index | https://huggingface.co/h0000w/model-quality-release-gate |
| Portfolio case study | Recruiter-facing engineering narrative | https://hendarmawan.se/projects/model-quality-release-gate/ |
| Agentic AI Academy | Evaluation/release-control cross-link | https://hendarmawan.se/agentic-ai/ |

## Validation

```bash
npm install
npm test
node --test scripts/release-gate.test.mjs
node scripts/release-gate.mjs release/candidate-release.json artifacts/release-gate
cd artifacts/release-gate && sha256sum --check checksums.sha256
npm run build
python -m py_compile huggingface-space/app.py
```

## Roadmap

- **Phase 1 — COMPLETE:** executive dashboard, comparison, regression detection, release gate, failure explorer, demo scenarios.
- **Phase 2 — COMPLETE:** evaluation playground, trends, policy simulator, what-if mode, safety/performance dashboards, dataset explorer.
- **Phase 3 — COMPLETE:** audit evidence, machine-readable artifacts, CI enforcement, badges, versioned benchmarks and published dataset versions.
- **Phase 4:** hardened real-model inference, LLM judge, production trace ingestion and historical model registry.

## Author

**Hendarmawan, PhD Eng.** · [Website](https://hendarmawan.se) · [LinkedIn](https://www.linkedin.com/in/hender/) · [GitHub](https://github.com/h00w)

MIT License.
