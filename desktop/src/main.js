import { app, BrowserWindow, dialog, protocol, session } from 'electron';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import https from 'node:https';
import path from 'node:path';
import { startBackend } from '../../backend/server.js';

const origin = 'sfm://app';
const smokeTest = process.argv.includes('--smoke-test');
const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-src 'none'; frame-ancestors 'none'; form-action 'none'";
protocol.registerSchemesAsPrivileged([
  { scheme: 'sfm', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

let server;
let window;
let closing = false;

function isAppUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'sfm:' && url.host === 'app';
  } catch {
    return false;
  }
}

// Keep the existing explicit certificate test option in the main process.
function createHttpsAgent(serverBase, allowTestIp) {
  if (allowTestIp === true && new URL(serverBase).protocol === 'https:') {
    return new https.Agent({ rejectUnauthorized: false });
  }
  return undefined;
}

async function openWindow() {
  window = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 900,
    minHeight: 650,
    title: `SVWS Foto-Matcher ${app.getVersion()}`,
    show: false,
    autoHideMenuBar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, offscreen: smokeTest },
  });
  window.removeMenu();
  window.on('page-title-updated', (event) => event.preventDefault());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (!isAppUrl(url)) event.preventDefault();
  });
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());
  window.on('closed', () => { window = null; });
  await window.loadURL(`${origin}/`);
  if (!smokeTest) window.show();

  if (smokeTest) {
    const result = await window.webContents.executeJavaScript(`(async () => {
      const response = await fetch('/api/svws/meta/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
      });
      return {
        title: document.title,
        rendered: document.querySelector('#app').textContent.includes('Benutzername'),
        isolated: typeof window.require === 'undefined' && typeof window.process === 'undefined',
        secureContext: window.isSecureContext,
        cameraApi: typeof navigator.mediaDevices?.getUserMedia === 'function',
        apiStatus: response.status,
        apiResponse: await response.json()
      };
    })()`);
    result.windowTitle = window.getTitle();
    const output = path.join(app.getPath('temp'), 'svws-photo-matcher-smoke');
    await fs.mkdir(output, { recursive: true });
    await fs.writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 2));
    await fs.writeFile(path.join(output, 'window.png'), (await window.webContents.capturePage()).toPNG());
    if (!result.rendered || !result.isolated || !result.secureContext || !result.cameraApi || result.apiStatus !== 400 || result.windowTitle !== `SVWS Foto-Matcher ${app.getVersion()}`) {
      throw new Error('Desktop-Smoke-Test fehlgeschlagen');
    }
    app.quit();
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (window) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); }
  });
  app.whenReady().then(async () => {
    app.setAppUserModelId('de.jwae.svws-photo-matcher');
    const token = randomBytes(32).toString('hex');
    server = await startBackend({ accessToken: token, createHttpsAgent });
    const backendOrigin = `http://127.0.0.1:${server.address().port}`;
    protocol.handle('sfm', async (request) => {
      if (!isAppUrl(request.url)) return new Response('Forbidden', { status: 403 });
      const url = new URL(request.url);
      const headers = new Headers(request.headers);
      headers.set('x-sfm-desktop-token', token);
      const response = await fetch(`${backendOrigin}${url.pathname}${url.search}`, {
        method: request.method,
        headers,
        body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer(),
        redirect: 'error',
      });
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set('Content-Security-Policy', csp);
      responseHeaders.set('X-Content-Type-Options', 'nosniff');
      return new Response(response.body, { status: response.status, headers: responseHeaders });
    });
    session.defaultSession.setPermissionCheckHandler((contents, permission, requestingOrigin, details) =>
      contents === window?.webContents && permission === 'media' && isAppUrl(requestingOrigin) && details.mediaType === 'video');
    session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => {
      callback(contents === window?.webContents && permission === 'media' &&
        isAppUrl(details.requestingUrl) && details.mediaTypes?.length > 0 &&
        details.mediaTypes.every((type) => type === 'video'));
    });
    await openWindow();
    app.on('activate', () => { if (!window) openWindow().catch(reportError); });
  }).catch(reportError);
}

function reportError(error) {
  if (smokeTest) {
    console.error(error);
    app.exit(1);
  } else {
    dialog.showErrorBox('SVWS Foto-Matcher konnte nicht starten', error.message);
    app.quit();
  }
}

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', (event) => {
  if (!server || closing) return;
  event.preventDefault();
  closing = true;
  server.close(() => app.quit());
  server.closeAllConnections();
});
