<script setup>
import { ref, reactive } from 'vue'
import axios from 'axios'
import { buildHelpHtml, clearAxiosSvwsConfig } from './gemeinsame-helfer.js'
import { useLoginVerwaltung } from './login-verwaltung.js'
import { useKlassenSchuelerliste } from './klassen-schuelerliste.js'
import { useBilderPool } from './bilder-pool.js'
import { useKameraModal } from './kamera-modal.js'
import LoginVerwaltung from './components/LoginVerwaltung.vue'
import KlassenSchuelerliste from './components/KlassenSchuelerliste.vue'
import BilderPool from './components/BilderPool.vue'
import KameraModal from './components/KameraModal.vue'
import GemeinsameHelfer from './components/GemeinsameHelfer.vue'

const isDemo = import.meta.env.VITE_APP_FLAVOR === 'demo'

const recentServers = ref([])
const selectedServer = ref('')
const showServerManager = ref(false)
const canEditSchueler = ref(null)
const allowTestIp = ref(false)

const serverName = ref(import.meta.env.DEV ? 'https://servername:Port' : '')
const dbName = ref('')
const loggedInUser = ref('')
const schemataListe = ref([])
const isLoadingSchemata = ref(false)
const isLoggedIn = ref(false)
const isLoggingIn = ref(false)
const credentials = reactive({ username: '', password: '' })
const klassenListe = ref([])
const selectedKlasse = ref(null)
const selectedSchueler = ref(null)
const zuordnungen = ref([])
const gefundeneBilder = ref({})
const previewImage = ref(null)

const deleteModal = reactive({
  show: false,
  mode: null,
  titel: '',
  nachricht: '',
  bildName: null,
  schueler: null,
})
const helpModal = reactive({ show: false, titel: 'Kurzhilfe', html: '' })
const toast = ref({ show: false, message: '', type: 'info' })
const uploadStatus = reactive({ active: false, current: 0, total: 0 })
const loginError = ref('')
const serverTest = reactive({ running: false, ok: null, title: '', details: '' })

function showToast(msg, type = 'info') {
  toast.value = { show: true, message: msg, type }
  setTimeout(() => {
    toast.value.show = false
  }, 3000)
}

const {
  sortierteSchueler,
  handleKlassenWechsel,
  handleSchuelerKlick,
  previewLocalImage,
  fetchAndShowDBFoto,
  resetMatches,
  getMatchIndex,
} = useKlassenSchuelerliste({
  selectedKlasse,
  selectedSchueler,
  zuordnungen,
  previewImage,
  showToast,
})

const {
  anzahlBilderImPool,
  revokeImageUrl,
  clearImagePool,
  handleFolderUpload,
  handleBildKlick,
  autoMatch,
  uploadAllMatches,
  uploadFotoForSchueler,
  executeDelete,
  downloadSingleImage,
  downloadAllLiveImages,
  zeigeLeerenModal,
  entferneBildAusPool,
  confirmDelete,
  getMatchIndexByBild,
  getMatchInfo,
} = useBilderPool({
  gefundeneBilder,
  zuordnungen,
  selectedSchueler,
  selectedKlasse,
  sortierteSchueler,
  uploadStatus,
  deleteModal,
  canEditSchueler,
  showToast,
})

const {
  camera,
  videoPlayer,
  camAdjust,
  previewFilterCss,
  resetCamAdjust,
  startCamera,
  stopCamera,
  capturePhoto,
} = useKameraModal({
  canEditSchueler,
  selectedKlasse,
  gefundeneBilder,
  zuordnungen,
  uploadStatus,
  showToast,
  uploadFotoForSchueler,
  revokeImageUrl,
})

const {
  displayServer,
  toggleAllowTestIp,
  rememberServer,
  removeSelectedServer,
  connectServer,
  applySelectedServer,
  performLogin,
} = useLoginVerwaltung({
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
})

function openHelp() {
  helpModal.titel = 'Kurzanleitung'
  helpModal.html = buildHelpHtml()
  helpModal.show = true
}

function closeHelp() {
  helpModal.show = false
}

function closeServerTest() {
  serverTest.ok = null
  serverTest.title = ''
  serverTest.details = ''
}

function closeDeleteModal() {
  deleteModal.show = false
}

function closePreview() {
  previewImage.value = null
}

function setVideoPlayerElement(element) {
  videoPlayer.value = element ?? null
}

function logout() {
  isLoggedIn.value = false
  loggedInUser.value = ''
  klassenListe.value = []
  selectedKlasse.value = null
  selectedSchueler.value = null
  canEditSchueler.value = null
  loginError.value = ''
  previewImage.value = null
  deleteModal.show = false
  helpModal.show = false
  stopCamera()
  zuordnungen.value = []
  clearImagePool()
  clearAxiosSvwsConfig(axios)
}
</script>

