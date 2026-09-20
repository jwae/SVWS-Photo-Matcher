SVWS Foto-Matcher - Windows-Desktop

Fertige Dateien (Windows x64)
  release/SVWS-Foto-Matcher-1.0.1-Setup.exe
    Installationsassistent mit Wahl des Zielverzeichnisses.
  release/SVWS-Foto-Matcher-1.0.1-Portable.exe
    Start ohne Installation. Benutzer-Einstellungen liegen auch hier im
    Windows-Benutzerprofil, nicht neben der EXE.

Auf dem Zielrechner werden weder Node.js noch npm oder ein separat gestarteter
Webserver benoetigt. Fuer den Zugriff auf Schuelerdaten muss der SVWS-Server
erreichbar sein. Die EXE-Dateien sind nicht mit einem Herausgeberzertifikat signiert.

Entwicklung und Build
  npm ci
  npm test
  npm run desktop       - Vue bauen und Electron starten
  npm run desktop:pack  - entpackte Windows-Anwendung in release/win-unpacked
  npm run desktop:dist  - Windows-Installer und portable EXE bauen

Die bisherigen Web-Kommandos npm run dev und npm start bleiben verfuegbar.
Builds benoetigen Internetzugriff fuer Electron und die Paketierungswerkzeuge.
Bei Problemen mit dem globalen Build-Cache kann in PowerShell vor dem Build
$env:ELECTRON_BUILDER_CACHE = Join-Path $PWD 'release\build-cache'
gesetzt werden.

Aufbau
  desktop/src/main.js startet Electron und das bestehende Express-Backend.
  Das Backend bindet ausschliesslich an 127.0.0.1 auf einem freien Port.
  Ein pro Start zufaelliger interner Schluessel schuetzt Desktop-Backend-Zugriffe.
  Das sichere App-Protokoll sfm://app liefert Oberflaeche und API aus derselben
  festen Origin. Node-Zugriff im Renderer ist deaktiviert; Sandbox und
  Context-Isolation sind aktiv. Eine Preload-Bridge ist derzeit nicht notwendig.
  Kamera-Zugriff ist nur fuer die eigene Oberflaeche und nur fuer Video erlaubt.
  Beim Beenden schliesst Electron auch das Backend.
  Der explizite Zertifikats-Testmodus wird im Electron-Hauptprozess behandelt.

Automatischer Starttest
  Die Electron-App unterstuetzt --smoke-test: verdeckter Start, Oberflaechen-
  pruefung und lokale Login-Anfrage ohne Zugangsdaten, anschliessend Beenden.
  Ergebnis und Bildschirmaufnahme: %TEMP%/svws-photo-matcher-smoke/
  Ein echter SVWS-Login, Fotowrites und eine reale Kameraaufnahme werden dabei
  nicht ausgefuehrt.
