<template>
  <div class="container-fluid py-4 bg-light min-vh-100 position-relative text-dark font-sans">
    
    <div v-if="toast.show" class="import-notification">
      <div class="d-flex align-items-center px-4 py-3 rounded-pill shadow-lg border animate-fade-in" 
           :class="toast.type === 'success' ? 'bg-success text-white border-success' : 'bg-dark text-white border-secondary'">
        <i class="bi me-3 fs-5" :class="toast.type === 'success' ? 'bi-check-circle-fill' : 'bi-info-circle'"></i>
        <span class="fw-bold">{{ toast.message }}</span>
      </div>
    </div>

    <div v-if="!isLoggedIn" class="row justify-content-center pt-5">
      <div class="col-md-4 ">
        <div class="card shadow border-1 p-4 rounded-4">
          <h4 class="fw-bold mb-4 text-center text-secondary">SVWS Photo-Matcher</h4>
          
          <div class="mb-3">
            <label class="small fw-bold text-muted mb-1 ps-1">Server URL</label>
            <div class="input-group shadow-sm rounded-3 overflow-hidden">
              <input v-model="serverName" type="text" class="form-control border-1 bg-light">
              <button @click="ladeSchemata" class="btn btn-primary" :disabled="isLoadingSchemata">
                <i v-if="isLoadingSchemata" class="spinner-border spinner-border-sm"></i>
                <i v-else class="bi bi-arrow-clockwise"></i>
              </button>
            </div>
          </div>

          <div class="mb-3">
            <label class="small fw-bold text-muted mb-1 ps-1">Datenbank (Schema)</label>
            <select v-model="dbName" class="form-select border-1 bg-light shadow-none" :disabled="schemataListe.length === 0">
              <option value="" disabled>-- Schema wählen --</option>
              <option v-for="s in schemataListe" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>

          <div class="mb-3">
            <label class="small fw-bold text-muted mb-1 ps-1">Benutzername</label>
            <input v-model="credentials.username" type="text" class="form-control border-1 bg-light">
          </div>
          <div class="mb-4">
            <label class="small fw-bold text-muted mb-1 ps-1">Passwort</label>
            <input v-model="credentials.password" type="password" class="form-control border-1 bg-light" @keyup.enter="performLogin">
          </div>
          
          <button @click="performLogin" class="btn btn-primary w-100 fw-bold py-2 shadow" :disabled="!dbName || isLoggingIn">
            <span v-if="isLoggingIn" class="spinner-border spinner-border-sm me-2"></span>
            ANMELDEN
          </button>
        </div>
      </div>
    </div>

    <div v-else class="row g-4 animate-fade-in">
      
      <div class="col-12">
        <div class="card border-0 shadow-sm p-3 bg-white rounded-4">
          <div class="d-flex flex-row justify-content-between align-items-center mb-3">
            <div>
              <h4 class="mb-0 fw-bold text-primary">SVWS Photo-Matcher</h4>
              <small class="text-muted">Datenbank: <strong>{{ dbName }}</strong></small>
            </div>
            <div class="d-flex gap-2">
              <button @click="$refs.fileInput.click()" class="btn btn-outline-primary btn-sm fw-bold px-3 rounded-pill">
                <i class="bi bi-folder-plus me-1"></i> Ordner laden
              </button>
              <input type="file" ref="fileInput" @change="handleFolderUpload" webkitdirectory directory multiple hidden>
              
              <button v-if="zuordnungen.length > 0" @click="uploadAllMatches" class="btn btn-success btn-sm fw-bold px-3 rounded-pill shadow-sm" :disabled="uploadStatus.active">
                <i class="bi bi-cloud-upload me-1"></i> {{ zuordnungen.length }} Matches hochladen
              </button>
              <button @click="logout" class="btn btn-primary btn-sm fw-bold px-3 rounded-pill">Logout</button>
            </div>
          </div>

          <div class="alert alert-info border-0 mb-0 py-2 px-3 rounded-3 d-flex align-items-center shadow-sm">
            <i class="bi bi-info-circle-fill me-3 fs-5"></i>
            <div class="small">
              <strong>Anleitung:</strong> Wählen Sie links einen <strong>Schüler</strong> und dann rechts das <strong>Foto</strong>. 
              <span class="badge bg-primary-subtle text-primary border border-primary-subtle mx-1"><i class="bi bi-magic"></i> Auto-Match</span> ordnet Bilder automatisch nach Name oder ID zu.
            </div>
          </div>
        </div>
      </div>

      <div class="col-md-7">
        <div class="card shadow-sm border-0 h-100 rounded-4 overflow-hidden">
          <div class="card-header bg-primary text-white d-flex align-items-center py-3 border-0">
            <h5 class="mb-0 fw-bold me-3">Klasse</h5>
            <select v-model="selectedKlasse" class="form-select form-select-sm w-auto border-0 shadow-sm" @change="handleKlassenWechsel">
              <option v-for="k in klassenListe" :key="k.id" :value="k">{{ k.kuerzel }}</option>
            </select>
            <div class="ms-auto d-flex gap-2">
              <button v-if="zuordnungen.length > 0" @click="resetMatches" class="btn btn-outline-light btn-sm fw-bold px-3 rounded-pill">Matches-Löschen</button>
              <button @click="autoMatch" class="btn btn-light btn-sm fw-bold text-primary shadow-sm px-3 rounded-pill d-flex align-items-center gap-2">
                <i class="bi bi-magic"></i> Auto-Match
              </button>
            </div>
          </div>
          <div class="card-body p-0 overflow-auto" style="max-height: 65vh;">
            <table class="table table-hover align-middle mb-0">
              <thead class="table-light sticky-top">
                <tr>
                  <th class="text-center" style="width: 60px;">Link</th>
                  <th class="text-center" style="width: 70px;">SVWS</th>
                  <th class="text-center" style="width: 80px;">ID</th>
                  <th>Name, Vorname</th>
                  <th class="text-end pe-3" style="width: 80px;">Foto</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="s in sortierteSchueler" :key="s.id" 
                    @click="handleSchuelerKlick(s)" 
                    :class="{'selected-row': selectedSchueler && selectedSchueler.id === s.id}" 
                    class="cursor-pointer">
                  <td class="text-center">
                    <div v-if="getMatchIndex(s.id)" class="match-circle mx-auto">{{ getMatchIndex(s.id) }}</div>
                    <i v-else class="bi bi-person opacity-25"></i>
                  </td>
                  <td class="text-center">
                    <i v-if="s.hatFoto" class="bi bi-camera-fill text-primary fs-4" @click.stop="fetchAndShowDBFoto(s)"></i>
                    <i v-else class="bi bi-camera text-muted opacity-25 fs-4"></i>
                  </td>
                  
                  <td class="text-center">
                    <span class="badge bg-light text-secondary border font-monospace px-2 py-1" style="font-size: 0.75rem;">
                      {{ s.id }}
                    </span>
                  </td>


                  <td class="fw-medium">{{ s.nachname }}, {{ s.vorname }}</td>
                  <td class="text-end pe-3">
                    <button v-if="s.hatFoto" class="btn btn-link btn-sm text-danger p-0" title="Foto aus Datenbank löschen" @click.stop="confirmDelete(s)">
                      <i class="bi bi-trash"></i>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="col-md-5">
        <div class="card shadow-sm border-0 h-100 rounded-4 overflow-hidden">
          <div class="card-header bg-success text-white py-3 border-0">
            <h5 class="mb-0 fw-bold">Bilder Pool</h5>
          </div>
          <div class="card-body p-0 overflow-auto" style="max-height: 65vh;">
            <table class="table table-hover align-middle mb-0" style="table-layout: fixed;">
              <tbody>
                <tr v-for="(data, name) in gefundeneBilder" :key="name" 
                    class="cursor-pointer" @click="handleBildKlick(name)">
                  <td style="width: 75px;" class="ps-3">
                    <div class="position-relative" style="width: 50px;">
                      <img :src="data.url" class="rounded border shadow-sm" style="width: 50px; height: 50px; object-fit: cover;">
                      <div v-if="getMatchIndexByBild(name)" class="match-circle floating-badge">{{ getMatchIndexByBild(name) }}</div>
                    </div>
                  </td>
                  <td class="overflow-hidden">
                    <div class="fw-bold small text-truncate" :title="name">{{ name }}</div>
                    <div v-if="getMatchInfo(name)" class="d-flex align-items-center gap-1 mt-1">
                        <span class="text-success fw-bold x-small text-truncate" style="max-width: 100px;">{{ getMatchInfo(name).schuelerName }}</span>
                        <span class="badge bg-secondary-subtle text-dark x-small-badge">{{ getMatchInfo(name).reason }}</span>
                    </div>
                  </td>
                  <td class="text-end pe-3" style="width: 60px;">
                    <button class="btn btn-outline-secondary btn-sm border-0 rounded-circle preview-btn" @click.stop="previewLocalImage(name, data.url)">
                      <i class="bi bi-search"></i>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <div v-if="previewImage" class="modal-backdrop glass-backdrop" @click="previewImage = null"></div>
    <div v-if="previewImage" class="modal show d-block" @click.self="previewImage = null">
      <div class="modal-dialog modal-sm modal-dialog-centered">
        <div class="modal-content border-0 rounded-4 shadow-lg overflow-hidden bg-white">
          
          <div class="modal-header border-0 pb-0 p-3">
            <h6 class="modal-title fw-bold text-truncate" :title="previewImage.name">{{ previewImage.name }}</h6>
            <button @click="previewImage = null" class="btn-close small shadow-none"></button>
          </div>
          
          <div class="modal-body p-3 text-center">
            <div class="d-inline-block p-1 bg-white border rounded shadow-sm">
              <img :src="previewImage.url" class="portrait-preview-small">
            </div>
            
            <div class="mt-2">
              <small v-if="previewImage.url.startsWith('data:')" class="badge bg-primary-subtle text-primary" style="font-size: 0.6rem;">
                DATENBANK, 119px x 160px
              </small>
              <small v-else class="badge bg-success-subtle text-success" style="font-size: 0.6rem;">
                LOKALE DATEI
              </small>
            </div>



          </div>

        </div>
      </div>
    </div>

    <div v-if="deleteModal.show" class="modal-backdrop"></div>
    <div v-if="deleteModal.show" class="modal show d-block">
      <div class="modal-dialog modal-sm modal-dialog-centered">
        <div class="modal-content border-0 shadow rounded-4 p-4 text-center">
          <i class="bi bi-exclamation-triangle text-danger fs-1 mb-2"></i>
          <h6 class="fw-bold mb-3">Foto von {{ deleteModal.schueler?.vorname }} {{ deleteModal.schueler?.nachname }} löschen?</h6>
          <div class="d-flex gap-2">
            <button class="btn btn-light w-100" @click="deleteModal.show = false">Abbrechen</button>
            <button class="btn btn-danger w-100" @click="executeDelete">Löschen</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="uploadStatus.active" class="upload-overlay d-flex align-items-center justify-content-center">
      <div class="card p-4 shadow-lg border-0 text-center rounded-4">
        <div class="spinner-border text-primary mb-3"></div>
        <h5 class="fw-bold">Übertragung läuft...</h5>
        <div class="text-muted small">Bild {{ uploadStatus.current }} von {{ uploadStatus.total }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import axios from 'axios'

// --- States ---
const serverName = ref('https://localhost'); 
const dbName = ref(''); 
const schemataListe = ref([]);
const isLoadingSchemata = ref(false); 
const isLoggedIn = ref(false); 
const isLoggingIn = ref(false);
const credentials = reactive({ username: 'waed', password: 'devau' });
const klassenListe = ref([]); 
const selectedKlasse = ref(null); 
const selectedSchueler = ref(null);
const zuordnungen = ref([]); 
const gefundeneBilder = ref({}); 
const previewImage = ref(null);
const deleteModal = reactive({ show: false, schueler: null });
const toast = ref({ show: false, message: '', type: 'info' });
const uploadStatus = reactive({ active: false, current: 0, total: 0 });

// --- Computed ---
const sortierteSchueler = computed(() => {
  if (!selectedKlasse.value?.schueler) return [];
  return [...selectedKlasse.value.schueler].sort((a,b) => a.nachname.localeCompare(b.nachname));
});

// --- API ---
async function ladeSchemata() {
  isLoadingSchemata.value = true;
  try {
    const base = serverName.value.trim().replace(/\/+$/, "");
    const res = await axios.create().get(`${base}/config/db/schemata`);
    schemataListe.value = res.data.map(i => typeof i === 'object' ? i.name : i);
    if (schemataListe.value.length > 0) dbName.value = schemataListe.value[0];
  } catch (e) { showToast("Server nicht erreichbar", "danger"); } 
  finally { isLoadingSchemata.value = false; }
}

async function performLogin() {
  isLoggingIn.value = true;
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
  autoMatch();
}

// --- Bild & Match Handling ---
function handleFolderUpload(e) {
  const files = Array.from(e.target.files);
  files.forEach(f => { 
    if (f.type.startsWith('image/')) {
      gefundeneBilder.value[f.name] = { url: URL.createObjectURL(f) }; 
    }
  });
  showToast(`${Object.keys(gefundeneBilder.value).length} Bilder geladen`, 'info');
}

function autoMatch() {
  const pool = Object.keys(gefundeneBilder.value);
  let neueTreffer = 0;

  sortierteSchueler.value.forEach(s => {
    // Falls bereits ein Match existiert (auch manuell), überspringen
    if (zuordnungen.value.some(z => z.sId === s.id)) return;
    
    const sName = s.nachname.toLowerCase();
    const sId = String(s.id);
    
    const m = pool.find(fileName => {
      const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "").toLowerCase();
      return nameWithoutExt.includes(sName) || nameWithoutExt.includes(sId);
    });

    if (m) {
      zuordnungen.value.push({ sId: s.id, bild: m, reason: 'Auto' });
      neueTreffer++;
    }
  });

  // Schöne Rückmeldung geben
  if (neueTreffer > 0) {
    showToast(`Erfolg: ${neueTreffer} Schüler automatisch zugeordnet!`, 'success');
  } else if (pool.length > 0) {
    showToast('Keine neuen Übereinstimmungen gefunden.', 'info');
  }
}

