# Reproducibility

This repository implements **Production AI Evidence Contract v1**. The contract turns a local verification run into a machine-readable evidence bundle that binds the exact Git commit, declared inputs, runtime environment, executed verification steps, logs, checksums, and reproduction status.

The canonical schema is:

`evidence/production-ai-evidence-contract-v1.schema.json`

The same schema is vendored across the flagship Production AI repositories so evidence can be compared across different system types without forcing those systems to share one execution stack.

## Scope

`make reproduce` reproduces the repository's deterministic release-engineering evidence. It does **not** make live provider calls and it does not reinterpret the project's domain release decision.

A successful reproduction means the declared deterministic verification steps passed for the exact checked-out commit. It does not mean that a candidate model is automatically authorized for production.

## Prerequisites

- Git
- GNU Make
- Node.js / npm compatible with the repository
- Python 3.10+ for the Phase 4 engine tests and evidence bundler
- project dependencies installed

Recommended clean-room setup:

```bash
git clone https://github.com/h00w/model-quality-release-gate.git
cd model-quality-release-gate
npm install
python -m pip install -r huggingface-space/requirements.txt
```

If the Hugging Face Space requirements file changes, use the dependency instructions in that directory for the exact revision you are reproducing.

## One-command reproduction

```bash
make reproduce
```

The command runs the repository's declared reproduction plan from `evidence/reproduction-plan.json`:

1. frontend and release-policy tests;
2. Node release-gate contract tests;
3. Phase 4 evaluation-engine tests;
4. production build;
5. evidence-bundle generation.

No `HF_TOKEN` is required for the default reproduction path.

## Evidence output

By default the bundle is written to:

```text
artifacts/reproduction/<UTC timestamp>-<git sha>/
├── evidence.json
├── summary.md
├── checksums.sha256
└── logs/
```

`evidence.json` conforms to Production AI Evidence Contract v1 and records:

- repository URL, branch, commit and tracked dirty state;
- subject identity;
- OS, CPU architecture and tool versions;
- SHA-256 identities for declared evaluation/release inputs;
- every verification command, exit code, runtime and log;
- reproduction status: `REPRODUCED`, `PARTIAL`, or `FAILED`;
- artifact hashes.

`PARTIAL` means all declared checks passed but the tracked working tree was dirty. For citeable evidence, reproduce from a clean tagged commit.

## Verify checksums

On systems with `sha256sum`:

```bash
cd artifacts/reproduction/$(cat artifacts/reproduction/LATEST)
sha256sum --check checksums.sha256
```

On macOS, install GNU coreutils or verify with an equivalent SHA-256 tool.

## Custom output location

Keep evidence outside the checkout if desired:

```bash
REPRO_OUT=/tmp/model-release-evidence make reproduce
```

## Clean-room standard

For a result intended for publication or citation:

1. checkout an immutable tag or full commit SHA;
2. start from a clean working tree;
3. install dependencies from that revision;
4. run `make reproduce` without changing policy or benchmark inputs;
5. retain the complete evidence directory;
6. publish the commit SHA, evidence bundle checksum and any external runtime assumptions.

## Evidence vs. release authority

The contract intentionally separates **reproduction status** from the project's **SHIP / INVESTIGATE / HOLD** release policy.

- `REPRODUCED` means the declared verification procedure passed reproducibly.
- `SHIP`, `INVESTIGATE`, and `HOLD` remain domain decisions produced by the project's release policy.
- A reproduced `HOLD` is still a valid and valuable reproduction result.

This prevents the reproducibility layer from silently granting production authority.

## Updating the reproduction plan

When a benchmark, release policy, evaluator, build system, or critical test changes, update `evidence/reproduction-plan.json` in the same pull request. Inputs should identify the smallest stable set of files/directories needed to reconstruct the decision.

Do not remove a failing step merely to obtain a green reproduction result. Treat failure as evidence and fix the underlying system or explicitly version the contract/plan.
