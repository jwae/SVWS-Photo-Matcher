import { computed } from 'vue';
import axios from 'axios';
import { scaleImage } from './imageUtils.js';

export function useBilderPool({
  gefundeneBilder,
  zuordnungen,
  selectedSchueler,
  selectedKlasse,
  sortierteSchueler,
  uploadStatus,
  deleteModal,
  canEditSchueler,
  showToast,
}) {
  const anzahlBilderImPool = computed(() => Object.keys(gefundeneBilder.value).length);

  function revokeImageUrl(imageData) {
    const url = imageData?.url;
    if (typeof url === 'string' && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  }

  function clearImagePool() {
    Object.values(gefundeneBilder.value).forEach(revokeImageUrl);
    gefundeneBilder.value = {};
  }

  function handleFolderUpload(event) {
    clearImagePool();
    zuordnungen.value = [];
    selectedSchueler.value = null;

    for (const file of Array.from(event.target.files)) {
      if (file.type.startsWith('image/')) {
        gefundeneBilder.value[file.name] = { url: URL.createObjectURL(file) };
      }
    }

    showToast(`${Object.keys(gefundeneBilder.value).length} Bilder geladen`);
    event.target.value = '';
  }

  function handleBildKlick(name) {
    const index = zuordnungen.value.findIndex((zuordnung) => zuordnung.bild === name);
    if (index !== -1) {
      zuordnungen.value.splice(index, 1);
    } else if (selectedSchueler.value) {
      zuordnungen.value.push({ sId: selectedSchueler.value.id, bild: name, reason: 'Manuell' });
      selectedSchueler.value = null;
    }
  }

  function autoMatch() {
    const pool = Object.keys(gefundeneBilder.value);
    let neueTreffer = 0;

    if (pool.length === 0) {
      showToast('Bilder-Pool ist leer. Bitte zuerst Fotos laden oder aufnehmen.', 'info');
      return;
    }

    sortierteSchueler.value.forEach((schueler) => {
      if (zuordnungen.value.some((zuordnung) => zuordnung.sId === schueler.id)) return;

      const nachname = schueler.nachname.toLowerCase();
      const vorname = schueler.vorname.toLowerCase();
      const schuelerId = String(schueler.id);

      const match = pool.find((fileName) => {
        const normalized = fileName.toLowerCase();
        if (zuordnungen.value.some((zuordnung) => zuordnung.bild === fileName)) return false;
        return normalized.includes(schuelerId) || (normalized.includes(nachname) && normalized.includes(vorname));
      });

      if (match) {
        zuordnungen.value.push({ sId: schueler.id, bild: match, reason: 'Auto' });
        neueTreffer += 1;
      }
    });

    if (neueTreffer > 0) {
      showToast(`${neueTreffer} neue Matches!`, 'success');
    } else if (zuordnungen.value.length > 0) {
      showToast('Keine weiteren Matches gefunden.', 'info');
    } else {
      showToast('Keine Matches im Bilder-Pool gefunden.', 'info');
    }
  }

  async function uploadAllMatches() {
    if (zuordnungen.value.length === 0) return;

    uploadStatus.active = true;
    uploadStatus.total = zuordnungen.value.length;
    uploadStatus.current = 0;

    let erfolge = 0;
    let permissionAbort = false;
    const errors = [];
    const successIds = new Set();
    const matchesToUpload = zuordnungen.value.slice();
    const schuelerById = new Map((selectedKlasse.value?.schueler ?? []).map((schueler) => [schueler.id, schueler]));

    try {
      for (let i = 0; i < matchesToUpload.length; i += 1) {
        const zuordnung = matchesToUpload[i];
        uploadStatus.current = i + 1;

        try {
          const bildDaten = gefundeneBilder.value[zuordnung.bild];
          if (!bildDaten?.url) throw new Error('Bild nicht mehr im Pool');

          const scaledDataUrl = await scaleImage(bildDaten.url, 119, 160);
          const base64String = scaledDataUrl.split(',')[1];
          if (!base64String) throw new Error('Skalierung lieferte kein Base64');

          await axios.patch(`/schueler/${zuordnung.sId}/stammdaten`, { foto: base64String });

          const schueler = schuelerById.get(zuordnung.sId);
          if (schueler) {
            schueler.hatFoto = true;
            schueler.dbFotoUrl = scaledDataUrl.startsWith('data:')
              ? scaledDataUrl
              : `data:image/jpeg;base64,${base64String}`;
          }

          successIds.add(zuordnung.sId);
          erfolge += 1;
        } catch (err) {
          if (err?.response?.status === 403) {
            permissionAbort = true;
            break;
          }

          let message = 'Unbekannter Fehler';
          if (err?.response?.status === 404) message = `Schüler mit ID ${zuordnung.sId} wurde nicht gefunden.`;
          else if (err?.response?.data?.message) message = err.response.data.message;
          else if (err?.message) message = err.message;

          console.error(`Fehler bei ID ${zuordnung.sId}:`, err);
          errors.push({ sId: zuordnung.sId, bild: zuordnung.bild, message });
        }
      }

      if (successIds.size > 0) {
        zuordnungen.value = zuordnungen.value.filter((item) => !successIds.has(item.sId));
      }

      if (permissionAbort) {
        showToast('Upload abgebrochen: Der SVWS-Benutzer hat keine Rechte, um Schülerdaten zu ändern (403).', 'danger');
      } else if (errors.length === 0) {
        showToast(`${erfolge} Foto(s) erfolgreich hochgeladen.`, 'success');
      } else {
        showToast(`${erfolge} erfolgreich, ${errors.length} fehlgeschlagen.`, 'danger');
      }
    } catch (err) {
      console.error('Upload abgebrochen:', err);
      showToast('Upload abgebrochen (unerwarteter Fehler).', 'danger');
    } finally {
      uploadStatus.active = false;
    }
  }

  async function uploadFotoForSchueler(sId, dataUrl119x160) {
    const base64String = dataUrl119x160.split(',')[1];
    if (!base64String) throw new Error('Skalierung lieferte kein Base64');

    try {
      await axios.patch(`/schueler/${sId}/stammdaten`, { foto: base64String });
      return { ok: true };
    } catch (err) {
      const status = err?.response?.status;
      if (status === 403) return { ok: false, code: 403, message: 'Keine Rechte, um Schülerdaten zu ändern.' };
      if (status === 404) return { ok: false, code: 404, message: `Schüler mit ID ${sId} nicht gefunden.` };
      return { ok: false, code: status ?? 0, message: err?.message ?? 'Upload fehlgeschlagen.' };
    }
  }

  async function executeDelete() {
    try {
      if (deleteModal.mode === 'svws') {
        const schueler = deleteModal.schueler;
        await axios.patch(`/schueler/${schueler.id}/stammdaten`, { foto: '' });
        schueler.hatFoto = false;
        schueler.dbFotoUrl = null;
        showToast(`Foto von ${schueler.vorname} ${schueler.nachname} gelöscht`, 'success');
      } else if (deleteModal.mode === 'pool') {
        clearImagePool();
        zuordnungen.value = [];
        selectedSchueler.value = null;
        showToast('Bilder-Pool geleert', 'info');
      } else if (deleteModal.mode === 'einzelbild') {
        const name = deleteModal.bildName;
        revokeImageUrl(gefundeneBilder.value[name]);
        delete gefundeneBilder.value[name];
        zuordnungen.value = zuordnungen.value.filter((zuordnung) => zuordnung.bild !== name);
        showToast('Bild entfernt', 'info');
      }
    } catch (err) {
      console.error('Fehler beim Löschen:', err);
      showToast('Aktion fehlgeschlagen', 'danger');
    } finally {
      deleteModal.show = false;
    }
  }

  function downloadSingleImage(fileName) {
    const imageData = gefundeneBilder.value[fileName];
    if (!imageData) return;
    const link = document.createElement('a');
    link.href = imageData.url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Bild gespeichert');
  }

  async function downloadAllLiveImages() {
    const liveBilderNamen = Object.keys(gefundeneBilder.value).filter((name) => gefundeneBilder.value[name].isLive === true);
    if (liveBilderNamen.length === 0) {
      showToast('Keine Live-Fotos zum Exportieren gefunden.', 'info');
      return;
    }

    showToast(`${liveBilderNamen.length} Fotos werden vorbereitet...`, 'success');

    for (const name of liveBilderNamen) {
      const link = document.createElement('a');
      link.href = gefundeneBilder.value[name].url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    showToast('Export abgeschlossen!', 'success');
  }

  function zeigeLeerenModal() {
    deleteModal.show = true;
    deleteModal.mode = 'pool';
    deleteModal.titel = 'Bilder-Pool leeren';
    deleteModal.nachricht = 'Möchtest du wirklich den Pool leeren und alle aktuellen Zuordnungen löschen?';
  }

  function entferneBildAusPool(dateiname) {
    deleteModal.show = true;
    deleteModal.mode = 'einzelbild';
    deleteModal.bildName = dateiname;
    deleteModal.titel = 'Bild entfernen';
    deleteModal.nachricht = `Möchtest du das Bild "${dateiname}" wirklich aus dem Pool löschen?`;
  }

  const confirmDelete = (schueler) => {
    if (canEditSchueler.value !== true) {
      showToast('Keine Berechtigung zum Löschen.', 'danger');
      return;
    }

    deleteModal.show = true;
    deleteModal.mode = 'svws';
    deleteModal.schueler = schueler;
    deleteModal.titel = 'Foto in Schild löschen?';
    deleteModal.nachricht = `Möchtest du das Foto von ${schueler.vorname} ${schueler.nachname} in der Schülerdatenbank wirklich löschen?`;
  };

  const getMatchIndexByBild = (name) => {
    const index = zuordnungen.value.findIndex((zuordnung) => zuordnung.bild === name);
    return index !== -1 ? index + 1 : null;
  };

  const getMatchInfo = (name) => {
    const match = zuordnungen.value.find((zuordnung) => zuordnung.bild === name);
    if (!match) return null;
    const schueler = selectedKlasse.value?.schueler.find((entry) => entry.id === match.sId);
    return { schuelerName: schueler ? schueler.nachname : '?', reason: match.reason };
  };

  return {
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
  };
}
