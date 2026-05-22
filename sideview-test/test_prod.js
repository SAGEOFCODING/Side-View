const puppeteer = require('puppeteer');

async function runTest() {
  console.log('[Test] Starting End-to-End WebRTC Test on Production URL');
  const roomUrl = 'https://sideview.vercel.app/room/test-production-check';

  const browserOptions = {
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--mute-audio',
      '--no-sandbox',
    ],
  };

  const browser1 = await puppeteer.launch(browserOptions);
  const browser2 = await puppeteer.launch(browserOptions);

  try {
    console.log('[Test] Launching Client 1');
    const page1 = await browser1.newPage();
    page1.on('console', msg => console.log('PAGE 1 LOG:', msg.text()));
    page1.on('pageerror', err => console.log('PAGE 1 ERROR:', err.toString()));
    await page1.goto(roomUrl, { waitUntil: 'networkidle2' });
    
    // Additional wait for hydration
    await new Promise(r => setTimeout(r, 2000));

    // Click Join Room button
    await page1.waitForSelector('button');
    await page1.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Join Room'));
      if (btn) btn.click();
    });

    // Wait for Client 1 to establish its own local video
    console.log('[Test] Client 1 joined. Waiting for local video to mount...');
    await page1.waitForSelector('video', { timeout: 15000 });
    console.log('[Test] Client 1 local video mounted successfully.');

    console.log('[Test] Launching Client 2');
    const page2 = await browser2.newPage();
    page2.on('console', msg => console.log('PAGE 2 LOG:', msg.text()));
    page2.on('pageerror', err => console.log('PAGE 2 ERROR:', err.toString()));
    await page2.goto(roomUrl, { waitUntil: 'networkidle2' });
    
    // Additional wait for hydration
    await new Promise(r => setTimeout(r, 2000));

    // Click Join Room button for Client 2
    await page2.waitForSelector('button');
    await page2.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Join Room'));
      if (btn) btn.click();
    });

    console.log('[Test] Client 2 joined. Waiting for WebRTC negotiation...');
    
    console.log('[Test] Asserting Client 1 receives Client 2 video track...');
    await page1.waitForFunction(() => document.querySelectorAll('video').length >= 2, { timeout: 30000 });
    console.log('✅ PASS: Client 1 successfully received remote WebRTC video stream.');

    console.log('[Test] Asserting Client 2 receives Client 1 video track...');
    await page2.waitForFunction(() => document.querySelectorAll('video').length >= 2, { timeout: 30000 });
    console.log('✅ PASS: Client 2 successfully received remote WebRTC video stream.');

    console.log('\n✅✅✅ TEST COMPLETED SUCCESSFULLY! Production URLs are working perfectly.');

  } catch (err) {
    console.error('❌ TEST FAILED:', err);
    process.exitCode = 1;
  } finally {
    await browser1.close();
    await browser2.close();
  }
}

runTest();
