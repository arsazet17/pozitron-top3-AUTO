#!/usr/bin/env python3
import asyncio
import json
import os
import re
import sys
from datetime import datetime, date, timezone, timedelta
from pathlib import Path

from playwright.async_api import async_playwright

LOGIN_URL = "https://oauth.stoloto.ru/login"
ARCHIVE_URL = "https://m.stoloto.ru/top3/archive/"
OUT = Path("/tmp/top3_official_tail.json")
TAIL_SIZE = 20
PAGE_READ_ATTEMPTS = 3
SCHEDULE = ["02:40","04:40","06:40","07:40","09:40","11:40","13:40","16:25","21:25","22:40"]
SCHEDULE_SET = set(SCHEDULE)
MONTHS = {
    "января":1,"февраля":2,"марта":3,"апреля":4,"мая":5,"июня":6,
    "июля":7,"августа":8,"сентября":9,"октября":10,"ноября":11,"декабря":12
}

def norm(s):
    return re.sub(r"[ \t]+", " ", str(s or "").replace("\xa0", " ")).strip()

def moscow_today():
    return (datetime.now(timezone.utc) + timedelta(hours=3)).date()

def parse_date_label(label):
    raw = norm(label).lower()
    today = moscow_today()
    if raw == "сегодня":
        d = today
    elif raw == "вчера":
        d = today - timedelta(days=1)
    else:
        m = re.fullmatch(r"(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})", raw)
        if m:
            y = int(m.group(3))
            y = y + 2000 if y < 100 else y
            d = date(y, int(m.group(2)), int(m.group(1)))
        else:
            m = re.fullmatch(r"(\d{1,2})\s+([а-яё]+)(?:\s+(\d{4}))?", raw)
            if not m or m.group(2) not in MONTHS:
                return None
            y = int(m.group(3)) if m.group(3) else today.year
            mm = MONTHS[m.group(2)]
            if not m.group(3) and mm > today.month + 6:
                y -= 1
            d = date(y, mm, int(m.group(1)))
    return d.strftime("%Y-%m-%d")

def parse_time(text):
    for m in re.finditer(r"\b([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?\b", str(text or "")):
        tm = f"{int(m.group(1)):02d}:{m.group(2)}"
        if tm in SCHEDULE_SET:
            return tm
    return None

def parse_draw(text):
    m = re.search(r"№\s*([0-9]{4,})", str(text or ""))
    return int(m.group(1)) if m else None

def parse_combo(text):
    s = norm(text)
    s = re.sub(r"№\s*[0-9]{4,}", " ", s)
    s = re.sub(r"\b(?:[01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?\b", " ", s)
    digits = re.findall(r"(?<!\d)([0-9])(?!\d)", s)
    if len(digits) >= 3:
        return "".join(digits[:3])
    m = re.search(r"(?<!\d)(\d{3})(?!\d)", s)
    return m.group(1) if m else None

def row_to_record(text, date_label):
    draw = parse_draw(text)
    tm = parse_time(text)
    combo = parse_combo(text)
    ds = parse_date_label(date_label) if date_label else None
    if draw and tm and combo and ds:
        return {"draw": draw, "date": ds, "time": tm, "combo": combo}
    return None

async def login(page, email, password):
    await page.goto(LOGIN_URL, wait_until="domcontentloaded", timeout=60000)
    login_loc = None
    pass_loc = None
    for sel in [
        'input[type="email"]','input[name*="email" i]','input[name*="login" i]',
        'input[autocomplete="username"]','input[type="text"]'
    ]:
        loc = page.locator(sel).first
        if await loc.count():
            login_loc = loc
            break
    for sel in [
        'input[type="password"]','input[name*="password" i]',
        'input[autocomplete="current-password"]'
    ]:
        loc = page.locator(sel).first
        if await loc.count():
            pass_loc = loc
            break
    if login_loc is None or pass_loc is None:
        raise RuntimeError(f"OAuth fields not found; url={page.url}")
    await login_loc.fill(email)
    await pass_loc.fill(password)
    clicked = False
    for btn in [
        page.get_by_role("button", name=re.compile("войти", re.I)).first,
        page.locator('button[type="submit"]').first,
        page.locator('input[type="submit"]').first
    ]:
        if await btn.count():
            await btn.click()
            clicked = True
            break
    if not clicked:
        raise RuntimeError("OAuth submit button not found")
    try:
        await page.wait_for_load_state("domcontentloaded", timeout=20000)
    except Exception:
        pass
    await page.wait_for_timeout(2500)
    if "oauth.stoloto.ru/login" in page.url:
        pw = page.locator('input[type="password"]').first
        if await pw.count():
            raise RuntimeError("Stoloto OAuth login did not complete")

