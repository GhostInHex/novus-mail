import { launchBrowser } from './browser.mjs';
import { expect } from '@playwright/test';
const browser = await launchBrowser();
try {
 for (const theme of ['light','dark']) {
  for (const scenario of ['inbox','compose','sign-in','connect','email-proposal']) {
   const page=await browser.newPage({viewport:{width:1280,height:900}});
   await page.addInitScript(theme=>localStorage.setItem('novusmail-theme',theme+'-default'),theme);
   await page.goto('http://localhost:3101/design-review?scenario='+scenario);
   await page.waitForSelector('main');
   await page.evaluate(()=>document.fonts.ready);
   const buttons=page.locator('[data-slot="button"][data-variant="default"]:visible');
   for(let i=0;i<await buttons.count();i++) {
    const style=await buttons.nth(i).evaluate(b=>({text:b.textContent,radius:getComputedStyle(b).borderRadius,bg:getComputedStyle(b).backgroundImage,before:getComputedStyle(b,'::before').content,height:b.clientHeight,scroll:b.scrollHeight}));
    expect(style.radius,`${scenario} ${style.text}`).toBe('8px');
    expect(style.bg).toBe('none');expect(style.before).toBe('none');expect(style.scroll).toBeLessThanOrEqual(style.height+1);
   }
   await expect(page.locator('html')).toHaveClass(/lenis/);
   if(scenario==='inbox') {
    const reader=page.locator('.dashboard-reader');
    await expect(reader).toHaveClass(/lenis/);
    await reader.hover();await page.mouse.wheel(0,400);
    await expect.poll(()=>reader.evaluate(e=>e.scrollTop)).toBeGreaterThan(0);
    await page.screenshot({path:`/tmp/novus-buttons-${theme}.png`});
   }
   await page.close();console.log(theme,scenario,'passed');
  }
 }
 const reduced=await browser.newPage({reducedMotion:'reduce'});
 await reduced.goto('http://localhost:3101/design-review?scenario=inbox');
 await expect(reduced.getByRole('button',{name:'Ask AI',exact:true})).toBeVisible();
 await expect(reduced.locator('html')).not.toHaveClass(/lenis/);
 await reduced.close();
}finally{await browser.close();}
