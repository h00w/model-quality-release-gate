import unittest

from phase4_engine import deterministic_security_scan, deterministic_correctness, ingest_trace_jsonl, promotion_record


class Phase4EngineTests(unittest.TestCase):
    def test_shell_injection_is_critical(self):
        result = deterministic_security_scan("subprocess.run(cmd, shell=True)")
        self.assertEqual(result["criticalFailures"], 1)
        self.assertIn("shell_injection", result["findings"])

    def test_parameterized_sql_scores_as_correct(self):
        result = deterministic_correctness(
            "Write safe parameterized SQL",
            'cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))',
        )
        self.assertEqual(result["score"], 100.0)

    def test_trace_ingestion_validates_schema(self):
        result = ingest_trace_jsonl('{"trace_id":"t1","model":"m","latency_ms":120,"status":"ok"}\n{"bad":true}')
        self.assertEqual(result["accepted"], 1)
        self.assertEqual(result["rejected"], 1)

    def test_ship_promotes_candidate_to_approved(self):
        record = promotion_record("candidate-model", "SHIP", "eval:sha", "candidate")
        self.assertEqual(record["state"], "approved")

    def test_hold_blocks_model(self):
        record = promotion_record("candidate-model", "HOLD", "eval:sha", "approved")
        self.assertEqual(record["state"], "blocked")


if __name__ == "__main__":
    unittest.main()