async def primary_dom_collect(page):
    raw = await page.locator("body").evaluate(r'''() => {
      const drawRx=/№\s*\d{4,}/;
      const dateRx=/^(Сегодня|Вчера|\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}|\d{1,2}\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?:\s+\d{4})?)$/i;
      const norm=s=>String(s||'').replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').trim();
      const all=[...document.querySelectorAll('body *')];
      function nearestDate(el){
        let best=null;
        for(const node of all){
          if(node===el || el.contains(node)) continue;
          const pos=node.compareDocumentPosition(el);
          if(!(pos & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
          const t=norm(node.innerText || node.textContent || '');
          if(!t || t.length>40 || !dateRx.test(t)) continue;
          if(node.children && node.children.length>3) continue;
          best=t;
        }
        return best;
      }
      let rows=[...document.querySelectorAll('tr')].filter(el=>drawRx.test(el.innerText||''));
      if(!rows.length){
        rows=all.filter(el=>{
          const t=norm(el.innerText||'');
          if(!drawRx.test(t)) return false;
          return ![...el.children].some(ch=>drawRx.test(norm(ch.innerText||'')));
        });
      }
      return rows.map(el=>({
        text: el.innerText || el.textContent || '',
        dateLabel: nearestDate(el),
        leafTexts: [...el.querySelectorAll('*')]
          .filter(n=>n.children.length===0)
          .map(n=>norm(n.innerText||n.textContent||''))
          .filter(Boolean)
      }));
    }''')
    out = []
    carry = None
    for row in raw:
        text = str(row.get("text", ""))
        label = norm(row.get("dateLabel", ""))
        if label:
            carry = label
        rec = row_to_record(text, label or carry)
        if not rec:
            leaf = " ".join(str(x) for x in row.get("leafTexts", []))
            rec = row_to_record(leaf, label or carry)
        if rec:
            out.append(rec)
    uniq = {x["draw"]: x for x in out}
    return sorted(uniq.values(), key=lambda x: x["draw"])

def fallback_text_collect(body_text):
    lines = [norm(x) for x in str(body_text or "").splitlines()]
    lines = [x for x in lines if x]
    date_rx = re.compile(
        r"^(Сегодня|Вчера|\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|"
        r"\d{1,2}\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|"
        r"сентября|октября|ноября|декабря)(?:\s+\d{4})?)$", re.I
    )
    out = []
    current_date = None
    for i, line in enumerate(lines):
        if date_rx.fullmatch(line):
            current_date = line
        if not re.search(r"№\s*\d{4,}", line):
            continue
        if current_date is None:
            for j in range(max(0, i-8), i):
                if date_rx.fullmatch(lines[j]):
                    current_date = lines[j]
        chunk = " ".join(lines[i:min(len(lines), i+12)])
        rec = row_to_record(chunk, current_date)
        if rec:
            out.append(rec)
    uniq = {x["draw"]: x for x in out}
    return sorted(uniq.values(), key=lambda x: x["draw"])

async def collect_once(page, attempt):
    try:
        await page.goto(ARCHIVE_URL, wait_until="domcontentloaded", timeout=60000)
    except Exception as e:
        print(f"WARN archive goto {attempt}: {e}", file=sys.stderr)
    try:
        await page.wait_for_load_state("networkidle", timeout=12000)
    except Exception:
        pass
    await page.wait_for_timeout(2000 + attempt * 600)
    primary = await primary_dom_collect(page)
    try:
        body = await page.locator("body").inner_text(timeout=10000)
    except Exception:
        body = ""
    fallback = fallback_text_collect(body)
    merged = {x["draw"]: x for x in primary}
    for x in fallback:
        merged.setdefault(x["draw"], x)
    out = sorted(merged.values(), key=lambda x: x["draw"])
    try:
        title = await page.title()
    except Exception:
        title = ""
    print(f"TOP-3 page {attempt}/{PAGE_READ_ATTEMPTS}: url={page.url} primary={len(primary)} fallback={len(fallback)} merged={len(out)} title={title!r}")
    if len(out) < 3:
        print("BODY HEAD:", norm(body)[:900], file=sys.stderr)
    return out

async def stable_tail(page):
    best = []
    for attempt in range(1, PAGE_READ_ATTEMPTS + 1):
        rows = await collect_once(page, attempt)
        if len(rows) > len(best):
            best = rows
        if len(rows) >= 3:
            await page.wait_for_timeout(900)
            rows2 = await collect_once(page, attempt)
            a = {x["draw"]: x for x in rows}
            b = {x["draw"]: x for x in rows2}
            common = sorted(set(a) & set(b))
            stable = [a[n] for n in common if a[n] == b[n]]
            if len(stable) >= 3:
                return stable[-TAIL_SIZE:]
        try:
            await page.reload(wait_until="domcontentloaded", timeout=60000)
        except Exception:
            pass
    raise RuntimeError(f"Only {len(best)} TOP-3 rows found after retries")

async def main():
    email = os.getenv("STOLOTO_EMAIL", "").strip()
    password = os.getenv("STOLOTO_PASSWORD", "").strip()
    if not email or not password:
        raise RuntimeError("Set STOLOTO_EMAIL and STOLOTO_PASSWORD secrets")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            ctx = await browser.new_context(locale="ru-RU", timezone_id="Europe/Moscow", viewport={"width":390,"height":844})
            page = await ctx.new_page()
            await login(page, email, password)
            tail = await stable_tail(page)
        finally:
            await browser.close()
    if not tail:
        raise RuntimeError("Authorized TOP-3 tail is empty")
    OUT.write_text(json.dumps(tail, ensure_ascii=False, indent=2), encoding="utf-8")
    last = tail[-1]
    print(f"AUTHORIZED TOP-3 OK: {len(tail)} rows; latest №{last['draw']} {last['date']} {last['time']}={last['combo']}")

def self_test():
    cases = [
        ("№ 267710 02:40 7 8 6", "04.09.2026", "786"),
        ("Тираж №267711 04:40 числа 0 2 8 суперприз 5 000 000", "4 сентября 2026", "028"),
        ("№267712 06:40 999", "Сегодня", "999"),
    ]
    for text, ds, expected in cases:
        got = row_to_record(text, ds)
        assert got is not None, (text, ds)
        assert got["combo"] == expected, (got, expected)
    print("SELF-TEST OK")

if __name__ == "__main__":
    if "--self-test" in sys.argv:
        self_test()
    else:
        asyncio.run(main())
