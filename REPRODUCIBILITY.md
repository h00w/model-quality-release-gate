# Reproducibility

This repository implements **Production AI Evidence Contract v1** and the **Production AI Five-Level Proof Model v1**.

## Goal

A reviewer should be able to clone the exact commit, install the documented dependencies, run one command, and receive a machine-readable evidence bundle tied to that source state. Reproducibility is treated as **Level 2**, not as the terminal production claim.

## Prerequisites

- Git
- Python 3.10+
- Node.js 22+
- npm
- GNU `sha256sum` or compatible environment

Install project dependencies first:

```bash
npm install --no-package-lock
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

## Assess the five-level proof

```bash
make proof
```

This re-runs reproduction, verifies public capability evidence, checks the release-candidate package, and writes:

```text
evidence/out/current/
├── proof.json
└── proof-summary.md
```

This repository's configured automated ceiling is **L4 — Production-Candidate** because its deterministic release-gate run creates a checksummed candidate package and must return `SHIP`. **L5 — Production-Validated is intentionally disabled** until target-environment observation, SLO and recovery evidence exists.

For a network-independent check:

```bash
make proof-offline
```

Offline assessment can establish at most **L2 — Reproducible**.

## Interpretation

A reproduction `PASS` means the configured deterministic verification chain completed successfully for the recorded source/environment. It is **not** a production `SHIP` decision or safety certification.

The model-release workflow may independently produce `SHIP`, `INVESTIGATE`, or `HOLD`; that domain decision remains separate from reproduction status.

See [PROOF_MODEL.md](PROOF_MODEL.md) for the five cumulative proof levels.

## Clean-room verification

```bash
git clone https://github.com/h00w/model-quality-release-gate.git
cd model-quality-release-gate
git checkout <commit>
npm install --no-package-lock
make proof
cat evidence/out/current/proof-summary.md
sha256sum --check evidence/out/current/checksums.sha256 --ignore-missing
```

Record `evidence.json` and `proof.json` together with the exact commit used.


## Portable proof artifact and signed provenance

Step 3 packages the proof state into a portable artifact:

```bash
make proof-package
make proof-verify
```

The bundle contains the Evidence Contract, `proof.json`, proof model, schemas, SHA-256-linked `proof-manifest.json`, direct-dependency SPDX SBOM, provenance-linkage metadata, and the human summary.

On trusted GitHub Actions runs from this repository, the completed `production-ai-proof-bundle.tar.gz` receives three keyless GitHub artifact attestations: SLSA build provenance, an SBOM attestation, and a custom Production AI proof-manifest predicate.

Verify the external signature with:

```bash
gh attestation verify --owner h00w evidence/out/current/production-ai-proof-bundle.tar.gz
```

See [PROVENANCE.md](PROVENANCE.md) for the trust and claim boundaries.
