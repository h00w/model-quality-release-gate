.PHONY: reproduce reproduce-clean proof proof-offline proof-clean

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