function handleSchuelerKlick(s) {
  const i = zuordnungen.value.findIndex(z => z.sId === s.id);
  if (i !== -1) {
    zuordnungen.value.splice(i, 1);
  } else {
    selectedSchueler.value = (selectedSchueler.value?.id === s.id) ? null : s;
  }
}

function handleBildKlick(n) {
  const i = zuordnungen.value.findIndex(z => z.bild === n);
  if (i !== -1) {
    zuordnungen.value.splice(i, 1);
  } else if (selectedSchueler.value) { 
    zuordnungen.value.push({ sId: selectedSchueler.value.id, bild: n, reason: 'Manuell' }); 
    selectedSchueler.value = null; 
  }
}

// --- Preview & Löschen ---
// Vorschau für lokale Bilder aus dem Pool
function previewLocalImage(name, url) { 
  previewImage.value = { 
    url: url, 
    name: name // Der Dateiname
  }; 
}

// Vorschau für vorhandene Bilder aus der SVWS-Datenbank
async function fetchAndShowDBFoto(s) { 
  try {
    const r = await axios.get(`/schueler/${s.id}/stammdaten`); 
    previewImage.value = { 
      url: `data:image/jpeg;base64,${r.data.foto}`, 
      name: `${s.vorname} ${s.nachname}` // Der Schülername
    }; 
  } catch { 
    showToast("Fehler beim Laden des Datenbank-Fotos", "danger"); 
  }
}

