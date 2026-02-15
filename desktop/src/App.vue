<script setup>
import { ref, computed, reactive, onMounted, watch } from 'vue'
import axios from 'axios'
import { scaleImage } from './imageUtils.js' // Die ausgelagerte Funktion

// --- 1. STATES ---
const LS_SERVERS = 'sfm:recentServers';
const MAX_SERVERS = 8;
const AUTO_UPLOAD_LIVE = true;
const fileInput = ref(null);
const recentServers = ref([]);
//const serverSaved = ref(false);
const selectedServer = ref('');
const showServerManager = ref(false);
const canEditSchueler = ref(null); // null = unbekannt, true/false = bekannt




const LS_SCHEMA = 'sfm:lastSchema';

const serverName = ref('https://localhost'); 
const dbName = ref(''); 
const loggedInUser = ref('');
const schemataListe = ref([]);
const isLoadingSchemata = ref(false); 
const isLoggedIn = ref(false); 
const isLoggingIn = ref(false);
const credentials = reactive({ username: '', password: '' });
const klassenListe = ref([]); 
const selectedKlasse = ref(null); 
const selectedSchueler = ref(null);
const zuordnungen = ref([]); 
const gefundeneBilder = ref({}); 
const previewImage = ref(null);
const deleteModal = reactive({
  show: false,
  mode: null,
  titel: '',
  nachricht: '',
  bildName: null,
  schueler: null
});
const infoModal = reactive({
  show: false,
  titel: '',
  html: ''
});


const toast = ref({ show: false, message: '', type: 'info' });
const uploadStatus = reactive({ active: false, current: 0, total: 0 });
const loginError = ref('');

const camAdjust = reactive({
  zoom: 1.0,        // 1.00 - 2.00
  brightness: 100,  // 50 - 150
  contrast: 100,    // 50 - 150
  saturate: 100     // 0 - 200
});

function resetCamAdjust() {
  camAdjust.zoom = 1.0;
  camAdjust.brightness = 100;
  camAdjust.contrast = 100;
  camAdjust.saturate = 100;
}

const previewFilterCss = computed(() =>
  `brightness(${camAdjust.brightness}%) contrast(${camAdjust.contrast}%) saturate(${camAdjust.saturate}%)`
);


const serverTest = reactive({
  running: false,
  ok: null,          // true/false/null
  title: '',
  details: ''
});

onMounted(() => {
  const saved = localStorage.getItem(LS_SERVERS);
  if (saved) {
    try {
      recentServers.value = JSON.parse(saved) || [];
    } catch {
      recentServers.value = [];
    }
  }

  // optional: zuletzt gemerkten Eintrag direkt ins Feld setzen
  if (recentServers.value.length > 0 && !serverName.value) {
    serverName.value = recentServers.value[0];
  }
});



watch(serverName, () => {
  // sobald die URL geändert wird: alten Teststatus zurücksetzen
  serverTest.ok = null;
  serverTest.title = '';
  serverTest.details = '';
});

watch(selectedServer, (val) => {
  if (val) serverName.value = val;
});


watch(dbName, (val) => {
  if (val) localStorage.setItem(LS_SCHEMA, val);
  else localStorage.removeItem(LS_SCHEMA);
});




function findAnySchuelerId() {
  for (const k of (klassenListe.value ?? [])) {
    const s = k?.schueler?.[0];
    if (s?.id != null) return s.id;
  }
  return null;
}

async function checkSchuelerEditPermission() {
  canEditSchueler.value = null;

  const testId = findAnySchuelerId();
  if (!testId) {
    // keine Schüler vorhanden → Rechte nicht testbar
    canEditSchueler.value = null;
    return;
  }

  try {
    // Leerer PATCH: Wenn keine Rechte -> 403.
    // Wenn Rechte ok -> meist 400/415/etc. (weil Body leer/ungültig)
    await axios.patch(`/schueler/${testId}/stammdaten`, {});
    
    // Falls Server das sogar akzeptiert: dann definitiv Rechte vorhanden
    canEditSchueler.value = true;

  } catch (err) {
    const status = err?.response?.status;

    if (status === 403) {
      canEditSchueler.value = false;
      return;
    }
    if (status === 400 || status === 415 || status === 422) {
      canEditSchueler.value = true;
      return;
    }
    if (status === 404) {
      canEditSchueler.value = null;
      return;
    }

    // Netzwerk / sonstiges
    canEditSchueler.value = null;
  }
}



