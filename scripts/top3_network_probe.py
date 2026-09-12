#!/usr/bin/env python3
import asyncio, os, re
from playwright.async_api import async_playwright

LOGIN_URL="https://oauth.stoloto.ru/login"
ARCHIVE_URL="https://m.stoloto.ru/top3/archive/"

async def login(page,email,password):
    await page.goto(LOGIN_URL,wait_until="domcontentloaded",timeout=60000)
    user=None; pw=None
    for sel in ('input[type="email"]','input[name*="email" i]','input[name*="login" i]','input[autocomplete="username"]','input[type="text"]'):
        x=page.locator(sel).first
        if await x.count(): user=x; break
    for sel in ('input[type="password"]','input[name*="password" i]','input[autocomplete="current-password"]'):
        x=page.locator(sel).first
        if await x.count(): pw=x; break
    if user is None or pw is None: raise RuntimeError("login fields missing")
    await user.fill(email); await pw.fill(password)
    btn=page.get_by_role("button",name=re.compile("войти",re.I)).first
    if not await btn.count(): btn=page.locator('button[type="submit"]').first
    await btn.click(); await page.wait_for_timeout(2500)

async def main():
    email=os.getenv("STOLOTO_EMAIL","").strip(); password=os.getenv("STOLOTO_PASSWORD","").strip()
    if not email or not password: raise RuntimeError("missing secrets")
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True)
        ctx=await browser.new_context(locale="ru-RU",timezone_id="Europe/Moscow",viewport={"width":1280,"height":900})
        page=await ctx.new_page(); tasks=[]
        async def inspect(resp):
            u=resp.url.lower()
            if any(k in u for k in ("api","archive","draw","top3","service","game")) and "stoloto" in u:
                try:
                    ct=(await resp.all_headers()).get("content-type","")
                    print(f"NET {resp.status} {ct} {resp.url}")
                    if "json" in ct and resp.status==200:
                        text=await resp.text()
                        print("JSON",text[:1200].replace("\n"," "))
                except Exception as e: print("NETERR",resp.url,e)
        page.on("response",lambda r: tasks.append(asyncio.create_task(inspect(r))))
        await login(page,email,password)
        print("LOGIN_URL_AFTER",page.url)
        await page.goto(ARCHIVE_URL,wait_until="domcontentloaded",timeout=60000)
        await page.wait_for_timeout(10000)
        body=await page.locator("body").inner_text(timeout=10000)
        print("PAGE_URL",page.url)
        print("BODY_HEAD",body[:2500].replace("\n"," | "))
        nums=sorted(set(re.findall(r"267\d{3}",body)))
        print("DRAW_NUMBERS_IN_BODY",nums[-30:])
        resources=await page.evaluate("performance.getEntriesByType('resource').map(x=>x.name)")
        print("RESOURCE_MATCHES")
        for u in resources:
            lo=u.lower()
            if "stoloto" in lo and any(k in lo for k in ("api","archive","draw","top3","service","game")):
                print(u)
        if tasks: await asyncio.gather(*tasks,return_exceptions=True)
        await browser.close()

asyncio.run(main())
