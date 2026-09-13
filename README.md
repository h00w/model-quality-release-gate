# AI Model Release Control Center

A production-oriented AI evaluation and release-engineering project for deciding whether a candidate coding model is ready to ship.

> **Evaluate → Compare → Investigate → Simulate → Gate → Ship**

## Phase status

**Phase 1 — Essential release gate: COMPLETE**  
**Phase 2 — Interactive evaluation & release simulation: COMPLETE**

### Phase 1

- Executive, decision-first dashboard
- Baseline vs candidate model comparison
- Metric deltas and tolerance-aware regression detection
- Deterministic **SHIP / INVESTIGATE / HOLD** policy
- Human-readable decision explanation
- Failure Explorer with severity and release-impact context
- Six deterministic demo scenarios
- CSV / JSON / JSONL candidate-result import
- Exportable report and CSV evidence

### Phase 2

- **Evaluation Playground** for prompt-level baseline/candidate examples
- **Version Trend** selector across quality, safety, reliability and latency
- **Release Policy Simulator** with configurable tolerances
- **What-If Mode** that applies hypothetical candidate changes without mutating source evidence
- **AI Code Safety Dashboard** with safety score and severity counts
- **Performance Dashboard** with P50/P90/P95/P99 latency and timeout-rate view
- **Evaluation Dataset Explorer** with executed coverage and case-level evidence
- Category + severity failure filtering
- Phase 2 helper-library tests for simulation, latency percentiles, safety aggregation and coverage
- CI validation for React/TypeScript and Hugging Face Space Python source

## Live publication stack

| Layer | Purpose | Link |
|---|---|---|
| GitHub | Source of truth, release policy, tests, CI | https://github.com/h00w/model-quality-release-gate |
| Hugging Face model card | Methodology and artifact index | https://huggingface.co/h0000w/model-quality-release-gate |
| Hugging Face dataset | Reproducible evaluation evidence | https://huggingface.co/datasets/h0000w/model-quality-release-gate |
| Hugging Face Space | Canonical interactive Phase 2 demo | https://huggingface.co/spaces/h0000w/model-quality-release-gate |
| Portfolio case study | Recruiter-facing engineering narrative | https://hendarmawan.se/projects/model-quality-release-gate/ |
| Agentic AI Academy | Evaluation/release-control cross-link | https://hendarmawan.se/agentic-ai/ |

## Architecture

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
         Policy + What-If Simulation
                     ↓
          SHIP / INVESTIGATE / HOLD
                     ↓
 Playground · Safety · Performance
 Dataset Explorer · Exportable Evidence
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

Latency remains an independent release constraint.

## Demo methodology

The Phase 1/2 demo data is intentionally **fictional and deterministic**. It proves release-engineering methodology without making unsupported claims about real models.

The Phase 2 Playground is also deterministic. Live-model inference remains a later hardened capability rather than being mixed into benchmark claims.

## Validation

```bash
npm install
npm test
npm run build
python -m py_compile huggingface-space/app.py
```

CI runs release-policy tests, Phase 2 helper tests, production TypeScript/Vite build and Space-source syntax validation on every push and pull request.

## Hugging Face publication

GitHub is the engineering source of truth. These directories are automatically synchronized through `.github/workflows/publish-huggingface.yml` using the repository `HF_TOKEN` secret:

```text
huggingface-model/      → https://huggingface.co/h0000w/model-quality-release-gate
huggingface-dataset/    → https://huggingface.co/datasets/h0000w/model-quality-release-gate
huggingface-space/      → https://huggingface.co/spaces/h0000w/model-quality-release-gate
```

## Roadmap

- **Phase 1 — COMPLETE:** executive dashboard, comparison, regression detection, release gate, failure explorer, demo scenarios.
- **Phase 2 — COMPLETE:** evaluation playground, version trends, release-policy simulator, what-if mode, safety/performance dashboards, dataset explorer.
- **Phase 3:** evidence/audit trail, evaluation artifacts, enforceable CI gate, badges, versioned datasets.
- **Phase 4:** hardened real-model inference, LLM judge, production trace ingestion, historical model registry.

## Author

**Hendarmawan, PhD Eng.** · [Website](https://hendarmawan.se) · [LinkedIn](https://www.linkedin.com/in/hender/) · [GitHub](https://github.com/h00w)

MIT License.
