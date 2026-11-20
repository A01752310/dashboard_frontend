"""Serve the React build locally; opt-in, read-only Historian proxy for mounting day."""
import argparse
import json
import os
import socket
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit, parse_qs, urlencode, unquote
from urllib.request import Request, build_opener, HTTPRedirectHandler, ProxyHandler
import mimetypes

ROOT = Path(__file__).resolve().parent

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None

class Handler(BaseHTTPRequestHandler):
    def send(self, code, body, content_type='application/json; charset=utf-8'):
        self.send_response(code)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")
        self.end_headers()
        self.wfile.write(body)

    def error(self, code, message):
        self.send(code, json.dumps({'error': message}).encode())

    def do_GET(self):
        target = urlsplit(self.path)
        if target.path.startswith('/api/'):
            return self.api(target)
        path = unquote(target.path)
        if '..' in path.split('/') or '\\' in path or '\x00' in path:
            return self.error(404, 'not_found')
        relative = 'index.html' if path == '/' else path.lstrip('/')
        file = (self.server.web_root / relative).resolve()
        if not file.is_relative_to(self.server.web_root) or not file.is_file():
            return self.error(404, 'not_found')
        self.send(200, file.read_bytes(), mimetypes.guess_type(file)[0] or 'application/octet-stream')

    def api(self, target):
        if target.path not in ('/api/health', '/api/telemetry'):
            return self.error(404, 'not_found')
        if not self.server.enable_api:
            return self.error(503, 'historian_disabled_for_simulation')
        query = parse_qs(target.query, keep_blank_values=True)
        if set(query) - {'limit', 'run_id'} or any(len(v) != 1 for v in query.values()):
            return self.error(400, 'invalid_parameters')
        if 'limit' in query and (not query['limit'][0].isdigit() or not 1 <= int(query['limit'][0]) <= 50):
            return self.error(400, 'invalid_limit')
        if len(query.get('run_id', [''])[0]) > 150:
            return self.error(400, 'invalid_run_id')
        url = self.server.historian_url + target.path.removeprefix('/api')
        if query:
            url += '?' + urlencode({k: v[0] for k, v in query.items()})
        try:
            # Ignore system proxies and redirects; never forward browser cookies/auth.
            opener = build_opener(ProxyHandler({}), NoRedirect())
            with opener.open(Request(url, headers={'Accept': 'application/json'}), timeout=3) as response:
                body = response.read(2_000_001)
                if len(body) > 2_000_000:
                    return self.error(502, 'response_too_large')
                self.send(response.status, body, response.headers.get('Content-Type', 'application/json'))
        except HTTPError as error:
            if 300 <= error.code < 400:
                return self.error(502, 'historian_redirect_rejected')
            self.send(error.code, error.read(2_000_000), error.headers.get('Content-Type', 'application/json'))
        except (URLError, TimeoutError, socket.timeout, ConnectionError):
            self.error(502, 'historian_unreachable')

    def not_allowed(self):
        self.error(405, 'method_not_allowed')
    do_POST = do_PUT = do_DELETE = do_PATCH = do_HEAD = do_OPTIONS = do_CONNECT = do_TRACE = not_allowed


def make_server(bind='127.0.0.1', port=8080, web_root=None, enable_api=False, historian_url='http://192.168.20.20:8081'):
    parsed = urlsplit(historian_url)
    if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ('', '/'):
        raise ValueError('HISTORIAN_URL must be a fixed HTTP origin without credentials or path')
    server = ThreadingHTTPServer((bind, port), Handler)
    server.web_root = Path(web_root or ROOT / 'dist').resolve()
    server.enable_api = enable_api
    server.historian_url = historian_url.rstrip('/')
    return server

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bind', default=os.getenv('BIND', '127.0.0.1'))
    parser.add_argument('--port', type=int, default=int(os.getenv('PORT', '8080')))
    parser.add_argument('--web', default=str(ROOT / 'dist'))
    parser.add_argument('--enable-api', action='store_true', help='Enable only during mounting or against a local mock')
    args = parser.parse_args()
    if not (Path(args.web) / 'index.html').is_file():
        parser.error('React build missing. Run npm ci and npm run build first.')
    with make_server(args.bind, args.port, args.web, args.enable_api, os.getenv('HISTORIAN_URL', 'http://192.168.20.20:8081')) as server:
        print(f'Dashboard: http://{args.bind}:{server.server_port}/', flush=True)
        print('Historian proxy: ' + ('enabled explicitly' if args.enable_api else 'disabled — simulation only'), flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