function confirmDelete(s) { deleteModal.schueler = s; deleteModal.show = true; }

async function executeDelete() {
  try {
    await axios.patch(`/schueler/${deleteModal.schueler.id}/stammdaten`, { foto: "" });
    deleteModal.schueler.hatFoto = false; deleteModal.show = false;
    showToast("Foto gelöscht", "info");
  } catch { showToast("Löschen fehlgeschlagen", "danger"); }
}

// --- Upload ---
async function uploadAllMatches() {
  uploadStatus.active = true; 
  uploadStatus.total = zuordnungen.value.length;
  uploadStatus.current = 0;
  
  for (let z of [...zuordnungen.value]) {
    try {
      uploadStatus.current++;
      // Proportionale Skalierung (Object-Fit)
      const img = await scaleImage(gefundeneBilder.value[z.bild].url, 119, 160);
      await axios.patch(`/schueler/${z.sId}/stammdaten`, { foto: img.split(',')[1] });
      const s = selectedKlasse.value.schueler.find(sch => sch.id === z.sId);
      if (s) s.hatFoto = true;
    } catch (e) { console.error("Upload error für ID " + z.sId, e); }
  }
  zuordnungen.value = []; 
  uploadStatus.active = false;
  showToast("Upload abgeschlossen", "success");
}