function rememberServer() {
  const v = serverName.value?.trim();
  if (!v) return;

  // Duplikate entfernen, neueste nach vorne
  recentServers.value = recentServers.value.filter(s => s !== v);
  recentServers.value.unshift(v);

  if (recentServers.value.length > MAX_SERVERS) {
    recentServers.value.length = MAX_SERVERS;
  }

  localStorage.setItem(LS_SERVERS, JSON.stringify(recentServers.value));

  // ✔️ kurz anzeigen
  serverSaved.value = true;
  setTimeout(() => {
    serverSaved.value = false;
  }, 1200);
  selectedServer.value = serverName.value.trim();

}

function removeSelectedServer() {
  const s = selectedServer.value;
  if (!s) return;

  recentServers.value = recentServers.value.filter(x => x !== s);
  localStorage.setItem(LS_SERVERS, JSON.stringify(recentServers.value));

  selectedServer.value = '';
  if ((serverName.value?.trim() ?? '') === s) serverName.value = '';
}


async function connectServer() {
  await testServerConnection();
  if (serverTest.ok === true) {
    await ladeSchemata();
  }
}




function isIpAddress(hostname) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
}

function analyzeServerUrl(url) {
  try {
    const parsed = new URL(url.trim());
    const hostname = parsed.hostname;

    return {
      isHttps: parsed.protocol === 'https:',
      hostname,
      isIp: isIpAddress(hostname),
    };
  } catch {
    return null; // ungültige URL
  }
}



function formatAxiosError(err) {
  if (err?.response) {
    const status = err.response.status;
    return {
      kind: 'http',
      title: `Server antwortet, aber mit Fehler (${status})`,
      details:
        status === 401 || status === 403
          ? 'Der Server ist erreichbar, aber Login/Authentifizierung ist fehlgeschlagen (Benutzer/Passwort prüfen).'
          : 'Der Server ist erreichbar, aber der angefragte Endpunkt liefert einen Fehler.'
    };
  }

  if (err?.request) {
    return {
      kind: 'network',
      title: 'Keine Antwort vom Server',
      details:
        'Der Server ist nicht erreichbar oder die Verbindung wird blockiert (Netzwerk, Firewall, VPN, DNS oder Zertifikat).'
    };
  }

  return {
    kind: 'unknown',
    title: 'Unbekannter Fehler',
    details: String(err?.message ?? err)
  };
}

function formatLoginError(err) {
  if (err?.response) {
    const s = err.response.status;
    if (s === 401 || s === 403) return 'Benutzername oder Passwort falsch (oder keine Berechtigung).';
    if (s === 404) return 'API-Endpunkt nicht gefunden (Serveradresse/Port prüfen).';
    return `Serverfehler (${s}). Bitte später erneut versuchen.`;
  }

  // Netzwerk/TLS/DNS/Timeout
  if (err?.code === 'ECONNABORTED') return 'Zeitüberschreitung. Server antwortet nicht rechtzeitig.';
  if (err?.request) return 'Keine Verbindung möglich. Netzwerk, Firewall oder Zertifikat/Hostname prüfen.';

  return 'Unbekannter Fehler beim Login.';
}


// Stelle sicher, dass dieses Objekt existiert!
const camera = reactive({
    active: false,
    schueler: null,
    stream: null
});

const videoPlayer = ref(null);

// --- 2. COMPUTED ---

const sortierteSchueler = computed(() => {
  if (!selectedKlasse.value?.schueler) return [];
  return [...selectedKlasse.value.schueler].sort((a,b) => a.nachname.localeCompare(b.nachname));
});

const anzahlBilderImPool = computed(() => {
  return Object.keys(gefundeneBilder.value).length;
});

