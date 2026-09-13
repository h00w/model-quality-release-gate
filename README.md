# AI Model Release Control Center

[![Phase 4 CI](https://github.com/h00w/model-quality-release-gate/actions/workflows/deploy.yml/badge.svg)](https://github.com/h00w/model-quality-release-gate/actions/workflows/deploy.yml)
[![Model Release Gate](https://github.com/h00w/model-quality-release-gate/actions/workflows/release-gate.yml/badge.svg)](https://github.com/h00w/model-quality-release-gate/actions/workflows/release-gate.yml)
![Reference decision](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/h00w/model-quality-release-gate/main/badges/release-gate.json)

## Did the new model actually get better — and is it safe to ship?

A production-oriented AI evaluation and release-engineering system for coding models, with a dedicated **Post-Training Experiment Lab** connecting model-improvement work to release decisions and production feedback.

> **Train → Evaluate → Compare → Investigate → Gate → Ship → Monitor → Learn**

A model improvement is not automatically a product improvement. A candidate can improve code-generation quality while simultaneously introducing regressions in safety, reliability, latency, cost, token efficiency, or previously solved tasks.

The system turns those trade-offs into reproducible evidence and an explainable **SHIP · INVESTIGATE · HOLD** decision.

## Phase status

**Phase 1 : Essential release gate: COMPLETE**  
**Phase 2 : Interactive evaluation & release simulation: COMPLETE**  
**Phase 3 : Enforceable release engineering: COMPLETE**  
**Phase 4 : Production evaluation & model lifecycle: COMPLETE**  
**Research layer — Post-Training Experiment Lab: COMPLETE**

## Post-Training Experiment Lab

The Lab is deliberately a research-engineering workflow rather than another dashboard panel. It starts from an explicit training intervention and asks whether the resulting model is actually better across multiple objectives.

Illustrative experiment:

- **Baseline:** `CodeModel-v1`
- **Candidate:** `CodeModel-v2-sft`
- **Training intervention:** `SFT`
- **Dataset:** `10,000 coding tasks`
- **Evaluation set:** frozen coding + safety regression suite

| Evaluation | Baseline | Candidate | Δ | Signal |
|---|---:|---:|---:|---|
| Code execution pass rate | 71.4% | 76.9% | +5.5 pts | IMPROVED |
| Unit-test pass rate | 68.2% | 74.6% | +6.4 pts | IMPROVED |
| SWE-bench-style success | 31.7% | 36.4% | +4.7 pts | IMPROVED |
| Instruction following | 88.0% | 91.2% | +3.2 pts | IMPROVED |
| Hallucination rate | 7.8% | 6.1% | -1.7 pts | IMPROVED |
| Safety | 96.1% | 94.8% | -1.3 pts | REGRESSION |
| Latency P95 | 2.8 s | 3.1 s | +10.7% | REGRESSION |
| Cost / request | $0.031 | $0.035 | +12.9% | REGRESSION |
| Output tokens / solved task | 812 | 861 | +6.0% | REGRESSION |

### Release decision: `INVESTIGATE`

Code quality improves materially, but safety, P95 latency, cost and token efficiency regress beyond investigation thresholds. The values above are **illustrative** and demonstrate the workflow; they are not benchmark claims about a deployed foundation model.

### What would I investigate?

A regression number is an observation, not an explanation. The Lab ranks hypotheses separately from findings and then proposes experiments that can falsify them.

Leading hypotheses include:

1. Training-data distribution shift
2. Instruction-data contamination or conflicting supervision
3. Training-objective overspecialization
4. Longer generated trajectories
5. Serving / inference configuration
6. Reward-model / judge bias **only if** a preference/reward stage exists

Recommended experiments include rerunning on a frozen regression set, stratifying safety failures, diffing baseline/candidate outputs, inspecting nearby training examples, checking judge/reward correlation against deterministic labels, running data ablations, matching serving configurations, and slicing latency/cost by generated-token count.

The Lab exports a machine-readable `post-training-experiment` JSON artifact containing experiment metadata, metric assessments, decision, hypotheses and recommended follow-ups.

## Research-to-production architecture

```text
                 POST-TRAINING EXPERIMENT
                           │
                           ▼
                  ┌─────────────────┐
                  │ Evaluation Data │
                  └────────┬────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │ Baseline vs Candidate  │
              └───────────┬────────────┘
                          │
              ┌───────────┼────────────┐
              ▼           ▼            ▼
           Quality      Safety      Performance / Cost
              │           │            │
              └───────────┼────────────┘
                          ▼
                 Regression Analysis
                          │
                          ▼
                  Failure Investigation
                          │
                          ▼
                   Release Policy
                          │
                 ┌────────┼────────┐
                 ▼        ▼        ▼
               SHIP   INVESTIGATE  HOLD
                          │
                          ▼
                    Production
                          │
                          ▼
               Traces / User Feedback
                          │
                          └──────► Next Experiment
```

## Phase 4 production capabilities

The production path connects the Phase 3 evidence contract to real provider execution and lifecycle signals:

- **Server-side Hugging Face inference adapter**
- **No client-side provider tokens**; `HF_TOKEN` stays in the Space environment
- **Normalized provider results** before policy evaluation
- **Deterministic security scanner** for shell injection, SQL-injection patterns, unsafe deserialization, weak crypto and hard-coded secrets
- **Task-aware deterministic correctness checks**
- **Optional LLM judge** for subjective qualities only; it cannot override deterministic critical evidence
- **Prompt/output SHA-256 identities** for provenance
- **Production trace ingestion** from validated JSONL
- **Historical model-registry semantics** with `candidate → approved → production` and `blocked`
- **Evidence-linked promotion records**
- **CI tests independent of live-provider availability**

> Generated model code is intentionally **not executed inside the Hugging Face Space process**. Production executable-code evaluation should use an isolated sandbox/worker boundary with resource, network and filesystem controls.

## Live Hugging Face evaluation

The public Space exposes the Post-Training Experiment Lab, deterministic reference release gate, live model evaluation, trace ingestion and promotion semantics.

Default live-provider examples:

- baseline: `Qwen/Qwen2.5-Coder-1.5B-Instruct`
- candidate: `Qwen/Qwen2.5-Coder-3B-Instruct`
- optional judge: `Qwen/Qwen2.5-7B-Instruct` or `JUDGE_MODEL`

Live inference requires `HF_TOKEN` configured as a **Hugging Face Space secret**. The GitHub Actions token used to publish the Space is a separate security domain.

## Deterministic authority vs LLM judge

```text
Security / correctness / critical failures
→ deterministic checks
→ release authority

Helpfulness / clarity
→ optional LLM judge or heuristic
→ supporting evidence
```

A judge score cannot turn a deterministic critical safety failure into a passing release.

## Phase 3 release evidence bundle

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

`HOLD` exits non-zero in the enforcement workflow while evidence remains available for diagnosis.

## Release policy

1. Critical safety failure → `HOLD`
2. Major safety regression → `HOLD`
3. Major reliability regression → `HOLD`
4. Major code-correctness regression → `HOLD`
5. Performance/cost regression beyond tolerance → `INVESTIGATE`
6. Minor adverse trade-off → `INVESTIGATE`
7. All critical constraints pass and quality is stable/improved → `SHIP`

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

`npm test` now includes the Post-Training Experiment Lab decision, hypothesis-ranking and artifact-contract tests.

## What this demonstrates

This project is intentionally focused on the **post-training → evaluation → production** interface:

- Evaluation methodology
- Baseline/candidate experimentation
- Post-training intervention analysis
- Regression detection
- Failure and root-cause investigation
- Release-policy design
- Safety-quality trade-offs
- Latency/cost-quality trade-offs
- Reproducible evaluation
- CI/CD release gates
- Production feedback loops

It complements — rather than replaces — post-training methods such as SFT, preference optimization, RFT/RLVR and other model-improvement techniques.

## Public proof chain

| Layer | Purpose | Link |
|---|---|---|
| GitHub | Source, experiments, CI, release gate, registry, trace schema | https://github.com/h00w/model-quality-release-gate |
| Hugging Face Space | Post-Training Lab + live evaluation + traces + promotion | https://huggingface.co/spaces/h0000w/model-quality-release-gate |
| Hugging Face dataset | Versioned evaluation benchmark/evidence | https://huggingface.co/datasets/h0000w/model-quality-release-gate |
| Hugging Face methodology card | Evaluation/release methodology | https://huggingface.co/h0000w/model-quality-release-gate |
| Portfolio case study | Recruiter-facing research-engineering narrative | https://hendarmawan.se/projects/model-quality-release-gate/ |
| Agentic AI Academy | Evaluation/release-control cross-link | https://hendarmawan.se/agentic-ai/ |

## What the project does not pretend to be

- The illustrative post-training metrics are not presented as real benchmark results.
- It does not claim in-process execution of arbitrary generated code is safe.
- It does not treat an LLM judge as ground truth for deterministic security or correctness.
- It does not claim the demo registry is a transactional production database.
- It does not claim GitHub Actions artifacts are WORM-compliant immutable storage.

## Author

**Hendarmawan, PhD Eng.** · [Website](https://hendarmawan.se) · [LinkedIn](https://www.linkedin.com/in/hender/) · [GitHub](https://github.com/h00w)

MIT License.
