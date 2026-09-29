"""Local Gmail OAuth and narrow evidence import. Uses only Python's standard library."""

import argparse
import base64
import hashlib
import http.server
from html.parser import HTMLParser
import json
import os
import secrets
import sqlite3
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import webbrowser

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
API_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages"
SCOPE = "https://www.googleapis.com/auth/gmail.readonly"
# 14 months still covers the previous charge of a yearly subscription.
SEARCH = "{invoice receipt billing renewal subscription payment 账单 续费 订阅 服务通知} newer_than:14m -in:spam -in:trash"
MAX_MATCHES = 2000


def request_json(url, *, token=None, form=None):
    headers = {"Accept": "application/json"}
    body = None
    if token:
        headers["Authorization"] = "Bearer " + token
    if form is not None:
        body = urllib.parse.urlencode(form).encode()
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    request = urllib.request.Request(url, body, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError("Gmail 请求失败（HTTP %d）。请检查授权、API 启用状态和配额。" % error.code) from None


def load_client(path):
    with open(path, encoding="utf-8") as stream:
        installed = json.load(stream).get("installed")
    if not isinstance(installed, dict) or not installed.get("client_id") or not installed.get("client_secret"):
        raise ValueError("请选择 Google Cloud 中“桌面应用”类型的 OAuth 客户端 JSON。")
    return installed["client_id"], installed["client_secret"]


def save_private_json(path, value):
    temporary = path + ".tmp"
    descriptor = os.open(temporary, os.O_CREAT | os.O_TRUNC | os.O_WRONLY, 0o600)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
            json.dump(value, stream)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def oauth_interactive(client_id, client_secret):
    state = secrets.token_urlsafe(32)
    verifier = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
    received = {}

    class Callback(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            parts = urllib.parse.urlsplit(self.path)
            values = urllib.parse.parse_qs(parts.query)
            if parts.path != "/callback" or values.get("state", [""])[0] != state:
                self.send_error(400)
                return
            received["code"] = values.get("code", [""])[0]
            received["error"] = values.get("error", [""])[0]
            page = b"<html><meta charset='utf-8'><body>Assetboard authorization received. You can close this tab.</body></html>"
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(page)))
            self.end_headers()
            self.wfile.write(page)

        def log_message(self, *_args):
            pass

    server = http.server.HTTPServer(("127.0.0.1", 0), Callback)
    server.timeout = 1
    redirect = "http://127.0.0.1:%d/callback" % server.server_port
    query = urllib.parse.urlencode({
        "client_id": client_id, "redirect_uri": redirect, "response_type": "code",
        "scope": SCOPE, "access_type": "offline", "prompt": "consent", "state": state,
        "code_challenge": challenge, "code_challenge_method": "S256",
    })
    webbrowser.open(AUTH_URL + "?" + query)
    deadline = time.monotonic() + 300
    try:
        while not received and time.monotonic() < deadline:
            server.handle_request()
    finally:
        server.server_close()
    if received.get("error"):
        raise RuntimeError("Google 授权未完成：" + received["error"])
    if not received.get("code"):
        raise RuntimeError("等待 Google 授权超时，请重新尝试。")
    return request_json(TOKEN_URL, form={
        "client_id": client_id, "client_secret": client_secret, "code": received["code"],
        "code_verifier": verifier, "redirect_uri": redirect, "grant_type": "authorization_code",
    })


def access_token(client_id, client_secret, token_file):
    saved = None
    if os.path.isfile(token_file):
        with open(token_file, encoding="utf-8") as stream:
            saved = json.load(stream)
    if saved and saved.get("client_id") == client_id and saved.get("refresh_token"):
        fresh = request_json(TOKEN_URL, form={
            "client_id": client_id, "client_secret": client_secret,
            "refresh_token": saved["refresh_token"], "grant_type": "refresh_token",
        })
        return fresh["access_token"]
    fresh = oauth_interactive(client_id, client_secret)
    if not fresh.get("refresh_token"):
        raise RuntimeError("Google 未返回离线授权令牌，请在 Google 账户中撤销此应用后重新授权。")
    save_private_json(token_file, {"client_id": client_id, "refresh_token": fresh["refresh_token"]})
    return fresh["access_token"]


