# Installation im Debian-12-LXC ohne Docker

## Schnellstart über Git

Der Installierende muss als Collaborator eingetragen sein.

Start in der Proxmox-Konsole oder per SSH als **root im frischen Debian-12-Container**
ausführen, nicht in Windows-PowerShell.

**1. Git und GitHub CLI installieren:**

```bash
apt update
apt install -y ca-certificates git gh
```

**2. Einmalig bei GitHub anmelden:**

```bash
gh auth login --hostname github.com --web --git-protocol https
```

Den angezeigten Einmalcode kopieren und gegebenenfalls die Eingabetaste drücken,
damit der Befehl auf die Browseranmeldung wartet. Auf dem **normalen PC**
[github.com/login/device](https://github.com/login/device) öffnen, mit dem eigenen
GitHub-Konto anmelden, den Code eingeben und den Zugriff bestätigen. Im LXC ist
kein Browser erforderlich. Eine Meldung, dass dort kein Browser geöffnet werden
konnte, verhindert die Anmeldung über den PC nicht.

Falls gefragt wird, ob Git mit den GitHub-Zugangsdaten eingerichtet werden soll,
mit **Yes** bestätigen. Nach abgeschlossener Anmeldung im Container:

```bash
gh auth setup-git --hostname github.com
```

Ein Personal Access Token muss dabei nicht manuell erstellt werden. Die GitHub
CLI verwaltet die Anmeldung für root; ohne System-Schlüsselbund kann sie diese
im Benutzerprofil als Datei speichern. Der Installer überträgt diese Anmeldung
nicht an den Dienstbenutzer `sfm`. Bei einem öffentlichen Repository kann Schritt
2 entfallen.

**3. Standardbranch herunterladen und Installer starten:**

```bash
git clone https://github.com/jwae/SVWS-Photo-Matcher.git /root/sfm-install-source
cd /root/sfm-install-source/deployment/debian-lxc
bash install.sh
```

Das Skript muss innerhalb des vollständigen Git-Clones liegen; die einzelne
Skriptdatei oder ein Download-ZIP reichen nicht. Nicht über `curl | bash` starten:
Die Zertifikatserstellung benötigt ein interaktives Terminal.
`bash install.sh --help` zeigt die Hilfe ohne Installation.

Das Skript installiert Systempakete, verwendet das offizielle NodeSource-Setup
für Node.js 24 und übernimmt die bereits geklonte Quelle lokal nach
`/opt/svws-foto-matcher`. **Es erfolgt kein zweiter Clone und keine weitere
GitHub-Anmeldung im Installer.** Es werden
keine SVWS-Zugangsdaten abgefragt oder gespeichert und keine Schülerfotos als
Installationstest hochgeladen oder gelöscht.

Installiert wird der beim Start ausgewählte lokale **Git-Commit (HEAD)**. Mit dem
obigen Clone ist das der heruntergeladene Stand des Standardbranches. Der
Installer ruft kein `git pull` auf und lehnt Änderungen an versionierten Dateien
ab. Per `git archive` werden ausschließlich Dateien dieses Commits übernommen;
`.git`, lokale Zusatzdateien, vorhandene Builds und GitHub-Anmeldedaten werden
nicht mitkopiert. Das Installationsverzeichnis ist deshalb selbst kein Git-Clone.
Branch und Commit stehen nach erfolgreicher Installation in `installation.txt`.

Nginx stellt HTTPS direkt unter
der Container-IP bereit und leitet intern an `127.0.0.1:3100` weiter. Die App
startet per systemd. Es werden weder Docker noch eine grafische Umgebung benötigt.

Nach dem Klonen ist die GitHub-Anmeldung für die Installation und den Betrieb
nicht mehr erforderlich. Bei Bedarf mit `gh auth logout --hostname github.com`
lokal abmelden. Für ein späteres erneutes Herunterladen aus dem privaten
Repository ist dann wieder eine Anmeldung nötig.

## Voraussetzungen

- Frischer Debian-12-LXC mit systemd, IPv4 und Root-Zugriff über eine interaktive
  Proxmox-Konsole oder SSH. Kein bereits eingerichteter Nginx oder Foto-Matcher.
- Dauerhafte IP durch feste Konfiguration oder DHCP-Reservierung. Das Skript
  ermittelt aktive IPv4-Adressen automatisch und fragt bei mehreren nach der
  gewünschten Adresse. Es ändert keine Netzwerkeinstellungen. IPv6-only wird
  nicht unterstützt.
- Internetzugang für Debian-Pakete, NodeSource, GitHub und npm; funktionierendes
  DNS und korrekte Uhrzeit. Keine eingehende Internetfreigabe erforderlich.
- Vom Container aus muss der SVWS-Server erreichbar sein.
- Clients müssen die Container-IP auf TCP 443 erreichen; TCP 80 dient nur der
  HTTPS-Weiterleitung. Das Skript verändert keine Proxmox-/Netzwerk-Firewall.

Als Startgröße sind 2 CPU-Kerne, 2 GB RAM und 8 GB Speicher vorgesehen; das ist
eine Orientierung, kein gemessener Mindestbedarf. Die Kamera gehört zum
Client-PC oder Tablet und muss nicht an den Container durchgereicht werden.

## Ablauf

Der Installer erklärt diese sieben Schritte auch direkt in der Konsole. Neben
einer möglichen IP-Auswahl ist nur das neue CA-Passwort einzugeben; dafür nicht
das GitHub- oder Container-Passwort verwenden.

1. Debian-Version, systemd, lokale Git-Quelle, freie Ports und bestehende
   Installationspfade prüfen. Quellverzeichnis, Branch und Commit anzeigen.
2. IPv4 ermitteln, bei mehreren Adressen Auswahl anbieten.
3. Git, curl, OpenSSL, Node.js 24 und Nginx installieren.
4. Dienstbenutzer `sfm` anlegen, Dateien des lokalen Commits ohne Netzwerkzugriff
   nach `/opt/svws-foto-matcher` übernehmen und als `sfm` nacheinander
   `npm ci`, `npm test` und `npm run build` ausführen. Die Build-Abhängigkeiten
   bleiben installiert. Electron wird nicht gestartet.
5. Passwortgeschützte lokale CA und ein Serverzertifikat für die ausgewählte
   IP erzeugen. OpenSSL fragt nach einem neuen CA-Passwort und später erneut
   nach diesem Passwort zum Signieren. Es wird nicht in einer Datei gespeichert.
6. systemd-Dienst und Nginx einrichten, HTTP auf HTTPS umleiten.
7. Backend und HTTPS mit echter Zertifikatsprüfung testen; Commit, Adresse,
   Zertifikatsfingerabdruck und Ablaufdaten ausgeben.

Danach `https://CONTAINER-IP` öffnen. Vor der ersten Anmeldung das CA-Zertifikat
wie unten beschrieben importieren. Die Adresse des SVWS-Servers und die
Zugangsdaten werden in der App eingegeben.

Das Skript ist ausschließlich für die Erstinstallation gedacht. Eine erneute
Ausführung bricht bei vorhandenen Pfaden, Benutzerkonten oder belegten Ports ab.
Es überschreibt keine bestehende Installation und führt kein App-Update aus.
Bei einem Fehler bleiben bereits ausgeführte Schritte erhalten; es gibt keinen
automatischen Rollback. Bei einer fehlgeschlagenen Erstinstallation ist ein
frischer LXC oder die Wiederherstellung eines vorherigen Snapshots der einfachste
Neustart. Nicht unbesehen vorhandene Verzeichnisse löschen: Sie können CA-Schlüssel
und bereits benötigte Konfiguration enthalten.

## Zertifikat auf Clients installieren

Zum Verteilen dient ausschließlich diese **öffentliche** Datei:

```text
/etc/svws-foto-matcher/client/foto-app-ca.crt
```

Sie wird nicht über die Webseite bereitgestellt. Per WinSCP/SFTP aus dem
Container herunterladen und bei Bedarf per USB weitergeben. Der bei der
Installation angezeigte SHA-256-Fingerabdruck identifiziert das Zertifikat.
Er kann im Zertifikatsdialog oder mit OpenSSL verglichen werden:

```bash
openssl x509 -in foto-app-ca.crt -noout -fingerprint -sha256
```

Auf einem Windows-Client:

1. `foto-app-ca.crt` doppelklicken und **Zertifikat installieren** auswählen.
2. **Lokaler Computer** wählen (Administratorrechte erforderlich).
3. **Alle Zertifikate in folgendem Speicher speichern** wählen.
4. **Vertrauenswürdige Stammzertifizierungsstellen** auswählen und abschließen.
5. Browser neu starten und `https://CONTAINER-IP` öffnen.

Edge und Chrome verwenden üblicherweise den Windows-Zertifikatsspeicher. Falls
Firefox die CA nicht übernimmt, dort unter Einstellungen → Datenschutz &
Sicherheit → Zertifikate → Zertifikate anzeigen → Zertifizierungsstellen
importieren und das Vertrauen für Websites aktivieren. Bei verwalteten Rechnern
kann die IT die CA zentral verteilen. Auf Tablets ist der plattformspezifische
Import nötig; unter iOS/iPadOS muss zusätzlich das volle Vertrauen für die
installierte Root-CA aktiviert werden.

Das Vertrauen in die CA erlaubt ihr, Serverzertifikate zu bestätigen. Deshalb
nur die eigene, überprüfte CA installieren und deren privaten Schlüssel nie an
Clients verteilen. Für die Browserkamera müssen HTTPS ohne Zertifikatsfehler
und die Kameraerlaubnis im Browser vorliegen. Der App-Testmodus für das
SVWS-Zertifikat ersetzt dieses Browservertrauen nicht.

## Zertifikate sichern und Laufzeiten

| Datei/Verzeichnis | Zweck |
| --- | --- |
| `/root/svws-foto-matcher-ca/ca.key` | Passwortgeschützter privater CA-Schlüssel; nur root |
| `/root/svws-foto-matcher-ca/ca.crt` | CA-Zertifikat, 3650 Tage gültig |
| `/etc/svws-foto-matcher/tls/server.key` | Privater Nginx-Schlüssel; nur root, ohne Passwort für Dienststart |
| `/etc/svws-foto-matcher/tls/server.crt` | Serverzertifikat, 365 Tage gültig |
| `/etc/svws-foto-matcher/tls/server.csr` und `server.ext` | Antrag und Erweiterungen für manuelle Erneuerung |
| `/etc/svws-foto-matcher/installation.txt` | Installationsdatum, Branch, Commit und Adresse |

**Es wird kein Timer oder Cronjob zur Erneuerung eingerichtet.** Einen Termin
mindestens 30 Tage vor Ablauf des Serverzertifikats setzen. Die Ablaufdaten prüfen:

```bash
openssl x509 -in /etc/svws-foto-matcher/tls/server.crt -noout -dates
openssl x509 -in /etc/svws-foto-matcher/client/foto-app-ca.crt -noout -dates
```

Das komplette Verzeichnis `/root/svws-foto-matcher-ca` auf einen geschützten
externen Datenträger oder in eine geeignete verschlüsselte Sicherung kopieren;
Passwort getrennt aufbewahren. Nach geprüfter Sicherung kann der private
CA-Schlüssel aus dem Container entfernt werden. Nginx benötigt ihn nicht.
Zur manuellen Erneuerung muss er wieder am unten verwendeten Pfad bereitliegen.
Container-Backups können ebenfalls private Schlüssel enthalten.

## Serverzertifikat manuell erneuern

Die folgenden Befehle gelten für **dieselbe Container-IP und dieselbe CA**.
Sie verwenden den bestehenden Server-Schlüssel weiter. Als root in einer
Bash-Sitzung ausführen; bei Fehlern wird die Sitzung abgebrochen. Den gesicherten
CA-Schlüssel zuvor gegebenenfalls nach `/root/svws-foto-matcher-ca/ca.key`
zurückkopieren (Verzeichnis `0700`, Schlüssel `0600`, Eigentümer root).

```bash
set -euo pipefail
umask 077
cd /etc/svws-foto-matcher/tls
APP_IP=$(cat /etc/svws-foto-matcher/ip-address)

# CA muss mindestens die gesamte neue Laufzeit abdecken.
openssl x509 -in /root/svws-foto-matcher-ca/ca.crt -checkend 31536000 -noout

# OpenSSL fragt nach dem CA-Passwort.
openssl x509 -req -sha256 -days 365 \
  -in server.csr \
  -CA /root/svws-foto-matcher-ca/ca.crt \
  -CAkey /root/svws-foto-matcher-ca/ca.key \
  -set_serial "0x$(openssl rand -hex 16)" \
  -extfile server.ext -out server.crt.new

openssl verify -CAfile /etc/svws-foto-matcher/client/foto-app-ca.crt \
  -purpose sslserver -verify_ip "$APP_IP" server.crt.new

cp -p server.crt "server.crt.backup.$(date +%Y%m%d-%H%M%S)"
mv server.crt.new server.crt
nginx -t
systemctl reload nginx
curl --noproxy '*' --fail --show-error \
  --cacert /etc/svws-foto-matcher/client/foto-app-ca.crt \
  "https://$APP_IP/" -o /dev/null
openssl x509 -in server.crt -noout -dates
```

Die Clients benötigen bei Erneuerung mit derselben gültigen CA keinen neuen
Import. Den CA-Schlüssel nach erfolgreicher Erneuerung wieder offline verwahren,
wenn dies eure gewählte Aufbewahrung ist. Schlägt `nginx -t` fehl, vor einem
Neustart die gesicherte vorherige Zertifikatsdatei wiederherstellen und prüfen.

Bei geändertem IP-Netz müssen Serverzertifikat (IP-SAN), Nginx-Konfiguration und
`ip-address` gemeinsam angepasst werden; dieses Skript migriert keine Adressen.
Bei Ablauf oder Verlust der CA samt Schlüssel bzw. Passwort ist eine neue CA
erforderlich, deren öffentliches Zertifikat erneut auf die Clients verteilt wird.

## Betrieb und Fehlerdiagnose

```bash
systemctl status svws-foto-matcher nginx --no-pager
journalctl -u svws-foto-matcher -n 80 --no-pager
nginx -t
curl --noproxy '*' -I http://127.0.0.1:3100/
```

- **Von einem Client nicht erreichbar:** Container-IP, Routing und Proxmox-/LAN-
  Firewall prüfen. Port 3100 bleibt absichtlich nur lokal erreichbar.
- **HTTPS-Test abgebrochen, Nginx meldet `bind() ... :80 failed (98: Address already in use)`:**
  Bei älteren Installerskripten kollidiert der Wechsel vom Debian-Standardlistener
  `0.0.0.0:80` auf die konkrete Container-IP beim Reload mit dem noch offenen
  Socket. Nginx behält dann die alte Konfiguration ohne HTTPS. Nach erfolgreichem
  `nginx -t` einmal `systemctl restart nginx` ausführen, nicht den Installer neu
  starten. Der aktuelle Installer verwendet für diesen Wechsel einen Neustart.
  Anschließend HTTPS erneut prüfen:

  ```bash
  APP_IP=$(cat /etc/svws-foto-matcher/ip-address)
  curl --noproxy '*' --fail --show-error \
    --cacert /etc/svws-foto-matcher/client/foto-app-ca.crt \
    "https://$APP_IP/" -o /dev/null
  ```

- **Zertifikatswarnung:** CA-Import, IP im Zertifikat, Uhrzeit und Ablauf prüfen.
- **SVWS-Anmeldung scheitert:** DNS, Netzwerk und das Zertifikat des SVWS-Servers
  separat prüfen. Die neue lokale CA sichert Browser → Foto-App, nicht automatisch
  Foto-App → SVWS. Keine globale Deaktivierung der TLS-Prüfung verwenden.
- **Build schlägt fehl:** Ausgabe von npm prüfen; bei Speichermangel dem Container
  mehr RAM zuweisen. Ein Fehler bei Tests oder Build stoppt die Installation.

App-Updates sind ein eigener Wartungsschritt (Sicherung, Quell-Clone aktualisieren,
neuen Commit übertragen, Abhängigkeiten, Tests, Build, Dienstneustart); dafür den
Installer nicht erneut starten. `git pull` gehört in den ursprünglichen
Quell-Clone, nicht nach `/opt/svws-foto-matcher`, da dort kein `.git` liegt.

## Technische Quellen

- [GitHub CLI: Anmeldung über den Browser](https://cli.github.com/manual/gh_auth_login)
- [GitHub CLI: Git-Anmeldung einrichten](https://cli.github.com/manual/gh_auth_setup-git)
- [NodeSource: Debian-Installation und unterstützte Versionen](https://github.com/nodesource/distributions/blob/master/DEV_README.md)
- [OpenSSL 3: Zertifikate und Zertifikatsanträge](https://docs.openssl.org/3.0/man1/openssl-req/)
- [OpenSSL 3: Signieren und Gültigkeitsprüfung](https://docs.openssl.org/3.0/man1/openssl-x509/)
- [OpenSSL 3: IP-Adressen in Subject Alternative Name](https://docs.openssl.org/3.0/man5/x509v3_config/)
- [Nginx: HTTPS-Konfiguration](https://nginx.org/en/docs/http/configuring_https_servers.html)
- [MDN: Browserkamera und sichere Kontexte](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
