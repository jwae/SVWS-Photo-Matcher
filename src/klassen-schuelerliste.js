import { computed } from 'vue';
import axios from 'axios';
import { guessImageMimeFromBase64 } from './gemeinsame-helfer.js';

export function useKlassenSchuelerliste({
  selectedKlasse,
  selectedSchueler,
  zuordnungen,
  previewImage,
  showToast,
}) {
  const sortierteSchueler = computed(() => {
    if (!selectedKlasse.value?.schueler) return [];
    return [...selectedKlasse.value.schueler].sort((a, b) => a.nachname.localeCompare(b.nachname));
  });

  async function handleKlassenWechsel(klasse = selectedKlasse.value) {
    if (!klasse) return;

    selectedKlasse.value = klasse;
    selectedSchueler.value = null;

    await Promise.all(
      (klasse.schueler ?? []).map(async (schueler) => {
        try {
          const response = await axios.get(`/schueler/${schueler.id}/stammdaten`);
          const fotoB64 = response?.data?.foto || '';
          schueler.hatFoto = fotoB64.length > 0;
          schueler.dbFotoUrl = schueler.hatFoto
            ? `data:${guessImageMimeFromBase64(fotoB64)};base64,${fotoB64}`
            : null;
        } catch {
          schueler.hatFoto = false;
          schueler.dbFotoUrl = null;
        }
      }),
    );
  }

  function handleSchuelerKlick(schueler) {
    const index = zuordnungen.value.findIndex((zuordnung) => zuordnung.sId === schueler.id);
    if (index !== -1) {
      zuordnungen.value.splice(index, 1);
      return;
    }
    selectedSchueler.value = selectedSchueler.value?.id === schueler.id ? null : schueler;
  }

  function previewLocalImage(name, url) {
    previewImage.value = { name, url };
  }

  async function fetchAndShowDBFoto(schueler) {
    try {
      const response = await axios.get(`/schueler/${schueler.id}/stammdaten`);
      const fotoB64 = response?.data?.foto || '';
      previewImage.value = {
        url: `data:${guessImageMimeFromBase64(fotoB64)};base64,${fotoB64}`,
        name: `${schueler.vorname} ${schueler.nachname}`,
      };
    } catch {
      showToast('Fehler beim Laden', 'danger');
    }
  }

  function resetMatches() {
    zuordnungen.value = [];
    selectedSchueler.value = null;
  }

  const getMatchIndex = (id) => {
    const index = zuordnungen.value.findIndex((zuordnung) => zuordnung.sId === id);
    return index !== -1 ? index + 1 : null;
  };

  return {
    sortierteSchueler,
    handleKlassenWechsel,
    handleSchuelerKlick,
    previewLocalImage,
    fetchAndShowDBFoto,
    resetMatches,
    getMatchIndex,
  };
}