// --- 3. API & AUTH ---
async function testServerConnection() {
  serverTest.running = true;
  serverTest.ok = null;
  serverTest.title = '';
  serverTest.details = '';

  const raw = serverName.value?.trim() ?? '';
  const info = analyzeServerUrl(raw);

  if (!info) {
    serverTest.ok = false;
    serverTest.title = 'Ungültige Server-Adresse';
    serverTest.details = 'Bitte eine gültige URL eingeben (z. B. https://servername:8443).';
    serverTest.running = false;
    return;
  }

  // Klarer Hinweis: HTTPS + IP
  if (info.isHttps && info.isIp) {
    serverTest.ok = false;
    serverTest.title = 'HTTPS mit IP-Adresse';
    serverTest.details =
      'HTTPS funktioniert meist nur mit Rechnernamen, da das Zertifikat an den Namen gebunden ist. ' +
      'Bitte verwenden Sie den Hostnamen (z. B. https://SERVERNAME:8443) statt der IP.';
    serverTest.running = false;
    return;
  }

  // Test-Endpunkt: config/db/schemata (ohne Auth) – passt zu deiner App
  // Falls dein Server das nur mit Auth liefert, testen wir danach noch mit Auth.
  const base = raw.replace(/\/+$/, '');

  // Timeout, damit es nicht ewig hängt
  const client = axios.create({ timeout: 6000 });

  try {
    await client.get(`${base}/config/db/schemata`);
    serverTest.ok = true;
    serverTest.title = 'Server erreichbar';
    serverTest.details = 'Die Verbindung funktioniert. Sie können jetzt Schema wählen und sich anmelden.';
  } catch (err) {
    // Wenn der Endpunkt Auth braucht: zweiter Versuch mit Basic Auth (falls eingegeben)
    const first = formatAxiosError(err);

    // Optionaler Retry mit Auth, falls Benutzer/Passwort schon eingetragen sind
    const hasCreds = !!credentials.username && !!credentials.password;
    if (hasCreds) {
      try {
        await client.get(`${base}/config/db/schemata`, { auth: credentials });
        serverTest.ok = true;
        serverTest.title = 'Server erreichbar (mit Login)';
        serverTest.details = 'Der Server antwortet, wenn Benutzer/Passwort mitgesendet werden.';
      } catch (err2) {
        const second = formatAxiosError(err2);
        serverTest.ok = false;
        serverTest.title = second.title;
        serverTest.details = second.details + '\n\nTipp: Wenn der Zugriff per Browser klappt, aber hier nicht, ist es oft ein Zertifikat-/Hostname-Thema.';
      }
    } else {
      serverTest.ok = false;
      serverTest.title = first.title;
      serverTest.details =
        first.details +
        '\n\nTipp: Verwenden Sie für HTTPS bitte den Rechnernamen (nicht die IP).';
    }
  } finally {
    serverTest.running = false;
  }
}

async function ladeSchemata() {
  isLoadingSchemata.value = true;
  const info = analyzeServerUrl(serverName.value);
if (!info) {
  showToast("Bitte eine gültige Server-Adresse eingeben (z. B. https://servername:8443).", "danger");
  isLoadingSchemata.value = false;
  return;
}
if (info.isHttps && info.isIp) {
  showToast(
    "Verbindungshinweis: HTTPS mit IP-Adresse funktioniert meist nicht (Zertifikat passt zum Rechnernamen). Bitte den Hostnamen verwenden.",
    "info"
  );
  // nicht abbrechen: Schemata können ggf. trotzdem gehen, aber meist scheitert TLS ohnehin
}

  try {
    const base = serverName.value.trim().replace(/\/+$/, "");
    const res = await axios.get(`${base}/config/db/schemata`);
    schemataListe.value = res.data.map(i => typeof i === 'object' ? i.name : i);
    if (schemataListe.value.length > 0) dbName.value = schemataListe.value[0];
  } catch (e) {
  //showConnectionHintForServerUrl(serverName.value);
  showToast("Server nicht erreichbar. Prüfe Servername und Netzwerk.", "danger");
  } 
  finally { isLoadingSchemata.value = false; }
}

async function performLogin() {
  isLoggingIn.value = true;
  loginError.value = '';

  const info = analyzeServerUrl(serverName.value);
if (!info) {
  showToast("Bitte eine gültige Server-Adresse eingeben (z. B. https://servername:8443).", "danger");
  isLoggingIn.value = false;
  return;
}

if (info.isHttps && info.isIp) {
  showToast(
    "Login abgebrochen: HTTPS mit IP-Adresse funktioniert meist nicht. Bitte den Rechnernamen verwenden (Zertifikat ist an den Namen gebunden).",
    "danger"
  );
  isLoggingIn.value = false;
  return;
}
 
  zuordnungen.value = [];       // Löscht die Matches
  gefundeneBilder.value = {};   // Löscht den Bilderpool

  try {
    const base = serverName.value.trim().replace(/\/+$/, "");
    axios.defaults.baseURL = `${base}/db/${dbName.value}`;
    axios.defaults.auth = credentials;
    
    
    const res = await axios.get('/klassen/abschnitt/01');

// nach "sortierung" sortieren (robust gegen null/undefined)
klassenListe.value = (Array.isArray(res.data) ? res.data : [])
  .slice()
  .sort((a, b) => {
    const sa = Number.isFinite(Number(a?.sortierung)) ? Number(a.sortierung) : 9999;
    const sb = Number.isFinite(Number(b?.sortierung)) ? Number(b.sortierung) : 9999;
    if (sa !== sb) return sa - sb;

    // optionaler Tie-Breaker: nach Kürzel
    return String(a?.kuerzel ?? '').localeCompare(String(b?.kuerzel ?? ''), 'de');
  });

isLoggedIn.value = true;
loggedInUser.value = credentials.username;

// User-Rechte prüfen
await checkSchuelerEditPermission();

if (klassenListe.value.length > 0) {
  selectedKlasse.value = klassenListe.value[0];
  await handleKlassenWechsel();
}

  } catch (e) {
  // Extra Hinweis, falls doch IP/HTTPS oder Zertifikat das Problem ist
  //showConnectionHintForServerUrl(serverName.value);
  loginError.value = formatLoginError(e);
} 
  finally { isLoggingIn.value = false; }
}

