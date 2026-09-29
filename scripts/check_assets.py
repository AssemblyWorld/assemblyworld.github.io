"""Validate public display packages without private datasets or model execution."""
import hashlib
import json
import struct
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[1] / 'public'
catalog = json.loads((root / 'catalog.json').read_text())
assert catalog['version'] == 1
for case in catalog['cases']:
    assert case['publish'], case['id']
    initial = root / case['initial'].lstrip('/')
    assert hashlib.sha256(initial.read_bytes()).hexdigest() == case['initialSHA256']
    with zipfile.ZipFile(initial) as z:
        assert not z.read('calls.jsonl').strip(), 'Initial scene contains agent calls'
        manifest = json.loads(z.read('manifest.json'))
        assert len(manifest['objects']) == case['parts']
        for name, digest in manifest['hashes'].items():
            assert hashlib.sha256(z.read(name)).hexdigest() == digest
    assert (root / case['thumbnail'].lstrip('/')).stat().st_size > 1000
    for variant in case['variants']:
        payload = (root / variant['url'].lstrip('/')).read_bytes()
        assert hashlib.sha256(payload).hexdigest() == variant['sha256']
        run = json.loads(payload)
        data = (root / run['geometry']['url'].lstrip('/')).read_bytes()
        assert hashlib.sha256(data).hexdigest() == run['geometry']['sha256']
        assert run['validation']['archiveSHA256'] == variant['episodeSHA256']
        assert run['validation']['inversePoseMaxError'] < 1e-10
        assert len(run['parts']) == case['parts'] == len(run['groundTruth'])
        assert str(run['finalState']) in run['states']
        assert len(run['calls']) == variant['calls']
        assert all(str(c['state_index']) in run['states'] for c in run['calls'])
        for p in run['parts']:
            end = p['indexOffset'] + p['indexCount'] * 4
            assert end <= len(data)
            indices = struct.unpack_from('<' + 'I' * p['indexCount'], data, p['indexOffset'])
            assert max(indices) < p['positionCount'] // 3
        assert run['cameras'].keys() == run['states'].keys()
        for camera in run['cameras'].values():
            assert all(len(camera[k]) == 3 for k in ('position', 'target', 'up'))
            assert abs(sum(x*x for x in camera['up'])-1) < 1e-8
            assert 0 < camera['fov'] < 180
            assert sum((x-y)**2 for x,y in zip(camera['position'], camera['target'])) > 1e-10
        for poses in [*run['states'].values(), run['groundTruth']]:
            assert len(poses) == case['parts']
            for pose in poses:
                assert len(pose) == 7 and abs(sum(x*x for x in pose[3:])-1) < 1e-8
    print('Verified', case['id'])