function scaleImage(url, tw, th) {
  return new Promise(res => {
    const img = new Image();
    img.src = url;
    img.onload = () => {
      const cvs = document.createElement('canvas');
      cvs.width = tw;
      cvs.height = th;
      const ctx = cvs.getContext('2d');

      // Hintergrund weiß füllen
      ctx.fillStyle = "#FFF";
      ctx.fillRect(0, 0, tw, th);

      const sourceAspect = img.width / img.height;
      const targetAspect = tw / th;

      let drawWidth, drawHeight, offsetX, offsetY;

      if (sourceAspect > targetAspect) {
        drawWidth = tw;
        drawHeight = tw / sourceAspect;
        offsetX = 0;
        offsetY = (th - drawHeight) / 2;
      } else {
        drawHeight = th;
        drawWidth = th * sourceAspect;
        offsetX = (tw - drawWidth) / 2;
        offsetY = 0;
      }

      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
      res(cvs.toDataURL('image/jpeg', 0.90));
    };
  });
}

// --- Helper ---
function showToast(msg, type) { 
  toast.value = { show: true, message: msg, type }; 
  setTimeout(() => toast.value.show = false, 3000); 
}
function resetMatches() { zuordnungen.value = []; }
function logout() { isLoggedIn.value = false; }
const getMatchIndex = (id) => { const i = zuordnungen.value.findIndex(z => z.sId === id); return i !== -1 ? i + 1 : null; }
const getMatchIndexByBild = (n) => { const i = zuordnungen.value.findIndex(z => z.bild === n); return i !== -1 ? i + 1 : null; }
const getMatchInfo = (n) => {
  const m = zuordnungen.value.find(z => z.bild === n);
  if (!m) return null;
  const s = selectedKlasse.value?.schueler.find(sch => sch.id === m.sId);
  return { schuelerName: s ? s.nachname : '?', reason: m.reason };
}
</script>

