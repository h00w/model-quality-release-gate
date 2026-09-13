# Model Quality Release Gate for AI Code Generation

A production-oriented AI evaluation and release-engineering project for deciding whether a candidate coding model is ready to ship.

> **Evaluate. Compare. Detect regressions. Decide.**

## Live publication stack

| Layer | Purpose | Link |
|---|---|---|
| GitHub | Source, policy engine, tests, CI | https://github.com/h00w/model-quality-release-gate |
| Hugging Face model card | Methodology and artifact index | https://huggingface.co/h0000w/model-quality-release-gate |
| Hugging Face dataset | Reproducible evaluation evidence | https://huggingface.co/datasets/h0000w/model-quality-release-gate |
| Hugging Face Space | Interactive / real-model evaluation | https://huggingface.co/spaces/h0000w/model-quality-release-gate |
| Portfolio case study | Recruiter-facing engineering narrative | https://hendarmawan.se/model-quality-release-gate/ |
| Agentic AI Academy | Curriculum and evaluation cross-link | https://hendarmawan.se/agentic-ai/ |

## What it demonstrates

- Baseline vs candidate comparison
- Deterministic metric aggregation and deltas
- Configurable regression thresholds
- Higher-is-better and lower-is-better metric semantics
- **SHIP / INVESTIGATE / HOLD** release policy
- Human-readable decision explanations
- Failure explorer and severity/category filtering
- CSV, JSON and JSONL import with validation
- Exportable evaluation evidence
- Real-evaluation provider abstraction
- Hugging Face Space implementation for server-side model/API execution
- Hugging Face dataset/model-card publication templates
- Unit tests and GitHub Pages workflow

## Architecture

```text
Model / API outputs
      ↓
Evaluation Provider
      ↓
Normalized EvaluationResult
      ↓
Metric Aggregation
      ↓
Regression Engine
      ↓
Failure Analysis
      ↓
Release Gate
      ↓
SHIP / INVESTIGATE / HOLD
      ↓
React UI · HF Space · CI · future API
```

Real provider credentials stay server-side. The static browser consumes normalized evaluation records; the Hugging Face Space can execute real inference when `HF_TOKEN` is configured as a Space secret.

## Release policy

1. Critical safety regression → `HOLD`
2. Major reliability regression → `HOLD`
3. Major code-correctness regression → `HOLD`
4. Performance regression beyond tolerance → `INVESTIGATE`
5. Near-threshold trade-off → `INVESTIGATE`
6. All critical constraints pass and quality is stable/improved → `SHIP`

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

Latency is a release constraint instead of dominating quality.

## Run locally

```bash
npm install
npm test
npm run dev
```

## Hugging Face synchronization

The exact source to publish is versioned here:

```text
huggingface-model/      → https://huggingface.co/h0000w/model-quality-release-gate
huggingface-dataset/    → https://huggingface.co/datasets/h0000w/model-quality-release-gate
huggingface-space/      → https://huggingface.co/spaces/h0000w/model-quality-release-gate
```

This keeps GitHub as the engineering source of truth while each Hugging Face artifact has a clear role.

## Author

**Hendarmawan, PhD Eng.** · [Website](https://hendarmawan.se) · [LinkedIn](https://www.linkedin.com/in/hender/) · [GitHub](https://github.com/h00w)

MIT License.