def text_parts(part):
    mime = part.get("mimeType", "")
    data = (part.get("body") or {}).get("data", "")
    if mime in ("text/plain", "text/html") and data:
        try:
            content = base64.urlsafe_b64decode(data + "=" * (-len(data) % 4)).decode("utf-8", "replace")
            return [(mime, content)]
        except (ValueError, UnicodeError):
            return []
    result = []
    for child in part.get("parts") or []:
        result.extend(text_parts(child))
    return result


class VisibleHTML(HTMLParser):
    def __init__(self):
        super().__init__()
        self.text = []
        self.hidden = 0

    def handle_starttag(self, tag, _attrs):
        if tag in ("style", "script"):
            self.hidden += 1
        if tag in ("p", "br", "div", "tr"):
            self.text.append("\n")

    def handle_endtag(self, tag):
        if tag in ("style", "script") and self.hidden:
            self.hidden -= 1

    def handle_data(self, value):
        if not self.hidden:
            self.text.append(value)


def message_evidence(message):
    headers = {item.get("name", "").lower(): item.get("value", "") for item in (message.get("payload") or {}).get("headers") or []}
    subject = headers.get("subject") or "无标题服务邮件"
    sender = headers.get("from") or ""
    parts = text_parts(message.get("payload") or {})
    plain = [value for mime, value in parts if mime == "text/plain"]
    if plain:
        body = "\n".join(plain).strip()
    else:
        html = VisibleHTML()
        for mime, value in parts:
            if mime == "text/html":
                html.feed(value)
        body = "".join(html.text).strip() or message.get("snippet", "")
    return {"id": "gmail-" + message["id"], "kind": "gmail", "source": sender,
            "title": subject, "body": body, "messageId": message["id"], "date": headers.get("date", "")}


def matching_ids(token):
    ids = []
    page_token = None
    while True:
        parameters = {"q": SEARCH, "maxResults": "100"}
        if page_token:
            parameters["pageToken"] = page_token
        result = request_json(API_URL + "?" + urllib.parse.urlencode(parameters), token=token)
        ids.extend(item["id"] for item in result.get("messages") or [])
        if len(ids) > MAX_MATCHES:
            raise RuntimeError("匹配邮件超过 %d 封，本次未写入；请缩小搜索范围。" % MAX_MATCHES)
        page_token = result.get("nextPageToken")
        if not page_token:
            return ids


def sync(credentials, database, token_file):
    client_id, client_secret = load_client(credentials)
    token = access_token(client_id, client_secret, token_file)
    ids = matching_ids(token)
    connection = sqlite3.connect(database)
    try:
        for message_id in ids:
            url = API_URL + "/" + urllib.parse.quote(message_id, safe="") + "?format=full"
            record = message_evidence(request_json(url, token=token))
            connection.execute(
                "INSERT INTO evidence(id,kind,source,title,body,imported_at,asset_id,payload) VALUES(?,?,?,?,?,?,?,?) "
                "ON CONFLICT(id) DO UPDATE SET source=excluded.source,title=excluded.title,body=excluded.body,imported_at=excluded.imported_at,payload=excluded.payload",
                (record["id"], record["kind"], record["source"], record["title"], record["body"],
                 time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "", json.dumps({"messageId": record["messageId"], "date": record["date"]})),
            )
        connection.commit()
    finally:
        connection.close()
    return len(ids)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--credentials", required=True)
    parser.add_argument("--database", required=True)
    parser.add_argument("--token-file", required=True)
    options = parser.parse_args()
    try:
        count = sync(options.credentials, options.database, options.token_file)
        print(json.dumps({"ok": True, "count": count}))
    except (OSError, ValueError, RuntimeError, KeyError, json.JSONDecodeError) as error:
        print(json.dumps({"ok": False, "error": str(error)}, ensure_ascii=False))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
