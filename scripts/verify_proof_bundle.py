"""Verify the portable Production AI proof bundle without trusting mutable repository state."""

from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import tarfile
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]


def sha256(path: pathlib.Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "bundle", nargs="?", default="evidence/out/current/production-ai-proof-bundle.tar.gz"
    )
    args = parser.parse_args()
    bundle = pathlib.Path(args.bundle)
    if not bundle.is_absolute():
        bundle = ROOT / bundle

    errors: list[str] = []
    with tempfile.TemporaryDirectory() as tmp:
        target = pathlib.Path(tmp)
        with tarfile.open(bundle, "r:gz") as tar:
            tar.extractall(target)

        manifest_path = target / "evidence" / "out" / "current" / "proof-manifest.json"
        if not manifest_path.is_file():
            errors.append("missing:proof-manifest.json")
        else:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            for item in manifest.get("files", []):
                path = target / item["path"]
                if not path.is_file():
                    errors.append(f"missing:{item['path']}")
                elif sha256(path) != item["sha256"]:
                    errors.append(f"sha256_mismatch:{item['path']}")
                elif path.stat().st_size != item["bytes"]:
                    errors.append(f"size_mismatch:{item['path']}")

    result = {
        "verified": not errors,
        "bundleSha256": sha256(bundle),
        "errors": errors,
        "signatureVerification": "not_performed",
        "next": "Use gh attestation verify --owner h00w <bundle> to verify the external GitHub/Sigstore attestation.",
    }
    print(json.dumps(result, indent=2))
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
