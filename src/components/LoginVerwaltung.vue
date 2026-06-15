<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  isDemo: { type: Boolean, required: true },
  serverName: { type: String, required: true },
  recentServers: { type: Array, required: true },
  serverTest: { type: Object, required: true },
  isLoadingSchemata: { type: Boolean, required: true },
  showServerManager: { type: Boolean, required: true },
  selectedServer: { type: String, required: true },
  allowTestIp: { type: Boolean, required: true },
  schemataListe: { type: Array, required: true },
  dbName: { type: String, required: true },
  credentials: { type: Object, required: true },
  isLoggingIn: { type: Boolean, required: true },
  loginError: { type: String, required: true },
})

const emit = defineEmits([
  'update:serverName',
  'update:showServerManager',
  'update:selectedServer',
  'update:dbName',
  'connectServer',
  'applySelectedServer',
  'removeSelectedServer',
  'rememberServer',
  'toggleAllowTestIp',
  'closeServerTest',
  'performLogin',
])

const schemaDropdownOpen = ref(false)
const serverDropdownOpen = ref(false)
const schemaDropdownRef = ref(null)
const serverDropdownRef = ref(null)
const showLoginFeedback = ref(false)
let loginFeedbackTimeoutId = null

const selectedSchemaLabel = computed(() => props.dbName || 'Schema wählen')
const selectedServerLabel = computed(() => props.selectedServer || 'Gespeicherten Server wählen…')

const loginFeedback = computed(() => {
  if (!showLoginFeedback.value) return null

  const message = props.loginError?.trim()
  if (!message) return null

  const normalized = message.toLowerCase()

  if (normalized.includes('passwort') || normalized.includes('benutzername')) {
    return {
      title: 'Anmeldung nicht erfolgreich',      
      icon: 'bi-shield-lock',
    }
  }

  if (normalized.includes('berechtigung') || normalized.includes('zugriff verweigert')) {
    return {
      title: 'Anmeldung erfolgreich, aber ohne Zugriff',
      hint: 'Der Benutzer wurde erkannt, hat aber keine ausreichenden Rechte fuer diese Funktion.',
      icon: 'bi-person-lock',
    }
  }

  return {
    title: 'Login fehlgeschlagen',
    hint: 'Bitte Server, Schema und Zugangsdaten pruefen oder den Verbindungscheck erneut ausfuehren.',
    icon: 'bi-exclamation-octagon',
  }
})

watch(
  () => props.loginError,
  (value) => {
    if (loginFeedbackTimeoutId) {
      clearTimeout(loginFeedbackTimeoutId)
      loginFeedbackTimeoutId = null
    }

    if (!value?.trim()) {
      showLoginFeedback.value = false
      return
    }

    showLoginFeedback.value = true
    loginFeedbackTimeoutId = window.setTimeout(() => {
      showLoginFeedback.value = false
      loginFeedbackTimeoutId = null
    }, 6000)
  },
)

function toggleSchemaDropdown() {
  schemaDropdownOpen.value = !schemaDropdownOpen.value
  if (schemaDropdownOpen.value) serverDropdownOpen.value = false
}

function toggleServerDropdown() {
  serverDropdownOpen.value = !serverDropdownOpen.value
  if (serverDropdownOpen.value) schemaDropdownOpen.value = false
}

function selectSchema(schema) {
  emit('update:dbName', schema)
  schemaDropdownOpen.value = false
}

function selectServer(server) {
  emit('update:selectedServer', server)
  emit('applySelectedServer')
  serverDropdownOpen.value = false
}

function handleDocumentClick(event) {
  if (!schemaDropdownRef.value?.contains(event.target)) schemaDropdownOpen.value = false
  if (!serverDropdownRef.value?.contains(event.target)) serverDropdownOpen.value = false
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
  if (loginFeedbackTimeoutId) clearTimeout(loginFeedbackTimeoutId)
})
</script>