function guessImageMimeFromBase64(b64) {
  if (!b64) return 'image/jpeg';
  // einfache Signatur-Erkennung
  if (b64.startsWith('/9j/')) return 'image/jpeg';   // JPEG
  if (b64.startsWith('iVBOR')) return 'image/png';   // PNG
  if (b64.startsWith('R0lGOD')) return 'image/gif';  // GIF
  return 'image/jpeg';
}


async function handleKlassenWechsel() {
  if (!selectedKlasse.value) return;

  const schuelerArray = selectedKlasse.value.schueler ?? [];

  for (let s of schuelerArray) {
    try {
      const r = await axios.get(`/schueler/${s.id}/stammdaten`);
      const fotoB64 = r?.data?.foto || '';

      s.hatFoto = fotoB64.length > 0;

      // ✅ NEU: direkt als Data-URL am Schüler ablegen (für Thumbnail in Tabelle)
      if (s.hatFoto) {
        const mime = guessImageMimeFromBase64(fotoB64);
        s.dbFotoUrl = `data:${mime};base64,${fotoB64}`;
      } else {
        s.dbFotoUrl = null;
      }

    } catch {
      s.hatFoto = false;
      s.dbFotoUrl = null;
    }
  }

  // autoMatch();
}


// --- 4. BILD-HANDLING & MATCHING ---
function handleFolderUpload(e) {
  const files = Array.from(e.target.files);
  files.forEach(f => { 
    if (f.type.startsWith('image/')) {
      gefundeneBilder.value[f.name] = { url: URL.createObjectURL(f) }; 
    }
  });
  showToast(`${Object.keys(gefundeneBilder.value).length} Bilder geladen`);
  e.target.value = '';
}

function handleSchuelerKlick(s) {
  const i = zuordnungen.value.findIndex(z => z.sId === s.id);
  if (i !== -1) {
    zuordnungen.value.splice(i, 1); // Match lösen bei Klick auf gematchten Schüler
  } else {
    selectedSchueler.value = (selectedSchueler.value?.id === s.id) ? null : s;
  }
}

function handleBildKlick(n) {
  const i = zuordnungen.value.findIndex(z => z.bild === n);
  if (i !== -1) {
    zuordnungen.value.splice(i, 1); // Match lösen
  } else if (selectedSchueler.value) { 
    zuordnungen.value.push({ sId: selectedSchueler.value.id, bild: n, reason: 'Manuell' }); 
    selectedSchueler.value = null; 
  }
}

function autoMatch() {
  const pool = Object.keys(gefundeneBilder.value);
  let neueTreffer = 0;

  // Wenn der Bilder-Pool komplett leer ist, direkt abbrechen und informieren
  if (pool.length === 0) {
    showToast("Bilder-Pool ist leer. Bitte zuerst Fotos laden oder aufnehmen.", "info");
    return;
  }

  sortierteSchueler.value.forEach(s => {
    // 1. Überspringen, wenn bereits zugeordnet (manuell oder auto)
    if (zuordnungen.value.some(z => z.sId === s.id)) return;
    
    const sNachname = s.nachname.toLowerCase();
    const sVorname = s.vorname.toLowerCase();
    const sId = String(s.id);
    
    // 2. Suche im Pool mit Priorisierung (ID oder Nachname+Vorname)
    const match = pool.find(fileName => {
      const fn = fileName.toLowerCase();
      const bildSchonVergeben = zuordnungen.value.some(z => z.bild === fileName);
      if (bildSchonVergeben) return false;

      if (fn.includes(sId)) return true;
      if (fn.includes(sNachname) && fn.includes(sVorname)) return true;
      
      return false;
    });

    if (match) {
      zuordnungen.value.push({ sId: s.id, bild: match, reason: 'Auto' });
      neueTreffer++;
    }
  });

  // --- Erweiterte Rückmeldung ---
  if (neueTreffer > 0) {
    showToast(`${neueTreffer} neue Matches!`, 'success');
  } else {
    // Falls keine neuen Treffer erzielt wurden
    const bereitsGematcht = zuordnungen.value.length;
    if (bereitsGematcht > 0) {
      showToast("Keine weiteren Matches gefunden.", "info");
    } else {
      showToast("Keine Matches im Bilder-Pool gefunden.", "info");
    }
  }
}


