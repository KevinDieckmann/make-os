# MAKE OS — Medien unterwegs: Recherche, Architektur, Bauplan

**Stand:** 08.10.2026 spät · nur Recherche und Konzept, nichts gebaut · Grundlage für die Fragerunde mit Kevin und einen Bau-Agenten über Nacht
**Auftrag (Kevin, 08.10. spät, wörtlich, auch in `ENTSCHEIDUNGEN_FRAGEBOGEN.md` › Nachtrag):**
„Über die App Bilder und Videos machen, wenn wir unterwegs sind — einfach über die Kamera. Dann gehen die Sachen geordnet, z. B. über ein Event,
direkt auf den Server, entweder Business oder Privat. Mit denen können wir dann im Marketing arbeiten, wenn sie dazu freigegeben wurden. Die
Schnittstelle können wir direkt mitbauen. Die gehen dann direkt an die Head ofs, um sie zu bearbeiten, wenn gewollt — das müssen wir auswählen können.“

> **Gilt zusammen mit:** CLAUDE.md (Plattform-Regel, Trennung serverseitig, Regeln 1, 3, 5, 6, 9; Abschnitte „Netzwerken“, „Verschlüsselung lückenlos“,
> „KI, Gesundheit, Telegram“, „Betroffenenrechte v2“), `AGENTEN_KONZEPT.md` (Heads → Mitarbeiter → Skills; dort steht für den Head of Marketing
> noch „ein Bildwerkzeug gibt es nicht“ — dieses Paket liefert es).
>
> **Belastbarkeit der Aussagen:**
> - **[O]** offizielle Doku / Hersteller / Gesetzestext, gelesen
> - **[S]** Such-Ausschnitt, Drittquelle, Forum, Bug-Tracker
> - **[A]** Annahme oder eigene Rechnung — nicht belegt, vor dem Bau am Gerät prüfen
> - **[R]** im Repo nachgesehen (08.10.2026)
>
> Alle Web-Quellen abgerufen am **08.10.2026**; Liste am Ende (Teil I).

---

## Kurzfassung

- **Am iPhone geht es als PWA:** Kamera über das Datei-Feld (System-Kamera und Mediathek), Fotos und Videos, Warteschlange auf dem Gerät, Upload in Stücken mit Wiederaufnahme. **Was nicht geht:** Hochladen im Hintergrund oder bei gesperrtem Bildschirm (kein Background Sync/Fetch auf iOS), Teilen-Ziel („Share Target“) auf iOS, Netztyp erkennen (WLAN/Mobilfunk). Lange Videos brauchen also „App offen lassen“ (Wake Lock hilft, ab iOS 16.4).
- **Videos sind das Mengenproblem:** 1 Minute 1080p ≈ 60 MB, 4K60 ≈ 400–440 MB [S]. Der Server hat ~5 GB frei, und die Nachtsicherung packt den ganzen Datenordner in 34 Generationen [R]. **Medien dürfen deshalb nie in `daten/` liegen.**
- **Empfehlung Speicher:** Hetzner Object Storage (S3, Deutschland, Grundpreis inkl. 1 TB; nach der Preisrunde April 2026 laut Drittquelle 6,49 € netto/Monat) — 50 GB/Monat passen ~20 Monate in den Grundpreis. Alternative: Storage Box (billiger, aber kein S3).
- **Empfehlung Upload:** eigener, tus-artiger Stückel-Upload **über den eigenen Server** (8-MiB-Stücke: unter der 10-MB-Grenze der Next-Middleware, über dem S3-Minimum von 5 MiB). Der Server verschlüsselt jedes Stück selbst (Schlüssel bleiben auf dem Server, Hetzner sieht nur Chiffrat) und reicht es als S3-Teil weiter. Direkt-Upload in den Bucket hieße: Schlüssel oder SSE-C-Header im Browser.
- **Vorbereitung im Browser statt ffmpeg:** Fotos ohne Exif/GPS (vorhandener Säuberer `jpegOhneMetadaten`), Vorschaubilder per Canvas, Video-Poster per `<video>` + Canvas, Ortsdaten aus Videos per Umpacken ohne Neukodierung (Mediabunny, `tags: {}`) — am Gerät zu prüfen.
- **Ordnung wie bei DAM-Systemen:** Album = Event · Kunde/Mandat · Projekt · Gesellschaft · frei; Bewertung (Favorit/Sterne/Ablehnen wie Lightroom), Status „intern → angefragt → freigegeben (Kanäle, bis-Datum) → gesperrt/abgelaufen“ wie Brandfolder/Canto/Bynder.
- **Recht:** Personen im Bild nur **von Hand** markieren (Gesichtserkennung = biometrische Daten, Art. 9). Freigabe nur durch Menschen (Regel 3), Rechtsgrundlage je Person, Widerruf/Art. 18 sperrt automatisch, Art. 15/17 über die vorhandenen Wege.
- **Heads:** nur, was ausdrücklich „an Head gegeben“ ist (je Album/Medium, Auftrag wählbar); Ergebnis immer Vorschlag im Stapel. Claude sieht Bilder, aber **kein Video/Audio**, bearbeitet keine Bilder und identifiziert keine Personen [O] → Video-KI über Einzelbilder + Transkript; Zuschnitt/Clip führt der Browser nach Klick aus.
- **Bau über Nacht (V1):** Upload-Kette + verschlüsselte Ablage (lokal + S3-Adapter mit Fake) + Katalog/Alben/Freigabe/Personen + Seite `/os/medien` + Rechte/Art. 15/17/Register. KI-Bearbeitung, Transkript, Clips, Zweitkopie = V2.
- **Befund nebenbei [R]+[O]:** Die Middleware läuft auf allen Routen, `middlewareClientMaxBodySize` ist nicht gesetzt → laut Next-Doku werden Körper über 10 MB **still abgeschnitten**. Die Aufgaben-Ablage erlaubt 25 MB, die CRM-Ablage 15 MB — Uploads zwischen 10 und 25 MB sollten im Prüfbau getestet werden.

---

# Teil A — Was es im Code schon gibt (Andockstellen, [R])

| Baustein | Wo | Nutzen für „Medien unterwegs“ | Grenze |
|---|---|---|---|
| Foto am Handy verkleinern | `components/os/netzwerken/bild.ts` (Canvas → JPEG 1400 px, q 0,78) | Muster für Vorschaubilder | nur Visitenkarten-Größe, kein Original |
| Exif/GPS entfernen | `lib/netzwerken/bild-bereinigen.ts` (`jpegOhneMetadaten`, `pngOhneMetadaten`) | Fotos ohne Ortsdaten, **ohne Neukodierung**, ICC (APP2) bleibt | nur JPEG/PNG; HEIC und Video nicht |
| Offline-Warteschlange | `lib/netzwerken/warteschlange.ts` (IndexedDB, AES-GCM mit nicht exportierbarem Schlüssel, 14/30-Tage-Regel, Sender im /os-Rahmen, idempotent per UUID, `ausfallsicher`) | genau das Muster für Medien | Körper als Base64 im Speicher — für Videos ungeeignet (Hunderte MB) |
| Verschlüsselte Bilder | `lib/store/bild-ablage.ts` (`bildAblegen/…Oeffnen`, AAD `ordner/name`, `BILD_ORDNER`) | Muster AAD + Rotation | ganze Datei im Arbeitsspeicher, liegt in `daten/` |
| Dateiablage | `lib/dateien/*` (`begrenztLesen`, 15/25 MB) | Typprüfung am Inhalt | ganzer Körper im RAM, `daten/` |
| Events / „Heute bei“ | `lib/crm/besuche*.ts`, `heuteBeiAngebot`, `istNetzwerkenEvent`, Make.One/Reihe | Album „Event“ automatisch vorbelegen | — |
| Mandate, Firmen, Projekte, Gesellschaften | `lib/crm`, `lib/aufgaben`, `lib/einheiten.ts` (`bereichVon`, `bereichVonGesellschaft`) | Album-Bezüge, Bereich Business/Privat | nie `kdc` als Sonderfall abfragen |
| Beiträge mit Freigabe | `Beitrag` (`status`, `freigabe { status, an }`) in `lib/crm/typen.ts` | Medium ↔ Beitrag verknüpfen | Freigabe dort = Text-Okay der Stimme |
| Heads + Agenten-Konzept | `lib/heads/*`, `AGENTEN_KONZEPT.md` C6 | Mitarbeiter „Bild & Video“ beim Head of Marketing/Event | heute kein Bildwerkzeug |
| KI-Tor, Kategorien | `lib/datenschutz/ki-tor.ts`, `ki-werkzeuge.ts` | neue Kategorie `medien` | gibt es noch nicht |
| Recht | Speicher-Register, `PERSON_BESTAENDE`, `personAufzaehlen/Entfernen`, Grabsteine, Lese-Protokoll, Hash-Kette | Medien anhängen wie jeden Bestand | — |
| Empfänger-Register | `lib/datenschutz/einrichtung.ts` → `hetzner` (Auftragsverarbeiter, EU) | Object Storage ist Hetzner (Notiz ergänzen) | ob der bestehende AVV Object Storage abdeckt: prüfen [A] |
| Nachtsicherung | `deploy/sicherung.sh` (tar über ganz `daten/`, Generationen 14/8/12) | — | **Medien in `daten/` würden jede Sicherung um ihre volle Größe aufblähen** |

---

# Teil B — Recherche

## B1 · Kamera in der Web-App

**Zwei Wege:**

| | `<input type="file" accept=… capture>` | `getUserMedia` + `MediaRecorder` (eigene Kamera in der App) |
|---|---|---|
| Was passiert | öffnet die System-Kamera bzw. die Mediathek; die Seite bekommt eine Datei | Live-Bild in der Seite, Aufnahme per JS |
| Qualität | volle Kamera-App (HDR, Stabilisierung, Objektive) [A] | was der Browser liefert; Formate je Browser |
| Formate iOS | Fotos: HEIC/JPEG, Videos: QuickTime/MOV (HEVC oder H.264) [S] | bis iOS 18.3 nur MP4 (H.264/AAC) [O, WebKit 2020]; ab 18.4 laut Drittquelle auch WebM, HEVC, VP9 [S] |
| Stolpersteine | mehrere Aufnahmen mit `capture` ersetzen einander in der FileList (iOS 16–18) [S]; ob die Aufnahme in „Fotos“ gesichert wird, ist nicht belegt — ältere Tests sagen nein [S] | Kamera-Erlaubnis in Home-Screen-Apps geht bei Routenwechsel verloren und wird erneut gefragt (WebKit-Bug 215884, Status unklar; Bericht noch Juni 2025 mit Next.js) [S]; Stream stoppt beim Kontrollzentrum (Bug 254129) [S] |
| Empfehlung | **V1** | nicht in V1 |

