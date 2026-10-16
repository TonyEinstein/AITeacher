"""HttpClient 冒烟测试：不打真实网络，用本地 HTTP 服务器验证请求形态"""

import asyncio
import json
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer

from network.http_client import EdgeHttpClient


class RecordingHandler(BaseHTTPRequestHandler):
    """记录收到的请求，返回固定 JSON"""

    last_request = {"method": None, "path": None, "headers": {}, "body": None}
    status_to_return = 200

    def do_GET(self):
        self._record(b"")
        self._respond()

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        self._record(body)
        self._respond()

    def _record(self, body: bytes):
        type(self).last_request = {
            "method": self.command,
            "path": self.path,
            "headers": {k.lower(): v for k, v in self.headers.items()},
            "body": body,
        }

    def _respond(self):
        payload = json.dumps({"ok": True}).encode()
        self.send_response(type(self).status_to_return)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, *args):
        pass  # 静默


class EdgeHttpClientTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = HTTPServer(("127.0.0.1", 0), RecordingHandler)
        cls.port = cls.server.server_address[1]
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()

    def setUp(self):
        RecordingHandler.status_to_return = 200
        self.client = EdgeHttpClient(
            base_url=f"http://127.0.0.1:{self.port}/api/v1",
            edge_token="test-token-123",
        )

    def test_post_aggregate_sends_token_and_json(self):
        """POST aggregates 带 x-edge-token 头与 JSON 体；2xx 视为成功"""
        payload = {"lessonRecordId": 42, "totalDetected": 3}
        ok = self.loop_run(self.client.post_aggregate(payload))
        req = RecordingHandler.last_request
        self.assertEqual(req["method"], "POST")
        self.assertTrue(req["path"].startswith("/api/v1/vision/aggregates"))
        self.assertEqual(req["headers"].get("x-edge-token"), "test-token-123")
        self.assertEqual(json.loads(req["body"])["lessonRecordId"], 42)
        self.assertTrue(ok)

    def test_fetch_config_serial_param(self):
        """GET config?serial=xxx 带 token 头，返回解析后的 JSON"""
        result = self.loop_run(self.client.fetch_config("SCH1-BOX1"))
        req = RecordingHandler.last_request
        self.assertEqual(req["method"], "GET")
        self.assertIn("serial=SCH1-BOX1", req["path"])
        self.assertEqual(req["headers"].get("x-edge-token"), "test-token-123")
        self.assertEqual(result, {"ok": True})

    def test_http_error_raises(self):
        """非 2xx 抛异常（供聚合器重试队列使用）"""
        RecordingHandler.status_to_return = 500
        with self.assertRaises(Exception):
            self.loop_run(self.client.post_aggregate({"x": 1}))

    def loop_run(self, coro):
        return asyncio.new_event_loop().run_until_complete(coro)


if __name__ == "__main__":
    unittest.main()
