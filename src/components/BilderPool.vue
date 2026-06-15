<script setup>
import { ref } from 'vue'

defineProps({
  displayServer: { type: String, required: true },
  dbName: { type: String, required: true },
  loggedInUser: { type: String, required: true },
  canEditSchueler: { default: null },
  zuordnungen: { type: Array, required: true },
  uploadStatus: { type: Object, required: true },
  gefundeneBilder: { type: Object, required: true },
  anzahlBilderImPool: { type: Number, required: true },
  getMatchIndexByBild: { type: Function, required: true },
  getMatchInfo: { type: Function, required: true },
  showHeader: { type: Boolean, default: true },
  showPool: { type: Boolean, default: true },
})

const emit = defineEmits([
  'handleFolderUpload',
  'uploadAllMatches',
  'logout',
  'openHelp',
  'downloadAllLiveImages',
  'zeigeLeerenModal',
  'handleBildKlick',
  'downloadSingleImage',
  'previewLocalImage',
  'entferneBildAusPool',
])

const fileInput = ref(null)

function openFolderPicker() {
  fileInput.value?.click()
}
</script>

<template>
  <section v-if="showHeader" class="app-summary-card">
    <div class="app-summary-main">
      <div class="app-summary-copy">
        <h1 class="app-summary-title">SVWS Foto-Matcher</h1>

        <div class="app-summary-meta">
          <span class="app-summary-item">
            <i class="bi bi-hdd-network"></i>
            <strong>{{ displayServer }}</strong>
          </span>
          <span class="app-summary-item">
            Schule:
            <strong>{{ dbName }}</strong>
          </span>
          <span class="app-summary-item">
            <i class="bi bi-person-circle"></i>
            <strong>{{ loggedInUser }}</strong>
          </span>
          <span
            v-if="canEditSchueler === true"
            class="app-summary-badge app-summary-badge-success"
            title="Der Benutzer darf Schülerdaten ändern"
          >
            <i class="bi bi-shield-check"></i>
            Darf Schülerdaten ändern
          </span>
          <span
            v-else-if="canEditSchueler === false"
            class="app-summary-badge app-summary-badge-danger"
            title="Dem Benutzer fehlt das Recht, Schülerdaten zu ändern. Bitte an den Admin wenden."
          >
            <i class="bi bi-shield-x"></i>
            Darf keine Schülerdaten ändern
          </span>
          <span
            v-else
            class="app-summary-badge app-summary-badge-muted"
            title="Rechte konnten nicht geprüft werden"
          >
            <i class="bi bi-shield"></i>
            ?
          </span>
        </div>
      </div>

      <div class="app-summary-actions">
        <button class="summary-button summary-button-secondary" @click="openFolderPicker">
          <i class="bi bi-folder-plus"></i>
          <span>Foto-Ordner laden</span>
        </button>
        <input
          ref="fileInput"
          type="file"
          webkitdirectory
          directory
          multiple
          hidden
          @change="emit('handleFolderUpload', $event)"
        >

        <button
          v-if="zuordnungen.length > 0"
          class="summary-button summary-button-success"
          :disabled="uploadStatus.active || canEditSchueler !== true"
          @click="emit('uploadAllMatches')"
        >
          <i class="bi bi-cloud-upload"></i>
          <span>{{ zuordnungen.length }} Zuordnungen hochladen</span>
        </button>

        <button class="summary-button summary-button-primary" @click="emit('logout')">Logout</button>
      </div>
    </div>

    <div class="app-summary-hint">
      <div class="app-summary-hint-copy">
        Wähle links einen <strong>Schüler</strong> und dann rechts ein <strong>Foto</strong>.
      </div>
      <button
        type="button"
        class="app-summary-help"
        title="Kurzhilfe anzeigen"
        @click="emit('openHelp')"
      >
        <i class="bi bi-question-circle-fill"></i>
      </button>

    </div>
  </section>

  <div v-if="showPool" class="content-column col-md-6">
    <section class="panel-card panel-card-table">
      <header class="panel-card-header panel-card-header-success">
        <div class="panel-card-header-main">
          <h2 class="panel-card-title">
            Bilder-Pool
            <span v-if="anzahlBilderImPool > 0" class="panel-counter-badge">{{ anzahlBilderImPool }}</span>
          </h2>
        </div>

        <div class="panel-card-actions">
          <button
            class="panel-action-button panel-action-button-soft"
            :disabled="!Object.values(gefundeneBilder).some((bild) => bild.isLive)"
            title="Alle Live-Bilder speichern"
            @click="emit('downloadAllLiveImages')"
          >
            <i class="bi bi-cloud-download"></i>
            <span>Live-JPGs exportieren</span>
          </button>

          <button
            class="panel-action-button panel-action-button-soft"
            :disabled="Object.keys(gefundeneBilder).length === 0"
            title="Pool komplett leeren"
            @click="emit('zeigeLeerenModal')"
          >
            <i class="bi bi-trash3"></i>
            <span>Bilder-Pool leeren</span>
          </button>
        </div>
      </header>

      <div class="panel-table-wrap">
        <table class="panel-table panel-table-fixed">
          <tbody>
            <tr
              v-for="(data, name) in gefundeneBilder"
              :key="name"
              class="panel-table-row cursor-pointer"
              @click="emit('handleBildKlick', name)"
            >
              <td class="pool-thumb-cell">
                <div class="pool-thumb-wrap">
                  <img :src="data.url" class="pool-thumb" :alt="name">

                  <div
                    v-if="getMatchIndexByBild(name)"
                    class="match-circle pool-match-badge"
                  >
                    {{ getMatchIndexByBild(name) }}
                  </div>
                </div>
              </td>

              <td class="pool-name-cell">
                <div class="pool-file-name" :title="name">{{ name }}</div>
                <div v-if="getMatchInfo(name)" class="pool-match-meta">
                  <span class="pool-match-name">{{ getMatchInfo(name).schuelerName }}</span>
                  <span class="pool-match-reason">{{ getMatchInfo(name).reason }}</span>
                </div>
              </td>

              <td class="pool-actions-cell">
                <div class="pool-actions">
                  <button
                    class="panel-icon-button"
                    title="Dieses Bild speichern"
                    @click.stop="emit('downloadSingleImage', name)"
                  >
                    <i class="bi bi-download panel-icon-success"></i>
                  </button>

                  <button
                    class="panel-icon-button"
                    title="Vorschau"
                    @click.stop="emit('previewLocalImage', name, data.url)"
                  >
                    <i class="bi bi-search panel-icon-primary"></i>
                  </button>

                  <button
                    class="panel-icon-button panel-icon-button-danger"
                    title="Aus Bilder-Pool entfernen"
                    @click.stop="emit('entferneBildAusPool', name)"
                  >
                    <i class="bi bi-trash panel-icon-danger"></i>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
