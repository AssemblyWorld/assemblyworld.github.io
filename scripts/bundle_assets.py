"""Package only publication-cleared assets; create an immutable release lock."""
import hashlib
import json
import tarfile
from pathlib import Path
root = Path(__file__).resolve().parents[1]
public = root / 'public'
catalog = json.loads((public / 'catalog.json').read_text())
archive = root / '.local/media-v1.tar.gz'
with tarfile.open(archive, 'w:gz') as tar:
    for case in catalog['cases']:
        assert case['publish']
        directory = (public / case['initial'].lstrip('/')).parent
        tar.add(directory, arcname=directory.relative_to(public).as_posix())
    tar.add(public / 'media/v1/paper.pdf', arcname='media/v1/paper.pdf')
    tar.add(public / 'licenses', arcname='media/v1/licenses')
    tar.add(public / 'asset-terms.html', arcname='media/v1/ASSET_TERMS.html')
    tar.add(public / 'catalog.json', arcname='media/v1/catalog.json')
lock = dict(version=1, url='https://github.com/AssemblyWorld/assemblyworld.github.io/releases/download/assets-v1/media-v1.tar.gz',
            sha256=hashlib.sha256(archive.read_bytes()).hexdigest(), bytes=archive.stat().st_size,
            cases=[c['id'] for c in catalog['cases']])
(root / 'assets.lock.json').write_text(json.dumps(lock, indent=2)+'\n')
print(json.dumps(lock, indent=2))
