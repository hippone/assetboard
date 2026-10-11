import base64
import json
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "desktop"))
import gmail_local


class GmailImportTests(unittest.TestCase):
    def test_extracts_plain_text_and_headers(self):
        body = base64.urlsafe_b64encode("Your renewal is due".encode()).decode().rstrip("=")
        record = gmail_local.message_evidence({
            "id": "abc", "snippet": "fallback",
            "payload": {"mimeType": "multipart/alternative", "headers": [
                {"name": "Subject", "value": "Renewal notice"},
                {"name": "From", "value": "billing@example.org"},
            ], "parts": [{"mimeType": "text/plain", "body": {"data": body}}]},
        })
        self.assertEqual(record["id"], "gmail-abc")
        self.assertEqual(record["title"], "Renewal notice")
        self.assertEqual(record["body"], "Your renewal is due")

    def test_extracts_visible_html_when_plain_text_is_absent(self):
        html = base64.urlsafe_b64encode(b"<style>hidden</style><p>Invoice <b>paid</b></p>").decode().rstrip("=")
        record = gmail_local.message_evidence({"id": "html", "snippet": "fallback", "payload": {
            "mimeType": "text/html", "body": {"data": html}, "headers": []}})
        self.assertIn("Invoice paid", record["body"])
        self.assertNotIn("hidden", record["body"])

    def test_import_upserts_matching_message_into_local_database(self):
        with tempfile.TemporaryDirectory() as root:
            folder = Path(root)
            credentials = folder / "client.json"
            credentials.write_text(json.dumps({"installed": {"client_id": "test-id", "client_secret": "test-secret"}}))
            database = folder / "board.sqlite"
            with sqlite3.connect(database) as connection:
                connection.execute("CREATE TABLE evidence (id TEXT PRIMARY KEY,kind TEXT,source TEXT,title TEXT,body TEXT,imported_at TEXT,asset_id TEXT,payload TEXT)")
            message = {"id": "abc", "snippet": "Invoice", "payload": {"headers": [{"name": "Subject", "value": "Invoice"}]}}
            with patch.object(gmail_local, "access_token", return_value="test-access"), \
                 patch.object(gmail_local, "matching_ids", return_value=["abc"]), \
                 patch.object(gmail_local, "request_json", return_value=message):
                self.assertEqual(gmail_local.sync(str(credentials), str(database), str(folder / "token.json")), 1)
                with sqlite3.connect(database) as connection:
                    payload = json.loads(connection.execute("SELECT payload FROM evidence").fetchone()[0])
                    connection.execute("UPDATE evidence SET payload=?", (json.dumps({**payload, "ai": {"text": "{}"}}),))
                self.assertEqual(gmail_local.sync(str(credentials), str(database), str(folder / "token.json")), 1)
            with sqlite3.connect(database) as connection:
                self.assertEqual(connection.execute("SELECT COUNT(*) FROM evidence").fetchone()[0], 1)
                self.assertEqual(connection.execute("SELECT title FROM evidence").fetchone()[0], "Invoice")
                payload = json.loads(connection.execute("SELECT payload FROM evidence").fetchone()[0])
                self.assertEqual(payload["ai"], {"text": "{}"}, "re-import keeps an earlier AI reading")
                self.assertEqual(payload["messageId"], "abc")


if __name__ == "__main__":
    unittest.main()
