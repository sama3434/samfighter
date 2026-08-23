#!/usr/bin/env python3
"""Local dev server for Sam Fighter.

Plain http.server caches aggressively, and an ES module graph is cached per
file -- so a reload can pick up a new entry point while still running an old
copy of everything it imports, which looks exactly like a bug in your code.
This sends no-store on everything so a reload always gets the current source.
"""
import sys
from functools import partial
from http.server import HTTPServer, SimpleHTTPRequestHandler


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        if "404" in (fmt % args):
            super().log_message(fmt, *args)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
    directory = sys.argv[2] if len(sys.argv) > 2 else "."
    handler = partial(NoCacheHandler, directory=directory)
    print(f"SAM FIGHTER  ->  http://localhost:{port}")
    print(f"tests        ->  http://localhost:{port}/tests/")
    HTTPServer(("127.0.0.1", port), handler).serve_forever()
