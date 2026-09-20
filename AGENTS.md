# AGENTS.md

## Zweck und Struktur
Dieses Repository verwaltet eine gemeinsame Web- und Electron-App zum Zuordnen und Hochladen von Schuelerfotos nach SVWS/Schild.

- `src/App.vue`: Orchestrierung und State-Zusammenfuehrung.
- `src/components/*.vue`: praesentationsnahe Komponenten, Props rein und Events raus.
- `src/login-verwaltung.js`: Serverwahl, Schemata und Login ueber das Backend.
- `src/klassen-schuelerliste.js`: Schuelerliste und DB-Fotovorschau.
- `src/bilder-pool.js`: Matching, Upload, Delete und Export.
- `src/kamera-modal.js`: Kameraaufnahme und Sofort-Upload ueber `uploadFotoForSchueler()`.
- `src/imageUtils.js`: Bildskalierung.
- `src/gemeinsame-helfer.js`: URL-, Fehler-, LocalStorage- und HTML-Helfer sowie Axios-Konfiguration.
- `backend/server.js`: Express-App, SVWS-Proxy, Login, TLS-Konfiguration und Backend-Start.
- `backend/permissions.js`: gemeinsame Auswertung der SVWS-Kompetenzen.
- `lib/loadKlassenUndSchueler.js`: Laden und Normalisieren von Klassen und Schuelern.
- `desktop/src/main.js`: Electron-Fenster, sicheres App-Protokoll, Kamera-Freigaben und Backend-Lebenszyklus.
- Root-`package.json`: zentrale Version, Abhaengigkeiten und Start-/Build-Befehle beider Varianten.

Es gibt aktuell weder eine Preload-Datei noch eine `window.sfm`-Bridge. `desktop/src/` enthaelt keine separate Vue-App.

## Gemeinsame Pflege
- Gemeinsame Fachlogik und UI nur einmal in `src/` pflegen, nicht fuer Electron duplizieren.
- Web- und Desktopbetrieb bei gemeinsamen Aenderungen beruecksichtigen.
- Composition-Style mit `use...`-Modulen, deutsche Fachbegriffe und bestehende Props/Events beibehalten.
- Kein Umbau auf Pinia, Vuex oder Router ohne Auftrag.
- Fehlerdarstellung ueber vorhandene Formatter und Toasts.
- Keine Sub-Agents ohne ausdruecklichen Auftrag einsetzen.

## Frontend-Sperre
Ohne expliziten Frontend-Auftrag nicht aendern: `src/components/*.vue`, `src/App.vue`, `src/App.css`, `src/index.css` und `src/assets/`.
Wenn der Auftrag diese Aenderungen erfordert, zuerst ausdruecklich feststellen, dass die Frontend-Sperre fuer diesen Auftrag aufgehoben ist. Zuerst bestehende Logik in `src/*.js` untersuchen und minimal patchen.

## API und Daten
- Der Renderer ruft lokale `/api/svws/...`-Routen auf; externe SVWS-Anfragen erfolgen im Express-Backend.
- Login und Schemata: `POST /api/svws/meta/login` und `POST /api/svws/meta/schemata`.
- Stammdaten und Fotos: bestehende Proxy-Routen unter `/api/svws/db`.
- Schreibzugriffe weiterhin ueber `PATCH /schueler/{id}/stammdaten` im konfigurierten Datenbankschema.
- Keine neuen API-Konventionen oder externen Netzwerkziele einfuehren.
- Lesen erfordert Kompetenz 11, Schreiben 12; Admin- und Gruppenregeln aus `backend/permissions.js` beachten.
- Axios-Konfiguration ueber die bestehenden Login-/Logout-Helfer setzen und loeschen.
- Sammel-Uploads isolieren Fehler pro Schueler; 403 beendet den gesamten Upload.
- JPEG/Base64-Format beibehalten. Sammel-Uploads skalieren auf 119x160; der aktuelle Live-Pfad erzeugt 357x480. Diese bekannte Abweichung nur in einem gesonderten Fotoauftrag korrigieren.
- Keine SQL-Migrationen, ORM-Modelle oder lokale Datenbankabstraktionen einfuehren. SVWS-Schemaaenderungen liegen ausserhalb dieses Projekts.

## Sicherheit
- Node-APIs nicht im Renderer oder in Vue-Komponenten verwenden.
- Electron-Sandbox, Context-Isolation, deaktivierte Node-Integration, CSP und Navigationsbeschraenkungen beibehalten.
- Desktop-Backend nur lokal binden; internen Zugriffsschluessel nicht in Renderer, Logs oder persistenten Stores offenlegen.
- TLS-Testmodus nur ueber bestehende Pfade in `backend/server.js` und den Desktop-HTTPS-Agent in `desktop/src/main.js` behandeln. Keine zusaetzlichen Umgehungen einfuehren.
- Keine Zugangsdaten loggen oder persistieren.
- Keine echten Schuelerfotos schreiben oder loeschen, wenn nur Codepruefung oder lokale Tests beauftragt sind.

## Pruefung und Auslieferung
- `npm test`: Rechte- und Backendtests.
- `npm run build`: gemeinsame Vue-Oberflaeche bauen.
- `npm start`: gebaute lokale Webversion.
- `npm run desktop`: Build und Electron-Start.
- `npm run desktop:pack` / `npm run desktop:dist`: Windows-Pakete.
- Die Version zentral in `package.json` und `package-lock.json` pflegen; UI-Version nicht hart codieren.
- Erzeugte Verzeichnisse `dist/`, `release/` und `node_modules/` nicht committen.
- Vorhandene Benutzerarbeit erhalten; Funktionskorrekturen nicht mit einer reinen Zusammenfuehrung vermischen.
