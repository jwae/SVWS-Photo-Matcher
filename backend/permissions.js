function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value);
  return [];
}

function toKompetenzModulo100(kompetenz) {
  let raw = null;

  if (typeof kompetenz === 'number' || typeof kompetenz === 'string') raw = kompetenz;
  else if (typeof kompetenz === 'object' && kompetenz !== null) raw = kompetenz.id ?? kompetenz.nr ?? null;

  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  return ((value % 100) + 100) % 100;
}

function collectKompetenzen(endpointData) {
  const gruppenKompetenzen = asArray(endpointData?.gruppen).flatMap((gruppe) => asArray(gruppe?.kompetenzen));
  const direkteKompetenzen = asArray(endpointData?.kompetenzen);
  return [...gruppenKompetenzen, ...direkteKompetenzen];
}

export function getPermissionResult(endpointData) {
  const kompetenzwerte = collectKompetenzen(endpointData)
    .map((kompetenz) => toKompetenzModulo100(kompetenz))
    .filter((value) => value != null);

  const canEditSchueler = endpointData?.istAdmin === true || kompetenzwerte.includes(12);
  const canViewSchueler = canEditSchueler || kompetenzwerte.includes(11);

  return {
    canViewSchueler,
    canEditSchueler,
  };
}