**Formate und Umwandlung durch Safari:**
- HEIC → JPEG: Safari wandelt beim Auswählen in den **ersten Typ der `accept`-Liste** um, wenn HEIC nicht darin steht; steht `image/heic` drin, können umgekehrt PNG/JPEG zu HEIC werden (WebKit-Bugs 292350, 303803; Apple-Forum) [S]. **Folge [A]:** `accept="image/jpeg,image/png,video/*"` liefert JPEG — Säubern dann ohne Neukodierung mit `jpegOhneMetadaten`. Am Gerät mit `File.type`/Größe protokollieren.
- Videos: Seit iOS 13.6.1 bekommt die Seite laut Bericht die **unveränderte** Datei aus der Mediathek, oft HEVC in QuickTime (früher Umwandlung auf 720p H.264) [S]. „Kompatibelste“ in den Kamera-Einstellungen = H.264 [S].
- Abspielen: HEVC spielt Safari (iOS ab 11, macOS ab 13) [O caniuse]; Chrome/Firefox nur „teilweise“ [O caniuse]. Für das Team mit Apple-Geräten reicht das Original; für Web/Social braucht es später eine H.264-Fassung.

**Dateigrößen (iPhone, Angaben aus Apples Einstellungsbildschirm über Drittquellen) [S]:** 1080p30 ≈ 60 MB/min · 1080p60 ≈ 90 MB/min · 4K30 ≈ 170 MB/min (HEVC) · 4K60 ≈ 400–440 MB/min. HEVC halbiert gegenüber H.264 grob.

## B2 · Grenzen der iOS-PWA

| Fähigkeit | iOS-Safari / Home-Screen-App | Quelle |
|---|---|---|
| Background Sync | **nein** (alle Versionen bis 27.2) | [O caniuse] |
| Background Fetch | **nein** | [S firt.dev] |
| Upload läuft weiter, wenn App im Hintergrund / Bildschirm gesperrt | **nein** — iOS hält die Seite an; Verbindungen brechen ab bzw. hängen nach der Rückkehr; nur native `URLSession`-Hintergrundsitzungen setzen fort | [S Apple-Forum, Breakpad, Hersteller-Hilfe] |
| Screen Wake Lock (Bildschirm bleibt an) | ja ab 16.4; für Home-Screen-Apps gab es einen Bug, als behoben markiert, Version unklar | [O caniuse], [S WebKit 254545] |
| Speicher je Ursprung | bis **60 % der Platte** (Browser-Apps, Safari 17+), Home-Screen-App gleich; darüber `QuotaExceededError` | [O WebKit-Blog „Updates to Storage Policy“] |
| Löschen durch iOS | bei Platzmangel oder nach Zeit ohne Nutzung (ITP); `navigator.storage.persist()` nimmt aus | [O WebKit-Blog], [S firt.dev: persist ab 15.2] |
| OPFS / `createWritable` | OPFS ab 15.2, `createWritable` ab **iOS 26** | [S firt.dev], [O caniuse/MDN-Daten] |
| Teilen-Ziel (`share_target`) | **nein** (Chrome Android ja) | [O caniuse], [S WebKit-Bug 194593] |
| Netztyp erkennen (`navigator.connection`) | **nein** (Chrome Android ja) | [O caniuse] |
| Web Push | ja ab 16.4, nur installierte Home-Screen-App | [S firt.dev] |
| WebCodecs | teilweise 16.4–18.7, **voll ab iOS 26** | [O caniuse] |
| WebGPU | ab iOS 26 (Safari 26) | [S appdevelopermagazine, gigazine] |

**Folge:** Ein Upload braucht die offene App. Darum: Stücke klein, Fortschritt sichtbar, Wake Lock während des Uploads, beim Zurückkehren (`visibilitychange`) den Stand beim Server erfragen und weitermachen; Hinweis „Für große Videos App offen lassen oder später im WLAN“ — „im WLAN“ kann die App nicht selbst erkennen.

**Teilen aus der Fotos-App ohne native App:** iOS-**Kurzbefehl** im Teilen-Menü (Eingabetyp „Bilder“), Aktion „Inhalte von URL abrufen“ mit POST und Datei als Körper [O Apple Shortcuts-Hilfe]. Ein Forum meldet eine Bestätigungs-Rückfrage vor dem Ausführen [S]. Braucht einen **eigenen, eingeschränkten Upload-Schlüssel je Person** (Muster HOI/Zulieferer, CLAUDE.md „Neue Außen-Zugänge nur so“). Grenzen von Kurzbefehlen bei großen Videos: nicht belegt [A]. → V2/V3.

## B3 · Große Uploads über Mobilfunk

- **tus 1.0** (Stand der Spezifikation 2016): `POST` legt an, `HEAD` liefert `Upload-Offset`, `PATCH` setzt fort; Erweiterungen Expiration, Checksum (SHA-1 Pflicht), Termination, Concatenation (parallele Teile) [O tus.io]. Referenzserver **tusd** (Go) speichert lokal, auf GCS oder S3-kompatibel [S pkg.go.dev]. Uppy empfiehlt tus für Zuverlässigkeit und baut Backoff bei 429 ein [O uppy.io].
- **IETF „Resumable Uploads for HTTP“** (aus tus entstanden): Entwurf **-12 vom Juli 2026**, noch kein RFC; Statuscode 104 nur vorläufig registriert [S Datatracker, http.dev]. → nicht darauf bauen, aber dieselbe Form nachbilden.
- **S3 Multipart:** Teile 5 MiB–5 GiB, letzter Teil beliebig klein, höchstens 10.000 Teile [O AWS]; Hetzner: bis 5 GB je Teil, 10.000 Teile, Objekt bis 5 TB [O Hetzner]. Direkt aus dem Browser mit vorab signierten Teil-URLs (Uppy `@uppy/aws-s3`): ein Server-Rundweg je Teil zum Signieren [S Transloadit-Forum].
- **SSE-C und vorab signierte URLs:** Wer die URL benutzt, muss **den Schlüssel als Header mitschicken**; ein bloßer Link (z. B. `<video src>`) geht damit nicht [O AWS-Doku/Blog]. AWS schaltet SSE-C seit April 2026 für neue Buckets standardmäßig ab [O AWS] — ein Zeichen, dass das Verfahren unbeliebt ist; für Hetzner ohne Aussage.
- **Next.js-Middleware:** Mit Middleware wird jeder Körper geklont und gepuffert; Standard-Grenze **10 MB**, darüber wird **nur der Anfang** weitergereicht, **ohne Fehler** an den Client (`experimental.middlewareClientMaxBodySize`, „nicht für Produktion empfohlen“) [O Next.js 15 Doku]. MAKE OS hat Middleware auf allen Pfaden [R] → **jedes Upload-Stück < 10 MB**.

**Direkt in den Bucket oder über den eigenen Server?**

| | direkt (vorab signiert) | über den Server (Empfehlung) |
|---|---|---|
| Serverlast | keine Nutzdaten | 1 vCPU: AES-GCM ist um Größenordnungen schneller als jeder Mobilfunk-Upload [A]; RAM ~2 × 16 MiB je parallelem Stück (Middleware-Klon + Route) [A] |
| Verschlüsselung | nur SSE-C (Schlüssel in jedem Browser-Request) oder Verschlüsselung im Browser (Schlüssel je Medium im Browser) | **eigene Verschlüsselung auf dem Server, Schlüssel verlässt den Server nie** (passt zu Regel 9) |
| Bucket nach außen | CORS + offene Signaturen | Bucket privat, nur der Server kennt Zugangsdaten |
| Verkehr | Handy → Hetzner | Handy → Server (Eingang frei), Server → Bucket in `eu-central` frei [O Hetzner] |
| Anzeige/Abspielen | SSE-C-Objekte nicht per Link abspielbar | Server entschlüsselt Bereich für Bereich (Range) |

## B4 · Speicher

**Hetzner Object Storage [O Hetzner-Doku, wenn nicht anders vermerkt]**
- Standorte FSN1, NBG1, HEL1 (alle Netzzone `eu-central`); S3-kompatibel; Objekte unveränderlich (WORM-Modell).
- Grenzen: PUT bis 5 GB, Multipart 5 GB je Teil / 10.000 Teile, Objekt bis 5 TB; 750 Anfragen/s je IP und Bucket; 10 Gbit/s je Bucket; 100 Buckets, 50 Mio. Objekte je Bucket; 8 kB Metadaten je Objekt; abgerechnet mindestens 64 KB je Objekt.
- Verschlüsselung: **nur SSE-C** (Schlüssel bei jedem Zugriff mitsenden; „does not encrypt metadata“; Kopieren von SSE-C-Objekten nicht möglich). Ob ohne SSE-C „at rest“ verschlüsselt wird: nicht belegt.
- Lebenszyklus-Regeln: Ablauf nach Tagen, nicht aktuelle Versionen nur `NoncurrentDays`, **abgebrochene Multipart-Uploads automatisch räumen**. Versionierung und Object Lock vorhanden. CORS möglich. CopyObject nur im selben Bucket. Eigene Domains nein.
- **Preis:** Start 12/2024 netto 4,99 €/Monat inkl. 1 TB Speicher + 1 TB Ausgang, darüber 0,0067 € je TB-Stunde, Ausgang 1 €/TB [O Pressemitteilung (brutto 5,94/0,0080/1,19), S heise netto]. Zum **1. April 2026** stieg der Grundpreis laut Drittquelle auf **6,49 € netto** [S agentdeals.dev, ifun] — von Hetzner selbst nicht bestätigt gefunden; Mehr-TB laut Sliplane 8,70 €/TB-Monat [S]. Eingang, Verkehr innerhalb `eu-central` und API-Aufrufe frei.
- Zuverlässigkeit: Störung „degraded“ am 02.07.2026 laut Drittquelle [S Sliplane].

**Hetzner Storage Box [O Produktseite, Preise S]:** BX11 1 TB, unbegrenzter Verkehr, 10 Snapshots manuell/10 automatisch, 100 Unterkonten, **10 gleichzeitige Verbindungen**; SFTP, SCP, Samba, WebDAV, HTTPS, rsync, Borg, Restic, Rclone; Standort DE/FI. Preis Ende 2025 3,20 € netto/Monat [S whtop]; ob die Preisrunde 2026 sie traf: nicht belegt. Kein S3, keine Lebenszyklus-Regeln.

**Hetzner Volume (Blockspeicher am Server):** 10 GB–10 TB, laut Doku 0,44 €/10 GB/Monat (≈ 0,044 €/GB), nach April +~30 % laut Drittquelle [O Doku, S ecosistemastartup]. Technisch am einfachsten (eine Platte), aber am teuersten pro GB und an einen Server gebunden.

**Kosten bei 50 GB Zuwachs pro Monat [A, eigene Rechnung, netto, Preise siehe oben]:**

| Monat | Bestand | Object Storage | Storage Box | Volume (0,044–0,057 €/GB) |
|---|---|---|---|---|
| 6 | 300 GB | 6,49 € | 3,20 € (BX11) | 13–17 € |
| 12 | 600 GB | 6,49 € | 3,20 € | 26–34 € |
| 24 | 1,2 TB | ~6,49 € + 0,2 TB × 5–8,70 € ≈ 7,5–8,2 € | BX21 (5 TB) nötig, Preis nicht belegt | 53–68 € |
| 36 | 1,8 TB | ≈ 10,4–13,5 € | BX21 | 79–103 € |

