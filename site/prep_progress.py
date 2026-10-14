import hashlib
import json
import re
from pathlib import Path


SITE = Path(__file__).resolve().parent


def identifier(source):
    overrides = json.loads((SITE / 'progress-id-overrides.json').read_text())
    value = overrides.get(source, 'note-' + hashlib.sha256(source.encode()).hexdigest()[:16])
    if not re.fullmatch(r'note-[a-f0-9]{16}', value):
        raise ValueError(f'Invalid progress ID for {source}')
    return value


def catalog(pairs):
    """Stable note IDs with their pages, served as static/prep-progress-catalog.json.
    The reading drawer reads titles from it, and the public counter accepts only these IDs."""
    result = {}
    for source, pair in pairs.items():
        note_id = identifier(source)
        if note_id in result:
            raise ValueError(f'Duplicate progress ID: {note_id}')
        result[note_id] = {
            'source': source,
            'pages': {language: {'url': page.url, 'title': page.title}
                      for language, page in pair.items() if page}
        }
    return {'version': 1, 'notes': result}
