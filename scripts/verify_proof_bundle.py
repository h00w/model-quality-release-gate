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


def safe_extract(tar: tarfile.TarFile, target: pathlib.Path) -> None:
    target_resolved = target.resolve()
    for member in tar.getmembers():
        if member.issym() or member.islnk():
            raise ValueError(f"links_not_allowed:{member.name}")
        destination = (target / member.name).resolve()
        if destination != target_resolved and target_resolved not in destination.parents:
            raise ValueError(f"path_traversal:{member.name}")
    tar.extractall(target)


def verify_bundle(bundle: pathlib.Path) -> dict:
    errors: list[str] = []
    with tempfile.TemporaryDirectory() as tmp:
        target = pathlib.Path(tmp)
        with tarfile.open(bundle, "r:gz") as tar:
            safe_extract(tar, target)

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

    return {
        "verified": not errors,
        "bundleSha256": sha256(bundle),
        "errors": errors,
        "signatureVerification": "not_performed",
        "next": "Use gh attestation verify <bundle> -R OWNER/REPO to verify the external GitHub/Sigstore attestation.",
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "bundle", nargs="?", default="evidence/out/current/production-ai-proof-bundle.tar.gz"
    )
    args = parser.parse_args()
    bundle = pathlib.Path(args.bundle)
    if not bundle.is_absolute():
        bundle = ROOT / bundle

    result = verify_bundle(bundle)
    print(json.dumps(result, indent=2))
    return 0 if result["verified"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
