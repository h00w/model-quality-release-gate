# Proof Manifest and Signed Provenance

Step 3 turns `proof.json` into a portable release artifact.

## Local artifact

```bash
make proof-package
make proof-verify
```

The package command creates:

```text
evidence/out/current/
├── proof-manifest.json
├── provenance.json
├── sbom.spdx.json
├── bundle-digest.json
└── production-ai-proof-bundle.tar.gz
```

The bundle also contains the Evidence Contract, proof assessment, schemas, proof model and checksums.

## Trust model

There are two layers:

1. **Internal integrity** — `proof-manifest.json` records SHA-256 digests and byte sizes for the evidence, proof, SBOM, provenance linkage, schemas and proof model.
2. **External authenticity** — GitHub Actions signs the completed tarball using GitHub artifact attestations. The signature is external to the archive so the subject digest cannot be invalidated by embedding its own signature.

The included `provenance.json` records CI/build identity and links the evidence, proof and SBOM. It deliberately does not claim to be a signed SLSA statement. The actual signed SLSA provenance is produced by `actions/attest@v4`.

## Verify

Internal bundle integrity:

```bash
python scripts/verify_proof_bundle.py evidence/out/current/production-ai-proof-bundle.tar.gz
```

Signed GitHub/Sigstore provenance:

```bash
gh attestation verify --owner h00w evidence/out/current/production-ai-proof-bundle.tar.gz
```

GitHub's attestation binds the artifact digest to repository/workflow identity through an OIDC-backed signing certificate. The workflow also attaches an SBOM attestation and a custom proof-manifest predicate.

## Claim boundary

A valid cryptographic signature proves **artifact provenance and integrity**, not correctness, safety, or production fitness. The five-level proof decision remains governed by the evidence model; signing does not automatically increase the achieved proof level.