// --- 5. UPLOAD & DELETE ---
async function uploadAllMatches() {
  if (zuordnungen.value.length === 0) return;

  uploadStatus.active = true;
  uploadStatus.total = zuordnungen.value.length;
  uploadStatus.current = 0;

  let erfolge = 0;
  const errors = [];
  const successIds = new Set();

  const matchesToUpload = zuordnungen.value.slice();
  const schuelerById = new Map((selectedKlasse.value?.schueler ?? []).map(s => [s.id, s]));

  try {
    for (let i = 0; i < matchesToUpload.length; i++) {
      const z = matchesToUpload[i];
      uploadStatus.current = i + 1;

      try {
        const bildDaten = gefundeneBilder.value[z.bild];
        if (!bildDaten?.url) throw new Error("Bild nicht mehr im Pool");

        const scaledDataUrl = await scaleImage(bildDaten.url, 119, 160);
        const base64String = scaledDataUrl.split(',')[1];
        if (!base64String) throw new Error("Skalierung lieferte kein Base64");

        await axios.patch(`/schueler/${z.sId}/stammdaten`, { foto: base64String });

        const schueler = schuelerById.get(z.sId);
if (schueler) {
  schueler.hatFoto = true;

  // ✅ NEU: sofort Thumbnail setzen (scaledDataUrl ist schon data:image/...;base64,...)
  // Falls scaleImage kein "data:image/.." Prefix liefert, fallback auf jpeg:
  schueler.dbFotoUrl = scaledDataUrl.startsWith('data:')
    ? scaledDataUrl
    : `data:image/jpeg;base64,${base64String}`;
}


        successIds.add(z.sId);
        erfolge++;

      } catch (err) {
        // ✅ HIER: 403 => Abbruch
        if (err?.response?.status === 403) {
          throw new Error("NO_PERMISSION_ABORT");
        }

        // normale Fehler sammeln
        let msg = "Unbekannter Fehler";
        if (err?.response?.status === 404) msg = `Schüler mit ID ${z.sId} wurde nicht gefunden.`;
        else if (err?.response?.data?.message) msg = err.response.data.message;
        else if (err?.message) msg = err.message;

        console.error(`Fehler bei ID ${z.sId}:`, err);
        errors.push({ sId: z.sId, bild: z.bild, message: msg });
      }
    }

    if (successIds.size > 0) {
      zuordnungen.value = zuordnungen.value.filter(item => !successIds.has(item.sId));
    }

    // Abschlussmeldung
    if (errors.length === 0) showToast(`${erfolge} Foto(s) erfolgreich hochgeladen.`, "success");
    else showToast(`${erfolge} erfolgreich, ${errors.length} fehlgeschlagen.`, "danger");

  } catch (e) {
    // ✅ HIER: Abbruchmeldung für 403
    if (e?.message === "NO_PERMISSION_ABORT") {
      showToast("Upload abgebrochen: Der SVWS-Benutzer hat keine Rechte, um Schülerdaten zu ändern (403).", "danger");
    } else {
      console.error("Upload abgebrochen:", e);
      showToast("Upload abgebrochen (unerwarteter Fehler).", "danger");
    }
  } finally {
    uploadStatus.active = false;
  }
}

async function uploadFotoForSchueler(sId, dataUrl119x160) {
  const base64String = dataUrl119x160.split(',')[1];
  if (!base64String) throw new Error("Skalierung lieferte kein Base64");

  try {
    await axios.patch(`/schueler/${sId}/stammdaten`, { foto: base64String });
    return { ok: true };
  } catch (err) {
    const status = err?.response?.status;

    if (status === 403) return { ok: false, code: 403, message: "Keine Rechte, um Schülerdaten zu ändern." };
    if (status === 404) return { ok: false, code: 404, message: `Schüler mit ID ${sId} nicht gefunden.` };

    return { ok: false, code: status ?? 0, message: err?.message ?? "Upload fehlgeschlagen." };
  }
}



