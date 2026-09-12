#!/usr/bin/env python3
"""Build compact browser archive from the repository XLSX without third-party packages.

The historical spreadsheet may contain either a single 3-digit combination column
or separate A/B/C digit columns. Old rows without date/time are kept as real draw
number + combination only; no dates are invented.
"""
import json
import os
import re
import zipfile
from pathlib import Path
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta

ROOT = Path(__file__).resolve().parents[1] if "scripts" in Path(__file__).parts else Path.cwd()
DEFAULT_XLSX = ROOT / "data" / "TOP-3_архив_A_B_C_ИСПРАВЛЕННЫЙ_компактно.xlsx"
XLSX = Path(os.getenv("TOP3_FULL_ARCHIVE_XLSX", str(DEFAULT_XLSX)))
BOOTSTRAP = ROOT / "data" / "bootstrap-tail.json"
DATED_ARCHIVE = ROOT / "data" / "archive.json"
OUT_DIR = ROOT / "data" / "full-archive"
FROM_DRAW = 11

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def read_json(path, fallback):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return fallback


def shared_strings(zf):
    try:
        with zf.open("xl/sharedStrings.xml") as fh:
            root = ET.parse(fh).getroot()
    except KeyError:
        return []
    out = []
    for si in root.findall(f"{NS}si"):
        out.append("".join(t.text or "" for t in si.iter(f"{NS}t")))
    return out


def cell_value(cell, shared):
    typ = cell.get("t")
    if typ == "inlineStr":
        return "".join(t.text or "" for t in cell.iter(f"{NS}t"))
    v = cell.find(f"{NS}v")
    if v is None or v.text is None:
        return ""
    raw = v.text.strip()
    if typ == "s":
        try:
            return shared[int(raw)]
        except Exception:
            return raw
    return raw


def as_digit(text):
    text = str(text or "").strip()
    return str(int(float(text))) if re.fullmatch(r"\d(?:\.0+)?", text) else None


def combo_from_cells(cells):
    b = str(cells.get("B", "")).strip()
    if re.fullmatch(r"\d{3}", b):
        return b
    for cols in (("A","B","C"),("B","C","D")):
        ds = [as_digit(cells.get(c, "")) for c in cols]
        if all(d is not None for d in ds):
            return "".join(ds)
    for col, text in cells.items():
        text = str(text).strip()
        if col != "A" and re.fullmatch(r"\d{3}", text):
            return text
    a = str(cells.get("A", "")).strip()
    if len(cells) == 1 and re.fullmatch(r"\d{3}", a):
        return a
    return None


def read_combos(path):
    if not path.exists():
        raise FileNotFoundError(path)
    combos = []
    with zipfile.ZipFile(path) as zf:
        shared = shared_strings(zf)
        sheet_name = "xl/worksheets/sheet1.xml"
        if sheet_name not in zf.namelist():
            candidates = sorted(n for n in zf.namelist() if n.startswith("xl/worksheets/sheet") and n.endswith(".xml"))
            if not candidates:
                raise RuntimeError("В XLSX не найден лист с архивом")
            sheet_name = candidates[0]
        with zf.open(sheet_name) as fh:
            for event, elem in ET.iterparse(fh, events=("end",)):
                if elem.tag != f"{NS}row":
                    continue
                cells = {}
                for c in elem.findall(f"{NS}c"):
                    ref = c.get("r", "")
                    m = re.match(r"([A-Z]+)", ref)
                    if m:
                        cells[m.group(1)] = cell_value(c, shared)
                combo = combo_from_cells(cells)
                if combo is not None:
                    combos.append(combo)
                elem.clear()
    if len(combos) < 1000:
        raise RuntimeError(f"Слишком мало комбинаций в XLSX: {len(combos)}")
    return combos


def expand_bootstrap(meta):
    if not isinstance(meta, dict) or not meta.get("data"):
        return []
    data = str(meta["data"])
    combos = [data[i:i+3] for i in range(0, len(data), 3) if len(data[i:i+3]) == 3]
    out = []
    start_draw = int(meta["fromDraw"])
    first = meta["first"]
    regular = datetime.strptime(f"{meta['regularStart']['date']} {meta['regularStart']['time']}", "%Y-%m-%d %H:%M")
    step = int(meta.get("stepMinutes", 30))
    for i, combo in enumerate(combos):
        if i == 0:
            ds, tm = first["date"], first["time"]
        else:
            stamp = regular + timedelta(minutes=(i-1)*step)
            ds, tm = stamp.strftime("%Y-%m-%d"), stamp.strftime("%H:%M")
        out.append({"draw": str(start_draw+i), "date": ds, "time": tm, "combo": combo})
    if meta.get("count") is not None and len(out) != int(meta["count"]):
        raise RuntimeError(f"bootstrap count mismatch: {len(out)} != {meta['count']}")
    return out


