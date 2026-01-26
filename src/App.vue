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


// Stelle sicher, dass dieses Objekt existiert!
const camera = reactive({
    active: false,
    schueler: null,
    stream: null
});

const videoPlayer = ref(null);
const captureCanvas = ref(null);

// --- 2. COMPUTED ---
const sortierteSchueler = computed(() => {
  if (!selectedKlasse.value?.schueler) return [];
  return [...selectedKlasse.value.schueler].sort((a,b) => a.nachname.localeCompare(b.nachname));
});

const anzahlBilderImPool = computed(() => {
  return Object.keys(gefundeneBilder.value).length;
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
  const mode = deleteModal.mode;

  try {
    if (mode === 'svws') {
      // --- DEIN ERFOLGREICHER WEG ---
      const s = deleteModal.schueler;
      await axios.patch(`/schueler/${s.id}/stammdaten`, { foto: "" });
      
      s.hatFoto = false; // Icon in der Liste aktualisieren
      showToast(`Foto von ${s.vorname} ${s.nachname} gelöscht`, "success");
    } 
    else if (mode === 'pool') {
      // --- DEN GESAMTEN BILDER-POOL LEEREN ---
      gefundeneBilder.value = {};
      zuordnungen.value = [];
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
function previewLocalImage(name, url) { previewImage.value = { url, name }; }

async function fetchAndShowDBFoto(s) { 
  try {
    const r = await axios.get(`/schueler/${s.id}/stammdaten`); 
    previewImage.value = { url: `data:image/jpeg;base64,${r.data.foto}`, name: `${s.vorname} ${s.nachname}` }; 
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
  
  try {
    // Fragt den Browser nach Erlaubnis für die Kamera
    camera.stream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        width: { ideal: 1280 }, 
        height: { ideal: 720 }, 
        facingMode: "user" 
      } 
    });
    
    // Kurze Verzögerung, damit Vue das Video-Element im Modal erst rendern kann
    setTimeout(() => {
      if (videoPlayer.value) {
        videoPlayer.value.srcObject = camera.stream;
      }
    }, 200);
    
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
  if (!videoPlayer.value || !captureCanvas.value || !camera.schueler) return;

  const video = videoPlayer.value;
  const canvas = captureCanvas.value;
  const context = canvas.getContext('2d');
  const s = camera.schueler;

  // --- KLASSEN-RETTUNG ---
  let klassenName = '00';
  if (selectedKlasse.value && selectedKlasse.value.kuerzel) {
    klassenName = selectedKlasse.value.kuerzel.replace(/\s+/g, '_');
  }

  // --- AUFLÖSUNG & SCHNITT ---
  const factor = 3;
  canvas.width = 119 * factor;
  canvas.height = 160 * factor;

  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;
  const sourceAspect = sourceWidth / sourceHeight;
  const targetAspect = 119 / 160;

  let drawWidth, drawHeight, offsetX, offsetY;
  if (sourceAspect > targetAspect) {
    drawWidth = sourceHeight * targetAspect;
    drawHeight = sourceHeight;
    offsetX = (sourceWidth - drawWidth) / 2;
    offsetY = 0;
  } else {
    drawWidth = sourceWidth;
    drawHeight = sourceWidth / targetAspect;
    offsetX = 0;
    offsetY = (sourceHeight - drawHeight) / 2;
  }

  // Bild zeichnen
  context.drawImage(video, offsetX, offsetY, drawWidth, drawHeight, 0, 0, canvas.width, canvas.height);
  
  const imageData = canvas.toDataURL('image/jpeg', 0.9);
  const response = await fetch(imageData);
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
    
  const saubererName = s.nachname.replace(/\s+/g, '_');
  const saubererVorname = s.vorname.replace(/\s+/g, '_');
  const dateiName = `${klassenName}_${saubererName}_${saubererVorname}_${s.id}.jpg`;
  
  // 1. Bild im Pool speichern/überschreiben
  gefundeneBilder.value[dateiName] = { 
    url: blobUrl,
    isLive: true 
  };
  
  // 2. LOGIK: Existiert bereits ein Match für diesen Schüler?
  const bestehenderMatchIndex = zuordnungen.value.findIndex(z => z.sId === s.id);

  if (bestehenderMatchIndex !== -1) {
    // Vorhandenen Match aktualisieren (verhindert Erhöhung der Anzahl)
    zuordnungen.value[bestehenderMatchIndex].bild = dateiName;
    zuordnungen.value[bestehenderMatchIndex].reason = 'Live (Update)';
    showToast(`Foto für ${s.vorname} aktualisiert`, 'info');
  } else {
    // Neuen Match hinzufügen
    zuordnungen.value.push({ 
      sId: s.id, 
      bild: dateiName, 
      reason: 'Live' 
    });
    showToast(`Foto für ${s.vorname} erstellt`, 'success');
  }

  stopCamera();
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




function leereBilderPool() {
  if (confirm("Möchtest du wirklich den Pool leeren und alle aktuellen Zuordnungen löschen?")) {
    gefundeneBilder.value = {};
    zuordnungen.value = [];
    showToast("Bilder-Pool wurde geleert", "info");
  }
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
  // Das alert kannst du jetzt entfernen, wenn du magst
  deleteModal.show = true; // KEIN .value
  deleteModal.mode = 'svws';
  deleteModal.schueler = s;
  deleteModal.titel = 'Foto in Schild löschen';
  deleteModal.nachricht = `Möchtest du das Foto von ${s.vorname} ${s.nachname} wirklich löschen?`;
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
  deleteModal.titel = "Unterstütze das Projekt";
  deleteModal.mode = "info"; // Wichtig für das v-if oben!
  deleteModal.nachricht = spendeHTML; // Hier kommt dein langer String mit der Karte rein
  deleteModal.show = true;
}



</script>




<template src="./App.html"></template>
<style scoped src="./App.css"></style>