"""Keep every Showcase game identical to the published Composer runtime."""
import hashlib
import json
import shutil
import sys
from pathlib import Path

road_source, site = map(Path, sys.argv[1:])
metadata_path = site / "games.json"
metadata = json.loads(metadata_path.read_text())
for entry in metadata:
    game = entry["id"]
    source = road_source.parent / game
    if not (source / "index.html").is_file():
        raise SystemExit("Published Goat Road runtime is missing")
    files = sorted(p for p in source.rglob("*") if p.is_file() and p.suffix not in {".br", ".gz"})
    digest = hashlib.sha256()
    for path in files:
        digest.update(path.relative_to(source).as_posix().encode())
        digest.update(path.read_bytes())
    revision = digest.hexdigest()[:12]
    road = site / "games" / game
    destination = road / revision
    for path in files:
        target = destination / path.relative_to(source)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, target)
    (road / "index.html").write_text(
        '<!doctype html><meta charset="utf-8"><title>Loading game</title>'
        '<script>location.replace(' + json.dumps(revision + '/index.html')
        + '+location.search+location.hash)</script>'
    )
    entry.update(revision=revision, mb=round(sum(p.stat().st_size for p in files) / 1024 / 1024, 1))
    print("Published runtime:", game, revision)
metadata_path.write_text(json.dumps(metadata) + "\n")
manifest = road_source.parents[2] / "releases.json"
if manifest.exists():
    shutil.copy2(manifest, site / "releases.json")