Ansehen über den Server: Bucket → Server frei (`eu-central`), Server → Handy zählt gegen das Verkehrs-Kontingent des Cloud-Servers (EU: 20 TB/Monat inkl., darüber 1 €/TB [S egresscost, O Hetzner-Traffic-Doku]).

**„Alle Bestände verschlüsselt, Schlüssel nur auf dem Server“ — wie das passt:**
1. **Hüllen-Verschlüsselung (Envelope):** je Medium ein zufälliger Datenschlüssel (DEK, 32 Byte), mit dem Datenschlüssel der Instanz (Schlüsselring aus `lib/store/huelle.mjs`) gewickelt und **im Katalog** gespeichert. Rotation des Datenschlüssels = nur DEKs neu wickeln, keine Videos neu schreiben [A].
2. **Inhalt in Segmenten** nach dem Vorbild von **age** (STREAM: 64-KiB-Stücke, je Stück eigener Nonce mit Zähler + „letztes Stück“-Merker, Abschneiden wird erkannt, Springen an jedes Stück möglich) [O age-Spezifikation]. Bei uns AES-256-GCM (Node `crypto`), AAD = `make-os|medien|<medium>|<variante>`.
3. **Bucket sieht nur Chiffrat** unter zufälligen Namen (`<medium-id>/<variante>`), keine Dateinamen, keine Metadaten. SSE-C wird dann nicht gebraucht.
4. **Nonce-Regel:** Ein Stück kann wegen eines Abbruchs mehrmals kommen. Nie denselben Nonce mit anderem Inhalt verwenden — darum je Teil-Versuch ein zufälliges Salz im Nonce, das Salz des erfolgreichen Teils steht in der Upload-Sitzung und danach im Katalog [A, Gestaltungsregel].

## B5 · Verarbeitung auf schwachem Server — im Browser

| Aufgabe | Weg | Belege |
|---|---|---|
| Vorschaubilder Foto | Canvas (wie `bild.ts`), z. B. 400 px Raster + 1600 px Ansicht, JPEG | [R] |
| Poster für Videos | `<video playsinline muted>` laden, zu Sekunde x springen, `drawImage` auf Canvas | Standard-Web-API [A: am iPhone testen] |
| HEIC → JPEG | Safari wandelt per `accept`-Liste um (B1); Safari 17+ dekodiert HEIC nativ, andere Browser über WASM (z. B. heic-normalize) | [S WebKit-Bugs, libraries.io] |
| Exif/GPS Foto | `jpegOhneMetadaten` (ohne Neukodierung, ICC bleibt) | [R] |
| GPS aus Video | Ort steht als `com.apple.quicktime.location.ISO6709` (mdta) bzw. `©xyz` in `udta` [O Apple QuickTime-Doku, S addpipe]. **Im Browser:** Mediabunny packt **ohne Neukodierung** um und lässt mit `tags: {}` alle beschreibenden Metadaten weg [O Mediabunny]. Ob die ISO6709-Angabe dabei sicher fällt: **mit exiftool/ffprobe prüfen** [A]. Server-Rückfall: `ffmpeg -map_metadata -1 -c copy` [S] — ffmpeg ist im Docker-Bild nicht enthalten [R] | |
| Video verkleinern | WebCodecs voll ab iOS 26 [O caniuse]; Mediabunny Conversion (Größe, Qualität, Trimmen; Trimmen erzwingt Neukodierung) [O]; Codecs per `canEncode` prüfen, Ergebnis H.264/AAC in MP4 am sichersten [S]. Lizenz von Mediabunny vor Einbau prüfen (nicht belegt) | |
| Zuschnitt | im Browser über Canvas mit Rechteck vom Head; Server-Rückfall `sharp` (libvips, „attention“/„entropy“ nur bei `fit: cover`, experimentell) [S sharp-Doku]; Browser-Bibliothek smartcrop.js (Kanten, Hautton, Sättigung; Gesichter nur mit Fremd-Detektor) [S] | |
| Duplikate | Wahrnehmungs-Fingerabdruck dHash/Blockhash (Hamming-Abstand; 0 = gleich, ≤ 10 Varianten — Faustregel eines Pakets) [S] | |

**Warum nicht ffmpeg auf dem Server:** 1 vCPU/2 GB, alles reiht sich hintereinander (CLAUDE.md „Tempo“); Neukodierung eines 4K-Videos blockiert die App minutenlang [A]. Reines Umpacken/Schneiden mit `-c copy` wäre billig, braucht aber Klartext-Zwischendateien und ein größeres Docker-Bild → höchstens V2 im Arbeiter-Container mit tmpfs.

## B6 · Ordnung und Rechte am Material (DAM-Vorbilder)

| Vorbild | Was es gut macht | Für MAKE OS |
|---|---|---|
| **Brandfolder** [O Smartsheet-Hilfe/API] | je Asset `approved` (ja/nein), `availability_start` (Entwurf bis…) und `availability_end` (abgelaufen); Abgelaufenes verschwindet aus Links/CDN; Collections = Teilmengen ohne Kopie | Status + bis-Datum; Album = Teilmenge, nie Kopie |
| **Canto** [S Release-Notes 6.8.0] | Filter „freigegeben, läuft am … ab“, „bald automatisch freigegeben“, Copyright-Filter; Approval Hub | Ablaufliste „läuft in 30 Tagen ab“ |
| **Bynder** [S] | Ablauf/Embargo, Download-Freigaben, automatische Wasserzeichen nach Regeln, „öffentlich markieren“ = Link | Wasserzeichen und öffentliche Links erst V3 |
| **Frame.io** [S] | Status-Etiketten (Needs Review · In Progress · Approved), Smart-Collections aus Metadaten; Camera-to-Cloud lädt **Proxys** (720p) sofort, Originale später | Proxy-Idee: erst kleine Fassung hoch, Original nachziehen (Frage 4) |
| **Dropbox Replay** [S] | Kommentare an Zeitpunkt/-spanne, Versionen nebeneinander, Rechte je Link | Kommentare am Medium später über `BeitragsVerlauf` |
| **Google Fotos, geteilte Alben** [O Google-Hilfe] | mehrere tragen bei („Collaborate“ abschaltbar), Sortierung nach Aufnahmezeit, Link-Freigabe mit neu erzeugbarem Link | Event-Album, in das das ganze Team lädt |
| **Event-Fotografen** (Pixieset, Sony Visual Story, Evoto) [S] | Live-Galerie während des Events, Favoriten/Herz je Kunde mit Notiz, Höchstzahl Favoriten | Auswahl in der Galerie, Kunden-Auswahl später |
| **Lightroom** [S] | Durchgang 1 Flaggen (P = behalten, X = ablehnen), Durchgang 2 Sterne 1–5 nur für Behaltene, Farb-Etiketten für Status | Favorit/Ablehnen + Sterne; „Ablehnen“ ≠ löschen |

**Recht am Bild (Deutschland, Hinweis — keine Rechtsberatung):**
- Fotos erkennbarer Personen sind personenbezogene Daten; für Unternehmen trägt meist **Art. 6 Abs. 1 lit. f** (Interessenabwägung), bei der Aufsichtsbehörden die Wertungen des **§ 23 KUG** heranziehen (z. B. Versammlungen, Beiwerk) [S Heuking, LDA Brandenburg]. § 23 Abs. 1 Nr. 2/3 KUG: Personen als Beiwerk, Bilder von Versammlungen und ähnlichen Vorgängen; Abs. 2: nie gegen berechtigte Interessen der Abgebildeten [O gesetze-im-internet].
- Nicht öffentliche Events, Einzelporträts, Social Media nach außen: Quellen raten zur **Einwilligung**; Kinder fast immer mit Einwilligung der Eltern; Hinweis vor der Aufnahme (Art. 13), Widerspruch nach Art. 21 möglich [S dr-datenschutz, Otto Schmidt].
- Mitarbeiterfotos für außen: Einwilligung, freiwillig, konkret, widerruflich [S dr-datenschutz, e-recht24].
- **Gesichtserkennung:** Lichtbilder sind nur dann biometrische Daten, wenn sie mit speziellen technischen Mitteln zur eindeutigen Identifizierung verarbeitet werden (ErwG 51) [O]; genau das tut automatisches Gesichter-Zuordnen → Art. 9, ausdrückliche Einwilligung nötig, Schilder reichen nicht [S]. Claude identifiziert ohnehin keine Personen [O]. → **Nur manuelles Markieren.**
- **KI-VO Art. 50 Abs. 4** (gilt seit **02.08.2026**): Wer mit KI realistische Bilder/Videos von Personen erzeugt oder **verändert** (Deepfake), muss das sichtbar kennzeichnen [S Kanzleien, Kommissions-Leitlinien Juli 2026]. Zuschnitt und Helligkeit sind keine Deepfakes [A]; generative Bearbeitung (Hintergrund tauschen, Personen entfernen) wäre kennzeichnungspflichtig → nicht in V1/V2.

## B7 · KI-Bearbeitung durch Heads und Mitarbeiter

- **Claude-Vision [O]:** JPEG/PNG/GIF/WebP, bis 8000 × 8000 px, 10 MB je Bild (API), bis 100/600 Bilder je Anfrage; ab 20 Bildern je Anfrage strengere Pixelgrenze (≤ 2000 px sicher). Kosten ⌈B/28⌉ × ⌈H/28⌉ Bild-Tokens, Standard-Stufe max. 1568 px, Hochauflösung (Claude 4.7+) 2576 px. **Kann keine Personen benennen, erzeugt/bearbeitet keine Bilder, liest keine Metadaten.** Kein Video/Audio als Eingabe. → Vorschaubilder 1024–1568 px reichen für Auswahl/Zuschnitt-Vorschläge; Videos = Einzelbilder + Transkript.
- **Auswahl der besten Bilder:** Claude bewertet Schärfe, Ausschnitt, Ausdruck, Markenpassung aus Vorschaubildern; Ergebnis als Vorschlag mit Begründung [A]. Vorfilter ohne KI: Duplikate (dHash), Ablehnungen.
- **Formate für Zuschnitt [S Drittquellen, uneinheitlich]:** Instagram Feed 1080 × 1440 (3:4, neu) bzw. 1080 × 1350 (4:5), 1:1, 1,91:1; Stories/Reels 1080 × 1920 (9:16). LinkedIn 1200 × 627 (1,91:1), 1:1 (1080/1200), 4:5 (1080 × 1350), Dokument-Karussell 1200 × 1500. Instagram-API: nur **JPEG ≤ 8 MB, 4:5 bis 1,91:1**, Medien müssen unter einer **öffentlichen URL** liegen, 100 API-Posts/24 h [O Meta].
- **Untertitel/Transkript:** LinkedIn nimmt **SRT** (Oberfläche und Videos-API; laut API eine Datei, nur Englisch) und transkribiert auch selbst [O Microsoft Learn, S 3Play]. Transkription: **Mistral Voxtral Mini Transcribe V2**, 0,003 $/Minute, Deutsch, bis 3 h je Anfrage, Sprecher-Zuordnung; Daten laut Drittquellen standardmäßig in der EU, Aufbewahrung umstritten [O Mistral-Blog, S]. Auf dem Gerät: Whisper über Transformers.js mit WebGPU (iOS 26) — Modell ~200 MB, auf iPhones nicht getestet gefunden [S]. Anthropic transkribiert nicht [O].
- **Kurzclips:** zwei Aufgaben — *Momente finden* (OpusClip-API nur Enterprise/Early Access [S]; Tencent „Intelligent Highlights“ [S]) und *schneiden* (Mux: Instant Clipping per URL ohne Neukodierung, segmentgenau; framegenau als neues Asset; Cloudinary `so_/eo_` [S]). Für MAKE OS [A]: Momente schlägt der Head aus Transkript + Einzelbildern vor, schneiden tut nach Klick der Browser (Mediabunny `trim`, Neukodierung auf dem Gerät, iOS 26).
- **Bildverbesserung:** Zuschnitt, Gerade-Richten, Helligkeit/Kontrast deterministisch im Browser [A]; generative Verbesserung (Drittanbieter, Kennzeichnung Art. 50) später und nur nach Kevins Wort.
- **Immer:** erst Vorschlag (Stapel), dann Freigabe durch einen Menschen; das Ergebnis ist ein **neues Medium** „abgeleitet von“, das Original bleibt.