async function executeDelete() {
  const mode = deleteModal.mode;

  try {
    if (mode === 'svws') {
      // --- DEIN ERFOLGREICHER WEG ---
      const s = deleteModal.schueler;
      await axios.patch(`/schueler/${s.id}/stammdaten`, { foto: "" });
      
      s.hatFoto = false;  
      s.dbFotoUrl = null; // Icon in der Liste aktualisieren
      showToast(`Foto von ${s.vorname} ${s.nachname} gelöscht`, "success");
    } 
    else if (mode === 'pool') {
      // --- DEN GESAMTEN BILDER-POOL LEEREN ---
      gefundeneBilder.value = {};
      zuordnungen.value = [];
      if (fileInput.value) fileInput.value.value = '';
      showToast("Bilder-Pool geleert", "info");
    } 
    else if (mode === 'einzelbild') {
      // --- EINZELNES BILD AUS DEM POOL ENTFERNEN ---
      const name = deleteModal.bildName;
      delete gefundeneBilder.value[name];
      // Match-Zahlen beim Schüler entfernen
      zuordnungen.value = zuordnungen.value.filter(z => z.bild !== name);
      showToast("Bild entfernt", "info");
    }
  } catch (error) {
    console.error("Fehler beim Löschen:", error);
    showToast("Aktion fehlgeschlagen", "danger");
  } finally {
    // Modal in jedem Fall schließen
    deleteModal.show = false;
  }
}
// --- 6. VORSCHAU & HELPER ---
function previewLocalImage(name, url) {
  previewImage.value = { name, url };
}
async function fetchAndShowDBFoto(s) { 
  try {
    const r = await axios.get(`/schueler/${s.id}/stammdaten`); 
    const fotoB64 = r?.data?.foto || '';
const mime = guessImageMimeFromBase64(fotoB64);
previewImage.value = { url: `data:${mime};base64,${fotoB64}`, name: `${s.vorname} ${s.nachname}` };

  } catch { showToast("Fehler beim Laden", "danger"); }
}



function showToast(msg, type = 'info') { toast.value = { show: true, message: msg, type }; setTimeout(() => toast.value.show = false, 3000); }
function logout() { isLoggedIn.value = false; }
function resetMatches() { zuordnungen.value = []; }

const getMatchIndex = (id) => { const i = zuordnungen.value.findIndex(z => z.sId === id); return i !== -1 ? i + 1 : null; }
const getMatchIndexByBild = (n) => { const i = zuordnungen.value.findIndex(z => z.bild === n); return i !== -1 ? i + 1 : null; }
const getMatchInfo = (n) => {
  const m = zuordnungen.value.find(z => z.bild === n);
  if (!m) return null;
  const s = selectedKlasse.value?.schueler.find(sch => sch.id === m.sId);
  return { schuelerName: s ? s.nachname : '?', reason: m.reason };
}

// --- 7. KAMERA-LOGIK ---
async function startCamera(s) {
  camera.schueler = s;
  camera.active = true;
  resetCamAdjust();

  try {
    const targetAR = 119 / 160; // ~0.74375 (Portrait)

    // Wichtig: wenn schon ein Stream läuft -> stoppen
    if (camera.stream) {
      camera.stream.getTracks().forEach(t => t.stop());
      camera.stream = null;
    }

    // Portrait-Constraints: verringert Pillarboxing stark
    const constraints = {
      video: {
        facingMode: "user",
        aspectRatio: { ideal: targetAR },
        width: { ideal: 960 },   // Portrait-ish, ausreichend scharf
        height: { ideal: 1280 }, // Portrait-ish
        // optional: frameRate: { ideal: 30 }
      }
    };

    camera.stream = await navigator.mediaDevices.getUserMedia(constraints);

    // Warten bis Video-Metadaten da sind (zuverlässiger als setTimeout)
    await new Promise((resolve, reject) => {
      const el = videoPlayer.value;
      if (!el) return resolve();

      el.onloadedmetadata = () => resolve();
      el.onerror = (e) => reject(e);

      el.srcObject = camera.stream;
      // iOS/Safari: play() nötig; in Electron meistens ok
      const p = el.play?.();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    });

  } catch (err) {
    console.error("Kamera-Fehler:", err);
    showToast("Kamera konnte nicht gestartet werden. Prüfe die Berechtigungen.", "danger");
    camera.active = false;
  }
}


function stopCamera() {
  if (camera.stream) {
    // Schaltet das Kamera-Licht (Hardware) wieder aus
    camera.stream.getTracks().forEach(track => track.stop());
  }
  camera.active = false;
  camera.stream = null;
  camera.schueler = null;
}

// --- 7. KAMERA-LOGIK ---

