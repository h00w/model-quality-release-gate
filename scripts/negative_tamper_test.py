"""Negative test: a content-tampered proof bundle must fail internal verification."""

from __future__ import annotations

import argparse
import pathlib
import tarfile
import tempfile

from verify_proof_bundle import safe_extract, verify_bundle


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "bundle",
        nargs="?",
        default="evidence/out/current/production-ai-proof-bundle.tar.gz",
    )
    args = parser.parse_args()
    source = pathlib.Path(args.bundle).resolve()

    with tempfile.TemporaryDirectory() as tmp:
        work = pathlib.Path(tmp)
        extracted = work / "extracted"
        extracted.mkdir()

        with tarfile.open(source, "r:gz") as tar:
            safe_extract(tar, extracted)

        proof = extracted / "evidence" / "out" / "current" / "proof.json"
        if not proof.is_file():
            raise SystemExit("Tamper test cannot find proof.json in the bundle.")
        proof.write_bytes(proof.read_bytes() + b"\nTAMPERED\n")

        tampered = work / "tampered-proof-bundle.tar.gz"
        with tarfile.open(tampered, "w:gz") as tar:
            for path in sorted(extracted.rglob("*")):
                if path.is_file():
                    tar.add(path, arcname=str(path.relative_to(extracted)))

        result = verify_bundle(tampered)
        if result["verified"]:
            raise SystemExit("FAIL: content-tampered proof bundle was accepted.")

        expected = any(error.startswith("sha256_mismatch:") for error in result["errors"])
        if not expected:
            raise SystemExit(
                "FAIL: tampered bundle failed, but not because a bound digest changed."
            )

        print("PASS: content tamper was rejected by proof-manifest verification.")
        print("\n".join(result["errors"]))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
