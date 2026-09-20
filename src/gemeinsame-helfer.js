export const LS_SERVERS = 'sfm:recentServers';
export const MAX_SERVERS = 8;
export const LS_SERVERS_INIT = 'sfm:serversInitialized';
export const LS_SCHEMA = 'sfm:lastSchema';
export const AUTO_UPLOAD_LIVE = true;

export function normalizeServerBase(input) {
  let s = (input || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  return new URL(s).origin;
}

export function buildSvwsTargetBase(serverBase, dbName = '') {
  const base = normalizeServerBase(serverBase);
  return dbName ? `${base}/db/${dbName}` : base;
}

export function applyAxiosSvwsConfig(client, { serverBase, dbName = '', credentials, allowTestIp = false, timeout } = {}) {
  if (timeout != null) client.defaults.timeout = timeout;
  client.defaults.baseURL = '/api/svws/db';
  client.defaults.auth = credentials;
  client.defaults.headers.common['x-svws-server-base'] = normalizeServerBase(serverBase);
  client.defaults.headers.common['x-svws-db-name'] = dbName;
  client.defaults.headers.common['x-svws-allow-test-ip'] = allowTestIp ? '1' : '0';
  return client;
}

export function clearAxiosSvwsConfig(client) {
  client.defaults.baseURL = undefined;
  client.defaults.auth = undefined;
  delete client.defaults.headers.common['x-svws-server-base'];
  delete client.defaults.headers.common['x-svws-db-name'];
  delete client.defaults.headers.common['x-svws-allow-test-ip'];
}

export function isIpAddress(hostname) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
}

export function analyzeServerUrl(url) {
  try {
    const parsed = new URL(url.trim());
    return {
      isHttps: parsed.protocol === 'https:',
      hostname: parsed.hostname,
      isIp: isIpAddress(parsed.hostname),
    };
  } catch {
    return null;
  }
}

export function formatAxiosError(err) {
  if (err?.response) {
    const status = err.response.status;
    return {
      kind: 'http',
      title: `Server antwortet, aber mit Fehler (${status})`,
      details:
        status === 401 || status === 403
          ? 'Der Server ist erreichbar, aber Login/Authentifizierung ist fehlgeschlagen (Benutzer/Passwort prüfen).'
          : 'Der Server ist erreichbar, aber der angefragte Endpunkt liefert einen Fehler.',
    };
  }

  if (err?.request) {
    return {
      kind: 'network',
      title: 'Keine Antwort vom Server',
      details:
        'Der Server ist nicht erreichbar oder die Verbindung wird blockiert (Netzwerk, Firewall, VPN, DNS oder Zertifikat).',
    };
  }

  return {
    kind: 'unknown',
    title: 'Unbekannter Fehler',
    details: String(err?.message ?? err),
  };
}

export function formatLoginError(err) {
  if (err?.response) {
    const status = err.response.status;
    if (status === 401 || status === 403) return 'Benutzername oder Passwort falsch (oder keine Berechtigung).';
    if (status === 404) return 'API-Endpunkt nicht gefunden (Serveradresse/Port prüfen).';
    return `Serverfehler (${status}). Bitte später erneut versuchen.`;
  }

  if (err?.code === 'ECONNABORTED') return 'Zeitüberschreitung. Server antwortet nicht rechtzeitig.';
  if (err?.request) return 'Keine Verbindung möglich. Netzwerk, Firewall oder Zertifikat/Hostname prüfen.';
  return 'Unbekannter Fehler beim Login.';
}

export function guessImageMimeFromBase64(b64) {
  if (!b64) return 'image/jpeg';
  if (b64.startsWith('/9j/')) return 'image/jpeg';
  if (b64.startsWith('iVBOR')) return 'image/png';
  if (b64.startsWith('R0lGOD')) return 'image/gif';
  return 'image/jpeg';
}

export function buildAllowTestIpHtml() {
  return `
    <div class="text-start">
      <p>Bei Aktivierung werden <strong>Zertifikatsfehler bei HTTPS-Aufrufen zu IP-Adressen</strong>
      ignoriert. Das kann ein Sicherheitsproblem sein und ist nur für Tests gedacht.<br />
      Bitte nur in vertrauenswürdigen Netzen benutzen.</p>
      <hr>
    </div>
    <div class="d-flex gap-2 justify-content-center mt-3">
      <button id="btnOkTestIp" class="btn btn-danger btn-sm">Ja, Risiko akzeptieren</button>
    </div>
  `;
}

export function buildHelpHtml() {
  return `
    <div class="help-steps">
      <div class="help-step">
        <i class="bi bi-1-circle-fill help-step-icon"></i>
        <div><strong>Klasse auswählen.</strong></div>
      </div>
      <div class="help-step">
        <i class="bi bi-2-circle-fill help-step-icon"></i>
        <div><strong>Zuordnen:</strong> Links einen <strong>Schüler</strong> anklicken, dann rechts im <strong>Bilder-Pool</strong> das passende Foto anklicken.</div>
      </div>
      <div class="help-step">
        <i class="bi bi-magic help-step-icon"></i>
        <div><strong>Auto-Match:</strong> Mit <strong>Auto-Match</strong> werden Fotos automatisch nach <strong>Name, Vorname</strong> oder <strong>ID</strong> zugeordnet.</div>
      </div>
      <div class="help-step">
        <i class="bi bi-camera-fill help-step-icon"></i>
        <div><strong>Kamera:</strong> Über das <strong>Kamera-Symbol</strong> kann ein Live-Foto aufgenommen werden, welches anschließend automatisch in Schild hochgeladen wird.</div>
      </div>
      <div class="help-step">
        <i class="bi bi-cloud-upload-fill help-step-icon help-step-icon-success"></i>
        <div><strong>Upload:</strong> Mit <strong>„Zuordnungen hochladen“</strong> werden alle Zuordnungen in Schild übertragen.</div>
      </div>
    </div>
    <div class="help-tip">
      Tipp: Ein Klick auf einen bereits verknüpften Eintrag hebt die Zuordnung wieder auf.
    </div>	
    
  `;
}
