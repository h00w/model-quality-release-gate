.PHONY: reproduce reproduce-clean proof proof-offline proof-clean proof-package proof-verify

PYTHON ?= python

reproduce:
	$(PYTHON) scripts/reproduce.py

reproduce-clean:
	rm -rf evidence/out

proof: reproduce
	$(PYTHON) scripts/proof_level.py

proof-offline: reproduce
	$(PYTHON) scripts/proof_level.py --offline

proof-clean:
	rm -rf evidence/out

proof-package: proof
	$(PYTHON) scripts/build_proof_bundle.py

proof-verify:
	$(PYTHON) scripts/verify_proof_bundle.py
