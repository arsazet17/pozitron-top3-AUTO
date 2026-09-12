#!/usr/bin/env python3
import json
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ARCHIVE_API = "https://m.stoloto.ru/p/api/mobile/api/v35/service/draws/archive"
INFO_API = "https://m.stoloto.ru/p/api/mobile/api/v35/service/games/info-new"
OUT = Path("/tmp/top3_official_tail.json")
LATEST_FILE = Path("data/latest.json")
ARCHIVE_FILE = Path("data/archive.json")
PAGE_SIZE = 30
MAX_PAGES = 20
TAIL_SIZE = 60
SCHEDULE = [f"{hour:02d}:{minute:02d}" for hour in range(24) for minute in (25, 55)]
SCHEDULE_SET = set(SCHEDULE)
HEADERS = {
    "Accept": "application/json",
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/152 Safari/537.36",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
}
MOSCOW = ZoneInfo("Europe/Moscow")


def get_json(url, attempts=3):
    last = None
    for attempt in range(1, attempts + 1):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=35) as r:
                if r.status != 200:
                    raise RuntimeError(f"HTTP {r.status}: {url}")
                return json.loads(r.read().decode("utf-8"))
        except Exception as exc:
            last = exc
            if attempt < attempts:
                time.sleep(1.5 * attempt)
    raise RuntimeError(f"Official API read failed: {last}")


def valid_row(row):
    return (
        isinstance(row, dict)
        and isinstance(row.get("draw"), int)
        and row["draw"] >= 100000
        and isinstance(row.get("date"), str)
        and len(row["date"]) == 10
        and row.get("time") in SCHEDULE_SET
        and isinstance(row.get("combo"), str)
        and len(row["combo"]) == 3
        and row["combo"].isdigit()
    )


def parse_iso_date(value):
    s = str(value or "")
    if len(s) < 16 or s[4] != "-" or s[7] != "-" or s[10] != "T":
        return None
    try:
        return {"date": s[:10], "time": s[11:16]}
    except Exception:
        return None


def parse_epoch_moscow(value):
    try:
        seconds = float(value)
    except Exception:
        return None
    if seconds > 10_000_000_000:  # tolerate milliseconds if API ever switches units
        seconds /= 1000.0
    dt = datetime.fromtimestamp(seconds, tz=timezone.utc).astimezone(MOSCOW)
    return {"date": dt.strftime("%Y-%m-%d"), "time": dt.strftime("%H:%M")}


def combo_from(raw):
    c = raw.get("combination") if isinstance(raw, dict) else None
    nums = None
    if isinstance(c, dict):
        nums = c.get("structured") or c.get("serialized")
    if nums is None and isinstance(raw, dict):
        nums = raw.get("winningCombination")
    if not isinstance(nums, list) or len(nums) < 3:
        return None
    try:
        vals = [int(nums[i]) for i in range(3)]
    except Exception:
        return None
    if any(n < 0 or n > 9 for n in vals):
        return None
    return "".join(str(n) for n in vals)


def archive_to_row(raw):
    if not isinstance(raw, dict):
        return None
    dt = parse_iso_date(raw.get("date"))
    combo = combo_from(raw)
    try:
        draw = int(raw.get("number"))
    except Exception:
        return None
    row = {"draw": draw, "date": dt["date"], "time": dt["time"], "combo": combo} if dt and combo else None
    return row if valid_row(row) else None


def completed_to_row(raw):
    if not isinstance(raw, dict):
        return None
    dt = parse_epoch_moscow(raw.get("date"))
    combo = combo_from(raw)
    try:
        draw = int(raw.get("number"))
    except Exception:
        return None
    row = {"draw": draw, "date": dt["date"], "time": dt["time"], "combo": combo} if dt and combo else None
    return row if valid_row(row) else None


def same_draw(a, b):
    return bool(a and b and all(a.get(k) == b.get(k) for k in ("draw", "date", "time", "combo")))


def dedupe(rows):
    by_no = {}
    for row in rows:
        if valid_row(row):
            by_no[row["draw"]] = row
    return [by_no[n] for n in sorted(by_no)]


def local_latest():
    try:
        j = json.loads(LATEST_FILE.read_text(encoding="utf-8"))
        return int(j.get("draw", {}).get("draw", 0))
    except Exception:
        pass
    try:
        a = json.loads(ARCHIVE_FILE.read_text(encoding="utf-8"))
        return max((int(x.get("draw", 0)) for x in a if isinstance(x, dict)), default=0)
    except Exception:
        return 0


