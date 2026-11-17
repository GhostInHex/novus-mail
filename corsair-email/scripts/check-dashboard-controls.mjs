import { launchBrowser } from './browser.mjs';
import { expect } from '@playwright/test';
const browser = await launchBrowser();
try {
 for (const width of [1440,390]) {
 const page = await browser.newPage({viewport:{width,height:850},reducedMotion:'reduce'});
 await page.goto('http://localhost:3100/design-review?scenario=inbox');
 await page.getByRole('button',{name:'Ask AI',exact:true}).click();
 await expect(page.getByRole('dialog')).toBeVisible();
 const g = await page.locator('.doop-ai-panel').evaluate(panel=>{
 const scroll=panel.querySelector('.doop-chat-scroll > div');
 for(let i=0;i<20;i++){const p=document.createElement('p');p.textContent='Long conversation result';p.style.height='80px';scroll.append(p);}
 return {bottom:panel.querySelector('.doop-agent-composer').getBoundingClientRect().bottom,scrollBottom:scroll.getBoundingClientRect().bottom,top:panel.querySelector('.doop-agent-composer').getBoundingClientRect().top,scrolls:scroll.scrollHeight>scroll.clientHeight};
 });
 expect(g.bottom).toBeLessThanOrEqual(850);expect(g.scrollBottom).toBeLessThanOrEqual(g.top+1);expect(g.scrolls).toBe(true);
 await page.keyboard.press('Escape');
 const theme=page.getByRole('button',{name:/Switch to .* theme/});const before=await theme.getAttribute('aria-label');await theme.click();await expect(theme).not.toHaveAttribute('aria-label',before);
 await page.getByRole('button',{name:'Account menu'}).click();await expect(page.getByRole('menuitem',{name:'Log out'})).toBeVisible();await expect(page.getByRole('menuitem',{name:'Landing page'})).toHaveAttribute('href','/?landing=1');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 await page.close();console.log(`${width}px controls and scrolling passed`);
 }
} finally {await browser.close();}
