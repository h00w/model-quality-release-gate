"""Create and validate the release/tag binding for a Production AI proof bundle."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "evidence" / "out" / "current"


def sha256(path: pathlib.Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--tag", required=True)
    parser.add_argument("--commit", default=os.getenv("GITHUB_SHA"))
    args = parser.parse_args()

    if not args.commit:
        raise SystemExit("A release commit is required.")

    manifest_path = OUT / "proof-manifest.json"
    digest_path = OUT / "bundle-digest.json"
    bundle_path = OUT / "production-ai-proof-bundle.tar.gz"

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    digest = json.loads(digest_path.read_text(encoding="utf-8"))

    actual_digest = sha256(bundle_path)
    errors: list[str] = []

    if manifest["subject"]["commit"] != args.commit:
        errors.append("proof-manifest subject commit does not match release commit")
    if digest["subjectCommit"] != args.commit:
        errors.append("bundle-digest subject commit does not match release commit")
    if digest["sha256"] != actual_digest:
        errors.append("bundle-digest SHA-256 does not match the release artifact")

    if errors:
        raise SystemExit("Release binding rejected: " + "; ".join(errors))

    binding = {
        "schemaVersion": "1.0.0",
        "artifactType": "production-ai-evidence-release",
        "repository": os.getenv("GITHUB_REPOSITORY") or manifest["subject"]["repository"],
        "tag": args.tag,
        "commit": args.commit,
        "bundle": {
            "name": bundle_path.name,
            "sha256": actual_digest,
            "bytes": bundle_path.stat().st_size,
        },
        "proof": manifest["proof"],
        "sourceManifestSha256": sha256(manifest_path),
        "sbomSha256": sha256(OUT / "sbom.spdx.json"),
        "provenanceSha256": sha256(OUT / "provenance.json"),
        "verification": {
            "internal": "python scripts/verify_proof_bundle.py production-ai-proof-bundle.tar.gz",
            "attestation": (
                "gh attestation verify production-ai-proof-bundle.tar.gz "
                f"-R {os.getenv('GITHUB_REPOSITORY') or manifest['subject']['repository']}"
            ),
        },
    }

    output = OUT / "release-binding.json"
    output.write_text(json.dumps(binding, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(binding, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
