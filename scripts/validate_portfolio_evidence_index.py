"""Validate the machine-readable portfolio evidence index before network verification."""

from __future__ import annotations

import hashlib
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
INDEX = ROOT / "evidence" / "portfolio-evidence-index-v1.json"


def main() -> int:
    payload = json.loads(INDEX.read_text(encoding="utf-8"))
    errors: list[str] = []
    seen_repos: set[str] = set()
    seen_digests: set[str] = set()

    if payload.get("schemaVersion") != "1.0.0":
        errors.append("unexpected schemaVersion")

    for project in payload.get("projects", []):
        repo = project.get("repository", "")
        commit = project.get("commit", "")
        digest = project.get("bundle", {}).get("sha256", "")
        level = project.get("proof", {}).get("level")

        if repo in seen_repos:
            errors.append(f"duplicate repository:{repo}")
        seen_repos.add(repo)

        if digest in seen_digests:
            errors.append(f"duplicate bundle digest:{digest}")
        seen_digests.add(digest)

        if not re.fullmatch(r"[0-9a-f]{40}", commit):
            errors.append(f"invalid commit:{repo}")
        if not re.fullmatch(r"[0-9a-f]{64}", digest):
            errors.append(f"invalid bundle digest:{repo}")
        if not isinstance(level, int) or level < 0 or level > 5:
            errors.append(f"invalid proof level:{repo}")
        if not isinstance(project.get("distribution", {}).get("workflowRunId"), int):
            errors.append(f"missing workflow run:{repo}")

        urls = project.get("attestations", {})
        for name in ("provenance", "sbom", "proofManifest"):
            if not str(urls.get(name, "")).startswith(f"https://github.com/{repo}/attestations/"):
                errors.append(f"invalid {name} attestation URL:{repo}")

    index_sha = hashlib.sha256(INDEX.read_bytes()).hexdigest()
    print(
        json.dumps(
            {
                "valid": not errors,
                "projectCount": len(payload.get("projects", [])),
                "indexSha256": index_sha,
                "errors": errors,
            },
            indent=2,
        )
    )
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
