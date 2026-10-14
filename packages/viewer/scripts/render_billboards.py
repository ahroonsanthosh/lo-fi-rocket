"""Render tree billboards from Poly Haven glTF models in headless Chromium (plan 3d-0002).

Usage (from a scratch directory holding `models/<asset>/` from get_gltf.py, with `three`
linked to the three.js package of the repository's node_modules):

    python3 render_billboards.py <chromium> <out_dir> name:models/asset/asset_1k.gltf:yaw ...

Serves this directory's render-billboards.html and the scratch directory over HTTP on
127.0.0.1, runs Chromium headless on the page with the jobs in its query string, and
saves the colour and normal renders (PNG) and each tree's size (JSON) that the page
posts back. Not part of the build.
"""
import base64
import http.server
import json
import os
import subprocess
import sys
import threading
import urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
chromium, out_dir, *jobs = sys.argv[1:]
os.makedirs(out_dir, exist_ok=True)
done = threading.Event()


class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        if path.split('?')[0] == '/render-billboards.html':
            return os.path.join(HERE, 'render-billboards.html')
        return super().translate_path(path)

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        if body.get('done'):
            done.set()
        else:
            name = body['name']
            for k in ('colour', 'normal'):
                with open(os.path.join(out_dir, f'{name}_{k}.png'), 'wb') as f:
                    f.write(base64.b64decode(body[k].split(',')[1]))
            with open(os.path.join(out_dir, f'{name}.json'), 'w') as f:
                json.dump(body['meta'], f)
            print(name, body['meta'])
        self.send_response(204)
        self.end_headers()

    def log_message(self, *args):
        pass


server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
url = f'http://127.0.0.1:{server.server_port}/render-billboards.html?jobs=' + urllib.parse.quote(','.join(jobs))
proc = subprocess.Popen([chromium, '--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
                         '--window-size=1024,1024', '--no-sandbox', url])
done.wait(timeout=3600)
proc.terminate()
server.shutdown()
