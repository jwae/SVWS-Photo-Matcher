<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  klassenListe: { type: Array, required: true },
  selectedKlasse: { default: null },
  sortierteSchueler: { type: Array, required: true },
  selectedSchueler: { default: null },
  zuordnungen: { type: Array, required: true },
  canEditSchueler: { default: null },
  getMatchIndex: { type: Function, required: true },
})

const emit = defineEmits([
  'update:selectedKlasse',
  'handleKlassenWechsel',
  'resetMatches',
  'autoMatch',
  'handleSchuelerKlick',
  'previewLocalImage',
  'showDbFoto',
  'startCamera',
  'confirmDelete',
])

const isDropdownOpen = ref(false)
const dropdownRef = ref(null)

const selectedKlasseLabel = computed(() => props.selectedKlasse?.kuerzel ?? 'Klasse wählen')

function selectKlasse(klasse) {
  emit('update:selectedKlasse', klasse ?? null)
  emit('handleKlassenWechsel', klasse ?? null)
  isDropdownOpen.value = false
}

function toggleDropdown() {
  isDropdownOpen.value = !isDropdownOpen.value
}

function handleDocumentClick(event) {
  if (!dropdownRef.value?.contains(event.target)) {
    isDropdownOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
})
</script>

<template>
  <div class="content-column col-md-6">
    <section class="panel-card panel-card-table">
      <header class="panel-card-header panel-card-header-primary">
        <div class="panel-card-header-main">
          <h2 class="panel-card-title">Klasse</h2>

          <div ref="dropdownRef" class="panel-dropdown">
            <button
              type="button"
              class="panel-dropdown-trigger"
              :class="{ 'panel-dropdown-trigger-open': isDropdownOpen }"
              @click.stop="toggleDropdown"
            >
              <span>{{ selectedKlasseLabel }}</span>
              <i class="bi bi-chevron-down" :class="{ 'panel-dropdown-chevron-open': isDropdownOpen }"></i>
            </button>

            <div v-if="isDropdownOpen" class="panel-dropdown-menu">
              <div class="panel-dropdown-scroll">
                <button
                  v-for="klasse in klassenListe"
                  :key="klasse.id"
                  type="button"
                  class="panel-dropdown-item"
                  :class="{ 'panel-dropdown-item-active': String(selectedKlasse?.id ?? '') === String(klasse.id) }"
                  @click.stop="selectKlasse(klasse)"
                >
                  {{ klasse.kuerzel }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="panel-card-actions">
          <button
            class="panel-action-button panel-action-button-soft"
            :disabled="zuordnungen.length === 0"
            title="Alle aktuellen Zuordnungen aufheben"
            @click="emit('resetMatches')"
          >
            <i class="bi bi-arrow-counterclockwise"></i>
            <span>Zuordnungen löschen</span>
          </button>

          <button
            class="panel-action-button panel-action-button-soft"
            title="Ordnet Fotos automatisch nach Name + Vorname oder der Schüler-ID zu."
            @click="emit('autoMatch')"
          >
            <i class="bi bi-magic"></i>
            <span>Auto-Match</span>
          </button>
        </div>
      </header>

      <div class="panel-table-wrap">
        <table class="panel-table">
          <thead>
            <tr>
              <th class="panel-cell-center panel-cell-link">Link</th>
              <th class="panel-cell-center panel-cell-photo">SVWS</th>
              <th class="panel-cell-center panel-cell-id">ID</th>
              <th>Name, Vorname</th>
              <th class="panel-cell-center panel-cell-live">Live</th>
              <th class="panel-cell-center panel-cell-live">Foto</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="schueler in sortierteSchueler"
              :key="schueler.id"
              class="panel-table-row cursor-pointer"
              :class="{ 'selected-row': selectedSchueler && selectedSchueler.id === schueler.id }"
              @click="emit('handleSchuelerKlick', schueler)"
            >
              <td class="panel-cell-center panel-cell-link">
                <div
                  :class="[
                    'match-circle panel-match-circle',
                    getMatchIndex(schueler.id) ? 'panel-match-circle-active' : 'circle-empty',
                  ]"
                >
                  {{ getMatchIndex(schueler.id) || '' }}
                </div>
              </td>

              <td class="panel-cell-center panel-cell-photo">
                <img
                  v-if="schueler.dbFotoUrl"
                  :src="schueler.dbFotoUrl"
                  class="panel-photo-thumb cursor-pointer"
                  :title="`Foto von ${schueler.vorname} ${schueler.nachname} anzeigen`"
                  @click.stop="emit('previewLocalImage', `${schueler.vorname} ${schueler.nachname}`, schueler.dbFotoUrl)"
                >

                <button
                  v-else-if="schueler.hatFoto === true"
                  type="button"
                  class="panel-icon-button panel-icon-button-plain"
                  title="Foto in Schild vorhanden"
                  @click.stop="emit('showDbFoto', schueler)"
                >
                  <i class="bi bi-person-square panel-icon-primary panel-icon-large"></i>
                </button>

                <i
                  v-else
                  class="bi bi-person-square panel-icon-muted panel-icon-large panel-icon-faded"
                  title="Kein Foto vorhanden"
                ></i>
              </td>

              <td class="panel-cell-center panel-cell-id">
                <span class="panel-id-badge">{{ schueler.id }}</span>
              </td>

              <td>
                <span class="panel-name">{{ schueler.nachname }}, {{ schueler.vorname }}</span>
              </td>

              <td class="panel-cell-center panel-cell-live">
                <button
                  class="panel-icon-button"
                  :class="{ 'panel-icon-button-disabled': canEditSchueler !== true }"
                  :disabled="canEditSchueler !== true"
                  :title="canEditSchueler === true ? 'Live-Kamera öffnen' : 'Keine Berechtigung zum Aufnehmen'"
                  @click.stop="canEditSchueler === true && emit('startCamera', schueler)"
                >
                  <i
                    class="bi"
                    :class="canEditSchueler === true ? 'bi-camera panel-icon-primary' : 'bi-camera-video-off panel-icon-muted'"
                  ></i>
                </button>
              </td>

              <td class="panel-cell-center panel-cell-live">
                <button
                  v-if="schueler.hatFoto"
                  class="panel-icon-button panel-icon-button-danger"
                  :disabled="canEditSchueler !== true"
                  :title="canEditSchueler === true ? 'Foto löschen' : 'Keine Berechtigung zum Löschen'"
                  @click.stop="emit('confirmDelete', schueler)"
                >
                  <i class="bi bi-trash" :class="canEditSchueler === true ? 'panel-icon-danger' : 'panel-icon-muted'"></i>
                  <span v-if="canEditSchueler !== true" class="icon-strike"></span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
