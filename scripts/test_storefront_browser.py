#!/usr/bin/env python3
"""Real Chromium smoke coverage for the existing static storefront in the PR."""
import asyncio
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    browser=await p.chromium.launch(headless=True)
    for width in (360,390,430,1440):
      page=await browser.new_page(viewport={"width":width,"height":900},device_scale_factor=1)
      errors=[]
      page.on("pageerror",lambda e:errors.append(str(e)))
      await page.goto("http://127.0.0.1:8765/",wait_until="domcontentloaded")
      await page.locator(".product").first.wait_for(timeout=15000)
      assert await page.locator(".product").count()==84, (width,"catalog count")
      overflow=await page.evaluate("document.documentElement.scrollWidth > window.innerWidth")
      assert not overflow,(width,"horizontal overflow")
      if width <= 430:
        header_position=await page.locator("header").evaluate("(e)=>getComputedStyle(e).position")
        assert header_position=="static",(width,"large header still overlays catalog")
        photo_blend=await page.locator(".product .photo img").first.evaluate("(e)=>getComputedStyle(e).mixBlendMode")
        assert photo_blend=="multiply",(width,"square photo background not blended")
        card=await page.locator(".product").first.evaluate("(e)=>({height:e.getBoundingClientRect().height,photo:e.querySelector('.photo').getBoundingClientRect().height})")
        assert card["height"]<440,(width,"excessive product card height",card)
        assert 130<=card["photo"]<=170,(width,"bad image frame height",card)
      if width <= 430:
        hidden=await page.locator(".hero-art").evaluate("(e)=>getComputedStyle(e).display==='none'")
        assert hidden,(width,"hero photos overlap mobile text")
        hero=await page.locator(".hero").bounding_box()
        primary=await page.locator(".hero .primary").bounding_box()
        secondary=await page.locator(".hero .secondary-btn").bounding_box()
        assert hero and primary and secondary,(width,"missing mobile hero controls")
        for b in (primary,secondary):
          assert b["x"]>=hero["x"]-2 and b["x"]+b["width"]<=hero["x"]+hero["width"]+2,(width,"hero button clipped")
          assert b["y"]>=hero["y"] and b["y"]+b["height"]<=hero["y"]+hero["height"]+2,(width,"hero button outside banner")
        assert await page.locator(".product").first.evaluate("(e)=>e.getBoundingClientRect().width>=140"),(width,"product card too narrow")
      await page.locator("#search").fill("כיפה")
      assert await page.locator(".product").count()>=10,(width,"Hebrew search")
      await page.locator("#search").fill("")
      await page.locator("button.add:not([disabled])").first.click()
      await page.locator("#cartBtn").click()
      assert await page.locator(".remove-item").count()==1,(width,"cart removal")
      await page.locator(".remove-item").first.click()
      assert "0" in await page.locator("#total").inner_text(),(width,"cart zero")
      await page.locator("#closeCart").click()
      await page.locator(".photo").first.click()
      assert await page.locator("#modal").evaluate("(e)=>e.classList.contains('open')"),(width,"product modal")
      await page.locator("#modalClose").click()
      assert not errors,(width,errors)
      await page.screenshot(path=f"/tmp/mercaz-qa-{width}.png",full_page=False)
      await page.close()
    await browser.close()
    print("PASS Chromium: 84 articles, RTL mobile widths, Hebrew search, cart remove, modal, no JS exceptions")
asyncio.run(main())