def orientation_score(combos, known_rows):
    score = 0
    checked = 0
    to_draw = FROM_DRAW + len(combos) - 1
    for row in known_rows:
        try:
            draw = int(row.get("draw"))
        except Exception:
            continue
        combo = str(row.get("combo", ""))
        if FROM_DRAW <= draw <= to_draw and re.fullmatch(r"\d{3}", combo):
            checked += 1
            if combos[draw - FROM_DRAW] == combo:
                score += 1
    return score, checked


def main():
    raw_combos = read_combos(XLSX)
    bootstrap = sorted(expand_bootstrap(read_json(BOOTSTRAP, {})), key=lambda x: int(x.get("draw", 0)))
    dated = read_json(DATED_ARCHIVE, [])
    known_rows = [*dated, *bootstrap]
    forward = raw_combos
    reverse = list(reversed(raw_combos))
    fs, fc = orientation_score(forward, known_rows)
    rs, rc = orientation_score(reverse, known_rows)
    if rs > fs:
        combos = reverse
        orientation = "sheet-newest-to-oldest -> reversed"
        score, checked = rs, rc
    elif fs > rs:
        combos = forward
        orientation = "sheet-oldest-to-newest"
        score, checked = fs, fc
    else:
        combos = reverse
        orientation = "fallback newest-to-oldest -> reversed"
        score, checked = rs, rc
    if checked and score == 0:
        raise RuntimeError(f"Не удалось согласовать порядок XLSX с известными тиражами: checked={checked}")
    print(f"XLSX orientation: {orientation}; matched={score}/{checked}")
    base_to = FROM_DRAW + len(combos) - 1

    for row in bootstrap:
        draw = int(row["draw"])
        combo = str(row["combo"])
        if not re.fullmatch(r"\d{3}", combo):
            raise RuntimeError(f"Некорректная bootstrap-комбинация №{draw}: {combo}")
        if draw <= base_to:
            pos = draw - FROM_DRAW
            if pos < 0 or combos[pos] != combo:
                raise RuntimeError(
                    f"Контроль архива не прошёл на №{draw}: XLSX={combos[pos] if 0 <= pos < len(combos) else 'нет'}, bootstrap={combo}"
                )
            continue
        if draw != FROM_DRAW + len(combos):
            raise RuntimeError(f"Разрыв полного архива: после №{FROM_DRAW + len(combos) - 1} пришёл №{draw}")
        combos.append(combo)
        base_to = draw

    dated_by_draw = {}
    for row in [*dated, *bootstrap]:
        try:
            draw = int(row.get("draw"))
        except Exception:
            continue
        if row.get("date") and row.get("time") and re.fullmatch(r"\d{3}", str(row.get("combo", ""))):
            dated_by_draw[draw] = row

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    meta = {
        "schema": 2,
        "source": "TOP-3 full archive · repository XLSX + verified dated tail",
        "order": "oldest-to-newest",
        "fromDraw": FROM_DRAW,
        "toDraw": FROM_DRAW + len(combos) - 1,
        "total": len(combos),
        "datedFromDraw": min(dated_by_draw) if dated_by_draw else None,
        "datedToDraw": max(dated_by_draw) if dated_by_draw else None,
        "datedCount": len(dated_by_draw),
        "undatedCount": len(combos) - len(dated_by_draw),
        "data": "".join(combos),
    }
    (OUT_DIR / "all.json").write_text(json.dumps(meta, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (OUT_DIR / "unique.json").write_text(json.dumps(sorted(set(combos)), ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(
        f"FULL ARCHIVE OK: {len(combos)} combos, №{meta['fromDraw']}…№{meta['toDraw']}; "
        f"dated={meta['datedCount']}; unique={len(set(combos))}"
    )


if __name__ == "__main__":
    main()
