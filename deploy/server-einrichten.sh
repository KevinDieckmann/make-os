#!/usr/bin/env bash
# ─── MAKE OS · Server einrichten (einmalig, als root auf frischem Ubuntu 24.04) ─
# Aufruf auf dem Server:  bash server-einrichten.sh <github-repo-ssh-url>
#   z. B.  bash server-einrichten.sh git@github.com:<name>/make-os.git
# Macht: Updates, Docker (offizielles Paketquelle), Firewall (22/80/443),
# Nutzer „make“, Ordner unter /srv/make-os, Deploy-Schlüssel für GitHub,
# Sicherungs-Passwort, Cronjobs (Sicherung nachts, Vault-Abgleich alle 10 Min.).
# Danach fehlen nur: .env ausfüllen, Daten hochladen, `docker compose up -d --build`.
set -euo pipefail
REPO="${1:-}"
[ "$(id -u)" = 0 ] || { echo "Bitte als root ausführen."; exit 1; }
[ -n "$REPO" ] || { echo "Aufruf: bash server-einrichten.sh <github-repo-ssh-url>"; exit 1; }

echo "▸ System aktualisieren"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q && apt-get upgrade -yq
apt-get install -yq ca-certificates curl git ufw openssl unattended-upgrades age

echo "▸ Auslagerungsspeicher, wenn der Arbeitsspeicher knapp ist (Bauen braucht ~2 GB)"
if [ "$(awk '/MemTotal/ {print $2}' /proc/meminfo)" -lt 3500000 ] && ! swapon --show | grep -q /swapfile; then
  fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl -q vm.swappiness=10 && echo 'vm.swappiness=10' > /etc/sysctl.d/99-make-os.conf
fi

echo "▸ Docker aus der offiziellen Paketquelle"
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
apt-get update -q && apt-get install -yq docker-ce docker-ce-cli containerd.io docker-compose-plugin

echo "▸ Firewall: nur SSH, HTTP, HTTPS"
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable

echo "▸ Nutzer make (UID 1000 = Nutzer im Container)"
id make >/dev/null 2>&1 || useradd -m -u 1000 -s /bin/bash -G docker make
mkdir -p /home/make/.ssh && cp /root/.ssh/authorized_keys /home/make/.ssh/ 2>/dev/null || true
chown -R make:make /home/make/.ssh && chmod 700 /home/make/.ssh && chmod 600 /home/make/.ssh/authorized_keys 2>/dev/null || true
# make darf verwalten (sudo) — dann kann root-Login später aus (server-haerten.sh, 26.09.).
echo 'make ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/make && chmod 440 /etc/sudoers.d/make

echo "▸ Ordner"
mkdir -p /srv/make-os/{daten,vault,sicherungen}
chown -R make:make /srv/make-os

echo "▸ Deploy-Schlüssel für GitHub (nur lesen)"
sudo -u make bash -c '[ -f ~/.ssh/github ] || ssh-keygen -t ed25519 -N "" -f ~/.ssh/github -C "make-os-server" >/dev/null'
sudo -u make bash -c 'printf "Host github.com\n  IdentityFile ~/.ssh/github\n  IdentitiesOnly yes\n" > ~/.ssh/config && ssh-keyscan -H github.com >> ~/.ssh/known_hosts 2>/dev/null'

echo "▸ Sicherungs-Passwort (einmalig erzeugt — in den Passwort-Manager!)"
[ -f /srv/make-os/.sicherung-passwort ] || { openssl rand -base64 32 > /srv/make-os/.sicherung-passwort; chown make:make /srv/make-os/.sicherung-passwort; chmod 600 /srv/make-os/.sicherung-passwort; }

echo "▸ Cronjobs für make"
( { sudo -u make crontab -l 2>/dev/null | grep -v make-os || true; } ; \
  echo "15 3 * * * bash /srv/make-os/app/deploy/sicherung.sh >> /srv/make-os/sicherungen/protokoll.txt 2>&1 # make-os"; \
  echo "*/10 * * * * bash /srv/make-os/app/deploy/vault-abgleich.sh /srv/make-os/vault >> /srv/make-os/vault-abgleich.txt 2>&1 # make-os" ) | sudo -u make crontab -

echo "▸ Härten (SSH nur mit Schlüssel, fail2ban, nächtliche Updates, Protokollgrenzen)"
bash "$(dirname "$0")/server-haerten.sh"

cat <<TEXT

════════════════════════════════════════════════════════════════════
 Fertig. Jetzt noch drei Dinge:

 1) Diesen Deploy-Schlüssel im GitHub-Repo eintragen
    (Repo → Settings → Deploy keys → Add, NUR lesen):
$(cat /home/make/.ssh/github.pub)
    Genauso beim privaten Vault-Repo — dort MIT Schreibrecht
    (Jarvis schreibt ins Log).

 2) Als make:  git clone $REPO /srv/make-os/app
              install -m 600 /srv/make-os/app/deploy/env.server.beispiel /srv/make-os/app/.env
              nano /srv/make-os/app/.env        (Werte eintragen; Datei bleibt 600)
              Ausroll-Schlüssel in ~/.ssh/authorized_keys mit Forced Command:
              command="/srv/make-os/app/deploy/ausrollen.sh",restrict ssh-ed25519 AAAA… make-os-ausrollen
              Sicherung mit age (Empfänger = Kevins öffentlicher Schlüssel, Mac: age-keygen):
              echo 'age1…' > /srv/make-os/sicherung.pub

 3) Sicherungs-Passwort in den Passwort-Manager übertragen:
              cat /srv/make-os/.sicherung-passwort
════════════════════════════════════════════════════════════════════
TEXT
