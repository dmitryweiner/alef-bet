// Browser smoke of the real app: the start page, a question answered in each
// game, no horizontal scroll on a phone, no console errors. With --preview it
// runs against a fresh production build and also checks that the service
// worker makes the app work offline and that a new deploy reaches a page
// that is already open (phones suspend pages, never close them).
//
//   npm run smoke               # dev server
//   npm run smoke -- --preview  # production build + offline and update checks
//   npm run smoke -- --shots    # also saves shots/<viewport>-<mode>.png
//
// Prints one line per step; exits 1 on the first failed step or on any
// console error. New checks are new steps here, not new scripts.

import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { check, launch, parseArgs, VIEWPORTS } from './lib/harness.mjs';

const flags = parseArgs(process.argv.slice(2));
const preview = flags.has('preview');
const shots = flags.has('shots');
const app = await launch({ preview });
const MODES = ['#alphabet', '#nikud', '#pairs', '#guess', '#type', '#read'];

async function step(name, fn) {
  app.label(name);
  await fn();
  console.log(`ok  ${name}`);
}

try {
  await step('the start page is the alphabet, a card opens its details', async () => {
    const { page, context } = await app.open();
    check((await page.locator('[data-view].active').getAttribute('data-view')) === 'alphabet', 'the start page is not the alphabet');
    check((await page.locator('.letter-card').count()) >= 22, 'the alphabet has fewer than 22 cards');
    await page.locator('.letter-card').first().click();
    check(await page.locator('.detail').isVisible(), 'a card did not open its details');
    await context.close();
  });

  for (const hash of ['#guess', '#pairs', '#read']) {
    await step(`a question in ${hash} can be answered`, async () => {
      const { page, context } = await app.open({ hash });
      await page.locator('[data-answer]').first().click();
      check(await page.locator('.feedback').isVisible(), 'no feedback after an answer');
      await context.close();
    });
  }

  await step('a typed name in #type gets feedback', async () => {
    const { page, context } = await app.open({ hash: '#type' });
    await page.locator('#letter-name').fill('алеф');
    await page.locator('#letter-name').press('Enter');
    check(await page.locator('.feedback').isVisible(), 'no feedback after a typed answer');
    await context.close();
  });

  if (shots) mkdirSync('shots', { recursive: true });
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    await step(`no horizontal scroll on ${name} (${viewport.width}px) in every mode`, async () => {
      const { page, context } = await app.open({ viewport });
      for (const hash of MODES) {
        await page.evaluate((h) => (location.hash = h), hash);
        await page.locator(`[href="${hash}"].active`).waitFor();
        const width = await page.evaluate(() => document.documentElement.scrollWidth);
        check(width <= viewport.width, `${hash} is ${width}px wide`);
        if (shots) await page.screenshot({ path: `shots/${name}-${hash.slice(1)}.png`, fullPage: true });
      }
      await context.close();
    });
  }

  if (preview) {
    await step('works offline after the first visit', async () => {
      const { page, context } = await app.open({ hash: '#guess' });
      await page.evaluate(() => navigator.serviceWorker.ready);
      await context.setOffline(true);
      await page.reload();
      await page.locator('[data-answer]').first().click();
      check(await page.locator('.feedback').isVisible(), 'the game does not run offline');
      await context.close();
    });

    await step('a new deploy reaches an already open page', async () => {
      const { page, context } = await app.open();
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.evaluate(() => (window.oldPage = true));
      // A changed sw.js is what a deploy looks like to the browser.
      const worker = 'dist/sw.js';
      const original = readFileSync(worker, 'utf8');
      appendFileSync(worker, `\n// deploy ${Date.now()}\n`);
      try {
        const reloaded = page.waitForEvent('load', { timeout: 10_000 }).catch(() => null);
        // What a phone does when the user returns to a suspended page.
        await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
        check((await reloaded) !== null, 'the open page never switched to the new version');
        check((await page.evaluate(() => window.oldPage)) === undefined, 'the page was not reloaded');
      } finally {
        writeFileSync(worker, original);
      }
      await context.close();
    });
  }

  check(app.errors.length === 0, `console errors:\n${app.errors.join('\n')}`);
  console.log(`smoke passed (${preview ? 'preview' : 'dev'})`);
} catch (error) {
  console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await app.close();
}