async function capturePhoto() {
  if (canEditSchueler.value !== true) {
  showToast("Keine Berechtigung.", "danger");
  return;
}

  try {
    const video = videoPlayer.value;
    const s = camera.schueler;
    if (!video || !s) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) {
      showToast("Kamera ist noch nicht bereit.", "danger");
      return;
    }

    const factor = 3;
    const outW = 119 * factor;
    const outH = 160 * factor;

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // bessere Downscale-Qualität
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const targetAR = outW / outH;
    const videoAR = vw / vh;

    let sx, sy, sW, sH;

    // Center-Crop auf Ziel-Seitenverhältnis (cover)
    if (videoAR > targetAR) {
      // Video zu breit → links/rechts weg
      sH = vh;
      sW = vh * targetAR;
      sx = (vw - sW) / 2;
      sy = 0;
    } else {
      // Video zu hoch → oben/unten weg
      sW = vw;
      sH = vw / targetAR;
      sx = 0;
      sy = (vh - sH) / 2;
    }

    // Zoom (zentriert)
    const z = Math.max(1, Number(camAdjust?.zoom ?? 1));
    const newSW = sW / z;
    const newSH = sH / z;

    sx = sx + (sW - newSW) / 2;
    sy = sy + (sH - newSH) / 2;
    sW = newSW;
    sH = newSH;

    // Rundung + Clamp (verhindert 1px-Ränder & OOB)
    sx = Math.max(0, Math.round(sx));
    sy = Math.max(0, Math.round(sy));
    sW = Math.max(1, Math.min(vw - sx, Math.round(sW)));
    sH = Math.max(1, Math.min(vh - sy, Math.round(sH)));

    // Filter anwenden
    const b = Number(camAdjust?.brightness ?? 100);
    const c = Number(camAdjust?.contrast ?? 100);
    const sat = Number(camAdjust?.saturate ?? 100);
    ctx.filter = `brightness(${b}%) contrast(${c}%) saturate(${sat}%)`;

    // Draw
    ctx.clearRect(0, 0, outW, outH);
    ctx.drawImage(video, sx, sy, sW, sH, 0, 0, outW, outH);

    // DataURL für direkten Upload (enthält bereits data:image/jpeg;base64,...)
    const dataUrlForUpload = canvas.toDataURL('image/jpeg', 0.9);

    // Filter zurücksetzen (optional)
    ctx.filter = 'none';

    // Blob für lokalen Pool (blob: URL)
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.9)
    );

    if (!blob) {
      showToast("Foto konnte nicht erzeugt werden.", "danger");
      return;
    }

    const blobUrl = URL.createObjectURL(blob);

    const sanitize = (x) => String(x ?? '').trim().replace(/\s+/g, '_');
    const klassenName = sanitize(selectedKlasse.value?.kuerzel || '00');
    const dateiName =
      `${klassenName}_${sanitize(s.nachname)}_${sanitize(s.vorname)}_${s.id}.jpg`;

    // Bild im Pool speichern/überschreiben (Backup + Vorschau)
    gefundeneBilder.value[dateiName] = { url: blobUrl, isLive: true };

    // Match setzen/aktualisieren (Fallback, falls Upload fehlschlägt)
    const idx = zuordnungen.value.findIndex(z => z.sId === s.id);
    if (idx !== -1) {
      zuordnungen.value[idx].bild = dateiName;
      zuordnungen.value[idx].reason = 'Live (Update)';
    } else {
      zuordnungen.value.push({ sId: s.id, bild: dateiName, reason: 'Live' });
    }

    // ✅ Direkt-Upload von Live-Fotos (wenn aktiviert)
    if (AUTO_UPLOAD_LIVE === true) {
      uploadStatus.active = true;
      uploadStatus.total = 1;
      uploadStatus.current = 1;

      const result = await uploadFotoForSchueler(s.id, dataUrlForUpload);

      uploadStatus.active = false;

      if (result?.ok) {
        // UI sofort aktualisieren
        s.hatFoto = true;
        s.dbFotoUrl = dataUrlForUpload;

        // Zuordnung entfernen, weil bereits hochgeladen
        zuordnungen.value = zuordnungen.value.filter(z => z.sId !== s.id);

        showToast(`Live-Foto für ${s.vorname} gespeichert.`, 'success');
      } else {
        // Zuordnung bleibt bestehen → später per "Zuordnungen hochladen" erneut versuchen
        if (result?.code === 403) {
          showToast("Live-Upload abgebrochen: Keine Rechte (403).", "danger");
        } else if (result?.code === 404) {
          showToast(`Live-Upload fehlgeschlagen: Schüler ${s.id} nicht gefunden (404).`, "danger");
        } else {
          showToast(`Live-Upload fehlgeschlagen: ${result?.message ?? "Unbekannter Fehler"}`, "danger");
        }
      }
    } else {
      // klassisches Verhalten ohne Direkt-Upload
      if (idx !== -1) showToast(`Foto für ${s.vorname} aktualisiert`, 'info');
      else showToast(`Foto für ${s.vorname} erstellt`, 'success');
    }

    stopCamera();
  } catch (e) {
    console.error("capturePhoto Fehler:", e);
    showToast("Foto konnte nicht gespeichert werden.", "danger");
  } finally {
    // falls irgendwo vorher abgebrochen wurde
    if (uploadStatus.active && uploadStatus.total === 1) {
      uploadStatus.active = false;
    }
  }
}


