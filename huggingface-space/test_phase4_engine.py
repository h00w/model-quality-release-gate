import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from phase4_engine import (
    _chat_text,
    deterministic_correctness,
    deterministic_security_scan,
    ingest_trace_jsonl,
    llm_judge,
    promotion_record,
    run_hf_model,
)


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

    def test_chat_text_extracts_assistant_content(self):
        response = SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content="safe answer"))]
        )
        self.assertEqual(_chat_text(response), "safe answer")

    def test_chat_text_extracts_multipart_content(self):
        response = {
            "choices": [
                {
                    "message": {
                        "content": [
                            {"type": "text", "text": "part one"},
                            {"type": "text", "text": "part two"},
                        ]
                    }
                }
            ]
        }
        self.assertEqual(_chat_text(response), "part one\npart two")

    @patch("phase4_engine.run_hf_model")
    def test_llm_judge_failure_is_advisory_not_fatal(self, run_model):
        run_model.side_effect = RuntimeError("provider returned no final assistant content")
        result = llm_judge("prompt", "output")
        self.assertTrue(result["enabled"])
        self.assertFalse(result["available"])
        self.assertTrue(result["advisoryOnly"])
        self.assertIn("no final assistant content", result["error"])

    @patch("phase4_engine.InferenceClient")
    def test_run_hf_model_uses_chat_completion(self, client_cls):
        response = SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content="assistant output"))]
        )
        client = client_cls.return_value
        client.chat_completion.return_value = response

        with patch.dict(os.environ, {"HF_TOKEN": "hf_test_token"}, clear=False):
            run = run_hf_model("Qwen/test-model", "Write safe code", max_new_tokens=64)

        client.chat_completion.assert_called_once()
        kwargs = client.chat_completion.call_args.kwargs
        self.assertEqual(kwargs["model"], "Qwen/test-model")
        self.assertEqual(kwargs["messages"][-1]["content"], "Write safe code")
        self.assertEqual(kwargs["max_tokens"], 64)
        self.assertEqual(run.output, "assistant output")
        self.assertIn("chat-completion", run.provider)

    @patch("phase4_engine.InferenceClient")
    def test_run_hf_model_accepts_custom_system_prompt(self, client_cls):
        response = SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content='{"helpfulness": 90}'))]
        )
        client = client_cls.return_value
        client.chat_completion.return_value = response

        with patch.dict(os.environ, {"HF_TOKEN": "hf_test_token"}, clear=False):
            run_hf_model(
                "Qwen/judge-model",
                "judge this",
                max_new_tokens=64,
                system_prompt="Return JSON only",
            )

        kwargs = client.chat_completion.call_args.kwargs
        self.assertEqual(kwargs["messages"][0]["content"], "Return JSON only")


if __name__ == "__main__":
    unittest.main()
