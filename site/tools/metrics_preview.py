import argparse
from datetime import datetime, timezone
import hashlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import re
import sqlite3
from urllib.parse import urlsplit


NOTE = re.compile(r"note-[a-f0-9]{16}")
TOKEN = re.compile(r"[a-f0-9]{32}")


class Counts:
    def __init__(self, database, notes, clock=None):
        self.database = str(database)
        self.notes = set(notes)
        self.clock = clock or (lambda: datetime.now(timezone.utc))
        with self.connect() as connection:
            connection.executescript("""
                CREATE TABLE IF NOT EXISTS months (
                    note TEXT NOT NULL, month TEXT NOT NULL, reads INTEGER NOT NULL DEFAULT 0,
                    PRIMARY KEY (note, month)
                );
                CREATE TABLE IF NOT EXISTS read_keys (
                    note TEXT NOT NULL, visitor TEXT NOT NULL, day TEXT NOT NULL,
                    PRIMARY KEY (note, visitor, day)
                );
                CREATE TABLE IF NOT EXISTS bookmarks (
                    note TEXT NOT NULL, visitor TEXT NOT NULL, month TEXT NOT NULL,
                    PRIMARY KEY (note, visitor)
                );
            """)

    def connect(self):
        return sqlite3.connect(self.database, timeout=10)

    def dates(self):
        now = self.clock().astimezone(timezone.utc)
        return now.strftime("%Y-%m-%d"), now.strftime("%Y-%m")

    def validate_note(self, note):
        if not NOTE.fullmatch(note) or note not in self.notes:
            raise LookupError("unknown note")

    def snapshot(self, connection, note, month):
        reads, month_reads = connection.execute(
            "SELECT COALESCE(SUM(reads), 0), COALESCE(SUM(CASE WHEN month = ? THEN reads ELSE 0 END), 0) FROM months WHERE note = ?",
            (month, note)).fetchone()
        saves, month_saves = connection.execute(
            "SELECT COUNT(*), COALESCE(SUM(CASE WHEN month = ? THEN 1 ELSE 0 END), 0) FROM bookmarks WHERE note = ?",
            (month, note)).fetchone()
        return {"version": 1, "noteId": note, "month": month, "mode": "local",
                "reads": reads, "monthReads": month_reads, "saves": saves, "monthSaves": month_saves}

    def read(self, note):
        self.validate_note(note)
        _, month = self.dates()
        with self.connect() as connection:
            return self.snapshot(connection, note, month)

    def record(self, note, action):
        self.validate_note(note)
        if not isinstance(action, dict) or action.get("kind") not in {"view", "bookmark"}:
            raise ValueError("invalid event")
        required = {"kind", "token", "saved"} if action["kind"] == "bookmark" else {"kind", "token"}
        if set(action) != required or not isinstance(action.get("token"), str) or not TOKEN.fullmatch(action["token"]):
            raise ValueError("invalid event")
        if action["kind"] == "bookmark" and type(action["saved"]) is not bool:
            raise ValueError("invalid saved state")
        visitor = hashlib.sha256((note + ":" + action["token"]).encode()).hexdigest()
        day, month = self.dates()
        with self.connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            if action["kind"] == "view":
                connection.execute("DELETE FROM read_keys WHERE day < ?", (day,))
                inserted = connection.execute(
                    "INSERT OR IGNORE INTO read_keys (note, visitor, day) VALUES (?, ?, ?)",
                    (note, visitor, day)).rowcount
                if inserted:
                    connection.execute(
                        "INSERT INTO months (note, month, reads) VALUES (?, ?, 1) ON CONFLICT(note, month) DO UPDATE SET reads = reads + 1",
                        (note, month))
            elif action["saved"]:
                connection.execute("INSERT OR IGNORE INTO bookmarks (note, visitor, month) VALUES (?, ?, ?)",
                                   (note, visitor, month))
            else:
                connection.execute("DELETE FROM bookmarks WHERE note = ? AND visitor = ?", (note, visitor))
            return self.snapshot(connection, note, month)


def handler_for(directory, counts):
    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(directory), **kwargs)

        def log_message(self, *args):
            pass

        def json_response(self, status, value):
            payload = json.dumps(value).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def valid_host(self):
            return self.headers.get("Host") == f"127.0.0.1:{self.server.server_port}"

        def do_GET(self):
            if not self.valid_host():
                return self.json_response(403, {"error": "host"})
            path = urlsplit(self.path).path
            if path == "/static/note-metrics-config.json":
                return self.json_response(200, {"version": 1, "endpoint": "/api/note-metrics/"})
            if path.startswith("/api/note-metrics/"):
                try:
                    return self.json_response(200, counts.read(path.removeprefix("/api/note-metrics/")))
                except LookupError:
                    return self.json_response(404, {"error": "note"})
            return super().do_GET()

        def do_POST(self):
            expected_origin = f"http://127.0.0.1:{self.server.server_port}"
            if not self.valid_host() or self.headers.get("Origin") != expected_origin:
                return self.json_response(403, {"error": "origin"})
            path = urlsplit(self.path).path
            if not path.startswith("/api/note-metrics/"):
                return self.json_response(404, {"error": "path"})
            if self.headers.get("Content-Type", "").split(";")[0].strip() != "application/json":
                return self.json_response(415, {"error": "content type"})
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if not 0 < length <= 1024:
                    return self.json_response(413, {"error": "size"})
                action = json.loads(self.rfile.read(length))
                value = counts.record(path.removeprefix("/api/note-metrics/"), action)
            except LookupError:
                return self.json_response(404, {"error": "note"})
            except (ValueError, UnicodeDecodeError, TypeError):
                return self.json_response(400, {"error": "event"})
            return self.json_response(200, value)

    return Handler


def main():
    parser = argparse.ArgumentParser(description="Local-only note counter preview; not a production server.")
    parser.add_argument("--site", type=Path, default=Path("_site"))
    parser.add_argument("--db", type=Path, required=True)
    parser.add_argument("--port", type=int, default=18992)
    arguments = parser.parse_args()
    directory = arguments.site.resolve()
    database = arguments.db.resolve()
    if database == directory or directory in database.parents:
        parser.error("Keep the database outside the served site directory.")
    catalog = json.loads((directory / "static/prep-progress-catalog.json").read_text())
    counts = Counts(database, catalog["notes"])
    with ThreadingHTTPServer(("127.0.0.1", arguments.port), handler_for(directory, counts)) as server:
        print(f"Local counters only: http://127.0.0.1:{server.server_port}", flush=True)
        server.serve_forever()


if __name__ == "__main__":
    main()