<template>
  <div class="login-wrapper">
    <div class="login-container">
      <div class="login-shell">
        <div class="login-brand">
          <h1 class="login-title">
            SVWS Foto-Matcher
            <span v-if="isDemo" class="login-badge">Demo</span>
          </h1>
          <p class="login-subtitle">
            Verbinde dich mit deinem SVWS-Server und starte die Zuordnung der Schülerfotos.
          </p>
        </div>

        <div class="login-section">
          <label class="login-label">Server-Name</label>

          <div class="login-server-row">
            <input
              :value="serverName"
              type="text"
              class="login-input login-input-main"
              list="server-history"
              placeholder="z. B. https://SERVERNAME:8443"
              @input="emit('update:serverName', $event.target.value)"
            />

            <datalist id="server-history">
              <option v-for="server in recentServers" :key="server" :value="server"></option>
            </datalist>

            <div
              v-if="serverTest.ok === true"
              class="login-status-indicator login-status-success"
              title="Verbindung zum Server hergestellt."
            >
              <i class="bi bi-check2-circle"></i>
            </div>
            <div
              v-else-if="serverTest.ok === false"
              class="login-status-indicator login-status-danger"
              title="Keine Verbindung zum Server."
            >
              <i class="bi bi-x-square"></i>
            </div>
            <div
              v-else
              class="login-status-indicator login-status-muted"
              title="Verbindung zum Server noch nicht getestet."
            >
              <i class="bi bi-question-square"></i>
            </div>
          </div>

          <div class="login-server-actions">
            <button
              type="button"
              class="login-button login-button-primary login-button-grow"
              :disabled="serverTest.running || isLoadingSchemata || !serverName || serverName.trim().length === 0"
              title="Verbindung mit dem Schulserver herstellen."
              @click="emit('connectServer')"
            >
              <span v-if="serverTest.running || isLoadingSchemata" class="login-spinner"></span>
              Mit Server verbinden
            </button>

            <button
              type="button"
              class="login-button login-button-secondary login-button-icon"
              title="Serverliste pflegen"
              @click="emit('update:showServerManager', !showServerManager)"
            >
              <i class="bi" :class="showServerManager ? 'bi-chevron-double-up' : 'bi-gear'"></i>
            </button>
          </div>

          <div class="collapse-panel" :class="{ open: showServerManager }">
            <div class="login-manager-panel">
              <div class="login-manager-row">
                <div ref="serverDropdownRef" class="login-dropdown login-dropdown-grow">
                  <button
                    type="button"
                    class="login-dropdown-trigger"
                    :class="{ 'login-dropdown-trigger-open': serverDropdownOpen }"
                    @click.stop="toggleServerDropdown"
                  >
                    <span class="login-dropdown-label">{{ selectedServerLabel }}</span>
                    <i class="bi bi-chevron-down" :class="{ 'login-dropdown-chevron-open': serverDropdownOpen }"></i>
                  </button>

                  <div v-if="serverDropdownOpen" class="login-dropdown-menu">
                    <button
                      v-for="server in recentServers"
                      :key="server"
                      type="button"
                      class="login-dropdown-item"
                      :class="{ 'login-dropdown-item-active': selectedServer === server }"
                      @click.stop="selectServer(server)"
                    >
                      {{ server }}
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  class="login-button login-button-danger login-button-square"
                  :disabled="!selectedServer"
                  title="Aus Liste löschen"
                  @click="emit('removeSelectedServer')"
                >
                  <i class="bi bi-x-lg"></i>
                </button>

                <button
                  type="button"
                  class="login-button login-button-success login-button-square"
                  :disabled="!serverName || serverName.trim().length === 0"
                  title="Server zur Liste hinzufügen"
                  @click="emit('rememberServer')"
                >
                  <i class="bi bi-plus-lg"></i>
                </button>
              </div>

              <div class="login-manager-hint">
                Tipp: Auswahl übernimmt den Server in das Eingabefeld.<br>
                „+“ speichert den aktuellen Server-Namen.<br>
                „×“ löscht einen gespeicherten Servereintrag.
              </div>

              <div class="login-divider"></div>

              <div class="login-risk-row">
                <div class="login-switch-wrap">
                  <label class="toggle-switch" for="allow-test-ip-switch">
                    <input
                      id="allow-test-ip-switch"
                      class="allow-test-ip-switch"
                      type="checkbox"
                      :checked="allowTestIp"
                      @change="emit('toggleAllowTestIp')"
                    >
                    <span class="toggle-switch-track">
                      <span class="toggle-switch-thumb"></span>
                    </span>
                  </label>
                </div>

                <div class="login-risk-copy">
                  <i class="bi bi-shield-exclamation login-risk-icon"></i>
                  <span>
                    Erlaubt testweise HTTPS-Verbindungen zu lokalen Hosts oder IP-Adressen, auch wenn das
                    Zertifikat nicht zum Host passt. Dies kann ein Sicherheitsproblem sein. Bitte nur in
                    vertrauenswürdigen Netzen benutzen.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="serverTest.ok === false" class="login-error-panel">
          <div class="login-error-header">
            <div class="login-error-title">{{ serverTest.title }}</div>
            <button
              type="button"
              class="login-close-button"
              aria-label="Meldung schließen"
              @click="emit('closeServerTest')"
            >
              <i class="bi bi-x-lg"></i>
            </button>
          </div>
          <div class="login-error-details">{{ serverTest.details }}</div>
        </div>

        <div class="login-section">
          <label class="login-label">Schule wählen</label>
          <div ref="schemaDropdownRef" class="login-dropdown">
            <button
              type="button"
              class="login-dropdown-trigger login-dropdown-trigger-light"
              :class="{ 'login-dropdown-trigger-open': schemaDropdownOpen, 'login-dropdown-trigger-disabled': schemataListe.length === 0 }"
              :disabled="schemataListe.length === 0"
              @click.stop="toggleSchemaDropdown"
            >
              <span class="login-dropdown-label">{{ selectedSchemaLabel }}</span>
              <i class="bi bi-chevron-down" :class="{ 'login-dropdown-chevron-open': schemaDropdownOpen }"></i>
            </button>

            <div v-if="schemaDropdownOpen" class="login-dropdown-menu login-dropdown-menu-light">
              <button
                v-for="schema in schemataListe"
                :key="schema"
                type="button"
                class="login-dropdown-item"
                :class="{ 'login-dropdown-item-active': dbName === schema }"
                @click.stop="selectSchema(schema)"
              >
                {{ schema }}
              </button>
            </div>
          </div>
        </div>

        <form class="login-form" @submit.prevent="emit('performLogin')">
          <div class="login-field-grid">
            <div class="login-field">
              <label class="login-label">Benutzername</label>
              <input
                :value="credentials.username"
                type="text"
                class="login-input"
                @input="credentials.username = $event.target.value"
              >
            </div>

            <div class="login-field">
              <label class="login-label">Passwort</label>
              <input
                :value="credentials.password"
                type="password"
                class="login-input"
                @input="credentials.password = $event.target.value"
              >
            </div>

            <div class="login-submit-wrap">
              <button
                type="submit"
                class="login-button login-button-primary login-button-submit"
                :disabled="isLoggingIn || serverTest.ok !== true || schemataListe.length === 0 || !dbName"
              >
                <span v-if="isLoggingIn" class="login-spinner"></span>
                Anmelden
              </button>
            </div>
          </div>
        </form>

        <div v-if="loginFeedback" class="login-feedback-card animate-fade-in" role="alert" aria-live="polite">
          <div class="login-feedback-icon">
            <i class="bi" :class="loginFeedback.icon"></i>
          </div>
          <div class="login-feedback-copy">
            <div class="login-feedback-kicker">Anmeldung</div>
            <div class="login-feedback-title">{{ loginFeedback.title }}</div>
            <div class="login-feedback-message">{{ loginError }}</div>
            <div class="login-feedback-hint">{{ loginFeedback.hint }}</div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>