---

# Teil C — Machbarkeit am iPhone

| Geht | Geht nicht / nur mit Umweg |
|---|---|
| Foto/Video mit der System-Kamera aus der App (Datei-Feld mit `capture`) | Upload im Hintergrund oder bei gesperrtem Bildschirm — nur native App (`URLSession`) |
| Mehrere Fotos/Videos aus der Mediathek wählen (`multiple`) | Teilen aus „Fotos“ direkt in die PWA (`share_target`) — Umweg Kurzbefehl (V2) oder native App |
| HEIC als JPEG bekommen, Exif/GPS ohne Neukodierung entfernen | Zuverlässig in „Fotos“ mitspeichern, was in der App aufgenommen wurde — nicht belegt; Empfehlung: lange Videos mit der Kamera-App aufnehmen und dann wählen |
| Warteschlange auf dem Gerät (IndexedDB, bis 60 % Platte), dauerhaft per `persist()` | WLAN/Mobilfunk erkennen — der Nutzer entscheidet („Videos nur auf Knopfdruck hochladen“) |
| Upload in 8-MiB-Stücken mit Wiederaufnahme nach Abbruch/Neuladen | eigene Kamera-Oberfläche ohne wiederholte Erlaubnis-Abfragen in der Home-Screen-App (Bug-Lage unklar) |
| Bildschirm wach halten während des Uploads (Wake Lock) | Video neu kodieren auf iOS < 26 (WebCodecs nur teilweise) |
| Poster/Vorschaubilder per Canvas; Videos abspielen über Range-Anfragen (Safari verlangt 206-Antworten [S]) | KI-Transkription auf dem Gerät: theoretisch WebGPU (iOS 26), praktisch ungetestet |
| Videos umpacken/zuschneiden (WebCodecs ab iOS 26) | — |

---

# Teil D — Empfohlene Architektur für MAKE OS

## D1 · Überblick

```
 iPhone/PWA                                   MAKE-OS-Server (1 vCPU)                Hetzner Object Storage (nbg1/fsn1)
 ─────────────────────────────────────────    ───────────────────────────────────    ──────────────────────────────────
 [Aufnehmen]  Kamera / Mediathek
   │  Album vorbelegt („Heute bei …“, Bereich)
   ▼
 [Vorbereiten] JPEG ohne Exif · Video ohne Ort
   │            Poster + Vorschau (Canvas)
   ▼
 [Warteschlange] IndexedDB, verschlüsselt,
   │             Stücke à 8 MiB, persist()
   ▼
 [Senden] ──POST /api/medien/upload───────────▶ Sitzung anlegen (idempotent, UUID)
          ──PUT  …/upload/<id>/<nr> (8 MiB)──▶ prüfen (SHA-256, Größe, Person)
                                               verschlüsseln (DEK, 64-KiB-Segmente) ──UploadPart──▶ Teil n (Chiffrat)
          ──GET  …/upload/<id> (welche fehlen)▶ Stand
          ──POST …/upload/<id>/fertig────────▶ CompleteMultipart, Katalog „liegt“ ──Complete──▶ Objekt <medium>/original
                                               Vorschau/Poster klein → eigenes Objekt
 [Galerie] ◀─GET /api/medien (gefiltert)────── Katalog-Bestand (Sicht serverseitig)
 [Ansehen] ◀─GET /api/medien/inhalt?…&v= (Range 206)── entschlüsselt nur die nötigen Segmente ◀─GET Range─ Objekt
 [Ordnen/Freigeben] ─PATCH /api/medien (Ops mit Stand)─▶ Album, Personen, Freigabe, „an Head“
                                               │
                                               ▼
                                   Head of Marketing / Event (Mitarbeiter „Bild & Video“)
                                   liest nur Freigegebenes + „an Head gegeben“ → Vorschlag im Stapel (Art „medien“)
                                   → Klick: Browser schneidet zu / schneidet Clip → neues Medium „abgeleitet von“
```

## D2 · Aufnahme und Vorbereitung (Browser)
- **Zwei Knöpfe:** „Foto/Video aufnehmen“ (`accept="image/jpeg,image/png,video/*" capture="environment"`) und „Aus Mediathek“ (ohne `capture`, `multiple`). Kein `image/heic` in der Liste (B1).
- **Album vorbelegt:** aktives Event aus „Heute bei“ (Netzwerken-Weg `heuteBeiAngebot`), sonst zuletzt gewähltes Album, sonst „Unsortiert“ des Bereichs. Bereich folgt dem Album (Business-Event → Business); ohne Album der Kopf-Schalter (`useSpace().space`).
- **Foto:** Bytes → `jpegOhneMetadaten` (kein Neukodieren) → zusätzlich Vorschau 1600 px + Raster 400 px per Canvas. Orientierung: vor dem Entfernen von APP1 die Exif-Drehung auslesen und als Feld mitgeben [A] (sonst stehen Hochkant-Fotos quer).
- **Video:** Poster (Bild bei 1 s) + Raster-Vorschau per Canvas; Dauer/Abmessungen aus dem `<video>`-Element; Ortsdaten entfernen per Umpacken ohne Neukodierung (Mediabunny, `tags: {}`); gelingt das nicht → Video bleibt „Ortsdaten nicht geprüft“ und lässt sich nicht für Marketing freigeben.
- **Grenzen:** je Video höchstens X GB/Y Minuten (Frage 4), Fotos ≤ 50 MB [A].

## D3 · Warteschlange auf dem Gerät
- Muster `lib/netzwerken/warteschlange.ts`: AES-GCM mit nicht exportierbarem WebCrypto-Schlüssel, **aber Stückweise**: je 8-MiB-Stück ein verschlüsselter Blob in IndexedDB (nie das ganze Video im Arbeitsspeicher, nie Base64).
- Eintrag: Upload-Kennung (UUID), Medium-Metadaten, Album, Stückliste mit Stand (wartet/gesendet), Person (`erfasstVon` → nur für die angemeldete Person senden, wie Netzwerken).
- `navigator.storage.persist()` beim ersten Medium anfragen; `estimate()` zeigen („Auf dem Gerät warten 1,2 GB“).
- Senden: der Sender im /os-Rahmen (wie `NetzwerkenSender`), höchstens 2 Stücke gleichzeitig, Backoff wie Netzwerken (Status 0/401/429 → alle warten; 5xx → 3 Versuche je Stück). Videos optional nur auf Knopfdruck (Frage 4).
- Alter: wie Netzwerken (Hinweis ab 14 Tagen); automatisches Verwerfen bei Medien **nicht** (eigene Aufnahmen, keine Daten Dritter im Körper) — Frage 15.
- Abmelden: Warteschlange der Person nur nach Rückfrage löschen (Muster `vorAbmelden`).

## D4 · Upload-Protokoll (tus-artig, eigene Routen)

| Schritt | Route | Regeln |
|---|---|---|
| Anlegen | `POST /api/medien/upload` `{ id: <uuid>, art, typ, bytes, sha256?, album?, bereich, aufgenommenAm?, breite?, hoehe?, dauerSek?, ortsdatenEntfernt }` | Person aus Sitzung (`personStreng`), Dienstweg 403, `bauPruefen`, `jsonBegrenzt`; Typ-Positivliste; Grenzen → 413; idempotent: gleiche UUID derselben Person → bestehende Sitzung; S3 `CreateMultipartUpload`; Antwort `{ teilGroesse: 8 MiB, fehlende: [...] }` |
| Stück | `PUT /api/medien/upload/<id>/<nr>` Körper roh ≤ 8 MiB, Kopf `x-make-teil-sha256` | `begrenztLesen(8 MiB)`; SHA-256 prüfen; erstes Stück: Magic Bytes prüfen (JPEG/PNG/ftyp-MOV/MP4) → sonst 415; verschlüsseln; `UploadPart`; ETag + Salz in der Sitzung (Sperre); doppeltes Stück mit gleichem SHA → 200 ohne Arbeit, mit anderem SHA → 409 |
| Stand | `GET /api/medien/upload/<id>` | fehlende Stücke; nach Neuladen weitermachen |
| Fertig | `POST /api/medien/upload/<id>/fertig` `{ vorschau, poster? }` (kleine Bilder, je ≤ 1 MB, als Base64 oder eigener PUT) | alle Stücke da? → `CompleteMultipartUpload`; Vorschau/Poster verschlüsselt als eigene Objekte; Katalog-Eintrag „liegt“; Meldung an Album-Beteiligte (optional) |
| Abbrechen | `DELETE /api/medien/upload/<id>` | `AbortMultipartUpload`; Lebenszyklus-Regel räumt Reste nach 1–2 Tagen [O Hetzner: abgebrochene Uploads per Regel] |

Upload-Sitzungen: Bestand `medien-upload--<person>` (in `RAUSCHEN`, Frist 7 Tage). **Ein Schlüssel nach draußen (Kurzbefehl, später native App)** nur als eigener eingeschränkter Upload-Schlüssel je Person, der NUR diese Routen öffnet (Vorbild `istZulieferer`) — V2.

