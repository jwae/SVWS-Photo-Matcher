<script setup>
defineProps({
  camera: { type: Object, required: true },
  setVideoPlayerElement: { type: Function, required: true },
  previewFilterCss: { type: String, required: true },
  camAdjust: { type: Object, required: true },
})

const emit = defineEmits(['stopCamera', 'resetCamAdjust', 'capturePhoto'])
</script>

<template>
  <template v-if="camera && camera.active">
    <div class="modal-backdrop glass-backdrop"></div>

    <div class="modal show d-block">
      <div class="modal-dialog modal-md modal-dialog-centered">
        <div class="modal-content border-0 shadow-lg rounded-4 bg-dark text-white">
          <div class="modal-header border-secondary">
            <h6 class="modal-title">
              Foto für {{ camera?.schueler?.vorname }} {{ camera?.schueler?.nachname }} aufnehmen
            </h6>
            <button class="btn-close btn-close-white shadow-none" @click="emit('stopCamera')"></button>
          </div>

          <div class="modal-body p-0 position-relative bg-black d-flex justify-content-center overflow-hidden">
            <video
              :ref="setVideoPlayerElement"
              autoplay
              playsinline
              class="w-100"
              style="max-height: 70vh; object-fit: cover; display: block;"
              :style="{
                filter: previewFilterCss,
                transform: `scale(${camAdjust.zoom})`,
                transformOrigin: 'center center',
              }"
            ></video>

            <div class="camera-overlay-frame"></div>
          </div>

          <div class="modal-footer border-0 d-block pt-3 pb-4">
            <div class="px-2 px-md-3">
              <div class="d-flex align-items-center justify-content-between mb-2">
                <h4 class="fw-light">Kamerabild anpassen</h4>
                <button type="button" class="btn btn-sm btn-outline-light" @click="emit('resetCamAdjust')">Reset</button>
              </div>

              <div class="row g-2">
                <div class="col-12">
                  <label class="form-label small mb-1">Zoom</label>
                  <input
                    v-model.number="camAdjust.zoom"
                    type="range"
                    min="1"
                    max="2"
                    step="0.01"
                    :style="{ '--range-progress': ((camAdjust.zoom - 1) / (2 - 1)) * 100 + '%' }"
                    class="form-range form-range-thin"
                  >
                </div>

                <div class="col-12 col-md-4">
                  <label class="form-label small mb-1">Helligkeit</label>
                  <input
                    v-model.number="camAdjust.brightness"
                    type="range"
                    min="50"
                    max="150"
                    step="1"
                    :style="{ '--range-progress': ((camAdjust.brightness - 50) / (150 - 50)) * 100 + '%' }"
                    class="form-range form-range-thin"
                  >
                </div>

                <div class="col-12 col-md-4">
                  <label class="form-label small mb-1">Kontrast</label>
                  <input
                    v-model.number="camAdjust.contrast"
                    type="range"
                    min="50"
                    max="150"
                    step="1"
                    :style="{ '--range-progress': ((camAdjust.contrast - 50) / (150 - 50)) * 100 + '%' }"
                    class="form-range form-range-thin"
                  >
                </div>

                <div class="col-12 col-md-4">
                  <label class="form-label small mb-1">Sättigung</label>
                  <input
                    v-model.number="camAdjust.saturate"
                    type="range"
                    min="0"
                    max="200"
                    step="1"
                    :style="{ '--range-progress': (camAdjust.saturate / 200) * 100 + '%' }"
                    class="form-range form-range-thin"
                  >
                </div>
              </div>
            </div>

            <p class="text-warning text-center fw-light">Die Aufnahme wird direkt in Schild gespeichert.</p>

            <div class="d-flex justify-content-center gap-3 mt-3">
              <button type="button" class="btn btn-primary btn-sm px-4 rounded-3" @click="emit('capturePhoto')">
                <i class="bi bi-camera-fill me-1"></i>
                Aufnahme
              </button>

              <button type="button" class="btn btn-outline-light btn-sm px-3 rounded-3" @click="emit('stopCamera')">
                <i class="bi bi-x-lg me-1"></i>
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </template>
</template>
