# SVWS Foto-Matcher

Der SVWS Foto-Matcher ist eine Webapp zum Zuordnen, Prüfen und Hochladen von Schuelerfotos in SVWS/Schild.
Die App laedt Klassen- und Schuelerdaten aus SVWS, zeigt vorhandene Fotos an, unterstuetzt das manuelle oder automatische Matching mit lokalen Bildern und uebertraegt die fertigen Zuordnungen anschliessend ueber das lokale Backend an den SVWS-Server.

## Entwicklung starten
npm install
npm run serve
oder
npm run dev

## Build erstellen
npm run build

## Gebaute App lokal starten
npm run preview

## Architektur
- `src/`: Vue-Frontend
- `backend/`: Express-Backend als SVWS-Fassade/Proxy
- `lib/`: gemeinsames fachliches Hilfsmodul `loadKlassenUndSchueler.js`

## API-Endpunkte
- GET /config/db/schemata
- GET /db/{schema}/schule/stammdaten
- GET /db/{schema}/schueler/abschnitt/{idSchuljahresabschnitt}/auswahlliste
- PATCH /db/{schema}/schueler/{id}/stammdaten

## Hinweise
- Im Dev-Modus laeuft das Frontend ueber Vite und das Backend auf `http://127.0.0.1:3100`.
- Das Frontend spricht nur mit lokalen `/api/svws/...`-Routen; der Zugriff auf SVWS erfolgt serverseitig im Backend.
