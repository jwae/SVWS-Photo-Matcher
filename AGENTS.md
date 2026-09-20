# AGENTS.md

## Zweck
Dieses Repository ist ein Electron/Vue-Desktop-Client zum Zuordnen und Hochladen von Schuelerfotos nach SVWS/Schild.
Die fachliche Logik lebt im Renderer unter `desktop/src/*.js`. Die Vue-Komponenten unter `desktop/src/components/*.vue` sind praesentationsnah.

## Reale Struktur
- `README.md`: Start-/Build-Kommandos und dokumentierte SVWS-Endpunkte.
- `desktop/src/main.js`: Electron-Main, CSP, Zertifikats-Override fuer Test-IP, IPC-Registrierung.
- `desktop/src/preload.js`: einzige Bridge nach `window.sfm`.
- `desktop/src/App.vue`: Orchestrierung, State-Zusammenfuehrung, kein tiefer API-Code.
- `desktop/src/login-verwaltung.js`: Serverwahl, Schema-Laden, Login, Rechtepruefung.
- `desktop/src/klassen-schuelerliste.js`: Laden von Klassen-/Schueler-Stammdaten, DB-Fotovorschau.
- `desktop/src/bilder-pool.js`: Matching, Upload, Delete, Export.
- `desktop/src/kamera-modal.js`: Kameraaufnahme und optionaler Sofort-Upload.
- `desktop/src/gemeinsame-helfer.js`: URL-/Fehler-/LocalStorage-Helfer und HTML-Helfer.
- `desktop/src/components/*.vue`: UI-only.
- Root-`package.json`: Vite-Shell im Repo-Root; fuer App-Logik fast immer irrelevant.

## Verantwortlichkeiten
- `Login/API-Agent`: nur `desktop/src/login-verwaltung.js`, optional `gemeinsame-helfer.js` bei URL-/Fehlerformatierung.
- `Schueler/DB-Agent`: nur `desktop/src/klassen-schuelerliste.js` fuer Lesen von Stammdaten/Fotos.
- `Upload/Foto-Agent`: nur `desktop/src/bilder-pool.js`, `kamera-modal.js`, `imageUtils.js` fuer Matching, Skalierung, Upload, Delete.
- `Electron/Security-Agent`: nur `desktop/src/main.js` und `preload.js` fuer CSP, Zertifikate, IPC.
- `UI-Agent`: verboten, sofern der Auftrag nicht ausdruecklich Frontend betrifft.

## Frontend-Sperre
Ohne expliziten Frontend-Auftrag nicht aendern:
- `desktop/src/components/*.vue`
- `desktop/src/App.vue`
- `desktop/src/App.css`
- `desktop/src/index.css`
- Assets unter `desktop/src/assets/`

Bevorzugt erst die Logikmodule aendern und bestehende Props/Events unveraendert lassen.

## DB-relevante Bereiche
DB- bzw. SVWS-API-Zugriffe existieren aktuell nur im Renderer ueber `axios`:
- `login-verwaltung.js`: `GET /config/db/schemata`, `GET /klassen/abschnitt/01`, `GET /benutzer/angemeldet/daten`
- `klassen-schuelerliste.js`: `GET /schueler/{id}/stammdaten`
- `bilder-pool.js`: `PATCH /schueler/{id}/stammdaten`
- `kamera-modal.js`: nutzt `uploadFotoForSchueler()` statt eigener API-Logik

Es gibt in diesem Repo keinen eigenen DB-Server, kein ORM und keine SQL-Migrationsstruktur.

## Regeln fuer Migrationen
- Keine Migrationen, SQL-Dateien, ORM-Modelle oder lokale DB-Abstraktionen neu einfuehren.
- Keine Datenbankstruktur "verbessern"; dieses Repo konsumiert nur bestehende SVWS-Endpunkte.
- Falls ein Task echte Schemaaenderungen verlangt, eskalieren: ausserhalb dieses Repos loesbar.

## Regeln fuer Queries und Writes
- Endpunkte, HTTP-Methoden und Payload-Formate an bestehende Patterns anlehnen; keine neuen API-Konventionen erfinden.
- `axios.defaults.baseURL` und `axios.defaults.auth` nur im Login-Fluss setzen, nicht verstreut.
- Schreibzugriffe nur ueber bestehende `PATCH /schueler/{id}/stammdaten`-Pfade.
- Vor Write-Features Rechtebild beachten: Lesen ueber Kompetenz `11`, Schreiben ueber `12`.
- Bei Sammel-Uploads Fehler pro Schueler isolieren; 403 bleibt Abbruchsignal fuer den gesamten Upload.
- Fotos vor Upload im bestehenden Format halten: JPEG/Data-URL, Zielgroesse aktuell `119x160`.

## Sicherheitsregeln
- `allowTestIp` niemals ausserhalb von `main.js`/`preload.js` umgehen.
- Keine Node-APIs direkt in Vue-Komponenten oder Renderer-Logik einfuehren; IPC nur ueber `window.sfm`.
- CSP in `desktop/src/main.js` nicht aufweichen, ausser ein Task verlangt es ausdruecklich und begruendet.
- Keine Zugangsdaten loggen, persistieren oder in neue Stores schreiben.
- Keine neuen externen Netzwerkziele ausser den bereits vorgesehenen SVWS-Servern.

## Bestehende Patterns respektieren
- Composition-Style mit `use...`-Modulen beibehalten.
- UI-Komponenten dumm halten: Props rein, Emits raus, keine Fachlogik duplizieren.
- Bestehende deutsche Fachbegriffe und API-Namen beibehalten (`schueler`, `klassen`, `stammdaten`, `schemata`).
- Fehlerbehandlung ueber vorhandene Formatter/Toasts loesen, nicht mit ad-hoc Alerts.
- Bestehende Datenfluesse nicht auf Pinia/Vuex/Router umbauen.

## Arbeitsmodus fuer Agents
- Zuerst in `desktop/src/*.js` nach bestehender Logik suchen, dann minimal patchen.
- Wenn ein Anliegen nur UI betrifft, nicht "nebenbei" mit erledigen.
- Wenn ein Task Frontend-Aenderungen erzwingt, zuerst explizit feststellen, dass die Frontend-Sperre fuer diesen Auftrag aufgehoben wurde.
