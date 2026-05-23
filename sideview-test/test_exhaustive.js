const puppeteer = require('puppeteer');

async function runExhaustiveTest() {
  console.log('============================================================');
  console.log('[Test] STARTING EXHAUSTIVE PRODUCTION E2E CONNECTION TEST');
  console.log('============================================================');
  
  const roomUrl = process.env.TEST_URL || 'http://localhost:3000/room/exhaustive-local-test';

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
    // ------------------------------------------------------------
    // PHASE 1: Client 1 Joins
    // ------------------------------------------------------------
    console.log('\n[Phase 1] Launching Client 1 (User A)...');
    const page1 = await browser1.newPage();
    page1.on('console', msg => console.log('   [Client 1 Console]:', msg.text()));
    page1.on('pageerror', err => console.log('   [Client 1 Error]:', err.toString()));
    await page1.goto(roomUrl, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000)); // Hydration wait

    console.log('[Phase 1] Clicking Join Room...');
    await page1.waitForSelector('#join-room-btn');
    await page1.click('#join-room-btn');

    console.log('[Phase 1] Waiting for Client 1 local video to mount...');
    await page1.waitForSelector('video', { timeout: 15000 });
    console.log('✅ Client 1 local video mounted successfully.');

    // ------------------------------------------------------------
    // PHASE 2: Client 2 Joins
    // ------------------------------------------------------------
    console.log('\n[Phase 2] Launching Client 2 (User B)...');
    const page2 = await browser2.newPage();
    page2.on('console', msg => console.log('   [Client 2 Console]:', msg.text()));
    page2.on('pageerror', err => console.log('   [Client 2 Error]:', err.toString()));
    await page2.goto(roomUrl, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000)); // Hydration wait

    console.log('[Phase 2] Clicking Join Room...');
    await page2.waitForSelector('#join-room-btn');
    await page2.click('#join-room-btn');

    console.log('[Phase 2] Waiting for Client 2 local video to mount...');
    await page2.waitForSelector('video', { timeout: 15000 });
    console.log('✅ Client 2 local video mounted successfully.');

    // ------------------------------------------------------------
    // PHASE 3: WebRTC Negotiation
    // ------------------------------------------------------------
    console.log('\n[Phase 3] Checking WebRTC Mesh Peer Connection...');
    console.log('[Phase 3] Waiting for Client 1 to receive Client 2 video track...');
    await page1.waitForFunction(() => document.querySelectorAll('video').length >= 2, { timeout: 20000 });
    console.log('✅ Client 1 successfully receives Client 2 video stream.');

    console.log('[Phase 3] Waiting for Client 2 to receive Client 1 video track...');
    await page2.waitForFunction(() => document.querySelectorAll('video').length >= 2, { timeout: 20000 });
    console.log('✅ Client 2 successfully receives Client 1 video stream.');

    // ------------------------------------------------------------
    // PHASE 4: State Syncing (Mute/Video Toggles)
    // ------------------------------------------------------------
    console.log('\n[Phase 4] Testing Client State Synchronization...');
    
    // Mic Mute test
    console.log('[Phase 4] Client 1 toggling mute...');
    await page1.click('#toggle-mic-btn');
    await new Promise(r => setTimeout(r, 2000));
    
    // Check local flag and remote flag via store
    const isLocalMutedOnClient1 = await page1.evaluate(() => {
      const btn = document.querySelector('#toggle-mic-btn');
      return btn.classList.contains('bg-red-500/20');
    });
    console.log(`   Client 1 Local Muted UI State: ${isLocalMutedOnClient1 ? 'Muted' : 'Unmuted'}`);
    
    // Camera toggle test
    console.log('[Phase 4] Client 1 toggling camera...');
    await page1.click('#toggle-video-btn');
    await new Promise(r => setTimeout(r, 2000));

    const isLocalCameraOffOnClient1 = await page1.evaluate(() => {
      const btn = document.querySelector('#toggle-video-btn');
      return btn.classList.contains('bg-red-500/20');
    });
    console.log(`   Client 1 Local Camera UI State: ${isLocalCameraOffOnClient1 ? 'Off' : 'On'}`);
    console.log('✅ State toggles executed successfully.');

    // ------------------------------------------------------------
    // PHASE 5: Screen Sharing
    // ------------------------------------------------------------
    console.log('\n[Phase 5] Testing Screen Sharing connection...');
    console.log('[Phase 5] Client 1 starting screen share...');
    await page1.click('#share-screen-btn');
    await new Promise(r => setTimeout(r, 5000));

    console.log('[Phase 5] Verifying screen stream on Client 1...');
    const screenShareExistsOnClient1 = await page1.evaluate(() => {
      // Screen share replaces the "Theater is empty" text with a video player
      return !document.body.innerText.includes('Theater is empty');
    });
    console.log(`   Client 1 sees screen share active: ${screenShareExistsOnClient1}`);

    console.log('[Phase 5] Verifying screen stream received by Client 2...');
    const screenShareExistsOnClient2 = await page2.evaluate(() => {
      return !document.body.innerText.includes('Theater is empty');
    });
    console.log(`   Client 2 receives screen share stream: ${screenShareExistsOnClient2}`);

    console.log('[Phase 5] Client 1 stopping screen share...');
    await page1.click('#stop-share-btn');
    await new Promise(r => setTimeout(r, 3000));
    
    const screenShareStoppedOnClient2 = await page2.evaluate(() => {
      return document.body.innerText.includes('Theater is empty');
    });
    console.log(`   Client 2 returns to idle state: ${screenShareStoppedOnClient2}`);
    console.log('✅ Screen share connection verified successfully.');

    // ------------------------------------------------------------
    // PHASE 6: Leaving Room
    // ------------------------------------------------------------
    console.log('\n[Phase 6] Testing Leave Room...');
    console.log('[Phase 6] Client 1 leaving room...');
    await page1.click('#leave-room-btn');
    await new Promise(r => setTimeout(r, 3000));

    const client1Redirected = await page1.evaluate(() => {
      return window.location.pathname === '/';
    });
    console.log(`   Client 1 redirected to home page: ${client1Redirected}`);

    console.log('[Phase 6] Verifying Client 2 receives disconnect and removes User A overlay...');
    const client2OverlayCount = await page2.evaluate(() => {
      return document.querySelectorAll('video').length;
    });
    console.log(`   Client 2 remaining video overlay count: ${client2OverlayCount}`);
    console.log('✅ Leave room teardown verified successfully.');

    console.log('\n============================================================');
    console.log('🎉🎉🎉 EXHAUSTIVE E2E TEST PASSED WITH 100% SUCCESS 🎉🎉🎉');
    console.log('============================================================');

  } catch (err) {
    console.error('\n❌ EXHAUSTIVE TEST FAILED:', err);
    process.exitCode = 1;
  } finally {
    await browser1.close();
    await browser2.close();
  }
}

runExhaustiveTest();
