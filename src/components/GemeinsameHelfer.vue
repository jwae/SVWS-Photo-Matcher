<script setup>
defineProps({
  isDemo: { type: Boolean, required: true },
  toast: { type: Object, required: true },
  deleteModal: { type: Object, required: true },
  canEditSchueler: { default: null },
  previewImage: { default: null },
  helpModal: { type: Object, required: true },
})

const emit = defineEmits(['closeDeleteModal', 'executeDelete', 'closePreview', 'closeHelp'])
</script>

<template>
  <div v-if="isDemo" class="demo-watermark" aria-hidden="true">DEMO</div>

  <div v-if="toast.show" class="toast-stack">
    <div
      class="toast-modern toast-modern-card animate-fade-in"
      :class="
        toast.type === 'success'
          ? 'toast-success'
          : toast.type === 'danger'
            ? 'toast-danger'
            : 'toast-info'
      "
    >
      <i
        class="bi toast-icon"
        :class="
          toast.type === 'success'
            ? 'bi-check-circle-fill'
            : toast.type === 'danger'
              ? 'bi-exclamation-circle-fill'
              : 'bi-info-circle'
        "
      ></i>
      <span class="toast-text">{{ toast.message }}</span>
    </div>
  </div>

  <div v-if="deleteModal.show" class="app-overlay-backdrop glass-backdrop"></div>
  <div v-if="deleteModal.show" class="app-overlay-shell" @click.self="emit('closeDeleteModal')">
    <div class="dialog-card dialog-card-sm dialog-card-center">
      <div class="dialog-icon-wrap">
        <i
          class="bi dialog-icon"
          :class="canEditSchueler === true ? 'bi-trash3-fill dialog-icon-danger' : 'bi-shield-lock-fill dialog-icon-muted'"
        ></i>
      </div>

      <h3 class="dialog-title">{{ deleteModal.titel || 'Aktion' }}</h3>
      <p class="dialog-copy">{{ deleteModal.nachricht }}</p>

      <div class="dialog-actions">
        <button
          v-if="canEditSchueler !== true && deleteModal.mode === 'svws'"
          class="dialog-button dialog-button-secondary dialog-button-full"
          @click="emit('closeDeleteModal')"
        >
          Schließen
        </button>

        <template v-else>
          <button class="dialog-button dialog-button-secondary dialog-button-full" @click="emit('closeDeleteModal')">
            Abbrechen
          </button>
          <button class="dialog-button dialog-button-danger dialog-button-full" @click="emit('executeDelete')">
            OK
          </button>
        </template>
      </div>
    </div>
  </div>

  <div v-if="previewImage" class="app-overlay-backdrop glass-backdrop preview-backdrop" @click="emit('closePreview')"></div>
  <div v-if="previewImage" class="app-overlay-shell preview-modal" @click.self="emit('closePreview')">
    <div class="dialog-card dialog-card-lg">
      <div class="dialog-header">
        <div class="dialog-heading">
          <div class="dialog-kicker">Vorschau</div>
          <h3 class="dialog-title dialog-title-left">{{ previewImage.name }}</h3>
        </div>

        <button type="button" class="dialog-close" @click="emit('closePreview')">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>

      <div class="dialog-body dialog-body-tight">
        <div class="preview-frame">
          <img :src="previewImage.url" class="preview-img" :alt="previewImage.name">
        </div>
      </div>
    </div>
  </div>

  <div v-if="helpModal.show" class="app-overlay-backdrop glass-backdrop" @click="emit('closeHelp')"></div>
  <div v-if="helpModal.show" class="app-overlay-shell" @click.self="emit('closeHelp')">
    <div class="dialog-card dialog-card-md dialog-card-help">
      <div class="dialog-header dialog-header-help">
        <h3 class="dialog-title dialog-title-left">{{ helpModal.titel }}</h3>
        <button type="button" class="dialog-close" @click="emit('closeHelp')">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>

      <div class="dialog-body dialog-body-help">
        <div class="help-content" v-html="helpModal.html"></div>
      </div>
    </div>
  </div>
</template>
