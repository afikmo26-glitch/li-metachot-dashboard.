"""Tripo v3 pipeline: image -> 3D model -> rig check -> rig -> retarget animations. Usage: tripo.py NAME IMAGE [anim,anim,...]"""
import json, os, sys, time, urllib.request
KEY = os.environ['TRIPO_KEY']; BASE = 'https://openapi.tripo3d.ai/v3'
OUT = os.path.dirname(os.path.abspath(__file__))
def req(method, path, body=None, files=None):
    if files:
        import subprocess
        r = subprocess.run(['curl', '-s', '-H', f'Authorization: Bearer {KEY}', '-F', f'file=@{files}', BASE + path], capture_output=True, text=True)
        return json.loads(r.stdout)
    data = json.dumps(body).encode() if body is not None else None
    rq = urllib.request.Request(BASE + path, data=data, method=method, headers={'Authorization': f'Bearer {KEY}', 'Content-Type': 'application/json', 'User-Agent': 'curl/8'})
    try:
        return json.load(urllib.request.urlopen(rq, timeout=120))
    except urllib.error.HTTPError as e:
        return json.loads(e.read() or b'{}')
def task(path, body, label):
    r = req('POST', path, body)
    if r.get('code') != 0: raise SystemExit(f'{label} create failed: {r}')
    tid = r['data']['task_id']; print(label, 'task', tid, flush=True)
    while True:
        time.sleep(5)
        q = req('GET', f'/tasks/{tid}')['data']
        if q['status'] in ('success', 'failed', 'cancelled', 'banned', 'expired'):
            print(label, q['status'], 'credits', q.get('credits_consumed'), q.get('error_msg', ''), flush=True)
            if q['status'] != 'success': raise SystemExit(json.dumps(q)[:800])
            return tid, q.get('output', {})
def download(url, path):
    rq = urllib.request.Request(url, headers={'User-Agent': 'curl/8'})
    open(path, 'wb').write(urllib.request.urlopen(rq, timeout=300).read()); print('saved', path, os.path.getsize(path), flush=True)
if __name__ == '__main__':
    name, image = sys.argv[1], sys.argv[2]
    anims = sys.argv[3].split(',') if len(sys.argv) > 3 else []
    state_f = f'{OUT}/{name}.json'; st = json.load(open(state_f)) if os.path.exists(state_f) else {}
    save = lambda: json.dump(st, open(state_f, 'w'), indent=1)
    if 'model' not in st:
        tok = req('POST', '/files', files=image)['data']['file_token']
        tid, out = task('/generation/image-to-model', {'input': tok, 'model': 'v3.1-20260211', 'face_limit': int(os.environ.get('FACES', 20000)), 'pbr': False, 'texture_quality': os.environ.get('TQ', 'standard')}, 'model')
        st['model'] = tid; save(); download(out['model_url'], f'{OUT}/{name}_model.glb')
        if out.get('rendered_image_url'): download(out['rendered_image_url'], f'{OUT}/{name}_preview.webp')
    if 'check' not in st:
        _, out = task('/animations/rig-check', {'input': st['model']}, 'rigcheck'); st['check'] = out; save()
    print('rig check', st['check'])
    if not anims: sys.exit(0)
    if 'rig' not in st:
        rt = st['check'].get('rig_type', 'biped')
        if rt != 'biped' and not os.environ.get('FORCE'):
            raise SystemExit(f'not biped ({rt}); skipping the rig')
        body = {'input': st['model'], 'rig_type': rt, 'out_format': 'glb'}
        body['model'] = 'v1.0-20240301' if rt == 'biped' else 'v2.5-20260210'
        tid, out = task('/animations/rig', body, 'rig'); st['rig'] = tid; save(); download(out['model_url'], f'{OUT}/{name}_rigged.glb')
    if anims == ['RIGONLY']: sys.exit(0)
    for i in range(0, len(anims), 5):
        batch = anims[i:i + 5]; key = 'anim:' + ','.join(batch)
        if key in st: continue
        tid, out = task('/animations/retarget', {'input': st['rig'], 'animations': batch, 'out_format': 'glb', 'animate_in_place': True}, 'retarget')
        st[key] = tid; save(); download(out['model_url'], f'{OUT}/{name}_anim{i // 5}.glb')
        print(json.dumps(out)[:400])