## D5 · Ablage und Verschlüsselung
- **Speicher-Adapter** `lib/medien/speicher.ts` mit zwei Umsetzungen: `s3` (Server) und `ordner` (Entwicklung/Demo: `MAKE_OS_MEDIEN_DIR`, **nie unter `.data`/`daten`**, Riegel wie `lib/demo/schutz.ts`). Ohne Einrichtung auf dem Server: Medien aus (HOI gelb „Medienspeicher nicht eingerichtet“), **kein** stiller Rückfall in den Datenordner.
- Objekte: `<instanz-kennung>/<medium-id>/<variante>` mit `variante` ∈ `original | ansicht | raster | poster | web`; alle Chiffrat (D5-Format), Content-Type immer `application/octet-stream`, keine Metadaten.
- Format je Objekt: Kopf (Version, Segmentgröße 64 KiB, Medium-Kennung) + Segmente; je S3-Teil 128 Segmente (8 MiB Klartext + 128 × 16 B Tag). DEK gewickelt mit dem aktiven Schlüssel (`kid`) im Katalog; ohne Datenschlüssel (lokal) Klartext wie alle Bestände.
- Einrichtung: Bucket privat in **nbg1 oder fsn1** (gleiche Netzzone wie der Server — Server-Standort prüfen), Lebenszyklus „abgebrochene Multipart-Uploads nach 2 Tagen löschen“, Versionierung aus (Löschen soll löschen; Art. 17) [A]. Zugangsdaten nur in der Server-`.env` über ein Skript `deploy/medien-speicher-verbinden.sh` (verdeckte Eingabe, Muster `whoop-verbinden.sh`): `MAKE_OS_MEDIEN_S3_ENDPUNKT`, `…_BUCKET`, `…_ZUGANG`, `…_GEHEIMNIS`.
- **Sicherung:** Object Storage liegt außerhalb der Nachtsicherung. Zweitkopie (anderer Standort `hel1` oder Storage Box) = V2 und Kevins Entscheidung (Frage 1). Der **Katalog** (JSON-Bestand) ist in der Nachtsicherung; nach einem Zurückspielen gelten die Grabsteine (CLAUDE.md) — Objekte gelöschter Medien bleiben gelöscht.

## D6 · Ansehen und Abspielen
- `GET /api/medien/inhalt?id=…&v=raster|ansicht|poster|original` mit **Range-Unterstützung (206, `Accept-Ranges`, `Content-Range`)**, sonst spielt Safari keine Videos [S]. Server rechnet den Klartext-Bereich auf Segmente um, holt per S3-Range nur die nötigen Bytes, entschlüsselt, schneidet zu. Antwort-Köpfe wie die Ablage (`nosniff`, `Cache-Control: private, no-store` für Original; Raster darf `private, max-age` [A]).
- Zugang: dieselbe Filterstelle wie der Katalog; `leseZugriff(req, 'medien', { ids })` (neuer Lese-Bereich) für Originale mit markierten Personen.
- Galerie: nur Raster-Bilder (klein), Lazy Loading; Video-Player erst auf Tippen.

## D7 · Grenzen und Kosten (Vorschlag, [A])

| Größe | Vorschlag | Grund |
|---|---|---|
| Stückgröße Upload | 8 MiB | < 10 MB Middleware [O], ≥ 5 MiB S3 [O] |
| parallele Stücke je Gerät / Server | 2 / 4 | 1 vCPU, RAM |
| Video je Datei | 2 GB (≈ 5 min 4K60, 30 min 1080p) | Upload-Dauer am Handy |
| Foto je Datei | 50 MB | ProRAW ausgenommen |
| Medien je Album | keine Grenze, Liste seitenweise | „nie still kürzen“ |
| Speicher-Warnung | HOI gelb ab 80 % eines eingestellten Monats-/Gesamtbudgets | Kosten im Blick |

## D8 · Schnittstellen (was an was andockt)
- **CRM/Events:** Event-Akte und besuchte Events bekommen eine Kachel „Fotos & Videos“ (Album des Events, „+ Aufnehmen“); `WEG.medien({ album })`. Löschen eines Events lässt Medien stehen, nur der Album-Bezug wird „(gelöscht)“.
- **Netzwerken:** im Event-Modus ein Knopf „Foto/Video“ neben „Erfassen“ (gleiches Event).
- **Marketing:** Beitrag ↔ Medien (`Beitrag.medien?: string[]`, optional; nur freigegebene wählbar). Redaktionsplan zeigt das Vorschaubild.
- **Aufgaben/Projekte:** Album „Projekt“; keine Kopie in die Aufgaben-Ablage.
- **Heads/ZOE (AGENTEN_KONZEPT):** Mitarbeiter **„Bild & Video“** beim Head of Marketing (und Event). Werkzeuge: `medien_suchen` (frei, lesend, nur Metadaten, nur „an Head“), `medien_ansehen` (frei, Vorschaubilder ans Modell, KI-Kategorie `medien`), `medien_vorschlag` (legt Stapel-Art **`medien`** ab: Auswahl, Zuschnitt-Rechtecke je Format, Alt-Text/Bildunterschrift/Posttext, Clip-Zeitmarken, SRT-Entwurf). Ausführen nur per Klick.
- **Export (V2):** „Für LinkedIn/Instagram herunterladen“ (Formate aus B7, JPEG ≤ 8 MB). Direkt veröffentlichen über APIs (Instagram braucht eine öffentliche URL [O]) = V3 und nur nach Freigabe mit kurzlebigem Link.

---

# Teil E — Datenmodell-Skizze (TypeScript, Entwurf für `lib/medien/typen.ts`)

```ts
type MedienBereich = 'privat' | 'business';
type MedienArt = 'foto' | 'video';
type Variante = 'original' | 'ansicht' | 'raster' | 'poster' | 'web';
type Kanal = 'linkedin' | 'instagram' | 'website' | 'newsletter' | 'presse' | 'print' | 'intern';

interface Medium {
  id: string;                         // 'md-<uuid>' (neueKennung)
  art: MedienArt;
  bereich: MedienBereich;
  gesellschaft?: string;              // nur Business: kdc|kdv|ug|g-<uuid>; Bereich über bereichVonGesellschaft
  besitzer: string;                   // Speichername der aufnehmenden Person — setzt NUR der Server
  sicht: 'nur-ich' | 'haushalt' | 'team';   // privat: nur-ich|haushalt · business: team (Frage 8)
  aufgenommenAm?: string;             // Berliner Wandzeit; aus Exif VOR dem Säubern, nur Zeit, nie Ort
  hochgeladenAm: string;              // Server-Zeit
  datei: {
    typ: 'image/jpeg' | 'image/png' | 'video/quicktime' | 'video/mp4';
    bytes: number; sha256: string; breite?: number; hoehe?: number; dauerSek?: number; drehung?: 0 | 90 | 180 | 270;
    ortsdatenEntfernt: boolean;       // false → nie für Marketing freigebbar
  };
  varianten: Partial<Record<Variante, { objekt: string; bytes: number; teile?: { nr: number; salz: string }[] }>>;
  schluessel: { kid: string; dek: string };   // DEK gewickelt (base64); nie an den Browser
  status: 'hochladen' | 'liegt' | 'fehler';
  alben: string[];                    // Album-Kennungen (ein Medium kann in mehreren Alben stehen, nie kopiert)
  bezug?: { eventId?: string; mandatId?: string; firmaId?: string; projektId?: string; beitragId?: string };
  titel?: string; notiz?: string; schlagworte?: string[];
  auswahl?: Record<string, { favorit?: boolean; abgelehnt?: boolean; sterne?: 1 | 2 | 3 | 4 | 5 }>; // je Person (Frage 7)
  erkennbarePersonen: 'ja' | 'nein' | 'unklar';   // Pflicht vor jeder Freigabe
  personen: PersonImBild[];
  freigabe: Freigabe;
  heads: HeadZugang[];                // leer = kein Head sieht es
  abgeleitetVon?: { id: string; art: 'zuschnitt' | 'clip' | 'web'; vorschlagId?: string };
  dhash?: string; duplikatVon?: string;
  archiviertAm?: string; geloeschtAm?: string;     // Papierkorb 30 Tage, dann Objekte weg
  geaendert: string; geaendertVon?: string;        // Stand-Fingerabdruck wie überall
}

interface Album {
  id: string;                         // 'al-<uuid>'; Event-Album auch fest 'al-ev-<eventId>' (idempotent)
  bereich: MedienBereich;
  art: 'event' | 'mandat' | 'firma' | 'projekt' | 'gesellschaft' | 'kampagne' | 'frei';
  bezugId?: string;
  titel: string;                      // bei Bezug abgeleitet, nie Personennamen im Titel
  sicht: Medium['sicht'];
  besitzer: string;
  heads?: HeadZugang[];               // Vorgabe für neue Medien im Album
  vorgabeFreigabe?: Pick<Freigabe, 'kanaele' | 'bis'>;
}

interface PersonImBild {
  id: string;
  art: 'kontakt' | 'konto' | 'team' | 'unbekannt';
  kontaktId?: string; person?: string; anzahlUnbekannt?: number;
  grundlage: 'einwilligung' | 'berechtigtes-interesse' | 'versammlung' | 'beiwerk' | 'vertrag' | 'offen';
  einwilligungRef?: string;           // Einwilligung am Kontakt (Wortlaut, Beleg — vorhandene Nachweis-Regeln)
  minderjaehrig?: boolean;            // true → nie freigebbar ohne Einwilligung der Eltern (Frage 10)
  markiertVon: string; am: string;
}

interface Freigabe {
  status: 'intern' | 'angefragt' | 'freigegeben' | 'abgelehnt' | 'gesperrt' | 'abgelaufen';
  kanaele?: Kanal[]; bis?: string;    // bis-Datum → Takt setzt 'abgelaufen' + Aufgabe
  urheber: { art: 'team' | 'extern'; person?: string; name?: string; lizenz?: string };
  angefragtVon?: string; freigegebenVon?: string; am?: string; grund?: string;
  sperrGrund?: 'art18' | 'widerruf' | 'werbesperre' | 'ablauf' | 'art17' | 'hand';
  verlauf: { am: string; von: string; nach: Freigabe['status'] }[];   // nur Server, nie kürzen (Grenze → 413)
}

interface HeadZugang {
  head: string;                       // Kennung aus dem Agenten-Katalog (nie fest 'marketing' im Code)
  auftraege: ('auswahl' | 'zuschnitt' | 'text' | 'untertitel' | 'clip')[];
  von: string; am: string; bis?: string;
}

interface UploadSitzung {           // Bestand medien-upload--<person>
  id: string; mediumId: string; person: string; s3UploadId?: string;
  teilGroesse: number; teile: { nr: number; sha256: string; etag: string; salz: string; bytes: number }[];
  angelegt: string; laeuftAb: string;
}
```

**Bestände (Speicher-Register, alle mit Angaben `mit(…)`):**

| Bestand | Inhalt | Bezug / Behandlung |
|---|---|---|
| `medien--<haushalt>` | Katalog Business + Privat „haushalt“, Alben | dritte (Personen im Bild); Art. 15/17 über `kontaktId` |
| `medien--<person>` | Katalog Privat „nur ich“ | Person; `PERSON_BESTAENDE` (Export + Löschen samt Objekten) |
| `medien-upload--<person>` | offene Upload-Sitzungen | kein Inhalt; Frist 7 Tage; `RAUSCHEN` |
| Objekte im Bucket | Chiffrat | „ausgenommen: über den Katalog“ wie `whatsapp-medien` |

---

# Teil F — Rechte serverseitig, Art. 15/17, Fristen

**EINE Filterstelle** `medienFuerBetrachter(katalog, konto)` (rein, getestet) für jede Antwort (Katalog, Inhalt, Head-Werkzeuge, 409-Konflikte):

