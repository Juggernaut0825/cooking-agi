import argparse
from contextlib import closing
from http import HTTPStatus
import json
from pathlib import Path
import re
import sqlite3
from wsgiref.simple_server import make_server


MAX_BODY = 4096
STATUSES = ("to_read", "reading", "done")
ASSETS = {
    "/": ("index.html", "text/html; charset=utf-8"),
    "/app.js": ("app.js", "text/javascript; charset=utf-8"),
    "/style.css": ("style.css", "text/css; charset=utf-8"),
}


class RequestError(Exception):
    def __init__(self, status, code):
        self.status = status
        self.code = code


class ReadingList:
    def __init__(self, database, port=8787):
        self.database = str(database)
        self.host = f"127.0.0.1:{port}"
        self.origin = f"http://{self.host}"
        directory = Path(__file__).resolve().parent
        self.assets = {
            route: ((directory / filename).read_bytes(), content_type)
            for route, (filename, content_type) in ASSETS.items()
        }
        with closing(sqlite3.connect(self.database)) as connection, connection:
            connection.execute("""
                CREATE TABLE IF NOT EXISTS notes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 120),
                    status TEXT NOT NULL CHECK(status IN ('to_read', 'reading', 'done')),
                    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
                )
            """)

    def __call__(self, environment, start_response):
        try:
            if environment.get("HTTP_HOST") != self.host:
                raise RequestError(403, "host_not_allowed")
            origin = environment.get("HTTP_ORIGIN")
            if origin is not None and origin != self.origin:
                raise RequestError(403, "origin_not_allowed")
            status, body, content_type = self.dispatch(environment)
        except RequestError as error:
            status, body, content_type = self.json_response(error.status, {"error": error.code})
        except sqlite3.OperationalError:
            status, body, content_type = self.json_response(503, {"error": "storage_unavailable"})
        headers = [
            ("Content-Type", content_type),
            ("Content-Length", str(len(body))),
            ("Cache-Control", "no-store"),
            ("X-Content-Type-Options", "nosniff"),
            ("Content-Security-Policy", "default-src 'self'; frame-ancestors 'none'; base-uri 'none'"),
        ]
        if status == 405:
            headers.append(("Allow", "GET, POST" if environment.get("PATH_INFO") == "/api/notes" else
                            "PATCH" if re.fullmatch(r"/api/notes/[1-9][0-9]{0,8}", environment.get("PATH_INFO", ""))
                            else "GET"))
        start_response(f"{status} {HTTPStatus(status).phrase}", headers)
        return [body]

    @staticmethod
    def json_response(status, value):
        return status, json.dumps(value, ensure_ascii=False).encode("utf-8"), "application/json; charset=utf-8"

    @staticmethod
    def read_json(environment):
        if environment.get("CONTENT_TYPE", "").split(";", 1)[0].strip().lower() != "application/json":
            raise RequestError(415, "json_required")
        try:
            size = int(environment.get("CONTENT_LENGTH", ""))
        except ValueError:
            raise RequestError(400, "invalid_body") from None
        if size > MAX_BODY:
            raise RequestError(413, "body_too_large")
        if size < 1:
            raise RequestError(400, "invalid_body")
        raw = environment["wsgi.input"].read(size)
        if len(raw) != size:
            raise RequestError(400, "invalid_body")
        try:
            value = json.loads(raw.decode("utf-8"))
        except (ValueError, RecursionError):
            raise RequestError(400, "invalid_body") from None
        if not isinstance(value, dict):
            raise RequestError(400, "invalid_body")
        return value

    def dispatch(self, environment):
        path = environment.get("PATH_INFO", "")
        method = environment.get("REQUEST_METHOD", "GET")
        if path in self.assets:
            if method != "GET":
                raise RequestError(405, "method_not_allowed")
            body, content_type = self.assets[path]
            return 200, body, content_type
        if path == "/api/health":
            if method != "GET":
                raise RequestError(405, "method_not_allowed")
            return self.json_response(200, {"status": "ok"})
        note_match = re.fullmatch(r"/api/notes/([1-9][0-9]{0,8})", path)
        if path != "/api/notes" and note_match is None:
            raise RequestError(404, "not_found")
        if (note_match and method != "PATCH") or (not note_match and method not in {"GET", "POST"}):
            raise RequestError(405, "method_not_allowed")
        payload = self.read_json(environment) if method != "GET" else None
        if method == "POST":
            if set(payload) != {"title"} or not isinstance(payload["title"], str):
                raise RequestError(400, "title_required")
            title = payload["title"].strip()
            if not 1 <= len(title) <= 120 or any(ord(character) < 32 for character in title):
                raise RequestError(400, "invalid_title")
            try:
                title.encode("utf-8")
            except UnicodeEncodeError:
                raise RequestError(400, "invalid_title") from None
        if method == "PATCH":
            if set(payload) != {"status"} or payload["status"] not in STATUSES:
                raise RequestError(400, "invalid_status")
        with closing(sqlite3.connect(self.database, timeout=1)) as connection, connection:
            connection.row_factory = sqlite3.Row
            if method == "GET":
                rows = connection.execute("SELECT * FROM notes ORDER BY id DESC LIMIT 100").fetchall()
                return self.json_response(200, {"items": [dict(row) for row in rows]})
            if method == "POST":
                cursor = connection.execute("INSERT INTO notes (title, status) VALUES (?, ?)", (title, "to_read"))
                note_id = cursor.lastrowid
            else:
                note_id = int(note_match.group(1))
                cursor = connection.execute("UPDATE notes SET status = ? WHERE id = ?", (payload["status"], note_id))
                if cursor.rowcount != 1:
                    raise RequestError(404, "not_found")
            row = connection.execute("SELECT * FROM notes WHERE id = ?", (note_id,)).fetchone()
            result = self.json_response(201 if method == "POST" else 200, dict(row))
        return result


def main():
    parser = argparse.ArgumentParser(description="Local-only reading-list teaching server; not for public deployment.")
    parser.add_argument("--db", required=True, type=Path)
    parser.add_argument("--port", type=int, default=8787)
    arguments = parser.parse_args()
    if not 1024 <= arguments.port <= 65535:
        parser.error("Choose a port from 1024 to 65535")
    app = ReadingList(arguments.db, arguments.port)
    with make_server("127.0.0.1", arguments.port, app) as server:
        print(f"Local exercise: {app.origin} — SQLite: {arguments.db.resolve()}", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