<template>
  <div class="container-fluid py-4 bg-light min-vh-100 position-relative text-dark font-sans">
    <GemeinsameHelfer
      :is-demo="isDemo"
      :toast="toast"
      :delete-modal="deleteModal"
      :can-edit-schueler="canEditSchueler"
      :preview-image="previewImage"
      :help-modal="helpModal"
      @close-delete-modal="closeDeleteModal"
      @execute-delete="executeDelete"
      @close-preview="closePreview"
      @close-help="closeHelp"
    />

    <LoginVerwaltung
      v-if="!isLoggedIn"
      :is-demo="isDemo"
      :server-name="serverName"
      :recent-servers="recentServers"
      :server-test="serverTest"
      :is-loading-schemata="isLoadingSchemata"
      :show-server-manager="showServerManager"
      :selected-server="selectedServer"
      :allow-test-ip="allowTestIp"
      :schemata-liste="schemataListe"
      :db-name="dbName"
      :credentials="credentials"
      :is-logging-in="isLoggingIn"
      :login-error="loginError"
      @update:server-name="serverName = $event"
      @update:show-server-manager="showServerManager = $event"
      @update:selected-server="selectedServer = $event"
      @update:db-name="dbName = $event"
      @connect-server="connectServer"
      @apply-selected-server="applySelectedServer"
      @remove-selected-server="removeSelectedServer"
      @remember-server="rememberServer"
      @toggle-allow-test-ip="toggleAllowTestIp"
      @close-server-test="closeServerTest"
      @perform-login="performLogin"
    />

    <template v-else>
      <div class="row g-4 animate-fade-in">
        <div class="col-12">
          <BilderPool
            :display-server="displayServer"
            :db-name="dbName"
            :logged-in-user="loggedInUser"
            :can-edit-schueler="canEditSchueler"
            :zuordnungen="zuordnungen"
            :upload-status="uploadStatus"
            :gefundene-bilder="gefundeneBilder"
            :anzahl-bilder-im-pool="anzahlBilderImPool"
            :get-match-index-by-bild="getMatchIndexByBild"
            :get-match-info="getMatchInfo"
            :show-header="true"
            :show-pool="false"
            @handle-folder-upload="handleFolderUpload"
            @upload-all-matches="uploadAllMatches"
            @logout="logout"
            @open-help="openHelp"
            @download-all-live-images="downloadAllLiveImages"
            @zeige-leeren-modal="zeigeLeerenModal"
            @handle-bild-klick="handleBildKlick"
            @download-single-image="downloadSingleImage"
            @preview-local-image="previewLocalImage"
            @entferne-bild-aus-pool="entferneBildAusPool"
          />
        </div>
      </div>

      <div class="row g-4 animate-fade-in">
        <KlassenSchuelerliste
          :klassen-liste="klassenListe"
          :selected-klasse="selectedKlasse"
          :sortierte-schueler="sortierteSchueler"
          :selected-schueler="selectedSchueler"
          :zuordnungen="zuordnungen"
          :can-edit-schueler="canEditSchueler"
          :get-match-index="getMatchIndex"
          @update:selected-klasse="selectedKlasse = $event"
          @handle-klassen-wechsel="handleKlassenWechsel"
          @reset-matches="resetMatches"
          @auto-match="autoMatch"
          @handle-schueler-klick="handleSchuelerKlick"
          @preview-local-image="previewLocalImage"
          @show-db-foto="fetchAndShowDBFoto"
          @start-camera="startCamera"
          @confirm-delete="confirmDelete"
        />
        <BilderPool
          :display-server="displayServer"
          :db-name="dbName"
          :logged-in-user="loggedInUser"
          :can-edit-schueler="canEditSchueler"
          :zuordnungen="zuordnungen"
          :upload-status="uploadStatus"
          :gefundene-bilder="gefundeneBilder"
          :anzahl-bilder-im-pool="anzahlBilderImPool"
          :get-match-index-by-bild="getMatchIndexByBild"
          :get-match-info="getMatchInfo"
          :show-header="false"
          :show-pool="true"
          @handle-folder-upload="handleFolderUpload"
          @upload-all-matches="uploadAllMatches"
          @logout="logout"
          @open-help="openHelp"
          @download-all-live-images="downloadAllLiveImages"
          @zeige-leeren-modal="zeigeLeerenModal"
          @handle-bild-klick="handleBildKlick"
          @download-single-image="downloadSingleImage"
          @preview-local-image="previewLocalImage"
          @entferne-bild-aus-pool="entferneBildAusPool"
        />
      </div>
    </template>

    <KameraModal
      :camera="camera"
      :set-video-player-element="setVideoPlayerElement"
      :preview-filter-css="previewFilterCss"
      :cam-adjust="camAdjust"
      @stop-camera="stopCamera"
      @reset-cam-adjust="resetCamAdjust"
      @capture-photo="capturePhoto"
    />
  </div>
</template>

<style src="./App.css"></style>
