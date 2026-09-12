#!/usr/bin/env python3
import asyncio
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from playwright.async_api import async_playwright

LOGIN_URL = "https://oauth.stoloto.ru/login"
LANDING_PAGE = "https://m.stoloto.ru/top3/archive/"
INFO_API = "https://m.stoloto.ru/p/api/mobile/api/v35/service/games/info-new"
CURRENT_GAME = "top-3"
OUT = Path("/tmp/top3_official_tail.json")
ARCHIVE_FILE = Path("data/archive.json")
TAIL_SIZE = 60
SCHEDULE = [f"{hour:02d}:{minute:02d}" for hour in range(24) for minute in (25, 55)]
SCHEDULE_SET = set(SCHEDULE)
MOSCOW = ZoneInfo("Europe/Moscow")

# Одноразовый мост на смене продукта `top3` -> активный `top-3`.
# После попадания этих фактов в data/archive.json они больше не используются.
TRANSITION_BRIDGE = {
    267960: {"draw": 267960, "date": "2026-09-12", "time": "19:55", "combo": "178"},
    267961: {"draw": 267961, "date": "2026-09-12", "time": "20:25", "combo": "038"},
}


def valid_row(row):
    return (
        isinstance(row, dict)
        and isinstance(row.get("draw"), int)
        and row["draw"] >= 100000
        and re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(row.get("date", "")))
        and row.get("time") in SCHEDULE_SET
        and re.fullmatch(r"\d{3}", str(row.get("combo", "")))
    )


def parse_epoch_moscow(value):
    try:
        seconds = float(value)
    except Exception:
        return None
    if seconds > 10_000_000_000:
        seconds /= 1000.0
    dt = datetime.fromtimestamp(seconds, tz=timezone.utc).astimezone(MOSCOW)
    return {"date": dt.strftime("%Y-%m-%d"), "time": dt.strftime("%H:%M")}


def combo_from(raw):
    if not isinstance(raw, dict):
        return None
    c = raw.get("combination")
    nums = None
    if isinstance(c, dict):
        nums = c.get("structured") or c.get("serialized")
    if nums is None:
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


def completed_to_row(raw):
    if not isinstance(raw, dict):
        return None
    dt, combo = parse_epoch_moscow(raw.get("date")), combo_from(raw)
    try:
        draw = int(raw.get("number"))
    except Exception:
        return None
    row = {"draw": draw, "date": dt["date"], "time": dt["time"], "combo": combo} if dt and combo else None
    return row if valid_row(row) else None


def load_local_rows():
    data = json.loads(ARCHIVE_FILE.read_text(encoding="utf-8"))
    out = []
    for x in data if isinstance(data, list) else []:
        try:
            row = {
                "draw": int(x.get("draw")),
                "date": str(x.get("date")),
                "time": str(x.get("time")),
                "combo": str(x.get("combo")),
            }
        except Exception:
            continue
        if valid_row(row):
            out.append(row)
    out.sort(key=lambda x: x["draw"])
    if not out:
        raise RuntimeError("Local TOP-3 archive has no valid numbered rows")
    return out


async def login(page, email, password):
    await page.goto(LOGIN_URL, wait_until="domcontentloaded", timeout=60000)
    user = password_box = None
    for sel in (
        'input[type="email"]', 'input[name*="email" i]', 'input[name*="login" i]',
        'input[autocomplete="username"]', 'input[type="text"]',
    ):
        loc = page.locator(sel).first
        if await loc.count():
            user = loc
            break
    for sel in ('input[type="password"]', 'input[name*="password" i]', 'input[autocomplete="current-password"]'):
        loc = page.locator(sel).first
        if await loc.count():
            password_box = loc
            break
    if user is None or password_box is None:
        raise RuntimeError(f"OAuth fields not found; url={page.url}")
    await user.fill(email)
    await password_box.fill(password)
    btn = page.get_by_role("button", name=re.compile("войти", re.I)).first
    if not await btn.count():
        btn = page.locator('button[type="submit"]').first
    if not await btn.count():
        raise RuntimeError("OAuth submit button not found")
    await btn.click()
    try:
        await page.wait_for_load_state("domcontentloaded", timeout=20000)
    except Exception:
        pass
    await page.wait_for_timeout(1800)
    if "oauth.stoloto.ru/login" in page.url and await page.locator('input[type="password"]').count():
        raise RuntimeError("Stoloto OAuth login did not complete")


