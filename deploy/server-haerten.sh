#!/usr/bin/env bash
# ─── MAKE OS · Server härten (als root, wiederholbar) ───────────────────────
# Kevin 25.09.: „sicher in der höchsten Stufe, aber effektiv und
# kostengünstig“. Was hier passiert — alles ohne Zusatzkosten:
#   SSH       nur mit Schlüssel (kein Passwort), höchstens 3 Versuche, kein X11,
#             Firewall drosselt Verbindungsfluten (ufw limit)
#   fail2ban  sperrt Adressen nach wiederholten Fehlversuchen (SSH)
#   Updates   Sicherheitsupdates täglich von selbst; braucht der Kernel einen
#             Neustart, dann nachts um 4:30 (Container starten von selbst wieder)
#   Docker    Protokolle begrenzt (3 × 10 MB je Container) — die Platte läuft nie voll
#   Kernel    übliche Netz-Härtung (keine Umleitungen, SYN-Cookies, rp_filter)
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Bitte als root ausführen."; exit 1; }

echo "▸ SSH nur mit Schlüssel"
# 00- steht vor der Datei von cloud-init (50-…) — bei sshd gilt der erste Wert.
cat > /etc/ssh/sshd_config.d/00-make-os.conf <<'CONF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
PubkeyAuthentication yes
MaxAuthTries 3
LoginGraceTime 30
X11Forwarding no
AllowAgentForwarding no
CONF
sshd -t && systemctl reload ssh

echo "▸ Firewall drosselt SSH-Fluten"
ufw limit OpenSSH >/dev/null

echo "▸ fail2ban"
DEBIAN_FRONTEND=noninteractive apt-get install -yq fail2ban >/dev/null
cat > /etc/fail2ban/jail.d/make-os.conf <<'CONF'
[sshd]
enabled = true
backend = systemd
maxretry = 4
findtime = 10m
bantime = 1h
bantime.increment = true
CONF
systemctl enable --now fail2ban >/dev/null 2>&1 && systemctl restart fail2ban

echo "▸ Sicherheitsupdates, Neustart bei Bedarf nachts"
cat > /etc/apt/apt.conf.d/52make-os <<'CONF'
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:30";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
CONF

echo "▸ Docker-Protokolle begrenzen"
if [ ! -f /etc/docker/daemon.json ] || ! grep -q max-size /etc/docker/daemon.json; then
  printf '{\n  "log-driver": "json-file",\n  "log-opts": { "max-size": "10m", "max-file": "3" }\n}\n' > /etc/docker/daemon.json
  systemctl restart docker
fi

echo "▸ Kernel: Netz-Härtung"
cat > /etc/sysctl.d/98-make-os-netz.conf <<'CONF'
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.all.rp_filter = 1
net.ipv4.tcp_syncookies = 1
net.ipv4.conf.all.log_martians = 1
CONF
sysctl -q --system

echo "▸ Gehärtet."