| Betrachter | Business | Privat „haushalt“ | Privat „nur ich“ einer anderen Person | an Heads |
|---|---|---|---|---|
| Inhaber / volles Haushaltsmitglied | alles | ja | **nein** (nicht einmal die Anzahl) | — |
| Konto mit `finanzRecht: 'business'` („nur Business“) | alles | **nein** | nein | — |
| Teammitglied ohne Haushalt / Testkunde anderer Instanz | nein | nein | nein | — |
| Head/Mitarbeiter-Lauf (mit auslösender Person) | nur Medien mit `heads` ∋ dieser Head UND (je nach Frage 12) Status `freigegeben` | **nie** (Privat-Heads später nur eigene, eigene Kategorie) | nie | — |
| Dienstweg ohne Person | nur Zähler (HOI) | nein | nein | — |

**Schreiben:** hochladen nur für sich selbst; Album/Personen/Auswahl ändern = jedes Mitglied mit Sicht; **Freigabe erteilen** nur Menschen (Rolle nach Frage 9, nie Dienstweg, nie Agent); fremde Privat-Medien → 404 (nicht 403, damit es sie „nicht gibt“); `heads` setzen nur Mitglieder; Ops mit Stand → 409; Grenzen → 413.

**Automatische Sperren (Server, idempotent, im Morgenlauf und nach jeder Kartei-Änderung):**
- Person im Bild mit Art. 18 → `gesperrt` (`art18`), aus allen Head-Sichten.
- Einwilligung der Person widerrufen → `gesperrt` (`widerruf`), Aufgabe „Medium prüfen“ an die Freigebende.
- Werbesperre → gesperrt für Kanäle außer `intern`.
- `bis` erreicht → `abgelaufen` + Aufgabe.
- `ortsdatenEntfernt: false` oder `erkennbarePersonen: 'unklar'` oder Person mit Grundlage `offen` → Freigabe abgelehnt (400 mit Satz).

**Art. 15** (`personAufzaehlen.medien`): Medien, auf denen die Person markiert ist (Anzahl, Album-Titel, Tag, Freigabe-Status, Kanäle; Vorschaubild auf Anfrage); für Konten zusätzlich eigene Uploads. **Art. 17** (`personEntfernen`): Markierung raus; Medium → `gesperrt` (`art17`) und je nach Frage 13 löschen oder zur Prüfung; Objekte nur über den Katalog-Weg löschen (`bestandEntfernen`-Muster + `speicher.loeschen`). **Konto löschen:** „nur ich“-Medien samt Objekten weg; Business-Uploads bleiben, `besitzer` → „[gelöscht]“ (`eintragTilgen`).
**Grabsteine:** Medien-IDs gelöschter Medien in den Grabstein, damit ein zurückgespielter Katalog sie nicht „wiederbelebt“.
**Löschfristen** (Tabelle `LOESCHFRISTEN`): `medien-upload` 7 Tage · `medien-papierkorb` 30 Tage · `medien-roh` (nicht freigegeben, mit Personen) — Prüf-Aufgabe nach N Monaten (Frage 15), nie automatisch löschen ohne Kevins Wort.
**Verzeichnis (Art. 30):** `vv-medien` (Zweck Öffentlichkeitsarbeit/Dokumentation, Kategorien Bild/Video, Empfänger Hetzner, Fristen). **Empfänger:** `hetzner` um Object Storage ergänzen; bei Transkription `mistral` neu (Auftragsverarbeiter, EU, AVV).
**KI-Tor:** neue Kategorie `medien` (Instanz- und Personen-Schalter wie die übrigen); zusätzlicher Schalter „Bilder mit erkennbaren Personen an KI“ (Vorgabe aus); Pseudonymisierung greift bei Bildern nicht → nur mit diesem Schalter.
**Wächter:** „Sicht Business bekommt nichts aus Privat“, „Malin bekommt nichts aus Kevins ‚nur ich‘“ (Messlatte: GET `/api/medien` mit Malins Sitzung + `fuer=kevin` → Marke in die Saat), „Head sieht nur ‚an Head‘“, „`finanzRecht: 'business'` bekommt kein Privat“, Dienstweg ohne Person → nur Zähler.

---

# Teil G — Bauplan für EINEN Bau-Agenten über Nacht

**Branch `medien-1`** von `entwicklung`. Nichts nach `main`. Kein echter Bucket nötig: S3 über einen Fake (`tests/fixtures/s3-fake.ts`, Multipart, Range, Delete, Fehlerfälle wie `gmail-fake`). Abhängigkeiten nur gepinnt und mit Begründung: `@aws-sdk/client-s3` (oder schlanker Signierer `aws4fetch` — Agent entscheidet nach Größe), `mediabunny` (Lizenz vorher prüfen, sonst V2).

