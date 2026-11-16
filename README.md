# SVWS Foto-Matcher

Ein gemeinsames Projekt fuer Web und Electron zum Zuordnen und Hochladen von Schuelerfotos nach SVWS/Schild. Beide Varianten verwenden dieselbe Vue-Oberflaeche, Fachlogik und dasselbe Express-Backend.

## Voraussetzungen

- Node.js gemaess `engines` in `package.json`: ^20.19.0 oder >=22.12.0.
- Abhaengigkeiten installieren: `npm ci`.
- Fuer echte Schuelerdaten ist ein erreichbarer SVWS-Server erforderlich.

## Start und Build

| Zweck | Befehl |
| --- | --- |
| Webentwicklung mit Vite und Backend | `npm run dev` (alternativ `npm run serve`) |
| Gemeinsame Oberflaeche bauen | `npm run build` |
| Gebaute Webversion lokal starten | `npm start` (alternativ `npm run preview`) |
| Oberflaeche bauen und Electron starten | `npm run desktop` |
| Entpackte Windows-App erstellen | `npm run desktop:pack` |
| Windows-Installer und portable EXE erstellen | `npm run desktop:dist` |
| Automatische Tests | `npm test` |

Die lokale Webversion ist unter `http://127.0.0.1:3100` erreichbar. In der Entwicklung zeigt Vite seine eigene Adresse im Terminal an und leitet `/api` an das Backend auf Port 3100 weiter. `PORT` aendert den Backend-Port; der Vite-Proxy muss bei abweichendem Entwicklungsport passend konfiguriert werden.

Electron startet das Backend automatisch auf einem freien lokalen Port und beendet es mit der App. Ein separat gestarteter Webserver ist dafuer nicht erforderlich. Auf Windows-Zielrechnern benoetigt die gebaute Desktop-App keine separate Node.js-Installation.

## Gemeinsame Architektur

- `src/`: gemeinsame Vue-Oberflaeche und fachliche Module fuer beide Varianten.
- `backend/`: Express-Backend fuer SVWS-Zugriffe und Berechtigungspruefung.
- `lib/`: gemeinsames Modul zum Laden und Normalisieren von Klassen und Schuelern.
- `desktop/src/main.js`: Electron-Fenster, App-Protokoll, Backend-Lebenszyklus und Desktop-Sicherheitsregeln.
- `dist/`: erzeugter Web-Build, der auch in die Desktop-App eingebunden wird.
- `release/`: erzeugte Windows-Anwendungen.

Das Frontend verwendet lokale `/api/svws/...`-Routen. Im Desktopbetrieb vermittelt `sfm://app` zum internen Backend. Node-Zugriff im Renderer ist deaktiviert; Sandbox und Context-Isolation sind aktiv. Eine Preload-Bridge ist aktuell nicht vorhanden.

## Version und Pflege

Die gemeinsame Versionsnummer steht in `package.json` und `package-lock.json`. Die Kurzanleitung liest sie aus `package.json`, das Electron-Fenster aus `app.getVersion()`. Versionswechsel deshalb zentral mit `npm version <Version> --no-git-tag-version` vornehmen und beide Varianten neu bauen.

Gemeinsame Aenderungen werden einmal in `src/`, `backend/` oder `lib/` gepflegt. Nur Desktop-spezifische Funktionen gehoeren nach `desktop/`. Web und Desktop werden ab Version 1.0.3 gemeinsam veroeffentlicht. Bereits veroeffentlichte Tags bleiben unveraendert.

Projektanleitungen werden mit Git versioniert. `node_modules/`, `dist/` und `release/` sind erzeugte Dateien und bleiben ausgeschlossen. Die bisherigen separaten Projektordner bleiben bis zur Abnahme erhalten.

## Pruefung vor einem Release

1. `npm test` und `npm run build` ausfuehren.
2. Webversion mit `npm start` und Desktopversion mit `npm run desktop` pruefen.
3. Klassen-Dropdown, Kurzanleitung, Login, Kamera und Fotoablauf in beiden Varianten kontrollieren; Schreibtests nur mit geeigneten Testdaten.
4. Bei Desktop-Releases die Windows-Pakete bauen und pruefen.

Details zum Desktopbetrieb und zum automatischen Starttest stehen in `desktop/README.txt`. Funktionsfehler aus der vorherigen Codepruefung sind separate Aufgaben und werden durch die Zusammenfuehrung nicht automatisch behoben.

## Verwendete SVWS-Endpunkte

- `GET /config/db/schemata`
- `GET /db/{schema}/benutzer/angemeldet/daten`
- `GET /db/{schema}/schule/stammdaten`
- `GET /db/{schema}/schueler/abschnitt/{idSchuljahresabschnitt}/auswahlliste`
- `GET /db/{schema}/schueler/{id}/stammdaten`
- `PATCH /db/{schema}/schueler/{id}/stammdaten`

## Screenshots
<img width="500" height="350" alt="fotomatcher01" src="https://github.com/user-attachments/assets/157f86c2-73c7-4635-b3e0-441c050b292e" />
<img width="700" height="487" alt="fotomatcher02" src="https://github.com/user-attachments/assets/7a3c23b4-7482-4478-83c6-b53f649c3717" />

