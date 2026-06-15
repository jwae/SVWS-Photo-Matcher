import { computed, onMounted, watch } from 'vue';
import axios from 'axios';
import {
  LS_SCHEMA,
  LS_SERVERS,
  LS_SERVERS_INIT,
  MAX_SERVERS,
  analyzeServerUrl,
  applyAxiosSvwsConfig,
  clearAxiosSvwsConfig,
  formatLoginError,
  normalizeServerBase,
} from './gemeinsame-helfer.js';

export function useLoginVerwaltung({
  serverName,
  dbName,
  credentials,
  recentServers,
  selectedServer,
  showServerManager,
  canEditSchueler,
  allowTestIp,
  loggedInUser,
  schemataListe,
  isLoadingSchemata,
  isLoggedIn,
  isLoggingIn,
  klassenListe,
  zuordnungen,
  loginError,
  serverTest,
  clearImagePool,
  handleKlassenWechsel,
  showToast,
}) {
  const displayServer = computed(() => {
    try {
      return new URL(normalizeServerBase(serverName.value)).origin;
    } catch {
      return serverName.value || '';
    }
  });

  onMounted(async () => {
    const saved = localStorage.getItem(LS_SERVERS);

    if (import.meta.env.PROD) {
      const alreadyInit = localStorage.getItem(LS_SERVERS_INIT) === '1';
      if (!alreadyInit) {
        recentServers.value = [];
        localStorage.removeItem(LS_SERVERS);
        localStorage.setItem(LS_SERVERS_INIT, '1');
      } else if (saved) {
        try {
          recentServers.value = JSON.parse(saved) || [];
        } catch {
          recentServers.value = [];
        }
      }
    } else if (saved) {
      try {
        recentServers.value = JSON.parse(saved) || [];
      } catch {
        recentServers.value = [];
      }
    }

    allowTestIp.value = false;
  });

  watch(serverName, () => {
    serverTest.ok = null;
    serverTest.title = '';
    serverTest.details = '';
  });

  watch(selectedServer, (value) => {
    if (value) serverName.value = value;
  });

  watch(dbName, (value) => {
    if (value) localStorage.setItem(LS_SCHEMA, value);
    else localStorage.removeItem(LS_SCHEMA);
  });

  function applySchemata(rawSchemata) {
    schemataListe.value = rawSchemata.map((item) => (typeof item === 'object' ? item.name : item));
    if (schemataListe.value.length > 0) dbName.value = schemataListe.value[0];
  }

  function rememberServer() {
    const value = serverName.value?.trim();
    if (!value) return;

    recentServers.value = recentServers.value.filter((server) => server !== value);
    recentServers.value.unshift(value);
    if (recentServers.value.length > MAX_SERVERS) recentServers.value.length = MAX_SERVERS;

    localStorage.setItem(LS_SERVERS, JSON.stringify(recentServers.value));
    selectedServer.value = value;
  }

  function removeSelectedServer() {
    const server = selectedServer.value;
    if (!server) return;

    recentServers.value = recentServers.value.filter((entry) => entry !== server);
    localStorage.setItem(LS_SERVERS, JSON.stringify(recentServers.value));
    selectedServer.value = '';
    if ((serverName.value?.trim() ?? '') === server) serverName.value = '';
  }

  function applySelectedServer() {
    if (!selectedServer.value) return;
    serverName.value = selectedServer.value;
    showServerManager.value = false;
  }

  async function toggleAllowTestIp() {
    allowTestIp.value = !allowTestIp.value;

    if (allowTestIp.value) {
      showToast('Testmodus fuer lokale Hosts/IPs ist jetzt zugelassen.', 'warning');
      return;
    }

    showToast('Testmodus ist deaktiviert.', 'info');
  }

  async function requestSchemata({ withCredentials = false } = {}) {
    const payload = {
      serverName: serverName.value.trim(),
      allowTestIp: allowTestIp.value,
    };
    if (withCredentials) payload.credentials = { ...credentials };
    return axios.post('/api/svws/meta/schemata', payload, { timeout: 6000 });
  }

  async function testServerConnection() {
    serverTest.running = true;
    serverTest.ok = null;
    serverTest.title = '';
    serverTest.details = '';

    let schemataData = null;
    const raw = serverName.value?.trim() ?? '';
    const info = analyzeServerUrl(raw);

    if (!info) {
      serverTest.ok = false;
      serverTest.title = 'Ungueltige Server-Adresse';
      serverTest.details = 'Bitte eine gueltige URL eingeben (z. B. https://servername:8443).';
      serverTest.running = false;
      return null;
    }

    if (info.isHttps && info.isIp && !allowTestIp.value) {
      serverTest.ok = false;
      serverTest.title = 'HTTPS mit IP-Adresse';
      serverTest.details =
        'HTTPS funktioniert meist nur mit Rechnernamen, da das Zertifikat an den Namen gebunden ist. ' +
        'Aktiviere in den Einstellungen testweise den Modus fuer lokale Hosts/IPs.';
      serverTest.running = false;
      return null;
    }

    try {
      const response = await requestSchemata();
      schemataData = response.data;
      serverTest.ok = true;
      serverTest.title = 'Server erreichbar';
      serverTest.details = 'Die Verbindung funktioniert. Sie koennen jetzt Schema waehlen und sich anmelden.';
    } catch (err) {
      const hasCreds = !!credentials.username && !!credentials.password;

      if (hasCreds) {
        try {
          const response = await requestSchemata({ withCredentials: true });
          schemataData = response.data;
          serverTest.ok = true;
          serverTest.title = 'Server erreichbar (mit Login)';
          serverTest.details = 'Der Server antwortet, wenn Benutzer/Passwort mitgesendet werden.';
        } catch (err2) {
          serverTest.ok = false;
          serverTest.title = err2?.response?.data?.title ?? 'Keine Antwort vom Server';
          serverTest.details =
            (err2?.response?.data?.details ?? 'Der Server ist nicht erreichbar oder die Verbindung wird blockiert.') +
            '\n\nTipp: Wenn der Zugriff per Browser klappt, aber hier nicht, ist es oft ein Zertifikat-/Hostname-Thema.';
        }
      } else {
        serverTest.ok = false;
        serverTest.title = err?.response?.data?.title ?? 'Keine Antwort vom Server';
        serverTest.details = `${err?.response?.data?.details ?? 'Der Server ist nicht erreichbar oder die Verbindung wird blockiert.'}\nTipp: Aktiviere testweise den Modus fuer lokale Hosts/IPs oder pruefe Port und Zertifikat.`;
      }
    } finally {
      serverTest.running = false;
    }

    return schemataData;
  }

  async function ladeSchemata() {
    isLoadingSchemata.value = true;
    const info = analyzeServerUrl(serverName.value);

    if (!info) {
      showToast('Bitte eine gueltige Server-Adresse eingeben (z. B. https://servername:8443).', 'danger');
      isLoadingSchemata.value = false;
      return;
    }

    if (info.isHttps && info.isIp && !allowTestIp.value) {
      serverTest.ok = false;
      serverTest.title = 'Login abgebrochen';
      serverTest.details =
        'HTTPS mit IP-Adresse funktioniert meist nicht. Bitte den Rechnernamen verwenden (Zertifikat ist an den Namen gebunden). ' +
        'Fuer Tests kannst du den Modus fuer lokale Hosts/IPs aktivieren.';
      serverTest.running = false;
      isLoadingSchemata.value = false;
      return;
    }

    try {
      const response = await requestSchemata();
      applySchemata(response.data);
    } catch {
      showToast('Server nicht erreichbar. Pruefe Servername, Port und Netzwerk.', 'danger');
    } finally {
      isLoadingSchemata.value = false;
    }
  }

  async function connectServer() {
    const schemata = await testServerConnection();
    if (serverTest.ok !== true) return;
    if (Array.isArray(schemata)) applySchemata(schemata);
    else await ladeSchemata();
  }

  async function performLogin() {
    isLoggingIn.value = true;
    loginError.value = '';

    const info = analyzeServerUrl(serverName.value);
    if (!info) {
      showToast('Bitte eine gueltige Server-Adresse eingeben (z. B. https://servername:8443).', 'danger');
      isLoggingIn.value = false;
      return;
    }

    if (info.isHttps && info.isIp && !allowTestIp.value) {
      serverTest.ok = false;
      serverTest.title = 'Login abgebrochen';
      serverTest.details =
        'HTTPS mit IP-Adresse funktioniert meist nicht. Bitte den Rechnernamen verwenden (Zertifikat ist an den Namen gebunden). ' +
        'Fuer Tests kannst du den Modus fuer lokale Hosts/IPs aktivieren.';
      serverTest.running = false;
      isLoggingIn.value = false;
      return;
    }

    zuordnungen.value = [];
    clearImagePool();

    try {
      const base = normalizeServerBase(serverName.value);
      const response = await axios.post('/api/svws/meta/login', {
        serverName: base,
        dbName: dbName.value,
        credentials,
        allowTestIp: allowTestIp.value,
      });

      const { canViewSchueler, canEditSchueler: mayEditSchueler, klassenListe: loadedKlassenListe } = response.data;

      if (!canViewSchueler) {
        loginError.value = 'Der User ist nicht berechtigt, Schuelerdaten zu sehen.';
        showToast('Der User ist nicht berechtigt, Schuelerdaten zu sehen.', 'danger');
        isLoggedIn.value = false;
        loggedInUser.value = '';
        klassenListe.value = [];
        canEditSchueler.value = null;
        clearAxiosSvwsConfig(axios);
        return;
      }

      canEditSchueler.value = mayEditSchueler === true;
      klassenListe.value = loadedKlassenListe ?? [];
      applyAxiosSvwsConfig(axios, {
        serverBase: base,
        dbName: dbName.value,
        credentials,
        allowTestIp: allowTestIp.value,
      });

      isLoggedIn.value = true;
      loggedInUser.value = credentials.username;

      if (klassenListe.value.length > 0) {
        selectedServer.value = serverName.value.trim();
        await handleKlassenWechsel(klassenListe.value[0]);
      }
    } catch (err) {
      const status = err?.response?.status;

      if (status === 401) {
        loginError.value = 'Benutzername oder Passwort ist falsch.';
        isLoggedIn.value = false;
        loggedInUser.value = '';
        return;
      }

      if (status === 403) {
        loginError.value = 'Zugriff verweigert (keine Berechtigung).';
        isLoggedIn.value = false;
        loggedInUser.value = '';
        return;
      }

      loginError.value = formatLoginError(err);
      isLoggedIn.value = false;
      loggedInUser.value = '';
      clearAxiosSvwsConfig(axios);
    } finally {
      isLoggingIn.value = false;
    }
  }

  return {
    displayServer,
    toggleAllowTestIp,
    rememberServer,
    removeSelectedServer,
    connectServer,
    applySelectedServer,
    performLogin,
  };
}
