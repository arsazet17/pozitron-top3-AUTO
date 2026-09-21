#!/usr/bin/env python3
import base64
import json
import re
import sys
import urllib.request
from pathlib import Path

OUT = Path('/tmp/top3_official_tail.json')
ARCHIVE_FILE = Path('data/archive.json')
TAIL_SIZE = 60
SCHEDULE = [f'{hour:02d}:{minute:02d}' for hour in range(24) for minute in (25, 55)]
SCHEDULE_SET = set(SCHEDULE)
YULIA_CONTENTS = 'https://api.github.com/repos/arsazet17/pozitron-top3-v1.0/contents/top3-live.json?ref=main'
YULIA_RAW = 'https://raw.githubusercontent.com/arsazet17/pozitron-top3-v1.0/main/top3-live.json'
UA = 'TOP3-Analyzer-Sync/0.6.4'


def valid_row(row):
    return (
        isinstance(row, dict)
        and isinstance(row.get('draw'), int)
        and row['draw'] >= 100000
        and re.fullmatch(r'\d{4}-\d{2}-\d{2}', str(row.get('date', '')))
        and row.get('time') in SCHEDULE_SET
        and re.fullmatch(r'\d{3}', str(row.get('combo', '')))
    )


def get_json(url):
    req = urllib.request.Request(url, headers={
        'Accept': 'application/vnd.github+json, application/json',
        'User-Agent': UA,
        'Cache-Control': 'no-cache',
    })
    with urllib.request.urlopen(req, timeout=25) as response:
        return json.loads(response.read().decode('utf-8'))


def fetch_verified_live():
    errors = []
    try:
        wrapper = get_json(YULIA_CONTENTS)
        encoded = str(wrapper.get('content') or '').replace('\n', '')
        if encoded:
            payload = json.loads(base64.b64decode(encoded).decode('utf-8'))
            return payload, 'GitHub API direct'
    except Exception as exc:
        errors.append(f'contents: {exc}')
    try:
        return get_json(YULIA_RAW), 'GitHub RAW fallback'
    except Exception as exc:
        errors.append(f'raw: {exc}')
    raise RuntimeError('Yulia TOP-3 live source unavailable: ' + ' | '.join(errors))


def yulia_row(raw):
    try:
        draw = int(raw.get('id'))
        dd, mm, yy = str(raw.get('date')).split('.')
        date = f'20{yy}-{mm}-{dd}'
        time = str(raw.get('time'))
        vals = [int(raw.get('a')), int(raw.get('b')), int(raw.get('c'))]
        if any(v < 0 or v > 9 for v in vals):
            return None
        row = {'draw': draw, 'date': date, 'time': time, 'combo': ''.join(map(str, vals))}
    except Exception:
        return None
    return row if valid_row(row) else None


def load_local_rows():
    data = json.loads(ARCHIVE_FILE.read_text(encoding='utf-8'))
    rows = []
    for x in data if isinstance(data, list) else []:
        try:
            row = {
                'draw': int(x.get('draw')),
                'date': str(x.get('date')),
                'time': str(x.get('time')),
                'combo': str(x.get('combo')),
            }
        except Exception:
            continue
        if valid_row(row):
            rows.append(row)
    rows.sort(key=lambda r: r['draw'])
    if not rows:
        raise RuntimeError('Local TOP-3 archive has no valid numbered rows')
    return rows


def build_tail(local_rows, live_payload):
    source = str(live_payload.get('source') or '')
    if 'официальный API Столото' not in source:
        raise RuntimeError(f'Unexpected live source: {source!r}')

    live_rows = [r for r in (yulia_row(x) for x in live_payload.get('draws', [])) if r]
    if not live_rows:
        raise RuntimeError('Yulia TOP-3 live source contains no valid draws')

    by_live = {r['draw']: r for r in live_rows}
    live_latest = max(by_live)
    declared_latest = int(live_payload.get('latest') or live_latest)
    if declared_latest != live_latest:
        raise RuntimeError(f'Live header/draw mismatch: header №{declared_latest}, draws №{live_latest}')

    local_no = local_rows[-1]['draw']
    if live_latest < local_no:
        raise RuntimeError(f'Live source behind local archive: LIVE №{live_latest}, LOCAL №{local_no}')

    # Anti-leak / integrity: overlapping recent facts must be identical.
    local_map = {r['draw']: r for r in local_rows[-80:]}
    for n, live in by_live.items():
        old = local_map.get(n)
        if old and old != live:
            raise RuntimeError(f'Conflict №{n}: local={old} live={live}')

    merged = {r['draw']: r for r in local_rows}
    for n in range(local_no + 1, live_latest + 1):
        row = by_live.get(n)
        if not row:
            raise RuntimeError(f'Verified live tail missing required №{n}; nothing written')
        merged[n] = row

    rows = [merged[n] for n in sorted(merged)]
    tail = rows[-TAIL_SIZE:]
    if len(tail) < 3:
        raise RuntimeError(f'Only {len(tail)} valid rows available')
    for i in range(1, len(tail)):
        if tail[i]['draw'] != tail[i - 1]['draw'] + 1:
            raise RuntimeError(f"Non-contiguous tail №{tail[i-1]['draw']} -> №{tail[i]['draw']}")
    return tail, local_no, live_latest


def main():
    local_rows = load_local_rows()
    payload, transport = fetch_verified_live()
    tail, local_no, live_latest = build_tail(local_rows, payload)
    OUT.write_text(json.dumps(tail, ensure_ascii=False, indent=2), encoding='utf-8')
    newest = tail[-1]
    print(
        f"VERIFIED YULIA/STOLOTO TAIL OK via {transport}: "
        f"local №{local_no}; live №{live_latest} {newest['date']} {newest['time']}={newest['combo']}; "
        f"source={payload.get('source')}; updatedAt={payload.get('updatedAt')}; tail={len(tail)}"
    )


def self_test():
    assert len(SCHEDULE) == 48 and SCHEDULE[0] == '00:25' and SCHEDULE[-1] == '23:55'
    assert yulia_row({'id': 268389, 'date': '21.09.26', 'time': '18:25', 'a': 0, 'b': 8, 'c': 9}) == {
        'draw': 268389, 'date': '2026-09-21', 'time': '18:25', 'combo': '089'
    }
    print('SELF-TEST OK · Yulia verified full archive bridge · :25/:55')


if __name__ == '__main__':
    if '--self-test' in sys.argv:
        self_test()
    else:
        main()
