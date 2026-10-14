import json, os, sys, urllib.request
UA = {'User-Agent': 'lofi-rocket-asset-prep/1.0'}
def open_url(u):
    return urllib.request.urlopen(urllib.request.Request(u, headers=UA))
asset = sys.argv[1]
d = json.load(open_url(f'https://api.polyhaven.com/files/{asset}'))
e = d['gltf']['1k']['gltf']
os.makedirs(asset, exist_ok=True)
def get(url, path):
    full = os.path.join(asset, path)
    os.makedirs(os.path.dirname(full) or '.', exist_ok=True)
    if not os.path.exists(full):
        with open_url(url) as r, open(full, 'wb') as f:
            while True:
                b = r.read(1 << 20)
                if not b: break
                f.write(b)
get(e['url'], os.path.basename(e['url']))
for rel, v in e.get('include', {}).items():
    get(v['url'], rel)
print(asset, 'done')