<style scoped>
/* Hervorhebung ausgewählter Schüler */
table tr.selected-row td { 
  background-color: #e7f1ff !important; 
  color: #0d6efd !important; 
  font-weight: bold; 
}
table tr.selected-row { box-shadow: inset 6px 0 0 #0d6efd; }

/* Match-Status Icons */
.match-circle { 
  width: 22px; height: 22px; background: #198754; color: white; 
  border-radius: 50%; display: flex; align-items: center; 
  justify-content: center; font-size: 10px; font-weight: bold; 
  border: 2px solid white; 
}
.floating-badge { position: absolute; top: -5px; left: -5px; z-index: 5; }

/* Interaktionen */
.preview-btn { width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; transition: 0.2s; }
.preview-btn:hover { background: #e9ecef; color: #0d6efd; transform: scale(1.1); }

/* Overlays */
.modal-backdrop { background: rgba(0,0,0,0.75); position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 1040; }
.upload-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255,255,255,0.85); z-index: 2000; backdrop-filter: blur(2px); }
.import-notification { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); z-index: 3000; }

.cursor-pointer { cursor: pointer; user-select: none; }
.x-small { font-size: 0.7rem; }


/* Animationen */
.animate-fade-in { animation: fadeIn 0.3s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }


.match-pulse {
  animation: pulse-green 1.5s ease-out;
}

@keyframes pulse-green {
  0% { background-color: rgba(25, 135, 84, 0.2); }
  100% { background-color: transparent; }
}

/* Optimierung der Badge-Optik */
.x-small-badge {
  font-size: 0.65rem;
  padding: 0.2rem 0.5rem;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  opacity: 0.8;
}


.glass-backdrop {
  background: rgba(15, 23, 42, 0.6) !important;
  backdrop-filter: blur(8px);
}

/* Container für das Bild */
.preview-image-container {
  background-color: #f8f9fa;
  display: inline-block;
  line-height: 0;
}

.portrait-preview {
  max-height: 60vh;
  min-width: 200px;
  object-fit: contain;
  /* Verhindert Pixelbildung bei kleinen Originalbildern */
  image-rendering: high-quality; 
}

/* Sanftes Einblenden des Modals */
.modal.show .modal-content {
  animation: zoomIn 0.2s ease-out;
}

@keyframes zoomIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}


.portrait-preview-small {
  /* Wir zeigen es etwas größer als 119px an (ca. Faktor 1.5) 
     damit man Details sieht, aber nicht so groß, dass es verpixelt */
  width: 180px; 
  height: auto;
  display: block;
  object-fit: contain;
  /* Knackige Darstellung auch bei kleinen Bildern */
  image-rendering: -webkit-optimize-contrast;
}

.glass-backdrop {
  background: rgba(0, 0, 0, 0.4) !important;
  backdrop-filter: blur(4px);
}

/* Modal-Größe für sm erzwingen, falls Bootstrap-Standard zu breit */
.modal-sm {
  max-width: 250px !important;
}
</style>