async def browser_json(page, url):
    result = await page.evaluate(
        """async (url) => {
          try {
            const r = await fetch(url, {method:'GET', credentials:'include'});
            const text = await r.text();
            return {ok:r.ok,status:r.status,url:r.url,text};
          } catch (e) {
            return {ok:false,status:0,url:String(url),text:'',error:String(e)};
          }
        }""",
        url,
    )
    if not result.get("ok"):
        raise RuntimeError(f"Browser API HTTP {result.get('status')}: {result.get('url')} {result.get('error','')}")
    try:
        return json.loads(result.get("text") or "")
    except Exception as exc:
        raise RuntimeError(f"Browser API returned non-JSON: {exc}")


async def fetch_info_latest(page):
    payload = await browser_json(page, INFO_API)
    games = payload.get("games") if isinstance(payload, dict) else None
    if not isinstance(games, list):
        raise RuntimeError("games/info-new: field games is missing")
    game = next((x for x in games if isinstance(x, dict) and x.get("name") == CURRENT_GAME), None)
    if not game or game.get("active") is not True:
        raise RuntimeError("Active TOP-3 object `top-3` not found in games/info-new")
    row = completed_to_row(game.get("completedDraw"))
    if not row:
        raise RuntimeError("games/info-new did not return a valid current TOP-3 completedDraw")
    return row


def build_tail(local_rows, official_latest):
    local_no = local_rows[-1]["draw"]
    if official_latest["draw"] < local_no:
        raise RuntimeError(f"Active feed behind local archive: LOCAL №{local_no}, API №{official_latest['draw']}")

    merged = {r["draw"]: r for r in local_rows}
    if official_latest["draw"] > local_no:
        for n in range(local_no + 1, official_latest["draw"] + 1):
            row = official_latest if n == official_latest["draw"] else TRANSITION_BRIDGE.get(n)
            if not row:
                raise RuntimeError(
                    f"Missed №{n}; active info-new exposes only the latest completed draw. "
                    "Nothing written: verified bridge/detail source required."
                )
            merged[n] = row

    # Старый датированный архив исторически содержит ранние пропуски, поэтому
    # непрерывность проверяем только на рабочем хвосте, который отдаём update.mjs.
    rows = [merged[n] for n in sorted(merged)]
    tail = rows[-TAIL_SIZE:]
    if len(tail) < 3:
        raise RuntimeError(f"Only {len(tail)} valid rows available")
    for i in range(1, len(tail)):
        if tail[i]["draw"] != tail[i-1]["draw"] + 1:
            raise RuntimeError(f"Non-contiguous live tail near №{tail[i-1]['draw']} -> №{tail[i]['draw']}")
    return tail


async def main():
    email = os.getenv("STOLOTO_EMAIL", "").strip()
    password = os.getenv("STOLOTO_PASSWORD", "").strip()
    if not email or not password:
        raise RuntimeError("Set STOLOTO_EMAIL and STOLOTO_PASSWORD secrets")

    local_rows = load_local_rows()
    local_no = local_rows[-1]["draw"]
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            ctx = await browser.new_context(locale="ru-RU", timezone_id="Europe/Moscow", viewport={"width":1280,"height":900})
            page = await ctx.new_page()
            await login(page, email, password)
            await page.goto(LANDING_PAGE, wait_until="domcontentloaded", timeout=60000)
            await page.wait_for_timeout(900)
            official_latest = await fetch_info_latest(page)
        finally:
            await browser.close()

    tail = build_tail(local_rows, official_latest)
    OUT.write_text(json.dumps(tail, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        f"OFFICIAL ACTIVE TOP-3 OK: latest №{official_latest['draw']} "
        f"{official_latest['date']} {official_latest['time']}={official_latest['combo']}; local №{local_no}; tail={len(tail)}"
    )


def self_test():
    assert CURRENT_GAME == "top-3"
    assert len(SCHEDULE) == 48 and SCHEDULE[0] == "00:25" and SCHEDULE[-1] == "23:55"
    assert TRANSITION_BRIDGE[267960]["combo"] == "178"
    assert TRANSITION_BRIDGE[267961]["combo"] == "038"
    assert combo_from({"combination":{"structured":[0,3,8,1,2,7,3,0,3,9,4,9]}}) == "038"
    print("SELF-TEST OK · active game=top-3 · incremental info-new sync · :25/:55")


if __name__ == "__main__":
    if "--self-test" in sys.argv:
        self_test()
    else:
        asyncio.run(main())
