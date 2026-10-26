"""Serve the original files at / and /web-practice/ without rewriting them."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
import argparse
import socket

ROOT = Path(__file__).resolve().parents[1]


class PreviewServer(ThreadingHTTPServer):
    allow_reuse_address = False

    def server_bind(self):
        if hasattr(socket, 'SO_EXCLUSIVEADDRUSE'):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


class PreviewHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def translate_path(self, path):
        value = urlsplit(path).path
        if value == '/web-practice':
            value = '/'
        elif value.startswith('/web-practice/'):
            value = value[len('/web-practice'):]
        return super().translate_path(value)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def send_error(self, code, message=None, explain=None):
        if code == 404:
            content = (ROOT / '404.html').read_bytes()
            self.send_response(404)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(content)))
            self.end_headers()
            if self.command != 'HEAD':
                self.wfile.write(content)
            return
        super().send_error(code, message, explain)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8000)
    args = parser.parse_args()
    try:
        with PreviewServer(('127.0.0.1', args.port), PreviewHandler) as server:
            print(f'http://127.0.0.1:{args.port}/', flush=True)
            server.serve_forever()
    except KeyboardInterrupt:
        pass
    except OSError as error:
        print(f'Не вдалося запустити сервер на порту {args.port}: {error}', flush=True)
        raise SystemExit(1)
