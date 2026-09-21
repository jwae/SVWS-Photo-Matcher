#!/usr/bin/env bash
# Erstinstallation im frischen Debian-12-LXC. Siehe README.md.
set -Eeuo pipefail
umask 022

readonly APP_DIR=/opt/svws-foto-matcher
readonly CONFIG_DIR=/etc/svws-foto-matcher
readonly CA_DIR=/root/svws-foto-matcher-ca
readonly UNIT=/etc/systemd/system/svws-foto-matcher.service
readonly REPO=https://github.com/jwae/SVWS-Photo-Matcher.git

die() { printf 'FEHLER: %s\n' "$*" >&2; exit 1; }
info() { printf '\n== %s ==\n' "$*"; }
trap 'printf "\nAbbruch in Zeile %s. Bereits ausgefuehrte Schritte bleiben erhalten. Siehe README zur Fehlerbehebung.\n" "$LINENO" >&2' ERR

if [[ ${1:-} == --help && $# == 1 ]]; then
    printf '%s\n' \
        'Aufruf: bash install.sh' \
        'Nur Erstinstallation als root auf frischem Debian 12 mit systemd.' \
        'IPv4 wird ermittelt; bei mehreren Adressen erfolgt eine Auswahl.' \
        'Die lokale CA erfordert eine interaktive Passworteingabe.' \
        'Keine automatische Zertifikatserneuerung, kein Update-Modus.'
    exit 0
fi
[[ $# == 0 ]] || die 'Unbekannte Argumente. Hilfe: bash install.sh --help'
[[ $EUID == 0 ]] || die 'Bitte als root im Debian-Container ausfuehren.'
[[ -t 0 && -t 1 ]] || die 'Bitte direkt in einem interaktiven Terminal starten, nicht ueber curl | bash.'
[[ -r /etc/os-release ]] || die '/etc/os-release fehlt.'
# shellcheck source=/dev/null
source /etc/os-release
[[ ${ID:-} == debian && ${VERSION_ID:-} == 12 ]] || die 'Dieses Skript unterstuetzt ausschliesslich Debian 12.'
[[ -d /run/systemd/system ]] || die 'Ein laufendes systemd wird benoetigt.'
for command in ip ss systemctl runuser apt-get; do
    command -v "$command" >/dev/null || die "Werkzeug fehlt: $command (ip und ss kommen aus iproute2)."
done

info 'Frische Installation pruefen'
for target in "$APP_DIR" "$CONFIG_DIR" "$CA_DIR" "$UNIT" /etc/nginx; do
    [[ ! -e $target && ! -L $target ]] || die "Bereits vorhanden: $target. Bestehende Installation wird nicht ueberschrieben."
done
if getent passwd sfm >/dev/null || getent group sfm >/dev/null; then
    die 'Benutzer oder Gruppe sfm existiert bereits.'
fi
if [[ -n $(ss -H -ltn '( sport = :80 or sport = :443 or sport = :3100 )') ]]; then
    die 'Port 80, 443 oder 3100 ist bereits belegt.'
fi

info 'Container-IP ermitteln'
mapfile -t addresses < <(ip -4 -o address show scope global up | awk '{split($4,a,"/"); print a[1]}' | sort -u)
(( ${#addresses[@]} > 0 )) || die 'Keine aktive IPv4-Adresse gefunden. Zuerst Netzwerk konfigurieren.'
if (( ${#addresses[@]} == 1 )); then
    APP_IP=${addresses[0]}
else
    printf 'Mehrere IPv4-Adressen gefunden:\n'
    for index in "${!addresses[@]}"; do
        printf '  %s) %s\n' "$((index + 1))" "${addresses[index]}"
    done
    while true; do
        read -r -p 'Nummer der Adresse fuer den Browserzugriff: ' choice
        if [[ $choice =~ ^[1-9][0-9]{0,3}$ ]] && (( choice <= ${#addresses[@]} )); then
            APP_IP=${addresses[choice - 1]}
            break
        fi
        printf 'Bitte eine Nummer aus der Liste eingeben.\n'
    done
fi
readonly APP_IP
printf 'Verwendete Adresse: https://%s\nDie IP muss dauerhaft gleich bleiben (feste IP oder DHCP-Reservierung).\n' "$APP_IP"

info 'Systempakete und Node.js 24 installieren'
apt-get update
apt-get install -y ca-certificates curl git openssl gnupg
# Offizielles NodeSource-Setup fuegt das Node.js-24-Paketrepository hinzu.
setup_dir=$(mktemp -d)
curl --fail --show-error --silent --location --proto '=https' --proto-redir '=https' \
    https://deb.nodesource.com/setup_24.x -o "$setup_dir/nodesource_setup.sh"
bash "$setup_dir/nodesource_setup.sh"
rm -- "$setup_dir/nodesource_setup.sh"
rmdir -- "$setup_dir"
apt-get install -y nodejs nginx
[[ $(node -p 'process.versions.node.split(".")[0]') == 24 ]] || die 'Node.js 24 wurde nicht installiert.'
node --version
npm --version

info 'Standardbranch klonen, testen und bauen'
adduser --system --group --home "$APP_DIR" --shell /usr/sbin/nologin sfm
runuser -u sfm -- git clone --single-branch "$REPO" "$APP_DIR"
(
    cd "$APP_DIR"
    runuser -u sfm -- env NODE_ENV=development ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci --include=dev
    runuser -u sfm -- npm test
    runuser -u sfm -- npm run build
)
[[ -s $APP_DIR/dist/index.html ]] || die 'Der Web-Build fehlt.'

info 'Lokale CA und Serverzertifikat erstellen'
install -d -m 0755 "$CONFIG_DIR" "$CONFIG_DIR/client"
install -d -m 0700 "$CONFIG_DIR/tls" "$CA_DIR"
printf '%s\n' "$APP_IP" > "$CONFIG_DIR/ip-address"
printf '%s\n' \
    'Das CA-Passwort wird jetzt von OpenSSL abgefragt (Eingabe ist unsichtbar).' \
    'Ein starkes Passwort waehlen und separat aufbewahren.' \
    'Bei der Signierung wird dieses Passwort erneut benoetigt.'
(
    umask 077
    openssl req -x509 -newkey rsa:4096 -sha256 -days 3650 \
        -keyout "$CA_DIR/ca.key" -out "$CA_DIR/ca.crt" \
        -subj '/CN=SVWS Foto-Matcher Local CA' \
        -addext 'basicConstraints=critical,CA:TRUE,pathlen:0' \
        -addext 'keyUsage=critical,keyCertSign,cRLSign' \
        -addext 'subjectKeyIdentifier=hash'
    openssl req -new -newkey rsa:3072 -noenc -sha256 \
        -keyout "$CONFIG_DIR/tls/server.key" -out "$CONFIG_DIR/tls/server.csr" \
        -subj "/CN=$APP_IP"
    cat > "$CONFIG_DIR/tls/server.ext" <<EOF
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=IP:$APP_IP
subjectKeyIdentifier=hash
authorityKeyIdentifier=keyid,issuer
EOF
    openssl x509 -req -sha256 -days 365 \
        -in "$CONFIG_DIR/tls/server.csr" \
        -CA "$CA_DIR/ca.crt" -CAkey "$CA_DIR/ca.key" \
        -set_serial "0x$(openssl rand -hex 16)" \
        -extfile "$CONFIG_DIR/tls/server.ext" -out "$CONFIG_DIR/tls/server.crt"
)
install -m 0644 "$CA_DIR/ca.crt" "$CONFIG_DIR/client/foto-app-ca.crt"
openssl verify -CAfile "$CONFIG_DIR/client/foto-app-ca.crt" \
    -purpose sslserver -verify_ip "$APP_IP" "$CONFIG_DIR/tls/server.crt"

info 'systemd und Nginx konfigurieren'
cat > "$UNIT" <<'EOF'
[Unit]
Description=SVWS Foto-Matcher
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=sfm
Group=sfm
WorkingDirectory=/opt/svws-foto-matcher
Environment=NODE_ENV=production
Environment=PORT=3100
ExecStart=/usr/bin/node /opt/svws-foto-matcher/backend/server.js
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
UMask=0077

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/nginx/sites-available/svws-foto-matcher <<EOF
server {
    listen $APP_IP:80;
    server_name $APP_IP;
    return 301 https://$APP_IP\$request_uri;
}

server {
    listen $APP_IP:443 ssl;
    server_name $APP_IP;

    ssl_certificate $CONFIG_DIR/tls/server.crt;
    ssl_certificate_key $CONFIG_DIR/tls/server.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    client_max_body_size 15m;

    location / {
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }
}
EOF
# Nur den bei dieser Erstinstallation angelegten Debian-Standardlink entfernen.
if [[ -L /etc/nginx/sites-enabled/default ]]; then
    unlink /etc/nginx/sites-enabled/default
fi
ln -s /etc/nginx/sites-available/svws-foto-matcher /etc/nginx/sites-enabled/svws-foto-matcher
nginx -t
systemctl daemon-reload
systemctl enable --now svws-foto-matcher
systemctl enable nginx
# Debian startet Nginx bei der Paketinstallation mit Wildcard-Listenern.
# Der Wechsel auf die konkrete Container-IP benoetigt freie alte Sockets:
# Ein Reload kann hier mit "Address already in use" scheitern.
systemctl restart nginx

info 'Erreichbarkeit und Zertifikat pruefen'
curl --noproxy '*' --fail --silent --show-error --retry 10 --retry-connrefused \
    --retry-delay 1 --connect-timeout 3 --max-time 10 \
    http://127.0.0.1:3100/ -o /dev/null
curl --noproxy '*' --fail --silent --show-error --connect-timeout 3 --max-time 10 \
    --cacert "$CONFIG_DIR/client/foto-app-ca.crt" "https://$APP_IP/" -o /dev/null
systemctl is-active --quiet svws-foto-matcher nginx
{
    printf 'Installiert (UTC): %s\nRepository: %s\n' "$(date -u +%FT%TZ)" "$REPO"
    printf 'Branch: %s\n' "$(runuser -u sfm -- git -C "$APP_DIR" branch --show-current)"
    printf 'Commit: %s\n' "$(runuser -u sfm -- git -C "$APP_DIR" rev-parse HEAD)"
    printf 'Adresse: https://%s\n' "$APP_IP"
} > "$CONFIG_DIR/installation.txt"

info 'Installation abgeschlossen'
cat "$CONFIG_DIR/installation.txt"
printf '\nCA-Zertifikat fuer Clients: %s/client/foto-app-ca.crt\n' "$CONFIG_DIR"
openssl x509 -in "$CONFIG_DIR/client/foto-app-ca.crt" -noout -fingerprint -sha256
printf '\nServerzertifikat:\n'
openssl x509 -in "$CONFIG_DIR/tls/server.crt" -noout -dates
printf '\nCA-Zertifikat:\n'
openssl x509 -in "$CA_DIR/ca.crt" -noout -dates
printf '\n%s\n' \
    'CA-Zertifikat auf den Clients importieren; private Schluessel nicht verteilen.' \
    'CA-Verzeichnis samt Passwort separat sichern, siehe README.' \
    'Keine automatische Erneuerung eingerichtet. Vor Ablauf manuell erneuern.' \
    'Firewall bei Bedarf fuer TCP 80/443 aus dem internen Netz freigeben.' \
    'Logs: journalctl -u svws-foto-matcher -n 80 --no-pager'
