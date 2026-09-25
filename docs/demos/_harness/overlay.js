(() => {
  if (window.__demoOverlayReady) return;
  const root = document.documentElement || document.body;
  if (!root) return;

  window.__demoOverlayReady = true;

  const style = document.createElement('style');
  style.textContent = `
    #app-splash { display: none !important; }
    .demo-ios-status {
      position: fixed; inset: 0 0 auto 0; height: 54px; z-index: 2147483000;
      display: flex; align-items: flex-end; justify-content: space-between;
      padding: 0 28px 8px; font-size: 15px; font-weight: 600; color: #fff;
      font-family: -apple-system, Inter, system-ui, sans-serif;
      pointer-events: none;
    }
    .demo-island {
      position: fixed; top: 11px; left: 50%; transform: translateX(-50%);
      width: 126px; height: 37px; background: #000; border-radius: 20px;
      z-index: 2147483001; pointer-events: none;
    }
    .demo-status-right { display: flex; gap: 6px; align-items: center; }
    .demo-callout {
      position: fixed; left: 16px; right: 16px; z-index: 2147483010;
      display: flex; justify-content: center; pointer-events: none;
      opacity: 0; transform: translateY(-6px);
      transition: opacity .35s ease, transform .35s ease;
      bottom: 104px; top: auto;
    }
    .demo-callout.cam { top: 112px; bottom: auto; }
    .native-capture-modal [aria-label^="Recording,"] {
      top: 62px !important;
    }
    .demo-callout.show { opacity: 1; transform: none; }
    .demo-callout span {
      background: rgba(11,7,17,.82);
      border: 1px solid rgba(255,46,136,.45);
      color: #fff;
      font-size: 12px; font-weight: 650; letter-spacing: .01em;
      padding: 7px 12px; border-radius: 999px;
      backdrop-filter: blur(16px);
      box-shadow: 0 8px 24px rgba(255,46,136,.22);
      text-align: center; max-width: 340px;
    }
    .demo-finger {
      position: fixed; width: 44px; height: 44px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,.9);
      background: rgba(255,255,255,.28);
      box-shadow: 0 8px 20px rgba(0,0,0,.35);
      z-index: 2147483020; pointer-events: none;
      opacity: 0; transform: translate(-50%, -50%) scale(.6);
      transition: opacity .18s ease, transform .18s ease, left .28s ease, top .28s ease;
      left: 0; top: 0;
    }
    .demo-finger.show { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    .demo-finger.down { transform: translate(-50%, -50%) scale(.78); background: rgba(255,255,255,.45); }
  `;
  root.appendChild(style);

  const island = document.createElement('div');
  island.className = 'demo-island';
  root.appendChild(island);

  const status = document.createElement('div');
  status.className = 'demo-ios-status';
  status.innerHTML = `
    <span>9:41</span>
    <div class="demo-status-right">
      <svg width="17" height="12" viewBox="0 0 17 12" fill="currentColor"><rect x="0" y="7" width="3" height="5" rx=".5"/><rect x="4.5" y="5" width="3" height="7" rx=".5"/><rect x="9" y="2.5" width="3" height="9.5" rx=".5"/><rect x="13.5" y="0" width="3" height="12" rx=".5"/></svg>
      <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor"><path d="M8 9.2a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2Zm0-3.4c1.7 0 3.3.7 4.5 1.8l-1.1 1.1A4.6 4.6 0 0 0 8 6.8c-1.2 0-2.4.5-3.3 1.3L3.6 7C4.8 5.9 6.4 5.2 8 5.2Zm0-3.5c2.7 0 5.2 1.1 7 2.9L13.9 5.7A8.3 8.3 0 0 0 8 3.3c-2.2 0-4.3.9-5.9 2.4L.9 4.6A10.7 10.7 0 0 1 8 1.7Z"/></svg>
      <svg width="25" height="12" viewBox="0 0 25 12" fill="currentColor"><rect x="0" y="1" width="21" height="10" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="2" y="3" width="16" height="6" rx="1"/><rect x="22" y="4" width="2" height="4" rx="1"/></svg>
    </div>
  `;
  root.appendChild(status);

  const callout = document.createElement('div');
  callout.className = 'demo-callout';
  callout.innerHTML = '<span></span>';
  root.appendChild(callout);

  const finger = document.createElement('div');
  finger.className = 'demo-finger';
  root.appendChild(finger);

  const camOpen = () => Boolean(document.querySelector('.native-capture-modal'));

  window.__demoCallout = (text) => {
    callout.classList.toggle('cam', camOpen());
    if (!text) {
      callout.classList.remove('show');
      return;
    }
    callout.querySelector('span').textContent = text;
    callout.classList.add('show');
  };

  window.__demoFingerShow = (x, y) => {
    finger.style.left = `${x}px`;
    finger.style.top = `${y}px`;
    finger.classList.add('show');
    finger.classList.remove('down');
  };
  window.__demoFingerDown = () => finger.classList.add('down');
  window.__demoFingerUp = () => finger.classList.remove('down');
  window.__demoFingerHide = () => {
    finger.classList.remove('show', 'down');
  };

  document.getElementById('app-splash')?.remove();
})();
