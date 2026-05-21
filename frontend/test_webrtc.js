const puppeteer = require('puppeteer');

async function runTest() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--disable-web-security',
      '--allow-file-access-from-files'
    ]
  });

  try {
    console.log('Opening Page 1 (User A)...');
    const page1 = await browser.newPage();
    
    // Listen for console logs from the browser
    page1.on('console', msg => {
      const text = msg.text();
      if (text.includes('[WebRTC]') || text.includes('Camera') || text.includes('error') || text.includes('Error')) {
        console.log(`[Page 1 Log]: ${text}`);
      }
    });

    await page1.goto('https://sideview-frontend-252675432928.us-central1.run.app');
    
    // Click 'Create Private Room'
    console.log('Clicking Create Private Room...');
    await page1.waitForSelector('button', { timeout: 10000 });
    
    // Find the create room button
    const buttons = await page1.$$('button');
    let createBtn;
    for (const btn of buttons) {
      const text = await page1.evaluate(el => el.textContent, btn);
      if (text.includes('Create Private')) {
        createBtn = btn;
        break;
      }
    }
    
    if (!createBtn) throw new Error('Could not find Create Private Room button');
    await createBtn.click();
    
    // Wait for navigation to room page
    await page1.waitForNavigation({ waitUntil: 'networkidle0' });
    const roomUrl = page1.url();
    console.log(`Room created! URL: ${roomUrl}`);

    // Wait for "Join Room" button
    console.log('User A clicking Join Room...');
    await page1.waitForSelector('button');
    const joinBtns1 = await page1.$$('button');
    for (const btn of joinBtns1) {
      const text = await page1.evaluate(el => el.textContent, btn);
      if (text.includes('Join Room')) {
        await btn.click();
        break;
      }
    }

    // Wait a bit for camera to start
    await new Promise(r => setTimeout(r, 3000));
    
    console.log('Opening Page 2 (User B)...');
    const page2 = await browser.newPage();
    
    page2.on('console', msg => {
      const text = msg.text();
      if (text.includes('[WebRTC]') || text.includes('Camera') || text.includes('error') || text.includes('Error')) {
        console.log(`[Page 2 Log]: ${text}`);
      }
    });

    await page2.goto(roomUrl);
    
    console.log('User B clicking Join Room...');
    await page2.waitForSelector('button', { timeout: 10000 });
    const joinBtns2 = await page2.$$('button');
    for (const btn of joinBtns2) {
      const text = await page2.evaluate(el => el.textContent, btn);
      if (text.includes('Join Room')) {
        await btn.click();
        break;
      }
    }

    // Wait for connection and video streams
    console.log('Waiting for WebRTC connection (5 seconds)...');
    await new Promise(r => setTimeout(r, 5000));

    // Check video elements on Page 1
    const page1Videos = await page1.$$eval('video', videos => {
      return videos.map(v => ({
        paused: v.paused,
        srcObject: !!v.srcObject,
        readyState: v.readyState
      }));
    });
    
    console.log(`Page 1 Video Elements: ${page1Videos.length}`);
    console.log(page1Videos);

    // Check video elements on Page 2
    const page2Videos = await page2.$$eval('video', videos => {
      return videos.map(v => ({
        paused: v.paused,
        srcObject: !!v.srcObject,
        readyState: v.readyState
      }));
    });
    
    console.log(`Page 2 Video Elements: ${page2Videos.length}`);
    console.log(page2Videos);

    if (page1Videos.length >= 2 && page2Videos.length >= 2) {
      console.log('✅ TEST PASSED! Both users connected and see each other.');
    } else {
      console.log('❌ TEST FAILED! Users did not connect properly.');
    }

  } catch (err) {
    console.error('Test script failed:', err);
  } finally {
    await browser.close();
  }
}

runTest();