**V1 — in dieser Nacht (Reihenfolge = Commits):**
1. `lib/medien/typen.ts`, `regeln.ts` (rein): Typen aus Teil E; `medienFuerBetrachter`; Freigabe-Übergänge `freigabeAnwenden` (Pflichten aus Teil F); Album-Regeln (Event-Album idempotent `al-ev-<eventId>`); Grenzen; Teile-Rechnung. Tests zuerst.
2. `lib/medien/krypto.ts` (rein, Node): DEK erzeugen/wickeln über den Schlüsselring; Segment-Format (64 KiB, AES-256-GCM, Nonce = Salz je Teil-Versuch + Zähler + Letzt-Merker, AAD); Klartext-Range → Segment-Range. Tests: Rundweg, Manipulation, Vertauschen, Abschneiden, falsche Medium-Kennung, Range-Ränder, Rotation (nur DEK neu wickeln).
3. `lib/medien/speicher.ts` (+ `speicher-s3.ts`, `speicher-ordner.ts`): Schnittstelle `teilAnlegen/teilSchreiben/fertig/abbrechen/lesenBereich/loeschen`; Ordner-Adapter mit Riegel „nie unter .data/daten“; S3-Adapter gegen den Fake. Konfiguration aus Umgebung, ohne → „aus“.
4. `lib/medien/server.ts`: Katalog lesen/schreiben (EINE Schreibstelle, `updateJson` + Stand), Upload-Sitzungen (Sperre je Sitzung, idempotent), `einmalig()`.
5. Routen + Register (`lib/zugang/routen-register.ts`): `/api/medien` (GET gefiltert mit ETag, PATCH Ops), `/api/medien/upload` (POST), `/api/medien/upload/[id]` (GET, DELETE), `/api/medien/upload/[id]/[nr]` (PUT), `/api/medien/upload/[id]/fertig` (POST), `/api/medien/inhalt` (GET mit Range 206, `leseZugriff`). Tore: `personStreng`, Haushalt, Dienstweg 403 für alles Schreibende, `bauPruefen`, `jsonBegrenzt`, `begrenztLesen(8 MiB)`.
6. Browser: `lib/medien/warteschlange.ts` (Muster Netzwerken, Stücke als verschlüsselte Blobs, `persist()`), Sender im /os-Rahmen, `components/os/medien/` (`Aufnehmen` mit zwei Wegen + Album-Wahl „Heute bei“, `Fortschritt` mit Wake Lock + „App offen lassen“, `Galerie` (Raster, Filter Album/Status/Bereich), `MediumDetail` (Ansicht/Player, Album, Personen markieren über CRM-Schnellsuche, `erkennbarePersonen`, Auswahl Favorit/Ablehnen, Freigabe anfragen/erteilen, „an Head geben“ mit Auftragswahl), Foto-Vorbereitung (`jpegOhneMetadaten`, Drehung, Canvas-Vorschauen), Video-Poster.
7. Seite `/os/medien` (`WEG.medien`, `SEITEN_SUCHE`, Design-Standard `components/os/ui`), Kachel „Fotos & Videos“ in Event-Akte und besuchtem Event, Knopf im Netzwerken-Event-Modus. Leiste unverändert (≤ 12), Einstieg je Frage 5.
8. Recht: Speicher-Register (`mit(…)`), `PERSON_BESTAENDE`, `personAufzaehlen/Entfernen` (+ Test), Konto löschen, Grabstein, VVT `vv-medien`, Empfänger-Notiz Hetzner, Löschfristen (Upload 7 T., Papierkorb 30 T.), Morgenlauf-Schritt „Medien-Sperren“ (Art. 18/Widerruf/Ablauf), Lese-Bereich `medien`, Messlatte-Marke in die Saat, Demo-Saat (erfundenes Album mit Platzhalter-Bildern, über die Routen).
9. HOI: Befund „Medienspeicher nicht eingerichtet“ (gelb), „Upload-Reste“ (Zähler), nur Zahlen.
10. Doku: UPDATES.md-Abschnitt (Schritte für Kevin: Bucket anlegen, Lebenszyklus-Regel, Skript `deploy/medien-speicher-verbinden.sh`, Test am iPhone), CLAUDE.md-Abschnitt „Medien unterwegs“ (Regeln: nie in `daten/`, EINE Filterstelle, Schlüssel nie im Browser, Freigabe nur Menschen), `BAUSTAND.md`.
11. Prüfen: `npx tsc --noEmit` = 0, Lint grün, Tests der neuen Dateien + Routen-Register + Messlatte + Datenschutz-Register + Design-Wächter. Sichtprüfung nur mit Wegwerfkonto und Test-Datenordner.

**Am iPhone von Kevin zu prüfen (kann der Agent nicht):** `File.type`/Größe bei Foto aus Kamera und Mediathek; HEIC → JPEG; Hochkant-Drehung; Video MOV/HEVC; Poster; Upload 500-MB-Video über Mobilfunk mit App im Vordergrund, Abbruch (Flugmodus) und Fortsetzen; Neuladen mitten im Upload; Wake Lock in der Home-Screen-App; Abspielen im Player (Range); Ortsdaten im fertigen Video (exiftool am Mac).

**V2 (nächste Pakete):**
- KI: Mitarbeiter „Bild & Video“, Werkzeuge `medien_suchen/ansehen/vorschlag`, Stapel-Art `medien`, Ausführen per Klick (Zuschnitt im Browser, neues Medium „abgeleitet von“), Alt-Text/Posttext; KI-Kategorie `medien` + Personen-Schalter.
- Video: Ortsdaten-Strip im Browser (falls nicht V1), Web-Fassung 1080p H.264 (WebCodecs, iOS 26), Einzelbilder für den Head, Transkript (Voxtral oder auf dem Gerät), SRT, Clip-Vorschläge + Schneiden im Browser.
- Ordnung: Duplikate (dHash, Serienbilder gruppieren), Sterne, Smart-Alben (gespeicherte Filter), Kommentare (`BeitragsVerlauf`).
- Betrieb: Zweitkopie (`hel1` oder Storage Box), Speicher-Budget im HOI, Export in Social-Formaten, iOS-Kurzbefehl mit eingeschränktem Upload-Schlüssel, Android Share Target.

**V3 (später):** native Hülle für Hintergrund-Upload (Capacitor o. ä.), Veröffentlichen per LinkedIn/Instagram-API (kurzlebiger öffentlicher Link), Kunden-Alben mit Ablauf-Link, Wasserzeichen, generative Bearbeitung mit Art.-50-Kennzeichnung.

---

# Teil H — Entscheidungsfragen an Kevin

> Je Frage 6–12 Antworten; **(E)** = meine Empfehlung. Vorbilder in Klammern.

**1. Wo liegen die Originale (vor allem Videos)?**
1. **(E) Hetzner Object Storage, Nürnberg/Falkenstein, privat, nur Chiffrat** (S3-Standard wie AWS/Backblaze; ~6,49 € netto/Monat inkl. 1 TB)
2. Hetzner Storage Box BX11 (1 TB, ~3,20 € — Preis 2026 nicht bestätigt; WebDAV/SFTP wie ein Netzlaufwerk)
3. Hetzner Volume am Server (eine zusätzliche Platte; am teuersten je GB)
4. Object Storage + nächtliche Zweitkopie nach Helsinki (wie „Cross-Region-Replication“)
5. Object Storage + Zweitkopie auf Storage Box (Snapshots inklusive)
6. Server-Platte, nur Fotos (Videos erst später)
7. Google Drive/Workspace der Firma (Google Fotos-Prinzip; Drittland)
8. iCloud Drive (privat) / Google (Business) getrennt
9. DAM-Dienst (Canto, Bynder, Brandfolder) statt eigenem Speicher
10. Dropbox Business mit Replay

**2. Wie wird verschlüsselt?**
1. **(E) Auf dem eigenen Server je Segment, Schlüssel je Medium, nur der Server kennt den Hauptschlüssel** (Muster age/Tink-Streaming)
2. Hetzner SSE-C (Server schickt den Schlüssel bei jedem Zugriff mit)
3. Im Browser vor dem Upload (Ende-zu-Ende; Schlüssel je Medium im Browser, wie Tresorit/Proton Drive)
4. Nur Hetzners Schutz (ohne eigene Verschlüsselung; „at rest“ nicht belegt)
5. Privat eigene Verschlüsselung, Business ohne (schneller teilbar)
6. Eigene Verschlüsselung + Vorschaubilder unverschlüsselt (schnellere Galerie)

**3. Upload-Weg**
1. **(E) Eigener tus-artiger Stückel-Upload über unseren Server (8 MiB)**
2. tus-Protokoll mit tusd (Go-Dienst als eigener Container; Vimeo/Cloudflare Stream nutzen tus)
3. tus mit Node-Server (`@tus/server` + S3-Store)
4. Direkt in den Bucket mit vorab signierten Teil-URLs (Uppy + S3 Multipart, wie Frame.io/Dropbox)
5. Einfach am Stück (nur Fotos), Videos über AirDrop/Mac
6. Erst nur kleine Fassung hochladen, Original später am WLAN/Mac (Frame.io Camera-to-Cloud-Proxys)

**4. Videoqualität und Größe**
1. **(E) Original hochladen, Empfehlung in der App „1080p/30, HEVC“; Grenze 2 GB je Video; Videos starten nur auf Knopfdruck**
2. Immer Original, keine Grenze
3. Original + automatisch eine 1080p-Web-Fassung im Browser (ab iOS 26)
4. Nur die Web-Fassung (verkleinert auf dem Gerät), Original bleibt im iPhone
5. Grenze 3 Minuten je Video
6. Grenze 500 MB je Video
7. 4K nur, wenn ausdrücklich „Original“ gewählt
8. Erst kleine Vorschau hoch (Proxy), Original nachziehen (Frame.io)
9. V1 nur Fotos, Videos in V2

**5. Kamera und Einstieg in der App**
1. **(E) System-Kamera über das Datei-Feld + „Aus Mediathek“; Einstieg: Knopf im Netzwerken-Event-Modus, Kachel in der Event-Akte, Seite „Fotos & Videos“**
2. Eigene Kamera in der App (Live-Bild, ein Knopf) — Erlaubnis-Abfragen in der Home-Screen-App möglich
3. Kamera-Knopf fest in der Handy-Leiste (statt „Netzwerken“)
4. Schwebender Kamera-Knopf auf jeder Seite (wie Instagram „+“)
5. Nur über „Heute bei …“ (Event-Modus)
6. iOS-Kurzbefehl im Teilen-Menü („An MAKE OS“, eingeschränkter Schlüssel)
7. Native App (Capacitor) mit Hintergrund-Upload
8. Android: Teilen-Ziel der PWA

**6. Wann wird geordnet?**
1. **(E) Vorher: Album ist vorbelegt („Heute bei …“, sonst zuletzt), nachher änderbar**
2. Alles in „Unsortiert“, später sortieren (Inbox-Prinzip)
3. Automatisch nach Kalender-Termin zur Aufnahmezeit (Termin mit Event/Mandat → Album)
4. ZOE schlägt das Album vor (Vorschlag, Klick)
5. Nach Datum automatisch (Google Fotos)
6. Ort-basiert (braucht GPS — widerspricht „Ort entfernen“)

**7. Welche Ordnung und Auswahl in V1?** (mehrere möglich)
1. **(E) Alben Event · Kunde/Mandat · Projekt · frei**
2. Album Gesellschaft (kdv, MAKE …)
3. Album Kampagne/Beitrag
4. **(E) Auswahl Favorit + Ablehnen je Person** (Lightroom P/X)
5. Sterne 1–5
6. Gemeinsame Auswahl fürs Team statt je Person (Pixieset-Favoritenliste)
7. Schlagworte frei
8. Schlagworte automatisch durch KI (V2)
9. Duplikate erkennen (V2)
10. Farb-Etiketten für Bearbeitungsstand

**8. Privat — wer sieht private Medien?**
1. Nur die Person, die aufgenommen hat
2. Der ganze Haushalt (Familienalbum)
3. **(E) Wählbar je Album: „nur ich“ oder „Haushalt“ (Vorgabe „nur ich“)** (Google Fotos geteilte Alben)
4. Privat in V1 gar nicht, nur Business
5. Privat nie auf den Server, nur Business
6. Privat auf den Server, aber nie in Heads/ZOE

**9. Wer gibt für Marketing frei?**
1. Jede Person im Team
2. Nur der Inhaber
3. **(E) Freigabe durch die Marketing-Verantwortliche bzw. ein volles Mitglied, aber nie die Person allein, die angefragt hat, wenn Personen erkennbar sind (Vier-Augen)** (Canto Approval Hub)
4. Immer Vier-Augen
5. Die abgebildeten Team-Personen müssen zusätzlich zustimmen
6. Head of Marketing schlägt vor, Mensch klickt (immer)
7. Freigabe gilt automatisch für Fotos ohne erkennbare Personen

**10. Personen im Bild und Rechtsgrundlage**
1. **(E) Pflichtfrage „erkennbare Personen? ja/nein/unklar“ + Kontakte von Hand markieren + Grundlage je Person; Einzelporträts/nicht öffentliche Events nur mit Einwilligung; Minderjährige nie ohne Eltern-Einwilligung**
2. Nur „Gruppe/Beiwerk“ freigeben, Porträts nie
3. Einwilligung per QR-Formular am Event (Selbstauskunft der Gäste, wie Event-Fotografen)
4. Hinweisschild am Event + berechtigtes Interesse für alle Event-Fotos
5. Gesichtserkennung zum Markieren (Art. 9 — **nicht empfohlen**)
6. Keine Personen-Markierung, nur Freitext
7. Mitarbeiter-Einwilligung einmalig im Konto (widerruflich)

**11. Nutzungsrechte und Ablauf**
1. Unbefristet
2. Standard 24 Monate ab Freigabe
3. **(E) Je Freigabe Kanäle + bis-Datum (Vorgabe aus dem Album), Ablauf → automatisch gesperrt + Aufgabe** (Brandfolder/Canto)
4. Ablauf nur als Erinnerung, keine Sperre
5. Wasserzeichen für Weitergabe nach außen (Bynder)
6. Fremde Fotografen: Lizenz als Datei-Nachweis Pflicht
7. Getrennt „intern nutzbar“ und „extern nutzbar“

**12. Was bekommen die Heads zu sehen?**
1. **(E) Nur Medien, die ausdrücklich „an Head gegeben“ sind (je Album oder Medium, mit Auftrag) — Rohmaterial ja, aber nur Business**
2. Nur freigegebene Medien
3. Alle Business-Medien automatisch
4. Nur auf Auftrag im Head-Chat („nimm Album X“)
5. Event-Alben automatisch an den Head of Event
6. Bilder mit erkennbaren Personen nie an KI
7. Nur Vorschaubilder ≤ 1568 px, nie Originale
8. Auch Privat (eigener Privat-Head, nur eigene Medien)

**13. Was dürfen die Heads (immer nur als Vorschlag)?** (mehrere)
1. **(E) Beste Bilder auswählen + begründen**
2. **(E) Zuschnitte für LinkedIn/Instagram vorschlagen (Rechtecke)**
3. **(E) Alt-Text, Bildunterschrift, Post-Entwurf**
4. Untertitel/Transkript (SRT)
5. Clip-Vorschläge aus Videos (Zeitmarken)
6. Helligkeit/Kontrast/Gerade richten (deterministisch)
7. Generative Verbesserung (Hintergrund, Retusche — Art.-50-Kennzeichnung)
8. Direkt in den Redaktionsplan einplanen (Stapel)
9. Duplikate/Unscharfes aussortieren

**14. Transkription von Videos**
1. Keine in V1
2. **(E) V2: Mistral Voxtral (EU-Anbieter, ~0,003 $/Min.) mit AVV, nur auf Klick**
3. Auf dem Gerät (Whisper im Browser, iOS 26, ~200 MB Modell)
4. LinkedIn transkribiert selbst — nichts eigenes
5. OpenAI-Transkription (Drittland)
6. Deepgram/AssemblyAI mit EU-Region
7. Eigener Whisper-Dienst (größerer Server nötig)

**15. Aufbewahrung, Löschen, Sicherung**
1. Alles unbefristet
2. **(E) Rohmaterial mit Personen, nicht freigegeben: Prüf-Aufgabe nach 12 Monaten (nie automatisch löschen); Papierkorb 30 Tage; Art. 17 → Medium sperren + zur Prüfung**
3. Rohmaterial nach Event + 6 Monaten prüfen
4. Abgelehnte Bilder nach 30 Tagen löschen
5. Art. 17 → Medium sofort löschen
6. Zweitkopie der Medien (anderer Standort) ab sofort
7. Zweitkopie erst ab 100 GB
8. Keine Zweitkopie (Originale bleiben ja im iPhone)

---

# Teil I — Quellen (alle abgerufen am 08.10.2026)

**Kamera, iOS, PWA**
- WebKit „MediaRecorder API“ (2020): https://webkit.org/blog/11353/mediarecorder-api/
- addpipe MediaRecorder-Demo (iOS 18.4 Formate) [S]: https://addpipe.com/media-recorder-api-demo/
- Apple-Forum 658708 (Video-Umwandlung seit 13.6.1) [S]: https://developer.apple.com/forums/thread/658708
- WebKit-Bugs HEIC-Umwandlung [S]: https://bugs.webkit.org/show_bug.cgi?id=292350 · https://bugs.webkit.org/show_bug.cgi?id=303803 · https://developer.apple.com/forums/thread/743049
- Apple-Forum 826732 (mehrere `capture`-Aufnahmen) [S]: https://developer.apple.com/forums/thread/826732
- W3C-Liste 2014 (Aufnahme nicht in Fotos) [S]: https://lists.w3.org/Archives/Public/public-device-apis/2014Oct/0023.html
- WebKit-Bugs Kamera-Erlaubnis Home-Screen [S]: https://bugs.webkit.org/show_bug.cgi?id=215884 · https://bugs.webkit.org/show_bug.cgi?id=254129 · https://developer.apple.com/forums/thread/788518
- WebKit „Updates to Storage Policy“: https://webkit.org/?p=14403
- firt.dev iOS-PWA-Kompatibilität [S]: https://firt.dev/notes/pwa-ios/
- caniuse: https://caniuse.com/background-sync · https://caniuse.com/web-share · https://caniuse.com/mdn-manifests_webapp_share_target · https://caniuse.com/wake-lock · https://caniuse.com/netinfo · https://caniuse.com/mdn-api_filesystemfilehandle_createwritable · https://caniuse.com/webcodecs · https://caniuse.com/hevc
- WebKit-Bug Share Target [S]: https://bugs.webkit.org/show_bug.cgi?id=194593
- Upload im Hintergrund [S]: https://asuscloudsupport.asuswebstorage.com/hc/en-us/articles/51321187143577-Why-Files-May-Not-Uploading-in-the-Mobile-App · https://developer.apple.com/forums/thread/818379 · https://bugs.webkit.org/show_bug.cgi?id=254545
- Apple Kurzbefehle („Inhalte von URL abrufen“, Eingabetypen): https://support.apple.com/guide/shortcuts/apd58d46713f/ios · https://support.apple.com/guide/shortcuts/apd7644168e1/ios · Forum [S]: https://developer.apple.com/forums/thread/717264
- iPhone-Videogrößen [S]: https://www.techradar.com/how-to/how-to-shoot-4k-video-on-your-iphone · https://www.mobigyaan.com/change-default-video-recording-format-apple-iphone · https://photofocus.com/mobile/mobile-mondays-sharpen-your-iphone-videos-with-this-setting
- WebGPU iOS 26 [S]: https://appdevelopermagazine.com/webgpu-in-ios-26/

**Upload**
- tus 1.0: https://tus.io/protocols/resumable-upload · tusd [S]: https://pkg.go.dev/github.com/tus/tusd/v2
- Uppy „Choosing an uploader“: https://uppy.io/docs/guides/choosing-uploader/ · S3 Multipart: https://uppy.io/docs/aws-s3-multipart · Transloadit-Forum [S]: https://community.transloadit.com/t/presigning-urls-in-batches-for-aws-s3-multipart-upload/15774
- IETF-Entwurf Resumable Uploads -12 [S]: https://www.ietf.org/archive/id/draft-ietf-httpbis-resumable-upload-12.html · http.dev 104 [S]: https://http.dev/104
- AWS Multipart-Grenzen: https://docs.aws.amazon.com/AmazonS3/latest/userguide/qfacts.html
- AWS SSE-C + vorab signierte URLs: https://docs.aws.amazon.com/AmazonS3/latest/userguide/specifying-s3-c-encryption.html · https://aws.amazon.com/blogs/developer/generating-amazon-s3-pre-signed-urls-with-sse-c-part-5-finale/ · SSE-C-Vorgabe 2026: https://docs.aws.amazon.com/AmazonS3/latest/userguide/default-s3-c-encryption-setting-faq.html
- Next.js 15 `middlewareClientMaxBodySize`: https://nextjs.org/docs/15/app/api-reference/config/next-config-js/middlewareClientMaxBodySize

**Speicher und Preise**
- Hetzner Object Storage Überblick/Grenzen: https://docs.hetzner.com/storage/object-storage/overview · Produktseite: https://www.hetzner.com/storage/object-storage/ · unterstützte Aktionen: https://docs.hetzner.com/storage/object-storage/supported-actions/ · SSE-C: https://docs.hetzner.com/storage/object-storage/howto-protect-objects/encrypt-with-sse-c · Lebenszyklus: https://docs.hetzner.com/storage/object-storage/howto-protect-objects/manage-lifecycle · CORS: https://docs.hetzner.com/storage/object-storage/howto-protect-objects/cors/
- Hetzner Pressemitteilung Object Storage (Preise 12/2024): https://www.hetzner.com/de/pressroom/object-storage/ · heise [S]: https://heise.de/-10189226
- Preisrunde 2026 [S]: https://agentdeals.dev/hetzner-pricing-2026 · https://www.ifun.de/30-prozent-aufschlag-hetzner-erhoeht-server-preise-ab-april-275083/ · https://www.it-daily.net/shortnews/hetzner-erhoeht-serverpreise-deutlich · https://sliplane.io/blog/cheap-object-storage-providers-europe · Hetzner Preisanpassung: https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/
- Hetzner Storage Box: https://www.hetzner.com/storage/storage-box/ · https://docs.hetzner.com/storage/storage-box/access/access-webdav · Preis 2025 [S]: https://www.whtop.com/compare/hetzner,webtropia
- Hetzner Volumes: https://docs.hetzner.com/cloud/volumes/overview · Netzzonen: https://docs.hetzner.com/cloud/general/locations/ · Verkehr: https://docs.hetzner.com/robot/general/traffic/ · [S] https://egresscost.com/hetzner
- age-Format (STREAM, 64 KiB): https://github.com/C2SP/C2SP/blob/main/age.md

**Verarbeitung**
- Mediabunny: https://mediabunny.dev/guide/introduction · https://mediabunny.dev/guide/supported-formats-and-codecs · https://mediabunny.dev/guide/converting-media-files
- Ortsdaten in Videos: https://developer.apple.com/documentation/quicktime-file-format/location_metadata · [S] https://blog.addpipe.com/geolocation-metadata-ios-android-video-files/ · https://fftrac-bg.ffmpeg.org/ticket/4209
- sharp Resize/Strategien: https://sharp.pixelplumbing.com/api-resize · smartcrop.js [S]: https://github.com/jwagner/smartcrop.js
- Wahrnehmungs-Fingerabdrücke [S]: https://benhoyt.com/writings/duplicate-image-detection/ · https://github.com/ziahamza/blockhash-js
- Safari und Range-Anfragen [S]: https://feedback.umso.com/board/p/uploaded-video-files-not-served-with-http-range-support · https://discuss.huggingface.co/t/safari-cannot-play-xet-hosted-embedded-mp4s-cdn-returns-403-auth-failed-invalid-range-for-valid-byte-range/178503 · https://bugs.webkit.org/show_bug.cgi?id=202019

**Ordnung, DAM, Recht**
- Brandfolder Asset Availability: https://help.smartsheet.com/articles/2482849-Asset-Availability- · API: https://developers.smartsheet.com/api/brandfolder/openapi/assets
- Canto 6.8.0 [S]: https://releases.canto.com/hc/en-us/articles/37437732870417-Canto-DAM-6-8-0-July-30th-2025
- Bynder Advanced Rights [S]: https://support.bynder.com/hc/en-us/articles/21576746100114
- Frame.io [S]: https://blog.frame.io/2017/05/31/ios-version-1-4/ · https://www.provideocoalition.com/frame-io-brings-filmic-pro-to-the-cloud-testing-the-workflow/ · https://blog.frame.io/2026/07/29/new-in-frameio-full-screen-search-comparison-viewer/
- Dropbox Replay [S]: https://learn.dropbox.com/self-guided-learning/dropbox-replay-guide
- Google Fotos geteilte Alben: https://support.google.com/photos/answer/9789702
- Event-Galerien [S]: https://www.vsco.co/learn/live-event-photo-galleries · https://jaygrubbphotography.mypixieset.com/blog/how-to-create-a-favorites-list-in-your-online-photo-gallery-in-pixieset/ · https://www.pixpa.com/updates/manage-favorites-client-galleries
- Lightroom-Auswahl [S]: https://www.slrlounge.com/workshop/3-ways-to-rate-and-cull-images/
- § 23 KUG: https://www.gesetze-im-internet.de/kunsturhg/__23.html · ErwG 51 DSGVO: https://dsgvo-gesetz.de/erwaegungsgruende/nr-51/
- Veranstaltungs-/Mitarbeiterfotos [S]: https://www.heuking.de/de/news-events/newsletter-fachbeitraege/artikel/veranstaltungsfotografie-in-zeiten-der-datenschutz-grundverordnung.html · https://www.dr-datenschutz.de/fotos-auf-veranstaltungen-events/ · https://www.otto-schmidt.de/blog/it-recht-blog/beispiel-veranstaltungsfotos-warum-es-nach-der-dsgvo-oft-sinnvoll-ist-auf-einwilligungen-zu-verzichten-ITBLOG0003869.html · https://www.LDA.brandenburg.de/sixcms/media.php/9/RechtlicheAnforderungenFotografie.pdf · https://www.e-recht24.de/datenschutz/11303-dsgvo-und-fotografie-was-aendert-sich.html
- Gesichtserkennung/Art. 9 [S]: https://artistick.kamero.ai/resources/event-photo-privacy-gdpr-compliance · https://www.aoshearman.com/en/insights/ao-shearman-on-data/netherlands-the-dutch-data-protection-authority-publishes-guidance-on-facial-recognition-may-2-2024
- KI-VO Art. 50 [S]: https://www.srd-rechtsanwaelte.de/en/blog/deepfake-labelling-under-the-ai-act-what-the-new-eu-guidance-clarifies · https://www.mccannfitzgerald.com/knowledge/technology-and-innovation/one-month-to-go-eu-ai-act-transparency-compliance · https://perspectives.stephensonharwood.com/post/102nfqh/eu-ai-act-update-european-commission-adopts-guidelines-on-article-50-transparenc

**KI-Bearbeitung**
- Claude Vision (Grenzen, Kosten, Einschränkungen): https://platform.claude.com/docs/en/build-with-claude/vision
- Formate Instagram/LinkedIn [S]: https://www.linearity.io/templates/instagram-size-guide · https://socialk.it/it/sizes/instagram-post-size · https://linearity.io/blog/linkedin-size-guide/ · https://postiz.com/blog/linkedin-post-dimensions
- Instagram Content Publishing: https://developers.facebook.com/docs/instagram-platform/content-publishing
- LinkedIn Videos-API (Untertitel): https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/videos-api · [S] https://www.3playmedia.com/learn/how-to-guides/add-captions-subtitles-linkedin-videos
- Mistral Voxtral Transcribe 2: https://mistral.ai/fr/news/voxtral-transcribe-2 · [S] https://the-decoder.com/voxtral-transcribe-2-offers-speech-recognition-at-0-003-per-minute/ · https://anarlog.so/blog/mistral-data-retention-policy
- Whisper WebGPU [S]: https://www.huggingface.co/blog/transformersjs-v3 · https://sagicc-webgpu-whisper-sr.static.hf.space
- Clips [S]: https://www.mux.com/docs/guides/create-instant-clips · https://cloudinary.com/documentation/video_trimming · https://help.opus.pro/api-reference/v2/introduction
