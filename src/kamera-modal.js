import { computed, reactive, ref } from 'vue';
import { AUTO_UPLOAD_LIVE } from './gemeinsame-helfer.js';

export function useKameraModal({
  canEditSchueler,
  selectedKlasse,
  gefundeneBilder,
  zuordnungen,
  uploadStatus,
  showToast,
  uploadFotoForSchueler,
  revokeImageUrl,
}) {
  const camera = reactive({ active: false, schueler: null, stream: null });
  const videoPlayer = ref(null);
  const camAdjust = reactive({ zoom: 1.0, brightness: 100, contrast: 100, saturate: 100 });

  const previewFilterCss = computed(
    () => `brightness(${camAdjust.brightness}%) contrast(${camAdjust.contrast}%) saturate(${camAdjust.saturate}%)`,
  );

  function resetCamAdjust() {
    camAdjust.zoom = 1.0;
    camAdjust.brightness = 100;
    camAdjust.contrast = 100;
    camAdjust.saturate = 100;
  }

  async function startCamera(schueler) {
    camera.schueler = schueler;
    camera.active = true;
    resetCamAdjust();

    try {
      const targetAR = 119 / 160;

      if (camera.stream) {
        camera.stream.getTracks().forEach((track) => track.stop());
        camera.stream = null;
      }

      camera.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          aspectRatio: { ideal: targetAR },
          width: { ideal: 960 },
          height: { ideal: 1280 },
        },
      });

      await new Promise((resolve, reject) => {
        const element = videoPlayer.value;
        if (!element) return resolve();

        element.onloadedmetadata = () => resolve();
        element.onerror = (event) => reject(event);
        element.srcObject = camera.stream;
        const playPromise = element.play?.();
        if (playPromise && typeof playPromise.catch === 'function') playPromise.catch(() => {});
      });
    } catch (err) {
      console.error('Kamera-Fehler:', err);
      showToast('Kamera konnte nicht gestartet werden. Prüfe die Berechtigungen.', 'danger');
      camera.active = false;
    }
  }

  function stopCamera() {
    if (camera.stream) {
      camera.stream.getTracks().forEach((track) => track.stop());
    }
    camera.active = false;
    camera.stream = null;
    camera.schueler = null;
  }

  async function capturePhoto() {
    if (canEditSchueler.value !== true) {
      showToast('Keine Berechtigung.', 'danger');
      return;
    }

    try {
      const video = videoPlayer.value;
      const schueler = camera.schueler;
      if (!video || !schueler) return;

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) {
        showToast('Kamera ist noch nicht bereit.', 'danger');
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

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      const targetAR = outW / outH;
      const videoAR = vw / vh;

      let sx;
      let sy;
      let sW;
      let sH;

      if (videoAR > targetAR) {
        sH = vh;
        sW = vh * targetAR;
        sx = (vw - sW) / 2;
        sy = 0;
      } else {
        sW = vw;
        sH = vw / targetAR;
        sx = 0;
        sy = (vh - sH) / 2;
      }

      const zoom = Math.max(1, Number(camAdjust.zoom ?? 1));
      const newSW = sW / zoom;
      const newSH = sH / zoom;
      sx += (sW - newSW) / 2;
      sy += (sH - newSH) / 2;
      sW = newSW;
      sH = newSH;

      sx = Math.max(0, Math.round(sx));
      sy = Math.max(0, Math.round(sy));
      sW = Math.max(1, Math.min(vw - sx, Math.round(sW)));
      sH = Math.max(1, Math.min(vh - sy, Math.round(sH)));

      ctx.filter = `brightness(${Number(camAdjust.brightness ?? 100)}%) contrast(${Number(camAdjust.contrast ?? 100)}%) saturate(${Number(camAdjust.saturate ?? 100)}%)`;
      ctx.clearRect(0, 0, outW, outH);
      ctx.drawImage(video, sx, sy, sW, sH, 0, 0, outW, outH);

      const dataUrlForUpload = canvas.toDataURL('image/jpeg', 0.9);
      ctx.filter = 'none';

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      if (!blob) {
        showToast('Foto konnte nicht erzeugt werden.', 'danger');
        return;
      }

      const blobUrl = URL.createObjectURL(blob);
      const sanitize = (value) => String(value ?? '').trim().replace(/\s+/g, '_');
      const klassenName = sanitize(selectedKlasse.value?.kuerzel || '00');
      const dateiName = `${klassenName}_${sanitize(schueler.nachname)}_${sanitize(schueler.vorname)}_${schueler.id}.jpg`;

      revokeImageUrl(gefundeneBilder.value[dateiName]);
      gefundeneBilder.value[dateiName] = { url: blobUrl, isLive: true };

      const index = zuordnungen.value.findIndex((zuordnung) => zuordnung.sId === schueler.id);
      if (index !== -1) {
        zuordnungen.value[index].bild = dateiName;
        zuordnungen.value[index].reason = 'Live (Update)';
      } else {
        zuordnungen.value.push({ sId: schueler.id, bild: dateiName, reason: 'Live' });
      }

      if (AUTO_UPLOAD_LIVE === true) {
        uploadStatus.active = true;
        uploadStatus.total = 1;
        uploadStatus.current = 1;

        const result = await uploadFotoForSchueler(schueler.id, dataUrlForUpload);
        uploadStatus.active = false;

        if (result?.ok) {
          schueler.hatFoto = true;
          schueler.dbFotoUrl = dataUrlForUpload;
          zuordnungen.value = zuordnungen.value.filter((zuordnung) => zuordnung.sId !== schueler.id);
          showToast(`Live-Foto für ${schueler.vorname} gespeichert.`, 'success');
        } else if (result?.code === 403) {
          showToast('Live-Upload abgebrochen: Keine Rechte (403).', 'danger');
        } else if (result?.code === 404) {
          showToast(`Live-Upload fehlgeschlagen: Schüler ${schueler.id} nicht gefunden (404).`, 'danger');
        } else {
          showToast(`Live-Upload fehlgeschlagen: ${result?.message ?? 'Unbekannter Fehler'}`, 'danger');
        }
      } else if (index !== -1) {
        showToast(`Foto für ${schueler.vorname} aktualisiert`, 'info');
      } else {
        showToast(`Foto für ${schueler.vorname} erstellt`, 'success');
      }

      stopCamera();
    } catch (err) {
      console.error('capturePhoto Fehler:', err);
      showToast('Foto konnte nicht gespeichert werden.', 'danger');
    } finally {
      if (uploadStatus.active && uploadStatus.total === 1) {
        uploadStatus.active = false;
      }
    }
  }

  return {
    camera,
    videoPlayer,
    camAdjust,
    previewFilterCss,
    resetCamAdjust,
    startCamera,
    stopCamera,
    capturePhoto,
  };
}