def fetch_info_latest():
    j = get_json(INFO_API)
    games = j.get("games") if isinstance(j, dict) else None
    if not isinstance(games, list):
        raise RuntimeError("games/info-new: field games is missing")
    game = next((x for x in games if isinstance(x, dict) and x.get("name") == "top-3"), None)
    row = completed_to_row(game.get("completedDraw") if game else None)
    if not row:
        raise RuntimeError("games/info-new did not return a valid completedDraw for TOP-3")
    return row


def fetch_archive_since(local_no):
    rows = []
    for page in range(1, MAX_PAGES + 1):
        q = urllib.parse.urlencode({"game": "top3", "count": PAGE_SIZE, "page": page, "_": int(time.time() * 1000)})
        j = get_json(f"{ARCHIVE_API}?{q}")
        raw = j.get("draws") if isinstance(j, dict) else None
        page_rows = [archive_to_row(x) for x in (raw or [])]
        page_rows = [x for x in page_rows if x]
        if not page_rows:
            break
        rows.extend(page_rows)
        oldest = min(x["draw"] for x in page_rows)
        if oldest <= local_no or len(page_rows) < PAGE_SIZE:
            break
    return dedupe(rows)


def verify_sources(info_latest, archive_rows, local_no):
    if not archive_rows:
        raise RuntimeError("Official archive API returned no TOP-3 rows")
    archive_latest = archive_rows[-1]

    if same_draw(info_latest, archive_latest):
        return archive_rows, "archive+info-new"

    if archive_latest["draw"] > info_latest["draw"]:
        common = next((x for x in archive_rows if x["draw"] == info_latest["draw"]), None)
        if not same_draw(common, info_latest):
            raise RuntimeError(f"Official sources disagree: info-new={info_latest}; archive-common={common}")
        time.sleep(2.5)
        confirm = fetch_archive_since(local_no)
        if not confirm or not same_draw(archive_latest, confirm[-1]):
            raise RuntimeError(f"Newest archive draw did not confirm on second read: first={archive_latest}; second={confirm[-1] if confirm else None}")
        print(f"INFO-NEW LAG: №{info_latest['draw']}; archive twice confirmed №{archive_latest['draw']}")
        return confirm, "archive-twice+info-common"

    raise RuntimeError(f"Official archive has not caught up with info-new: info-new={info_latest}; archive={archive_latest}")


def ensure_contiguous(rows, local_no, newest_no):
    if newest_no <= local_no:
        return
    by_no = {x["draw"]: x for x in rows}
    missing = [n for n in range(local_no + 1, newest_no + 1) if n not in by_no]
    if missing:
        raise RuntimeError(f"Official API tail has a gap; missing draw(s): {missing[:8]}")


def main():
    local_no = local_latest()
    info_latest = fetch_info_latest()
    first_archive = fetch_archive_since(local_no)
    rows, mode = verify_sources(info_latest, first_archive, local_no)
    newest = rows[-1]

    # A stale source must be an error, never a successful 'no updates' run.
    if newest["draw"] < local_no:
        raise RuntimeError(f"Official source is stale: LOCAL №{local_no}, API №{newest['draw']}")

    ensure_contiguous(rows, local_no, newest["draw"])
    tail = rows[-TAIL_SIZE:]
    if len(tail) < 3:
        raise RuntimeError(f"Official API returned only {len(tail)} valid rows")

    OUT.write_text(json.dumps(tail, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        f"OFFICIAL API TOP-3 OK ({mode}): {len(tail)} rows; "
        f"latest №{newest['draw']} {newest['date']} {newest['time']}={newest['combo']}; local №{local_no}"
    )


def self_test():
    assert len(SCHEDULE) == 48 and SCHEDULE[0] == "00:25" and SCHEDULE[-1] == "23:55"
    assert parse_iso_date("2026-09-12T19:55:00+03:00") == {"date": "2026-09-12", "time": "19:55"}
    assert combo_from({"combination": {"structured": [1, 7, 8]}}) == "178"
    assert valid_row({"draw": 267960, "date": "2026-09-12", "time": "19:55", "combo": "178"})
    print("SELF-TEST OK · official API · 48 draws/day :25/:55")


if __name__ == "__main__":
    if "--self-test" in sys.argv:
        self_test()
    else:
        main()
