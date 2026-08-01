# MAKE OS gemeinsam betreiben

Was wohin gehört, damit Kevin und Malin zusammen arbeiten können — und was
bewusst **nicht** über iCloud läuft.

## Die vier Ebenen (jede hat ihren Ort)

| Was | Wo | Warum dort |
|---|---|---|
| **Code** | GitHub, privates Repo | Zwei Leute ändern gleichzeitig — nur Git kann das zusammenführen |
| **Daten** (Aufgaben, Netzwerk, Finanzen …) | Postgres auf dem Hetzner-Server | Ein Stand für beide, gleichzeitig nutzbar |
| **Dokumente** (Belege, PDFs, Screenshots) | gemeinsamer iCloud-Ordner | Genau dafür ist iCloud gut |
| **Arbeitsregeln für Claude** | `CLAUDE.md` im Repo | Reist mit dem Code mit, jedes Claude liest sie |

## Warum Code und Daten NICHT in iCloud gehören

Es liegt nahe, den Projektordner einfach in den gemeinsamen iCloud-Ordner zu
legen. Das geht schief, und zwar zuverlässig:

1. **`node_modules`** enthält über hunderttausend kleine Dateien. iCloud
   synchronisiert sich daran tot und lädt Dateien bei Bedarf nach — der
   Server startet dann nicht, weil eine Datei gerade „in der Cloud" ist.
2. **Git bricht.** Die `.git`-Ablage verträgt keine zwei Rechner, die
   gleichzeitig hineinschreiben. Ein halb synchronisierter Stand kann die
   ganze Historie beschädigen.
3. **Gleichzeitiges Speichern erzeugt Konfliktdateien** statt einer
   Zusammenführung — bei den Datendateien hieße das: einer von beiden
   verliert seine Eingaben, ohne es zu merken.

Für **Dokumente** ist iCloud dagegen genau richtig: Belege, Verträge,
Screenshots. Die Ordnerstruktur dafür steht als Punkt im Bauplan.

## Die Reihenfolge (was zuerst)

### 1 · GitHub — der gemeinsame Code
Nur Kevin, einmalig, im Browser:
- SSH-Schlüssel des Macs bei GitHub hinterlegen (Settings → SSH and GPG keys)
- Privates Repo `make-os` anlegen, ohne README
- Danach pusht Claude den Stand und lädt Malin als Mitarbeiterin ein

### 2 · Hetzner — der gemeinsame Server
Nur Kevin, einmalig:
- Konto auf hetzner.com, Cloud-Server **CX22**, Standort **Falkenstein**,
  Ubuntu 24.04, beim Anlegen denselben SSH-Schlüssel hinterlegen
- Server-IP an Claude geben

### 3 · Einrichtung (übernimmt Claude)
- Postgres aufsetzen, Datenspeicher umstellen (`lib/store/local-db.ts` ist
  die einzige Naht — mit `DATABASE_URL` schreibt sie in die Datenbank, ohne
  weiter lokal als Datei)
- Bestehende Daten aus `.data/` einmalig übertragen
- Coolify installieren: jeder Merge auf `main` geht in 1–2 Minuten live,
  mit HTTPS und Rollback-Knopf
- Zwei Zugänge einrichten: einer für Kevin, einer für Malin

### 4 · Malins Einstieg
- **Nutzen:** Adresse im Browser öffnen, Schlüssel von Kevin persönlich
- **Mitbauen:** Repo klonen, `npm install`, eigene `.env.local`, Claude Code
  im geklonten Ordner öffnen — die `CLAUDE.md` bringt ihm alle Regeln bei
- Details in `ONBOARDING_MALIN.md`

## Zum „geteilten Projekt bei Claude"

Ein gemeinsames Claude-Projekt im Sinne eines geteilten Gedächtnisses gibt es
nicht — jedes Claude arbeitet auf seinem Rechner mit seinem eigenen
Verlauf. Geteilt wird über den Code: Die `CLAUDE.md` im Repo enthält alle
Regeln, Begriffe und Leitplanken. Wer den Ordner öffnet, dessen Claude kennt
sie sofort. Das ist der belastbarste gemeinsame Kontext, den es gibt — er
altert nicht und geht nicht verloren.

## Bis der Server steht

Malin kann schon jetzt mitarbeiten: solange Kevins Mac läuft, erreicht sie
`http://<Mac-IP>:3001/os` im selben WLAN. Für unterwegs steht Tailscale im
Bauplan.
