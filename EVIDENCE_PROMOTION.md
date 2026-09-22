# Evidence Promotion and Independent Verification

Step 4 separates evidence production from evidence consumption.

## Producer

The `Production AI Proof Model` workflow builds and signs a portable proof bundle. It remains responsible for producing the evidence, proof manifest, SBOM and attestations.

## Independent consumer

`.github/workflows/evidence-consumer-verify.yml` runs only after a successful main-branch producer workflow (or against an explicitly supplied run ID). It downloads the producer artifact as a separate job and verifies:

1. internal SHA-256 bindings from `proof-manifest.json`;
2. GitHub/Sigstore SLSA provenance;
3. SPDX SBOM attestation;
4. the custom Production AI proof-manifest attestation;
5. rejection of a content-tampered bundle;
6. rejection of a byte-tampered signed artifact.

A producer PASS is therefore not sufficient by itself; the consumer must independently verify the result.

## Versioned evidence release

`.github/workflows/evidence-release.yml` prepares a draft `evidence-vX.Y.Z` release bound to an exact commit and bundle SHA-256. The draft contains the proof bundle plus its manifest, SBOM, provenance, digest and release-binding record.

The workflow intentionally does **not** publish the release. Before publishing, enable GitHub **release immutability** for the repository. GitHub then locks the published release's assets and associated tag and creates a release attestation.

## Claim boundary

Evidence promotion does not change the project's five-level proof state. It makes a specific proof result easier to distribute, reproduce and independently verify.
