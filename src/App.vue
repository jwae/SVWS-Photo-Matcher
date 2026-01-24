<template src="./App.html"></template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import axios from 'axios'
import { scaleImage } from './imageUtils.js' // Die ausgelagerte Funktion

// --- 1. STATES ---
const serverName = ref('https://localhost'); 
const dbName = ref(''); 
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
const deleteModal = reactive({ show: false, schueler: null });
const toast = ref({ show: false, message: '', type: 'info' });
const uploadStatus = reactive({ active: false, current: 0, total: 0 });

// --- 2. COMPUTED ---
const sortierteSchueler = computed(() => {
  if (!selectedKlasse.value?.schueler) return [];
  return [...selectedKlasse.value.schueler].sort((a,b) => a.nachname.localeCompare(b.nachname));
});

// --- 3. API & AUTH ---
async function ladeSchemata() {
  isLoadingSchemata.value = true;
  try {
    const base = serverName.value.trim().replace(/\/+$/, "");
    const res = await axios.get(`${base}/config/db/schemata`);
    schemataListe.value = res.data.map(i => typeof i === 'object' ? i.name : i);
    if (schemataListe.value.length > 0) dbName.value = schemataListe.value[0];
  } catch (e) { showToast("Server nicht erreichbar", "danger"); } 
  finally { isLoadingSchemata.value = false; }
}

async function performLogin() {
  isLoggingIn.value = true;
 
  zuordnungen.value = [];       // Löscht die Matches
  gefundeneBilder.value = {};   // Löscht den Bilderpool

  try {
    const base = serverName.value.trim().replace(/\/+$/, "");
    axios.defaults.baseURL = `${base}/db/${dbName.value}`;
    axios.defaults.auth = credentials;
    const res = await axios.get('/klassen/abschnitt/01');
    klassenListe.value = res.data; 
    isLoggedIn.value = true;
    if (klassenListe.value.length > 0) { 
      selectedKlasse.value = klassenListe.value[0]; 
      await handleKlassenWechsel(); 
    }
  } catch (e) { showToast("Login fehlgeschlagen", "danger"); } 
  finally { isLoggingIn.value = false; }
}

async function handleKlassenWechsel() {
  if (!selectedKlasse.value) return;
  const schuelerArray = selectedKlasse.value.schueler;
  for (let s of schuelerArray) {
    try { 
      const r = await axios.get(`/schueler/${s.id}/stammdaten`); 
      s.hatFoto = !!(r.data.foto && r.data.foto.length > 0); 
    } catch { s.hatFoto = false; }
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
    showToast("Bilder-Pool ist leer. Bitte zuerst Ordner laden.", "info");
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

  // Initialisierung des Status-Overlays
  uploadStatus.active = true; 
  uploadStatus.total = zuordnungen.value.length;
  uploadStatus.current = 0;
  
  let erfolge = 0;
  let fehler = 0;

  // Wir arbeiten mit einer Kopie, um das Original-Array während des Prozesses zu leeren
  const matchesToUpload = [...zuordnungen.value];

  for (let z of matchesToUpload) {
    try {
      uploadStatus.current++;

      // 1. Bild aus dem Pool holen
      const bildDaten = gefundeneBilder.value[z.bild];
      if (!bildDaten) throw new Error("Bild nicht mehr im Pool");

      // 2. Skalieren (exakt 119x160 für SVWS)
      const scaledDataUrl = await scaleImage(bildDaten.url, 119, 160);
      
      // 3. Base64-Teil extrahieren
      const base64String = scaledDataUrl.split(',')[1];

      // 4. API-Request (PATCH für Teil-Update der Stammdaten)
      await axios.patch(`/schueler/${z.sId}/stammdaten`, { 
        foto: base64String 
      });

      // 5. UI im Hintergrund aktualisieren (Blauer Kamera-Icon)
      const schueler = selectedKlasse.value?.schueler.find(s => s.id === z.sId);
      if (schueler) schueler.hatFoto = true;

      // 6. Aus der Zuordnungsliste entfernen (bei Erfolg)
      zuordnungen.value = zuordnungen.value.filter(item => item.sId !== z.sId);
      erfolge++;

    } catch (err) {
      console.error(`Fehler bei ID ${z.sId}:`, err);
      fehler++;
    }
  }

  // Abschluss-Feedback
  uploadStatus.active = false;
  
  if (fehler === 0) {
    showToast(`${erfolge} Fotos erfolgreich übertragen!`, 'success');
  } else if (erfolge > 0) {
    showToast(`${erfolge} erfolgreich, ${fehler} fehlgeschlagen.`, 'info');
  } else {
    showToast("Upload komplett fehlgeschlagen. Prüfen Sie die Verbindung.", 'danger');
  }
}

async function executeDelete() {
  try {
    await axios.patch(`/schueler/${deleteModal.schueler.id}/stammdaten`, { foto: "" });
    deleteModal.schueler.hatFoto = false; 
    deleteModal.show = false;
    showToast("Foto gelöscht");
  } catch { showToast("Löschen fehlgeschlagen", "danger"); }
}

// --- 6. VORSCHAU & HELPER ---
function previewLocalImage(name, url) { previewImage.value = { url, name }; }

async function fetchAndShowDBFoto(s) { 
  try {
    const r = await axios.get(`/schueler/${s.id}/stammdaten`); 
    previewImage.value = { url: `data:image/jpeg;base64,${r.data.foto}`, name: `${s.vorname} ${s.nachname}` }; 
  } catch { showToast("Fehler beim Laden", "danger"); }
}

function confirmDelete(s) { deleteModal.schueler = s; deleteModal.show = true; }
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
</script>

<style scoped src="./App.css"></style>