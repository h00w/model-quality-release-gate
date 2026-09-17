.PHONY: reproduce reproduce-clean

PYTHON ?= python

reproduce:
	$(PYTHON) scripts/reproduce.py

reproduce-clean:
	rm -rf evidence/out
