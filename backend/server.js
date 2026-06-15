import express from 'express';
import axios from 'axios';
import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadKlassenUndSchueler } from '../lib/loadKlassenUndSchueler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const port = Number(process.env.PORT || 3100);
const app = express();

app.use(express.json({ limit: '15mb' }));

function normalizeServerBase(input) {
  let value = String(input ?? '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  return new URL(value).origin;
}

function isIpAddress(hostname) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
}

function analyzeServerUrl(url) {
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

function buildHttpsAgent(serverBase, allowTestIp) {
  const info = analyzeServerUrl(serverBase);
  if (allowTestIp === true && info?.isHttps) {
    return new https.Agent({ rejectUnauthorized: false });
  }
  return undefined;
}

function createSvwsClient({ serverBase, dbName = '', credentials, allowTestIp = false, authorizationHeader, timeout = 15000 }) {
  const normalizedBase = normalizeServerBase(serverBase);
  const baseURL = dbName ? `${normalizedBase}/db/${dbName}` : normalizedBase;
  const headers = {};

  if (authorizationHeader) headers.Authorization = authorizationHeader;

  return axios.create({
    baseURL,
    timeout,
    auth: credentials,
    headers,
    httpsAgent: buildHttpsAgent(normalizedBase, allowTestIp),
  });
}

function describeTarget(err) {
  const url = err?.config?.baseURL || err?.config?.url || '';

  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}`;
  } catch {
    return url || 'unbekanntes Ziel';
  }
}

function buildDiagnosticSuffix(err) {
  const parts = [];
  if (err?.code) parts.push(`Code=${err.code}`);
  if (err?.errno) parts.push(`Errno=${err.errno}`);
  if (err?.syscall) parts.push(`Syscall=${err.syscall}`);
  if (err?.hostname) parts.push(`Host=${err.hostname}`);
  if (err?.address) parts.push(`Adresse=${err.address}`);
  if (err?.port) parts.push(`Port=${err.port}`);
  return parts.length > 0 ? `\nDiagnose: ${parts.join(', ')}` : '';
}

function buildResponseSnippet(data) {
  if (data == null) return '';
  if (typeof data === 'string') {
    const compact = data.replace(/\s+/g, ' ').trim();
    return compact ? `\nAntwortauszug: ${compact.slice(0, 220)}` : '';
  }

  try {
    return `\nAntwortauszug: ${JSON.stringify(data).slice(0, 220)}`;
  } catch {
    return '';
  }
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value);
  return [];
}

function toKompetenzModulo100(kompetenz) {
  let raw = null;

  if (typeof kompetenz === 'number' || typeof kompetenz === 'string') raw = kompetenz;
  else if (typeof kompetenz === 'object' && kompetenz !== null) raw = kompetenz.id ?? kompetenz.nr ?? null;

  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  return ((value % 100) + 100) % 100;
}

function collectKompetenzen(endpointData) {
  const gruppenKompetenzen = asArray(endpointData?.gruppen).flatMap((gruppe) => asArray(gruppe?.kompetenzen));
  const direkteKompetenzen = asArray(endpointData?.kompetenzen);
  return [...gruppenKompetenzen, ...direkteKompetenzen];
}

function getPermissionResult(endpointData) {
  const kompetenzwerte = collectKompetenzen(endpointData)
    .map((kompetenz) => toKompetenzModulo100(kompetenz))
    .filter((value) => value != null);

  const canViewSchueler = kompetenzwerte.includes(11);
  if (!canViewSchueler) return { canViewSchueler: false, canEditSchueler: false };

  return {
    canViewSchueler: true,
    canEditSchueler: kompetenzwerte.includes(12),
  };
}

function formatAxiosError(err) {
  const target = describeTarget(err);
  const diagnosticSuffix = buildDiagnosticSuffix(err);

  if (err?.response) {
    const status = err.response.status;
    return {
      status,
      body: {
        title: `Server antwortet, aber mit Fehler (${status})`,
        details:
          status === 401 || status === 403
            ? `Der Server ${target} ist erreichbar, aber Login/Authentifizierung ist fehlgeschlagen (Benutzer/Passwort pruefen).${buildResponseSnippet(err.response?.data)}`
            : `Der Server ${target} ist erreichbar, aber der angefragte Endpunkt liefert einen Fehler.${buildResponseSnippet(err.response?.data)}`,
      },
    };
  }

  if (err?.code === 'ECONNABORTED') {
    return {
      status: 504,
      body: {
        title: 'Zeitueberschreitung',
        details: `Der Server ${target} antwortet nicht rechtzeitig.${diagnosticSuffix}`,
      },
    };
  }

  if (
    err?.code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
    err?.code === 'SELF_SIGNED_CERT_IN_CHAIN' ||
    err?.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
    err?.code === 'CERT_HAS_EXPIRED' ||
    err?.code === 'ERR_TLS_CERT_ALTNAME_INVALID'
  ) {
    return {
      status: 502,
      body: {
        title: 'Zertifikatsfehler',
        details: `Die HTTPS-Verbindung zu ${target} scheitert am Zertifikat oder Hostnamen. Aktiviere testweise den Modus fuer lokale Hosts/IPs.${diagnosticSuffix}`,
      },
    };
  }

  if (err?.code === 'ENOTFOUND' || err?.code === 'EAI_AGAIN') {
    return {
      status: 502,
      body: {
        title: 'DNS-/Namensaufloesung fehlgeschlagen',
        details: `Der Host von ${target} konnte vom Backend nicht aufgeloest werden.${diagnosticSuffix}`,
      },
    };
  }

  if (err?.code === 'ECONNREFUSED') {
    return {
      status: 502,
      body: {
        title: 'Verbindung abgelehnt',
        details: `Zu ${target} konnte eine TCP-Verbindung aufgebaut werden, aber der Zielport lehnt die Verbindung ab.${diagnosticSuffix}`,
      },
    };
  }

  if (err?.code === 'ETIMEDOUT') {
    return {
      status: 504,
      body: {
        title: 'Netzwerk-Timeout',
        details: `Die Verbindung zu ${target} ist in ein Timeout gelaufen.${diagnosticSuffix}`,
      },
    };
  }

  if (err?.code === 'ECONNRESET') {
    return {
      status: 502,
      body: {
        title: 'Verbindung wurde zurueckgesetzt',
        details: `Die Verbindung zu ${target} wurde waehrend des Aufbaus oder der Antwort vom Ziel geschlossen.${diagnosticSuffix}`,
      },
    };
  }

  return {
    status: 502,
    body: {
      title: 'Keine Antwort vom Server',
      details: `Der Server ${target} ist nicht erreichbar oder die Verbindung wird blockiert (Netzwerk, Firewall, DNS oder Zertifikat).${diagnosticSuffix}`,
    },
  };
}

function sendAxiosError(res, err) {
  const { status, body } = formatAxiosError(err);
  res.status(status).json(body);
}

function getProxyConfigFromHeaders(req) {
  return {
    serverBase: req.headers['x-svws-server-base'],
    dbName: req.headers['x-svws-db-name'],
    allowTestIp: req.headers['x-svws-allow-test-ip'] === '1',
    authorizationHeader: req.headers.authorization,
  };
}

app.post('/api/svws/meta/schemata', async (req, res) => {
  const { serverName, credentials, allowTestIp = false } = req.body ?? {};

  if (!serverName) {
    res.status(400).json({ title: 'Fehlende Server-Adresse', details: 'Bitte eine Server-Adresse angeben.' });
    return;
  }

  try {
    const client = createSvwsClient({
      serverBase: serverName,
      credentials,
      allowTestIp,
      timeout: 6000,
    });
    const response = await client.get('/config/db/schemata');
    res.json(response.data);
  } catch (err) {
    sendAxiosError(res, err);
  }
});

app.post('/api/svws/meta/login', async (req, res) => {
  const { serverName, dbName, credentials, allowTestIp = false } = req.body ?? {};

  const hasUsername = typeof credentials?.username === 'string' && credentials.username.length > 0;
  const hasPassword = typeof credentials?.password === 'string';

  if (!serverName || !dbName || !hasUsername || !hasPassword) {
    res.status(400).json({ title: 'Fehlende Login-Daten', details: 'Server, Schema und Zugangsdaten sind erforderlich.' });
    return;
  }

  try {
    const client = createSvwsClient({
      serverBase: serverName,
      dbName,
      credentials,
      allowTestIp,
    });

    const permissionResponse = await client.get('/benutzer/angemeldet/daten');
    const permissionResult = getPermissionResult(permissionResponse.data);

    if (!permissionResult.canViewSchueler) {
      res.json({
        canViewSchueler: false,
        canEditSchueler: false,
        klassenListe: [],
      });
      return;
    }

    const klassenListe = await loadKlassenUndSchueler(client);
    res.json({
      canViewSchueler: true,
      canEditSchueler: permissionResult.canEditSchueler,
      klassenListe,
    });
  } catch (err) {
    sendAxiosError(res, err);
  }
});

app.all(/^\/api\/svws\/db(?:\/.*)?$/, async (req, res) => {
  const { serverBase, dbName, allowTestIp, authorizationHeader } = getProxyConfigFromHeaders(req);

  if (!serverBase || !dbName) {
    res.status(400).json({ message: 'Missing x-svws-server-base or x-svws-db-name header.' });
    return;
  }

  const requestUrl = new URL(req.originalUrl, 'http://localhost');
  const targetPath = requestUrl.pathname.replace(/^\/api\/svws\/db/, '') || '/';

  try {
    const client = createSvwsClient({
      serverBase,
      dbName,
      allowTestIp,
      authorizationHeader,
      timeout: 30000,
    });

    const response = await client.request({
      method: req.method,
      url: `${targetPath}${requestUrl.search}`,
      data: req.body,
      headers: {
        'content-type': req.headers['content-type'],
      },
      validateStatus: () => true,
    });

    res.status(response.status).set(response.headers).send(response.data);
  } catch (err) {
    sendAxiosError(res, err);
  }
});

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.listen(port, () => {
  console.log(`SVWS backend listening on http://127.0.0.1:${port}`);
});
