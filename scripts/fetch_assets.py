"""Download the exact public release referenced by assets.lock.json."""
import hashlib
import io
import json
import tarfile
import urllib.request
from pathlib import Path
root = Path(__file__).resolve().parents[1]
lock = json.loads((root / 'assets.lock.json').read_text())
request = urllib.request.Request(lock['url'], headers={'User-Agent':'AssemblyWorld-site-build'})
with urllib.request.urlopen(request, timeout=120) as response:
    payload = response.read()
assert len(payload) == lock['bytes']
assert hashlib.sha256(payload).hexdigest() == lock['sha256'], 'Asset archive checksum mismatch'
with tarfile.open(fileobj=io.BytesIO(payload), mode='r:gz') as tar:
    for member in tar.getmembers():
        path = Path(member.name)
        assert not path.is_absolute() and '..' not in path.parts and not member.issym() and not member.islnk()
        assert len(path.parts) >= 3 and path.parts[:2] == ('media',lock.get('mediaVersion','v1'))
        assert path.parts[2] in lock['cases'] or path.parts[2] in ('paper.pdf', 'licenses', 'ASSET_TERMS.html', 'catalog.json')
    tar.extractall(root / 'public', filter='data')
print('Verified and extracted public asset release:', lock['sha256'])
