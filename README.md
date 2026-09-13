# Model Quality Release Gate for AI Code Generation

A production-oriented evaluation and release-engineering demo for deciding whether a candidate AI coding model is ready to ship.

> **Evaluate. Compare. Detect regressions. Decide.**

The project compares a baseline and candidate model across helpfulness, safety, reliability, code-generation pass rate, and latency; detects regressions against configurable thresholds; inspects failures; and emits an explainable **SHIP / INVESTIGATE / HOLD** recommendation.

## Why this matters

A model can improve on a headline benchmark while becoming slower, less reliable, less safe, or more expensive. Production release decisions therefore need multidimensional evaluation, explicit regression tolerances, failure inspection, and deterministic release policy.

## Features

- Baseline vs candidate model comparison
- Deterministic metric aggregation and deltas
- Configurable regression thresholds
- Higher-is-better and lower-is-better metric semantics
- Release decision engine: **SHIP / INVESTIGATE / HOLD**
- Human-readable decision explanations generated from metrics
- Five seeded demo scenarios
- Failure explorer with severity/category filters and search
- 100+ deterministic evaluation examples generated in-browser
- CSV, JSON and JSONL import with validation
- CSV export and printable evaluation report
- Trend and comparison visualizations
- Dark/light theme
- Unit tests for release-gate logic
- GitHub Pages deployment workflow

## Release policy

Priority order:

1. **Critical safety regression** → `HOLD`
2. **Major reliability regression** → `HOLD`
3. **Major code correctness regression** → `HOLD`
4. **Moderate performance regression** → `INVESTIGATE`
5. **Minor trade-offs near thresholds** → `INVESTIGATE`
6. All critical constraints pass and quality is stable/improved → `SHIP`

Default tolerances:

| Metric | Direction | Default tolerance |
|---|---|---:|
| Helpfulness | Higher is better | -2% |
| Safety | Higher is better | -1% |
| Reliability | Higher is better | -2% |
| Code pass rate | Higher is better | -2% |
| Latency | Lower is better | +5% |

Overall quality score:

```text
qualityScore =
  0.25 × helpfulness +
  0.20 × safety +
  0.20 × reliability +
  0.35 × codePassRate
```

Latency is intentionally treated as a release constraint instead of dominating the quality score.

## Quick start

```bash
npm install
npm run dev
```

Open the local Vite URL and click **Run Demo Evaluation**.

## Test and build

```bash
npm test
npm run build
```

## Project structure

```text
src/
├── data/demo.ts
├── lib/evaluation.ts
├── types/evaluation.ts
├── App.tsx
├── main.tsx
└── styles.css
examples/
├── demo-baseline.json
└── demo-candidate.json
.github/workflows/deploy.yml
```

## Demo scenarios

- **Ship** — candidate improves across metrics
- **Investigate** — quality improves but latency exceeds tolerance
- **Hold: Safety** — safety drops beyond a critical gate
- **Hold: Code Quality** — candidate code-pass rate significantly regresses
- **Mixed Results** — helpfulness improves while reliability decreases

## Evaluation data schema

```json
{
  "model": "CodeGen-7B-v1.5",
  "taskId": "python_001",
  "category": "Python",
  "helpfulness": 0.91,
  "safety": 0.98,
  "latencyMs": 820,
  "reliability": 0.97,
  "codePassRate": 1,
  "passed": true,
  "failureType": null,
  "severity": null,
  "prompt": "Write a Python function that...",
  "expectedOutput": "...",
  "actualOutput": "..."
}
```

Scores are normalized to `0..1`; latency is milliseconds.

## Architecture

```text
Evaluation Data
      ↓
Metric Aggregation
      ↓
Model Comparison
      ↓
Regression Engine
      ↓
Failure Analysis
      ↓
Release Gate
      ↓
SHIP / INVESTIGATE / HOLD
      ↓
React UI / future API / future HF or Streamlit adapter
```

Business logic lives in `src/lib/evaluation.ts`, independent of React, so the same release-gate logic can later back a CLI, API, Hugging Face Space, or Streamlit application.

## Limitations

This repository uses fictional demo model names and deterministic seeded data. It demonstrates evaluation and release-engineering mechanics; it does not claim benchmark results for any real production model.

## Future work

- Connect real model-evaluation jobs and CI artifacts
- Add statistical confidence intervals and significance testing
- Add cost/token-throughput gates
- Store run history in a backend
- Add Hugging Face evaluation provider
- Add PR status checks and release approvals
- Add signed evaluation evidence bundles

## Author

**Hendarmawan, PhD Eng.**

- GitHub: https://github.com/h00w
- LinkedIn: https://www.linkedin.com/in/hender/
- Website: https://hendarmawan.se

## License

MIT