// NEU: Einzelnes Bild auf Festplatte speichern
function downloadSingleImage(fileName) {
  const imageData = gefundeneBilder.value[fileName];
  if (!imageData) return;

  const link = document.createElement('a');
  link.href = imageData.url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("Bild gespeichert");
}

async function downloadAllLiveImages() {
  // 1. Alle Bilder finden, die das 'isLive' Flag haben
  const liveBilderNamen = Object.keys(gefundeneBilder.value).filter(name => 
    gefundeneBilder.value[name].isLive === true
  );

  if (liveBilderNamen.length === 0) {
    showToast("Keine Live-Fotos zum Exportieren gefunden.", "info");
    return;
  }

  showToast(`${liveBilderNamen.length} Fotos werden vorbereitet...`, "success");

  // 2. Schleife durch die gefundenen Live-Bilder
  for (const name of liveBilderNamen) {
    const data = gefundeneBilder.value[name];
    
    // Wir erstellen einen unsichtbaren Download-Link für jedes Bild
    const link = document.createElement('a');
    link.href = data.url;
    link.download = name; // Nutzt den generierten Namen: Klasse_Nachname_Vorname_ID.jpg
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Kleine Pause einbauen, damit der Browser nicht blockiert (optional)
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  showToast("Export abgeschlossen!", "success");
}



function zeigeLeerenModal() {
  deleteModal.show = true; // KEIN .value
  deleteModal.mode = 'pool';
  deleteModal.titel = 'Bilder-Pool leeren';
  deleteModal.nachricht = 'Möchtest du wirklich den Pool leeren und alle aktuellen Zuordnungen löschen?';
}

function entferneBildAusPool(dateiname) {
  deleteModal.show = true; // KEIN .value
  deleteModal.mode = 'einzelbild';
  deleteModal.bildName = dateiname;
  deleteModal.titel = 'Bild entfernen';
  deleteModal.nachricht = `Möchtest du das Bild "${dateiname}" wirklich aus dem Pool löschen?`;
}

const confirmDelete = (s) => {
  // User hat keine Änderungsrechte
  if (canEditSchueler.value !== true) {
    showToast("Keine Berechtigung zum Löschen.", "danger");
    return;
  } 


  //  Änderungsrechte vorhanden → normaler Löschdialog
  deleteModal.show = true;
  deleteModal.mode = 'svws';
  deleteModal.schueler = s;
  deleteModal.titel = 'Foto in Schild löschen?';
  deleteModal.nachricht =
    `Möchtest du das Foto von ${s.vorname} ${s.nachname} in der Schülerdatenbank wirklich löschen?`;
};


import jw from './assets/jw.jpg';
const spendeHTML = `
    <div class="text-center">
        <div class="mb-3">
            <img src="${jw}" alt="Profilfoto" class="rounded-circle shadow-sm" style="width: 75px; height: 75px; object-fit: cover;">
        </div>
                
        <p class="text-muted mb-3" style="font-size: 0.85rem; line-height: 1.5;">
            Ich entwickle dieses Tool, damit der Foto-Workflow in Schulen stressfrei läuft. 
            Ich glaube fest an Open Source, aber Code schreibt sich leider nicht von allein.
            Jeder Euro hilft mir, das Projekt unabhängig und werbefrei zu halten.
        </p>

        <div class="d-grid gap-2">
            <a href="https://paypal.me/DEIN_NAME/5" target="_blank" class="btn btn-outline-primary btn-sm rounded-pill fw-bold d-flex justify-content-between align-items-center text-decoration-none px-3">
                <span>Kleiner Support</span> <span>5 €</span>
            </a>
            <a href="https://paypal.me/DEIN_NAME/10" target="_blank" class="btn btn-outline-primary btn-sm rounded-pill fw-bold d-flex justify-content-between align-items-center text-decoration-none px-3">
                <span>Standard</span> <span>10 €</span>
            </a>
            <a href="https://paypal.me/DEIN_NAME" target="_blank" class="btn btn-outline-secondary btn-sm rounded-pill fw-bold text-decoration-none">
                Anderer Betrag
            </a>
        </div>
        
        <p class="mt-3 mb-0 small text-secondary" style="font-size: 0.75rem;">
    Vielen Dank für deine Hilfe! JW <i class="bi bi-emoji-smile ms-1"></i>
</p>
    </div>
`;

function zeigeInfoModal() {
  infoModal.titel = "Unterstütze das Projekt";
  infoModal.html = spendeHTML;
  infoModal.show = true;
}



</script>




<template src="./App.html"></template>
<style scoped src="./App.css"></style>