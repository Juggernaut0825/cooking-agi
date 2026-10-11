import importlib.util
import io
import json
from pathlib import Path
import sqlite3
import tempfile
import tomllib
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("reading_list_lab", ROOT / "practice/web-lab/code/server.py")
LAB = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(LAB)


class ReadingListTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.database = Path(self.temporary.name) / "notes.sqlite3"
        self.app = LAB.ReadingList(self.database)

    def request(self, method="GET", path="/api/notes", payload=None, raw=None, **overrides):
        body = raw if raw is not None else json.dumps(payload).encode() if payload is not None else b""
        environment = {
            "REQUEST_METHOD": method, "PATH_INFO": path, "HTTP_HOST": "127.0.0.1:8787",
            "CONTENT_TYPE": "application/json", "CONTENT_LENGTH": str(len(body)),
            "wsgi.input": io.BytesIO(body),
        }
        environment.update(overrides)
        captured = {}

        def start_response(status, headers):
            captured["status"] = int(status.split()[0])
            captured["headers"] = dict(headers)

        response = b"".join(self.app(environment, start_response))
        self.assertEqual(int(captured["headers"]["Content-Length"]), len(response))
        data = json.loads(response) if captured["headers"]["Content-Type"].startswith("application/json") else response
        return captured["status"], data, captured["headers"]

    def test_empty_then_create_update_and_read(self):
        self.assertEqual(self.request()[1], {"items": []})
        status, item, headers = self.request("POST", payload={"title": "  BERT  "})
        self.assertEqual(status, 201)
        self.assertEqual(item["title"], "BERT")
        self.assertEqual(item["status"], "to_read")
        self.assertTrue(item["created_at"].endswith("Z"))
        self.assertEqual(headers["Cache-Control"], "no-store")
        self.assertEqual(self.request("PATCH", f'/api/notes/{item["id"]}', {"status": "done"})[0], 200)
        self.assertEqual(self.request()[1]["items"][0]["status"], "done")

    def test_records_survive_new_application_instance(self):
        self.request("POST", payload={"title": "注意力"})
        self.app = LAB.ReadingList(self.database)
        self.assertEqual(self.request()[1]["items"][0]["title"], "注意力")

    def test_sql_and_html_are_stored_as_data(self):
        title = "<img src=x onerror=alert(1)>'); DROP TABLE notes; --"
        self.assertEqual(self.request("POST", payload={"title": title})[0], 201)
        self.assertEqual(self.request()[1]["items"][0]["title"], title)
        self.assertEqual(self.request("POST", payload={"title": "still works"})[0], 201)

    def test_post_does_not_promise_idempotency(self):
        first = self.request("POST", payload={"title": "BERT"})[1]
        second = self.request("POST", payload={"title": "BERT"})[1]
        self.assertNotEqual(first["id"], second["id"])

    def test_invalid_titles_and_unknown_fields(self):
        for payload in ({}, {"title": None}, {"title": 7}, {"title": ""}, {"title": "   "},
                        {"title": "x" * 121}, {"title": "a\nb"}, {"title": "BERT", "owner": "admin"}):
            with self.subTest(payload=payload):
                self.assertEqual(self.request("POST", payload=payload)[0], 400)
        self.assertEqual(self.request()[1]["items"], [])

    def test_malformed_bodies(self):
        for raw in (b"", b"{", b"null", b"[]", b'"title"', b"\xff", b"[" * 2000):
            with self.subTest(raw=raw[:20]):
                self.assertEqual(self.request("POST", raw=raw)[0], 400)
        self.assertEqual(self.request("POST", raw=b"{}", CONTENT_LENGTH="bad")[0], 400)
        self.assertEqual(self.request("POST", raw=b"{}", CONTENT_LENGTH="-1")[0], 400)
        self.assertEqual(self.request("POST", raw=b"{}", CONTENT_LENGTH="3")[0], 400)
        self.assertEqual(self.request("POST", raw=b"{}", CONTENT_LENGTH="4097")[0], 413)

    def test_unicode_titles_reject_unpaired_surrogates(self):
        for title in ("\ud800", "\udfff", "BERT\ud800notes"):
            with self.subTest(title=ascii(title)):
                self.assertEqual(self.request("POST", payload={"title": title})[0:2],
                                 (400, {"error": "invalid_title"}))
        self.assertEqual(self.request()[1]["items"], [])
        title = "注意力 📚"
        self.assertEqual(self.request("POST", payload={"title": title})[0], 201)
        self.app = LAB.ReadingList(self.database)
        self.assertEqual(self.request()[1]["items"][0]["title"], title)

    def test_content_type_is_checked(self):
        self.assertEqual(self.request("POST", payload={"title": "BERT"}, CONTENT_TYPE="text/plain")[0], 415)
        self.assertEqual(self.request("POST", payload={"title": "BERT"}, CONTENT_TYPE="application/json; charset=utf-8")[0], 201)

    def test_invalid_status_and_missing_record(self):
        self.request("POST", payload={"title": "BERT"})
        for payload in ({"status": "unknown"}, {"status": []}, {"status": None}, {"status": "done", "title": "new"}):
            self.assertEqual(self.request("PATCH", "/api/notes/1", payload)[0], 400)
        self.assertEqual(self.request("PATCH", "/api/notes/999", {"status": "done"})[0], 404)
        self.assertEqual(self.request()[1]["items"][0]["status"], "to_read")

    def test_patch_sets_status_and_can_be_repeated(self):
        self.request("POST", payload={"title": "BERT"})
        for unused in range(2):
            self.assertEqual(self.request("PATCH", "/api/notes/1", {"status": "reading"})[0], 200)
        self.assertEqual(len(self.request()[1]["items"]), 1)

    def test_host_and_origin_checks_are_not_authentication(self):
        for overrides in ({"HTTP_HOST": "evil.example:8787"}, {"HTTP_HOST": "localhost:8787"},
                          {"HTTP_ORIGIN": "https://evil.example"}, {"HTTP_ORIGIN": "null"}):
            self.assertEqual(self.request("POST", payload={"title": "BERT"}, **overrides)[0], 403)
        self.assertEqual(self.request("POST", payload={"title": "BERT"}, HTTP_ORIGIN="http://127.0.0.1:8787")[0], 201)
        self.assertNotIn("Access-Control-Allow-Origin", self.request()[2])

    def test_methods_unknown_routes_and_no_file_server(self):
        for path in ("/../server.py", "/server.py", "/notes.sqlite3", "/api/notes/0", "/api/notes/" + "9" * 30):
            self.assertEqual(self.request(path=path)[0], 404)
        for method, path, allowed in (("DELETE", "/api/notes", "GET, POST"), ("OPTIONS", "/api/notes/1", "PATCH"),
                                      ("POST", "/api/health", "GET"), ("POST", "/", "GET")):
            status, data, headers = self.request(method, path)
            self.assertEqual(status, 405)
            self.assertEqual(headers["Allow"], allowed)

    def test_static_assets_are_an_explicit_allowlist(self):
        for path in LAB.ASSETS:
            status, body, headers = self.request(path=path)
            self.assertEqual(status, 200)
            self.assertGreater(len(body), 100)
            self.assertEqual(headers["X-Content-Type-Options"], "nosniff")

    def test_health_is_liveness_not_database_readiness(self):
        with patch.object(LAB.sqlite3, "connect", side_effect=sqlite3.OperationalError("private path")):
            self.assertEqual(self.request(path="/api/health")[0], 200)
            self.assertEqual(self.request()[0:2], (503, {"error": "storage_unavailable"}))

    def test_recent_first_and_bounded_list(self):
        for index in range(102):
            self.request("POST", payload={"title": str(index)})
        items = self.request()[1]["items"]
        self.assertEqual(len(items), 100)
        self.assertEqual([items[0]["title"], items[-1]["title"]], ["101", "2"])


class WebLabPublicationTests(unittest.TestCase):
    def test_navigation_and_complete_bilingual_pairs(self):
        nav = tomllib.loads((ROOT / "site/nav.toml").read_text())
        section = next(section for section in nav["section"] if section["dir"] == "practice/web-lab")
        self.assertEqual(section["order"], ["README.md", "static-and-ci.md", "reading-list.md", "eval-report.md", "next-projects.md"])
        for name in section["order"]:
            for suffix in (".md", ".en.md"):
                text = (ROOT / "practice/web-lab" / (name[:-3] + suffix)).read_text()
                self.assertGreater(len(text), 900)

    def test_frontend_checks_http_status_and_inserts_user_text_as_text(self):
        script = (ROOT / "practice/web-lab/code/app.js").read_text()
        self.assertIn("if (!response.ok)", script)
        self.assertIn("title.textContent = item.title", script)
        self.assertNotIn("innerHTML", script)
        self.assertIn("controller.abort(), 8000", script)


if __name__ == "__main__":
    unittest.main()
