"""Build a portable Production AI proof bundle with manifest, SBOM and provenance linkage."""

from __future__ import annotations

import gzip
import hashlib
import json
import os
import pathlib
import re
import tarfile
import tomllib
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "evidence" / "out" / "current"
BUNDLE = OUT / "production-ai-proof-bundle.tar.gz"


def sha256(path: pathlib.Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def dependency_records() -> list[dict]:
    records: dict[str, dict] = {}

    package_json = ROOT / "package.json"
    if package_json.is_file():
        data = json.loads(package_json.read_text(encoding="utf-8"))
        for group in (
            "dependencies",
            "devDependencies",
            "peerDependencies",
            "optionalDependencies",
        ):
            for name, version in (data.get(group) or {}).items():
                records[f"npm:{name}:{group}"] = {
                    "name": name,
                    "version": str(version),
                    "ecosystem": "npm",
                    "scope": group,
                }

    for req in sorted(ROOT.glob("**/requirements*.txt")):
        if any(part in {".venv", "venv", "node_modules"} for part in req.parts):
            continue
        for raw in req.read_text(encoding="utf-8", errors="replace").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or line.startswith("-"):
                continue
            match = re.match(r"^([A-Za-z0-9_.-]+)\s*(==|~=|>=|<=|>|<)?\s*([^;\s]+)?", line)
            if match:
                name, op, version = match.groups()
                records[f"pypi:{name}:{req}"] = {
                    "name": name,
                    "version": f"{op or ''}{version or ''}" or "unspecified",
                    "ecosystem": "pypi",
                    "scope": str(req.relative_to(ROOT)),
                }

    pyproject = ROOT / "pyproject.toml"
    if pyproject.is_file():
        try:
            data = tomllib.loads(pyproject.read_text(encoding="utf-8"))
            for dep in data.get("project", {}).get("dependencies", []) or []:
                match = re.match(r"^([A-Za-z0-9_.-]+)\s*(.*)$", dep)
                if match:
                    name, version = match.groups()
                    records[f"pypi:{name}:pyproject"] = {
                        "name": name,
                        "version": version.strip() or "unspecified",
                        "ecosystem": "pypi",
                        "scope": "project.dependencies",
                    }
        except Exception:
            pass

    return sorted(records.values(), key=lambda x: (x["ecosystem"], x["name"], x["scope"]))


def write_sbom(proof: dict) -> pathlib.Path:
    deps = dependency_records()
    packages = [
        {
            "name": proof.get("subject", {}).get("name") or ROOT.name,
            "SPDXID": "SPDXRef-Package-Root",
            "versionInfo": proof.get("subject", {}).get("gitCommit") or "unknown",
            "downloadLocation": proof.get("subject", {}).get("repository") or "NOASSERTION",
            "filesAnalyzed": False,
            "licenseConcluded": "NOASSERTION",
            "licenseDeclared": "NOASSERTION",
            "copyrightText": "NOASSERTION",
        }
    ]
    relationships = []
    for i, dep in enumerate(deps, start=1):
        spdx_id = f"SPDXRef-Dependency-{i}"
        packages.append(
            {
                "name": dep["name"],
                "SPDXID": spdx_id,
                "versionInfo": dep["version"],
                "downloadLocation": "NOASSERTION",
                "filesAnalyzed": False,
                "licenseConcluded": "NOASSERTION",
                "licenseDeclared": "NOASSERTION",
                "copyrightText": "NOASSERTION",
                "comment": f"Direct dependency declaration; ecosystem={dep['ecosystem']}; scope={dep['scope']}",
            }
        )
        relationships.append(
            {
                "spdxElementId": "SPDXRef-Package-Root",
                "relationshipType": "DEPENDS_ON",
                "relatedSpdxElement": spdx_id,
            }
        )
    doc = {
        "spdxVersion": "SPDX-2.3",
        "dataLicense": "CC0-1.0",
        "SPDXID": "SPDXRef-DOCUMENT",
        "name": f"{ROOT.name}-proof-bundle-sbom",
        "documentNamespace": f"https://github.com/{os.getenv('GITHUB_REPOSITORY', ROOT.name)}/proof/{proof.get('subject', {}).get('gitCommit', 'local')}",
        "creationInfo": {"created": now_iso(), "creators": ["Tool: scripts/build_proof_bundle.py"]},
        "documentDescribes": ["SPDXRef-Package-Root"],
        "packages": packages,
        "relationships": relationships,
        "comment": "Manifest-derived direct dependency SBOM for the portable proof bundle; not a transitive dependency resolution.",
    }
    path = OUT / "sbom.spdx.json"
    path.write_text(json.dumps(doc, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return path


def write_provenance(proof: dict, evidence: dict, sbom_path: pathlib.Path) -> pathlib.Path:
    repo = os.getenv("GITHUB_REPOSITORY") or proof.get("subject", {}).get("repository")
    server = os.getenv("GITHUB_SERVER_URL", "https://github.com")
    run_id = os.getenv("GITHUB_RUN_ID")
    provenance = {
        "schemaVersion": "1.0.0",
        "type": "production-ai-provenance-linkage",
        "generatedAt": now_iso(),
        "source": {
            "repository": repo,
            "commit": proof.get("subject", {}).get("gitCommit"),
            "ref": os.getenv("GITHUB_REF"),
            "event": os.getenv("GITHUB_EVENT_NAME"),
        },
        "builder": {
            "system": "github-actions" if os.getenv("GITHUB_ACTIONS") == "true" else "local",
            "workflow": os.getenv("GITHUB_WORKFLOW"),
            "workflowRef": os.getenv("GITHUB_WORKFLOW_REF"),
            "runId": run_id,
            "runAttempt": os.getenv("GITHUB_RUN_ATTEMPT"),
            "runnerEnvironment": os.getenv("RUNNER_ENVIRONMENT"),
            "runUrl": f"{server}/{repo}/actions/runs/{run_id}" if repo and run_id else None,
        },
        "materials": {
            "evidenceSha256": sha256(OUT / "evidence.json"),
            "proofSha256": sha256(OUT / "proof.json"),
            "sbomSha256": sha256(sbom_path),
            "proofModelSha256": proof.get("proofModelSha256"),
        },
        "signedProvenance": {
            "expectedMechanism": "GitHub artifact attestation / Sigstore keyless signing",
            "createdByThisFile": False,
            "note": "This linkage file is unsigned metadata inside the bundle. The CI workflow cryptographically attests the completed bundle as the external signed envelope.",
        },
    }
    path = OUT / "provenance.json"
    path.write_text(json.dumps(provenance, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return path


def file_entry(path: pathlib.Path, role: str) -> dict:
    return {
        "path": str(path.relative_to(ROOT)),
        "sha256": sha256(path),
        "bytes": path.stat().st_size,
        "role": role,
    }


def deterministic_tar(paths: list[pathlib.Path]) -> None:
    if BUNDLE.exists():
        BUNDLE.unlink()
    with BUNDLE.open("wb") as raw:
        with gzip.GzipFile(fileobj=raw, mode="wb", filename="", mtime=0) as gz:
            with tarfile.open(fileobj=gz, mode="w") as tar:
                for path in sorted(paths, key=lambda p: str(p.relative_to(ROOT))):
                    arcname = str(path.relative_to(ROOT))
                    info = tar.gettarinfo(str(path), arcname)
                    info.mtime = 0
                    info.uid = 0
                    info.gid = 0
                    info.uname = ""
                    info.gname = ""
                    with path.open("rb") as f:
                        tar.addfile(info, f)


def main() -> int:
    evidence_path = OUT / "evidence.json"
    proof_path = OUT / "proof.json"
    if not evidence_path.is_file() or not proof_path.is_file():
        raise SystemExit("Run make proof before packaging.")

    evidence = json.loads(evidence_path.read_text(encoding="utf-8"))
    proof = json.loads(proof_path.read_text(encoding="utf-8"))
    sbom_path = write_sbom(proof)
    provenance_path = write_provenance(proof, evidence, sbom_path)

    schema_path = ROOT / "evidence" / "production-ai-proof-manifest-v1.schema.json"
    proof_model_path = ROOT / "evidence" / "production-ai-proof-model-v1.json"
    contract_schema = ROOT / "evidence" / "production-ai-evidence-contract-v1.schema.json"

    roles = [
        (evidence_path, "evidence-contract"),
        (proof_path, "proof-assessment"),
        (OUT / "proof-summary.md", "human-summary"),
        (OUT / "checksums.sha256", "evidence-checksums"),
        (sbom_path, "sbom"),
        (provenance_path, "provenance-linkage"),
        (schema_path, "proof-manifest-schema"),
        (proof_model_path, "proof-model"),
        (contract_schema, "evidence-contract-schema"),
    ]
    roles = [(p, r) for p, r in roles if p.is_file()]

    subject = proof.get("subject", {})
    manifest = {
        "schemaVersion": "1.0.0",
        "artifactType": "production-ai-proof-bundle",
        "generatedAt": now_iso(),
        "subject": {
            "repository": os.getenv("GITHUB_REPOSITORY") or subject.get("repository") or "",
            "commit": subject.get("gitCommit") or os.getenv("GITHUB_SHA") or "",
            "ref": os.getenv("GITHUB_REF"),
        },
        "proof": {
            "modelVersion": proof.get("proofModelVersion"),
            "achievedLevel": proof.get("achievedLevel", 0),
            "achievedLabel": proof.get("achievedLabel", "Unproven"),
            "configuredCeiling": proof.get("configuredCeiling"),
        },
        "ciIdentity": {
            "provider": "github-actions" if os.getenv("GITHUB_ACTIONS") == "true" else "local",
            "workflow": os.getenv("GITHUB_WORKFLOW"),
            "workflowRef": os.getenv("GITHUB_WORKFLOW_REF"),
            "runId": os.getenv("GITHUB_RUN_ID"),
            "runAttempt": os.getenv("GITHUB_RUN_ATTEMPT"),
            "event": os.getenv("GITHUB_EVENT_NAME"),
            "actor": os.getenv("GITHUB_ACTOR"),
            "repositoryId": os.getenv("GITHUB_REPOSITORY_ID"),
            "repositoryOwnerId": os.getenv("GITHUB_REPOSITORY_OWNER_ID"),
        },
        "files": [file_entry(p, role) for p, role in roles],
        "linkage": {
            "evidenceContract": "evidence/out/current/evidence.json",
            "proofAssessment": "evidence/out/current/proof.json",
            "sbom": "evidence/out/current/sbom.spdx.json",
            "provenance": "evidence/out/current/provenance.json",
        },
        "attestation": {
            "mechanism": "github-artifact-attestation",
            "signature": "external",
            "expectedIssuer": "https://token.actions.githubusercontent.com",
            "verification": "gh attestation verify --owner h00w evidence/out/current/production-ai-proof-bundle.tar.gz",
        },
    }

    manifest_path = OUT / "proof-manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )

    bundle_paths = [p for p, _ in roles] + [manifest_path]
    deterministic_tar(bundle_paths)

    digest_record = {
        "artifact": str(BUNDLE.relative_to(ROOT)),
        "sha256": sha256(BUNDLE),
        "bytes": BUNDLE.stat().st_size,
        "subjectCommit": manifest["subject"]["commit"],
        "achievedLevel": manifest["proof"]["achievedLevel"],
    }
    (OUT / "bundle-digest.json").write_text(
        json.dumps(digest_record, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(digest_record, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
