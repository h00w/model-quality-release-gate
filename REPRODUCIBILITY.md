# Reproducibility

This repository implements **Production AI Evidence Contract v1**.

## Goal

A reviewer should be able to clone the exact commit, install the documented dependencies, run one command, and receive a machine-readable evidence bundle tied to that source state.

## Prerequisites

- Git
- Python 3.10+
- Node.js 22+
- npm
- GNU `sha256sum` or compatible environment

Install project dependencies first:

```bash
npm ci
```

## Reproduce

```bash
make reproduce
```

The command runs the repository verification chain, captures stdout/stderr, hashes benchmark/policy/dependency/input files, records Git/environment identity, and emits:

```text
evidence/out/current/
├── evidence.json
├── verification.stdout.log
├── verification.stderr.log
├── checksums.sha256
└── summary.md
```

`evidence.json` conforms to `evidence/production-ai-evidence-contract-v1.schema.json`.

## Interpretation

A reproduction `PASS` means the configured deterministic verification chain completed successfully for the recorded source/environment. It is **not** a production `SHIP` decision or safety certification.

The model-release workflow may independently produce `SHIP`, `INVESTIGATE`, or `HOLD`; that domain decision remains separate from reproduction status.

## Clean-room verification

For stronger evidence, run from a fresh clone at a pinned commit:

```bash
git clone https://github.com/h00w/model-quality-release-gate.git
cd model-quality-release-gate
git checkout <commit>
npm ci
make reproduce
cat evidence/out/current/summary.md
sha256sum --check evidence/out/current/checksums.sha256 --ignore-missing
```

Record the generated `evidence.json` together with the exact commit used.
