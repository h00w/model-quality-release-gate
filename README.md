# AI Model Release Control Center

A production-oriented AI evaluation and release-engineering project for deciding whether a candidate coding model is ready to ship.

> **Evaluate → Compare → Investigate → Gate → Ship**

## Phase status

**Phase 1 — Essential release gate: COMPLETE**

Phase 1 implements the decision-making core requested in the project roadmap:

- Executive, decision-first dashboard
- Baseline vs candidate model comparison
- Metric deltas and tolerance-aware regression detection
- Deterministic **SHIP / INVESTIGATE / HOLD** policy
- Human-readable **Why this decision?** explanation
- Failure Explorer with severity and release-impact context
- Six deterministic demo scenarios:
  - Candidate improves overall
  - Latency regression
  - Safety regression
  - Code quality regression
  - Mixed trade-offs
  - Catastrophic failure
- CSV / JSON / JSONL candidate-result import
- Exportable report and CSV evidence
- Automated test + production-build CI
- Automated GitHub → Hugging Face publication

Phase 2, Phase 3 and Phase 4 are intentionally tracked separately so later features do not weaken the deterministic Phase 1 release core.

## Live publication stack

| Layer | Purpose | Link |
|---|---|---|
| GitHub | Source of truth, release policy, tests, CI | https://github.com/h00w/model-quality-release-gate |
| Hugging Face model card | Methodology and artifact index | https://huggingface.co/h0000w/model-quality-release-gate |
| Hugging Face dataset | Reproducible evaluation evidence | https://huggingface.co/datasets/h0000w/model-quality-release-gate |
| Hugging Face Space | Canonical interactive demo | https://huggingface.co/spaces/h0000w/model-quality-release-gate |
| Portfolio case study | Recruiter-facing engineering narrative | https://hendarmawan.se/model-quality-release-gate/ |
| Agentic AI Academy | Evaluation/release-control cross-link | https://hendarmawan.se/agentic-ai/ |

## Phase 1 architecture

```text
Baseline evaluation          Candidate evaluation
        │                            │
        └────────────┬───────────────┘
                     ↓
             Metric Aggregation
                     ↓
             Baseline Comparison
                     ↓
            Regression Detection
                     ↓
              Failure Analysis
                     ↓
              Release Policy
                     ↓
          SHIP / INVESTIGATE / HOLD
                     ↓
      Explanation + exportable evidence
```

## Release policy

1. Critical safety failure → `HOLD`
2. Major safety regression → `HOLD`
3. Major reliability regression → `HOLD`
4. Major code-correctness regression → `HOLD`
5. Performance regression beyond tolerance → `INVESTIGATE`
6. Minor adverse trade-off → `INVESTIGATE`
7. All critical constraints pass and quality is stable/improved → `SHIP`

Default tolerances:

| Metric | Direction | Default tolerance |
|---|---|---:|
| Helpfulness | Higher is better | -2 pts |
| Safety | Higher is better | -1 pt |
| Reliability | Higher is better | -2 pts |
| Code pass rate | Higher is better | -2 pts |
| Latency | Lower is better | +5% |

Overall quality score:

```text
0.25 × helpfulness + 0.20 × safety + 0.20 × reliability + 0.35 × codePassRate
```

Latency remains an independent release constraint instead of dominating the quality score.

## Demo methodology

The Phase 1 demo data is intentionally **fictional and deterministic**. It exists to prove the release-engineering methodology, not to make unsupported claims about real models.

Each scenario contains 120 normalized evaluation records. Individual failures are traceable to a category, severity, prompt, expected behavior, candidate output and release impact.

The release engine lives in `src/lib/evaluation.ts`, independent from React presentation logic.

## Validation

```bash
npm install
npm test
npm run build
```

The Phase 1 CI workflow runs the release-policy test suite and production TypeScript/Vite build on every push and pull request.

## Hugging Face publication

GitHub is the engineering source of truth. The following directories are automatically synchronized with the three Hugging Face repositories through `.github/workflows/publish-huggingface.yml` using the repository `HF_TOKEN` secret:

```text
huggingface-model/      → https://huggingface.co/h0000w/model-quality-release-gate
huggingface-dataset/    → https://huggingface.co/datasets/h0000w/model-quality-release-gate
huggingface-space/      → https://huggingface.co/spaces/h0000w/model-quality-release-gate
```

The Space opens in **Phase 1 deterministic demo mode**. A clearly separated live-inference tab is retained only as a Phase 4 preview.

## Roadmap

- **Phase 1 — COMPLETE:** executive dashboard, comparison, regression detection, release gate, failure explorer, demo scenarios.
- **Phase 2:** evaluation playground, version trends, release-policy simulator, what-if mode, safety/performance dashboards, dataset explorer.
- **Phase 3:** evidence/audit trail, evaluation artifacts, enforceable CI gate, badges, versioned datasets.
- **Phase 4:** hardened real-model inference, LLM judge, production trace ingestion, historical model registry.

## Author

**Hendarmawan, PhD Eng.** · [Website](https://hendarmawan.se) · [LinkedIn](https://www.linkedin.com/in/hender/) · [GitHub](https://github.com/h00w)

MIT License.
