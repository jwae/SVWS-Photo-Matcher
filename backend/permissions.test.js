import assert from 'node:assert/strict';
import test from 'node:test';
import { getPermissionResult } from './permissions.js';

const cases = [
  ['Admin ohne Kompetenzen', { istAdmin: true }, true, true],
  ['Admin mit Lesekompetenz', { istAdmin: true, kompetenzen: [11] }, true, true],
  ['Direkte Kompetenz 11 erlaubt nur Ansehen', { kompetenzen: [11] }, true, false],
  ['Direkte Kompetenz 12 erlaubt Aendern ohne 11', { kompetenzen: [12] }, true, true],
  ['Direkte Kompetenzen 11 und 12', { kompetenzen: [11, 12] }, true, true],
  ['Gruppenkompetenz 11', { gruppen: [{ kompetenzen: [11] }] }, true, false],
  ['Gruppenkompetenz 12 ohne 11', { gruppen: [{ kompetenzen: [12] }] }, true, true],
  ['Direkte und mehrere Gruppenkompetenzen', {
    kompetenzen: [11], gruppen: [{ kompetenzen: [5] }, { kompetenzen: [12] }],
  }, true, true],
  ['Direkte Aenderungsrechte neben Gruppenleserechten', {
    kompetenzen: [12], gruppen: [{ kompetenzen: [11] }],
  }, true, true],
  ['Modulo 100 fuer direkte Leserechte', { kompetenzen: [211] }, true, false],
  ['Modulo 100 fuer direkte Aenderungsrechte', { kompetenzen: [312] }, true, true],
  ['Modulo 100 fuer Gruppenleserechte', { gruppen: [{ kompetenzen: [111] }] }, true, false],
  ['Modulo 100 fuer Gruppenaenderungsrechte', { gruppen: [{ kompetenzen: [212] }] }, true, true],
  ['Bestehende String- und Objektformate', {
    kompetenzen: ['111'], gruppen: [{ kompetenzen: [{ id: 212 }, { nr: 311 }] }],
  }, true, true],
  ['Ohne passende Kompetenzen', { istAdmin: false, kompetenzen: [10, 13] }, false, false],
  ['Admin muss boolean true sein', { istAdmin: 'true' }, false, false],
  ['Leere Benutzerdaten', {}, false, false],
  ['Fehlende Benutzerdaten', undefined, false, false],
];

for (const [name, endpointData, canViewSchueler, canEditSchueler] of cases) {
  test(name, () => {
    assert.deepEqual(getPermissionResult(endpointData), { canViewSchueler, canEditSchueler });
  });
}
