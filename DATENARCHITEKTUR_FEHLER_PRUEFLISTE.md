# Datenarchitektur: die 100 typischen Fehler — Prüfliste (28.09.2026)

**Stand:** 28.09.2026
**Zweck:** Eine Prüfliste für die Datenschicht von MAKE OS. Bauart: JSON-Bestände je Sammlung über `lib/store/local-db.ts`, ein Server mit 1 vCPU und 2 GB (Docker, Caddy), zwei Personen, AES-256-GCM je Datei, Bestände je Haushalt/Person, Stand je Zeile mit 409, „nie abschneiden → 413“, Änderungsprotokoll, Tagesarchiv, verschlüsselte Dateiablage, Import-Läufe, Sperrliste, DSGVO-Pfade, ZOE mit Lesezugriff, Brain/Vault (Markdown, Git). Die Punkte gelten auch allgemein für die beste Praxis bei der Datenhaltung.
**Format je Punkt:** `#Nr · Kategorie · Fehler · Folge · Prüfen/Gegenmaßnahme · Quelle`. „(ergänzt)“ heißt: eigene Übertragung auf diese Bauart, belegt ist nur der Kern. „Doku:“ verweist auf `DATENARCHITEKTUR.md` bzw. `CLAUDE.md`, nicht auf gelesenen Code.
**Hinweis:** Zusammengestellt per Web-Recherche und noch nicht gegen den Code geprüft. Rechtliche Punkte geben den Recherche-Stand wieder und sind keine Rechtsberatung.

---

## 1 · Atomarität & Dauerhaftigkeit (8)

**#1** · Atomarität
- **Fehler:** Es wird direkt in die Zieldatei geschrieben (`writeFile(ziel, …)`).
- **Folge:** Ein Absturz, SIGKILL oder OOM mitten im Schreiben hinterlässt abgeschnittenes JSON.
- **Prüfen:** Jede Schreibung läuft über tmp im selben Ordner → `fsync(tmp)` → `rename` → `fsync(Ordner)`.
- **Quelle:** https://www.sqlite.org/atomiccommit.html · https://danluu.com/file-consistency/

**#2** · Atomarität
- **Fehler:** `rename` ohne vorheriges `fsync` der neuen Datei.
- **Folge:** Nach einem Stromausfall zeigt der Name auf eine leere oder Null-Byte-Datei (verzögerte Blockzuteilung, z. B. ext4).
- **Prüfen:** `fh.sync()` vor dem `rename`, und zwar in jedem Schreibpfad, auch in Archiv, Dateiablage und Skripten.
- **Quelle:** https://www.usenix.org/conference/osdi14/technical-sessions/presentation/pillai · https://www.postgresql.org/message-id/E1adrE0-0001Os-CD%40gemulon.postgresql.org

**#3** · Atomarität
- **Fehler:** Kein `fsync` des Verzeichnisses nach dem `rename`.
- **Folge:** Der Rename ist nicht dauerhaft. Nach einem Crash liegt die alte Fassung da, obwohl der Browser „gespeichert“ gemeldet bekam.
- **Prüfen:** Das Verzeichnis öffnen und `fsync` ausführen (Linux). Ein Test mit simuliertem Abbruch gehört dazu.
- **Quelle:** https://danluu.com/file-consistency/ · https://www.postgresql.org/message-id/E1adrE0-0001Os-CD%40gemulon.postgresql.org

**#4** · Atomarität
- **Fehler:** Die tmp-Datei liegt in `/tmp` oder auf einem anderen Mount (Container-Dateisystem statt Volume).
- **Folge:** `rename` wirft EXDEV, oder ein Rückfall auf Kopieren plus Löschen ist nicht atomar.
- **Prüfen:** tmp-Name `ziel.tmp-<pid>-<zufall>` im Zielordner, kein Kopier-Rückfall.
- **Quelle:** https://man7.org/linux/man-pages/man2/rename.2.html

**#5** · Atomarität
- **Fehler:** Ein `fsync`- oder `write`-Fehler wird ignoriert oder einfach wiederholt.
- **Folge:** Der Kernel verwirft die fehlgeschlagenen Seiten, der zweite `fsync` meldet Erfolg, die Daten fehlen still („fsyncgate“).
- **Prüfen:** Jeder E/A-Fehler beim Schreiben heißt: Schreibung gescheitert, Fehler nach oben, Bestand neu lesen. Kein „retry und weiter“.
- **Quelle:** https://wiki.postgresql.org/wiki/Fsync_Errors · https://lwn.net/Articles/752063/

**#6** · Atomarität
- **Fehler:** Fester tmp-Name (`ziel.tmp`).
- **Folge:** Zwei Schreiber (zweiter Prozess, Deploy-Überlappung) schreiben in dieselbe tmp-Datei, ein vermischter Inhalt wird umbenannt.
- **Prüfen:** Eindeutiger tmp-Name plus prozessübergreifende Sperre (siehe #9). (ergänzt)
- **Quelle:** https://github.com/npm/write-file-atomic

**#7** · Atomarität
- **Fehler:** Ein Lese-, Parse- oder Entschlüsselungsfehler wird als „leer/null“ behandelt, danach wird geschrieben.
- **Folge:** Der Bestand wird mit einem leeren Stand überschrieben. Totalverlust.
- **Prüfen:** Fehler werfen, Quarantäne-Kopie anlegen, Schreibsperre setzen. Test „kaputte Datei → kein Schreiben“. Doku: seit 27.09. `BestandNichtLesbar`/`BestandBeschaedigt`, Test muss dauerhaft bleiben.
- **Quelle:** https://www.sqlite.org/howtocorrupt.html · DATENARCHITEKTUR.md §3.1

**#8** · Atomarität
- **Fehler:** Übrig gebliebene `*.tmp-*`- und `.corrupt-*`-Dateien werden weder gemeldet noch aufgeräumt.
- **Folge:** Beschädigte Bestände bleiben unbemerkt, die Platte läuft langsam voll.
- **Prüfen:** Ein Startlauf zählt beides und meldet es an die Glocke oder den HOI. Löschen nur nach Sichtung. (ergänzt)
- **Quelle:** https://www.sqlite.org/howtocorrupt.html

## 2 · Nebenläufigkeit & Sperren (8)

**#9** · Sperren
- **Fehler:** Die Sperre gilt nur im Prozess (Warteschlange je Bestand), obwohl mehrere Prozesse schreiben: Next-Server, Arbeiter (`.data/worker.pid`) und Skripte wie `daten-verschluesselung.mjs` oder Importe.
- **Folge:** Lost Update zwischen Prozessen trotz „Sperre“.
- **Prüfen:** Alle Prozesse auflisten, die `.data` schreiben. Dann entweder genau ein Schreibprozess (die anderen reichen Aufträge ein) oder eine prozessübergreifende Sperre (flock/Lockfile mit Stale-Erkennung).
- **Quelle:** https://github.com/moxystudio/node-proper-lockfile · https://sqlite.org/whentouse.html

**#10** · Sperren
- **Fehler:** Beim Deploy laufen der alte und der neue Container kurz parallel auf demselben Volume.
- **Folge:** Zwei Prozesse schreiben mit je eigener Sperre gleichzeitig, der alte Code womöglich mit altem Schema (#23).
- **Prüfen:** Das Deploy-Skript stoppt den alten Container, bevor der neue schreibt, oder beide nutzen ein gemeinsames Lockfile auf dem Volume. (ergänzt)
- **Quelle:** https://docs.docker.com/reference/cli/docker/container/stop/

**#11** · Sperren
- **Fehler:** Das Sperrregister hängt an einer Modulinstanz statt an `globalThis`.
- **Folge:** Next.js lädt Module mehrfach (HMR, getrennte Bundles). So entstehen zwei unabhängige Warteschlangen für denselben Bestand.
- **Prüfen:** Register auf `globalThis`, Test mit gleichzeitigen Schreibungen aus zwei verschiedenen Routen.
- **Quelle:** https://www.prisma.io/docs/orm/more/troubleshooting/nextjs

**#12** · Sperren
- **Fehler:** Die verschachtelten Sperren haben keine feste Reihenfolge (hier crm→kontakte, dort kontakte→crm), oder dieselbe Sperre wird erneut betreten.
- **Folge:** Deadlock. Die async-Warteschlangen hängen still und für immer.
- **Prüfen:** Feste globale Rangfolge der Bestände mit Prüfung beim Erwerb. Wiedereintritt per AsyncLocalStorage erkennen und werfen. Zeitlimit mit Fehlermeldung.
- **Quelle:** https://martin.kleppmann.com/2026/03/24/designing-data-intensive-applications-2e.html (Transaktionen) · (ergänzt)

**#13** · Sperren
- **Fehler:** Langsame oder externe Aufrufe (KI, HTTP, Mail, Kalender, Hashen großer Dateien) laufen innerhalb der Schreibsperre.
- **Folge:** Alle Schreiber des Bestands blockieren, es gibt Timeouts, bei einem Abbruch bleiben halbe Zustände.
- **Prüfen:** Sperrdauer messen (p99 < 100 ms). Muster: lesen → außerhalb rechnen → in der Sperre mit Stand-Prüfung anwenden.
- **Quelle:** https://sqlite.org/whentouse.html („no lock lasts for more than a few dozen milliseconds“)

**#14** · Sperren
- **Fehler:** Ganze Objekte oder Listen werden ohne Stand aus dem Browser zurückgeschrieben.
- **Folge:** Die Änderung der anderen Person wird still überschrieben.
- **Prüfen:** Stand je Zeile → 409, Feld-Patches statt ganzer Objekte. Doku: Stufe 2 ist gebaut, offen sind `teile.tsx`, `Kartei.tsx:268` und `events/Abend.tsx` (ganze Kontakte, mit Stand).
- **Quelle:** https://www.figma.com/blog/how-figmas-multiplayer-technology-works/ (Last-Writer-Wins je Eigenschaft, nicht je Objekt)

**#15** · Sperren
- **Fehler:** Die 409-Antwort hat keinen Auflösungsweg in der Oberfläche.
- **Folge:** Die Person wiederholt blind mit neuem Stand und überschreibt doch, oder ihre Eingabe geht verloren.
- **Prüfen:** Beide Fassungen anzeigen, die Eingabe bleibt erhalten, übernommen wird feldweise.
- **Quelle:** https://www.inkandswitch.com/local-first/

**#16** · Sperren
- **Fehler:** Kein geordnetes Herunterfahren.
- **Folge:** `docker stop` sendet SIGTERM und nach 10 s SIGKILL. Warteschlangen und Arbeiter-Läufe brechen mittendrin ab.
- **Prüfen:** Ein SIGTERM-Handler nimmt keine neuen Schreibungen mehr an, leert die Warteschlangen und beendet dann. `stop_grace_period` passend setzen.
- **Quelle:** https://docs.docker.com/reference/cli/docker/container/stop/

## 3 · Transaktionen über mehrere Bestände & Nebenwirkungen (5)

**#17** · Mehrbestand
- **Fehler:** Zwei Bestände werden nacheinander geschrieben (äußere und innere Sperre), der zweite schlägt fehl.
- **Folge:** Halber Zustand: Mandat ohne Kontaktbezug, Löschung nur zur Hälfte, Merge halb umgebogen.
- **Prüfen:** Absichtsprotokoll (Journal) vor der ersten Schreibung. Beim Start offene Absichten fertigstellen oder zurückdrehen. Alternativ die Daten so schneiden, dass eine Operation nur einen Bestand berührt.
- **Quelle:** https://www.sqlite.org/atomiccommit.html (Super-Journal über mehrere Dateien) · https://microservices.io/patterns/data/saga.html

**#18** · Mehrbestand
- **Fehler:** Eine Nebenwirkung nach außen (Mail, Telegram, Kalender) ist nicht an den Zustand gekoppelt.
- **Folge:** Die Mail ist raus, das Speichern scheitert, ein erneuter Versuch sendet doppelt. Oder der Zustand sagt „gesendet“, die Mail kam nie an.
- **Prüfen:** Outbox: Der Auftrag wird in derselben Sperre wie der Zustand geschrieben, ein eigener Zusteller arbeitet mit Idempotenz-Schlüssel.
- **Quelle:** https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html

**#19** · Mehrbestand
- **Fehler:** Wiederholbare Anfragen (Doppelklick, Netz-Retry, Neustart des Arbeiters) haben keinen Idempotenz-Schlüssel.
- **Folge:** Mandate, Buchungen, Importe oder Meldungen entstehen doppelt.
- **Prüfen:** Der Client erzeugt einen Schlüssel. Der Server speichert das Ergebnis je Schlüssel (mit Frist) und liefert es bei einer Wiederholung erneut aus.
- **Quelle:** https://stripe.com/blog/idempotency · https://brandur.org/idempotency-keys

**#20** · Mehrbestand
- **Fehler:** Arbeiter-Aufträge laufen „mindestens einmal“, ohne Deduplikation.
- **Folge:** Ein Absturz zwischen Wirkung und Abhaken lässt den Auftrag erneut laufen.
- **Prüfen:** Jeder Auftrag trägt eine Kennung, die Wirkung prüft „schon erledigt?“, und das Abhaken geschieht in derselben Sperre wie die Wirkung. (ergänzt)
- **Quelle:** https://stripe.com/blog/idempotency

**#21** · Mehrbestand
- **Fehler:** Ein Teilerfolg wird als Erfolg gemeldet (200, obwohl ein Bestand fehlschlug).
- **Folge:** Man glaubt an eine vollständige Löschung (Art. 17) oder Übernahme.
- **Prüfen:** Die Antwort nennt Erfolg oder Fehler je Bestand. Ein Löschlauf gilt erst als „fertig“, wenn alle Bestände bestätigt sind. (ergänzt)
- **Quelle:** https://microservices.io/patterns/data/saga.html

## 4 · Schema & Migration (7)

**#22** · Schema
- **Fehler:** Kein `schemaVersion` je Bestand.
- **Folge:** Der Code kann alte und neue Formen nicht unterscheiden, Migrationen raten.
- **Prüfen:** Hülle `{ version, daten }`, beim Lesen wird gezielt migriert.
- **Quelle:** https://martin.kleppmann.com/2026/03/24/designing-data-intensive-applications-2e.html (Encoding & Evolution) · https://jsonic.io/guides/json-migrations

**#23** · Schema
- **Fehler:** Alter Code verwirft beim Zurückschreiben unbekannte Felder (Arbeiter oder alter Container mit älterem Build, Schema-Validator mit „strip“).
- **Folge:** Neue Felder verschwinden still, die Vorwärtskompatibilität ist verletzt.
- **Prüfen:** Unbekannte Felder durchreichen. Web und Arbeiter immer aus demselben Image.
- **Quelle:** https://martin.kleppmann.com/2026/03/24/designing-data-intensive-applications-2e.html („data outlives code“)

**#24** · Schema
- **Fehler:** Eine träge Migration beim Lesen wird nie abgeschlossen oder schreibt aus GET heraus.
- **Folge:** Über Jahre bleibt ein Mischbestand, jeder Pfad muss beide Formen können, der ETag springt bei GET.
- **Prüfen:** Einmal-Migration mit Zähler „noch alte Form: n“, danach den Altlese-Code entfernen. Doku: jarvis→zoe wird beim Lesen übernommen.
- **Quelle:** https://reintech.io/blog/best-practices-mongodb-schema-versioning

**#25** · Schema
- **Fehler:** Migration ohne Sicherung, Trockenlauf und Abgleich.
- **Folge:** Eine fehlerhafte Umformung überschreibt das Original.
- **Prüfen:** Vorher Vollkopie, Trockenlauf mit Diff, danach Zeilenzahl und Prüfsumme je Art vergleichen.
- **Quelle:** https://stripe.com/blog/online-migrations

**#26** · Schema
- **Fehler:** Die Migration ist nicht idempotent.
- **Folge:** Ein zweiter Lauf (Neustart, zweiter Prozess) formt doppelt um, etwa Euro→Cent zweimal ×100.
- **Prüfen:** Die Migration prüft die Version, läuft in der Sperre und setzt die Version atomar zusammen mit den Daten. (ergänzt)
- **Quelle:** https://stripe.com/blog/online-migrations

**#27** · Schema
- **Fehler:** Ein Feld wird in einem Schritt umbenannt oder bekommt eine neue Bedeutung.
- **Folge:** Leser und Schreiber verschiedener Versionen verstehen sich nicht, es gibt keinen Rückweg.
- **Prüfen:** Expand/Contract: neu mitschreiben, beides lesen, umstellen, Altes entfernen.
- **Quelle:** https://martinfowler.com/bliki/ParallelChange.html

**#28** · Schema
- **Fehler:** Geprüft wird nur an der API, nicht beim Schreiben in den Bestand.
- **Folge:** Arbeiter, ZOE, Import und Migration schreiben ungültige Formen (NaN→null, Zahl als String).
- **Prüfen:** Ein Schema je Bestand, geprüft in `updateJson` vor dem Schreiben.
- **Quelle:** https://www.rfc-editor.org/rfc/rfc8259 · (ergänzt)

## 5 · Referenzielle Integrität & Kaskaden (5)

**#29** · Verweise
- **Fehler:** Verweise laufen über Anzeigenamen (Firmenname statt `firmaId`).
- **Folge:** Umbenennen oder Tippfehler brechen die Zuordnung, Gleichnamige werden vermischt.
- **Prüfen:** Nur unveränderliche Kennungen als Verweise. Doku: Stufe 4 ist offen.
- **Quelle:** DATENARCHITEKTUR.md §3.8 · (ergänzt)

**#30** · Verweise
- **Fehler:** Beim Löschen wird in anderen Beständen weder kaskadiert noch aufgeräumt.
- **Folge:** Hängende Verweise, Anzeige und ZOE zeigen Gelöschtes, Art. 17 bleibt unvollständig.
- **Prüfen:** Ein zentrales Register „wer verweist auf X“ (Doku: `person-bestaende.ts`). Test: nach dem Löschen findet sich die Kennung in keinem Bestand mehr.
- **Quelle:** https://brandur.org/soft-deletion

**#31** · Verweise
- **Fehler:** Keine regelmäßige Verweisprüfung.
- **Folge:** Waisen sammeln sich unbemerkt.
- **Prüfen:** Ein nächtlicher Lauf listet verwaiste Verweise je Bestandspaar (siehe #85). (ergänzt)
- **Quelle:** https://brandur.org/soft-deletion

**#32** · Verweise
- **Fehler:** Dateiablage (`.bin`) und Metadaten-Bestand laufen auseinander.
- **Folge:** Metadaten ohne Datei (Fehler beim Öffnen) oder Datei ohne Metadaten (unsichtbar, nie gelöscht, Art. 17).
- **Prüfen:** Beim Schreiben erst `.bin` mit fsync, dann die Metadaten, beim Löschen umgekehrt. Dazu ein Abgleichlauf. (ergänzt)
- **Quelle:** https://www.sqlite.org/appfileformat.html (Nachteile eines Datei-Haufens)

**#33** · Verweise
- **Fehler:** Beim Zusammenführen von Dubletten werden nicht alle Verweise umgebogen.
- **Folge:** Verweise zeigen auf die gelöschte Kennung.
- **Prüfen:** Umbiegen über alle Bestände (Doku: `personUmbiegen`) und die Weiterleitung alt→neu speichern.
- **Quelle:** CRM_FEHLER_PRUEFLISTE.md #17

## 6 · Identität & Kennungen (5)

**#34** · Kennungen
- **Fehler:** Kennungen aus `Date.now()`, `Math.random()` oder einem Zähler im Speicher.
- **Folge:** Kollisionen bei gleichzeitigem Anlegen oder nach einem Neustart.
- **Prüfen:** `crypto.randomUUID()` oder UUIDv7 (zeitlich sortierbar).
- **Quelle:** https://www.rfc-editor.org/rfc/rfc9562

**#35** · Kennungen
- **Fehler:** Kennungen aus fachlichen Werten (E-Mail, Name) oder wiederverwendet nach dem Löschen.
- **Folge:** Ändert sich die Mail, ändert sich die Kennung. Alte Protokolle zeigen auf eine fremde Person.
- **Prüfen:** Künstliche, unveränderliche Kennungen, die nie wiederverwendet werden. (ergänzt)
- **Quelle:** https://martin.kleppmann.com/2026/03/24/designing-data-intensive-applications-2e.html

**#36** · Kennungen
- **Fehler:** Arten von Kennungen werden verwechselt (Haushalt/Person/Bestand bzw. Site- statt App-ID).
- **Folge:** Eine Massenoperation trifft falsche Objekte. Atlassian 2022: 883 Sites gelöscht, weil Site-IDs statt App-IDs übergeben wurden.
- **Prüfen:** Typisierte oder präfixierte Kennungen. Massenoperationen nur mit Vorschau, Zählgrenze und „markieren statt endgültig löschen“.
- **Quelle:** https://www.atlassian.com/blog/atlassian-engineering/post-incident-review-april-2022-outage

**#37** · Kennungen
- **Fehler:** Der Bestandsname (`name--<haushalt>`) wird aus Eingaben gebildet, ohne ihn zu prüfen.
- **Folge:** Path Traversal (`../`) oder Zugriff auf einen fremden Haushalt.
- **Prüfen:** Haushalt und Person nur aus der Sitzung, strikte Zeichenliste, `path.resolve` muss unter `.data` bleiben.
- **Quelle:** https://owasp.org/www-community/attacks/Path_Traversal

**#38** · Kennungen
- **Fehler:** Groß-/Kleinschreibung und Unicode-Form in Dateinamen und Schlüsseln werden nicht beachtet.
- **Folge:** macOS (APFS, standardmäßig ohne Unterscheidung der Schreibweise) und Linux verhalten sich verschieden, NFD und NFC ergeben doppelte Schlüssel.
- **Prüfen:** Namen klein schreiben und in NFC normalisieren, Test auf beiden Systemen.
- **Quelle:** https://support.apple.com/guide/disk-utility/file-system-formats-dsku19ed921c/mac · CRM_FEHLER_PRUEFLISTE.md #13

## 7 · Zeit, Geld, Einheiten (6)

**#39** · Zeit
- **Fehler:** Reine Datumswerte werden als Zeitpunkt behandelt (`new Date('2026-09-28')` = UTC-Mitternacht).
- **Folge:** In Berlin verrutscht der Tag um eins.
- **Prüfen:** Ein Datum als `YYYY-MM-DD`-Text, Zeitpunkte als ISO-8601 mit Zone.
- **Quelle:** https://www.rfc-editor.org/rfc/rfc3339 · https://dev.to/zachgoll/a-complete-guide-to-javascript-dates-and-why-your-date-is-off-by-1-day-fi1

**#40** · Zeit
- **Fehler:** Es wird in der Server-Zone gerechnet (Container = UTC) oder Ortszeit ohne Zone gespeichert.
- **Folge:** „Heute/fällig“ springt um 1–2 h, Jobs laufen in der Umstellungsnacht doppelt oder gar nicht.
- **Prüfen:** In UTC speichern, ausdrücklich in `Europe/Berlin` rechnen. Tests für den 29.03. und den 25.10.
- **Quelle:** https://infiniteundo.com/post/25326999628/falsehoods-programmers-believe-about-time · https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal (Browser-Unterstützung unsicher, prüfen)

**#41** · Zeit
- **Fehler:** Die Wanduhr (mtime, `Date.now()`) bestimmt Reihenfolge oder Stand.
- **Folge:** Durch NTP-Sprünge oder gleiche Millisekunden entstehen falsche Reihenfolgen und übersehene Konflikte.
- **Prüfen:** Stand als Fingerabdruck oder Zähler (Doku: Fingerabdruck ✓), Reihenfolge über einen fortlaufenden Zähler.
- **Quelle:** https://martin.kleppmann.com/2026/03/24/designing-data-intensive-applications-2e.html (unzuverlässige Uhren)

**#42** · Geld
- **Fehler:** Beträge als Float, an verschiedenen Stellen gerundet.
- **Folge:** Cent-Differenzen, die Summe der Zeilen ergibt nicht die Gesamtsumme.
- **Prüfen:** Ganze Cent speichern, eine einzige Rundungsstelle (Doku: `ust.ts` ✓, Cent-Ganzzahlen im Kern v3 entscheidet Kevin).
- **Quelle:** https://www.moderntreasury.com/journal/floats-dont-work-for-storing-cents

**#43** · Einheiten
- **Fehler:** Mehrdeutige Einheiten (19 oder 0,19; brutto oder netto; m oder km; Sekunden oder Millisekunden).
- **Folge:** Fehler um den Faktor 100 oder 1000, falsche Summen.
- **Prüfen:** Die Einheit steht im Feldnamen (`betragBruttoCent`, `ustSatzProzent`) oder im Typ. (ergänzt)
- **Quelle:** https://www.moderntreasury.com/journal/floats-dont-work-for-storing-cents

**#44** · Einheiten
- **Fehler:** Große Ganzzahlen oder externe Kennungen als JSON-Zahl.
- **Folge:** Oberhalb von 2^53 geht Präzision verloren, Kennungen werden still falsch.
- **Prüfen:** Externe Kennungen immer als Text.
- **Quelle:** https://www.rfc-editor.org/rfc/rfc8259 (§6)

## 8 · Caching & Konsistenz (5)

**#45** · Cache
- **Fehler:** Der Cache-Schlüssel trägt weder Person noch Haushalt.
- **Folge:** Die private Sicht der einen Person wird der anderen oder ZOE ausgeliefert.
- **Prüfen:** Schlüssel = Bestand + Person/Haushalt + Stand (Doku-Regel), Test mit zwei Sitzungen.
- **Quelle:** https://nextjs.org/docs/app/guides/data-security

**#46** · Cache
- **Fehler:** Der Cache wird nur im eigenen Prozess ungültig, und aus dem Cache wird zurückgeschrieben.
- **Folge:** Ein anderer Prozess liest einen veralteten Memo-Stand und schreibt ihn zurück. Lost Update über den Cache.
- **Prüfen:** Vor dem Schreiben immer frisch in der Sperre lesen, der Cache dient nur zum Lesen, gültig nur per Dateivergleich (Inode/Zeit/Größe; Doku ✓).
- **Quelle:** https://martin.kleppmann.com/2026/03/24/designing-data-intensive-applications-2e.html (read-your-writes) · (ergänzt)

**#47** · Cache
- **Fehler:** Der ETag hängt an nicht kanonischer Serialisierung, oder schwache ETags werden für `If-Match` genutzt.
- **Folge:** Scheinkonflikte, falsche 304-Antworten.
- **Prüfen:** ETag = Hash des kanonisierten Inhalts, `If-Match` nur mit starken ETags.
- **Quelle:** https://www.rfc-editor.org/rfc/rfc9110

**#48** · Cache
- **Fehler:** Stale-while-revalidate oder abgeleitete Indizes liefern Gelöschtes bzw. Gesperrtes weiter aus.
- **Folge:** Nach Art. 17/18 tauchen Daten noch in Übersichten, Suche und im ZOE-Kontext auf.
- **Prüfen:** Löschen und Sperren machen alle abgeleiteten Caches und Indizes sofort ungültig. (ergänzt)
- **Quelle:** https://nextjs.org/docs/app/api-reference/functions/revalidatePath

**#49** · Cache
- **Fehler:** Der Zwischenspeicher hat keine Obergrenze und hält entschlüsselte Bestände.
- **Folge:** Bei 2 GB RAM droht OOM, Klartext liegt dauerhaft im Heap (Speicherabbild).
- **Prüfen:** Obergrenze in MB, Verdrängung (LRU), keine Heap-Dumps in Produktion. (ergänzt)
- **Quelle:** https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html

## 9 · Verschlüsselung & Schlüsselverwaltung (7)

**#50** · Schlüssel
- **Fehler:** Der Schlüssel liegt neben den Daten (Umgebungsvariable oder .env auf demselben Server, sichtbar in `docker inspect`, im Image).
- **Folge:** Er schützt nur gegen den Diebstahl einer Platten- oder Backup-Kopie, nicht gegen eine Übernahme des Servers.
- **Prüfen:** Bedrohungsmodell schriftlich festhalten. Schlüssel als Datei mit 0400 bzw. Docker-Secret, nie im Image, Repo oder Log.
- **Quelle:** https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html · https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html

**#51** · Schlüssel
- **Fehler:** Es gibt keine Hinterlegung für `MAKE_OS_DATEN_SCHLUESSEL`.
- **Folge:** Ist der Server neu aufgesetzt und der Schlüssel weg, sind alle Bestände und Backups Datenmüll.
- **Prüfen:** Schlüssel offline an zwei Orten (z. B. Passwortmanager beider Personen und Papier im Tresor). Jährliche Wiederherstellung nur aus der Hinterlegung.
- **Quelle:** https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html

**#52** · Schlüssel
- **Fehler:** Die Hülle trägt keine Schlüssel-Kennung (`kid`), es gibt keine Rotation.
- **Folge:** Ein kompromittierter Schlüssel lässt sich nur mit einem Big-Bang tauschen.
- **Prüfen:** `kid` in der Hülle `{ __verschluesselt, kid, iv, tag, daten }`. Lesen mit altem und neuem Schlüssel, Umschlüsseln im Hintergrund. Optional Envelope (Datenschlüssel je Bestand unter einem Hauptschlüssel).
- **Quelle:** https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html

**#53** · Verschlüsselung
- **Fehler:** Ein AES-GCM-Nonce wird wiederverwendet (fester oder abgeleiteter IV, Zähler nach Neustart zurückgesetzt).
- **Folge:** Vertraulichkeit und Integrität sind gebrochen.
- **Prüfen:** 96-bit-Zufalls-IV aus CSPRNG bei jeder Schreibung. Schreibungen je Schlüssel weit unter 2^32 halten, danach rotieren.
- **Quelle:** https://csrc.nist.gov/pubs/sp/800/38/d/final (§8.3)

**#54** · Verschlüsselung
- **Fehler:** Keine Associated Data: Das Chiffrat ist nicht an Bestandsname oder Haushalt gebunden.
- **Folge:** Eine vertauschte Datei (Restore-Fehler, Angreifer mit Schreibzugriff) wird fehlerfrei als fremder Bestand entschlüsselt, etwa `kontakte--A` als `kontakte--B`.
- **Prüfen:** Bestandsname und Formatversion als AAD mitgeben.
- **Quelle:** https://developers.google.com/tink/aead („prevents an attacker from moving medical history from one user to another“)

**#55** · Verschlüsselung
- **Fehler:** Klartext-Rückfall beim Lesen: Bei gesetztem Schlüssel wird eine unverschlüsselte Datei still akzeptiert.
- **Folge:** Downgrade: Eine eingeschleuste oder zurückgespielte Klartextdatei umgeht den Integritätsschutz.
- **Prüfen:** Klartext nur mit ausdrücklichem Migrationsschalter lesen, sonst Fehler plus Meldung. (ergänzt; Doku erwähnt den Übergang Klartext→verschlüsselt)
- **Quelle:** https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html

**#56** · Verschlüsselung
- **Fehler:** Klartext leckt neben der verschlüsselten Datei: tmp-Dateien, Fehlertexte und Logs mit Inhalt, Exporte, Caches auf Platte, Swap/Core-Dumps, Embeddings- und FTS-Index.
- **Folge:** Die Verschlüsselung im Ruhezustand ist praktisch wirkungslos.
- **Prüfen:** Suche nach bekannten Klartext-Markern in `.data`, tmp und Logs. Swap aus oder verschlüsselt. Indizes mitverschlüsseln oder ihr Risiko dokumentieren.
- **Quelle:** https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html

## 10 · Backup, Restore & Katastrophenfall (8)

**#57** · Backup
- **Fehler:** Die Backups liegen auf derselben Platte bzw. demselben Server.
- **Folge:** Plattenschaden, gelöschter Server, Übernahme oder Brand vernichten Original und Kopie. OVH 2021: Backups im selben Rechenzentrum mitverbrannt.
- **Prüfen:** 3-2-1: mindestens eine Kopie bei einem anderen Anbieter oder Ort. Doku: heute 14 Tageskopien in `.data/backup/`, gleiche Platte. Hetzner-Backups haben nur 7 Plätze und liegen beim selben Anbieter.
- **Quelle:** https://www.datacenterdynamics.com/en/news/ovhcloud-ordered-to-pay-250k-to-two-customers-who-lost-data-in-strasbourg-data-center-fire/ · https://docs.hetzner.com/cloud/servers/backups-snapshots/overview/

**#58** · Backup
- **Fehler:** Die Backups lassen sich vom Server aus löschen (Push mit vollen Zugangsdaten).
- **Folge:** Ein Angreifer oder ein Fehlskript löscht die Backups mit. Code Spaces 2014: Firma nach Stunden am Ende.
- **Prüfen:** Ziel nur anhängend oder unveränderlich (z. B. restic rest-server `--append-only`, Storage Box mit Snapshots, Object Lock) oder Pull vom Backup-Rechner.
- **Quelle:** https://www.csoonline.com/ (Überblick) · https://thehackernews.com/2014/06/cyber-attack-on-code-spaces-puts.html · https://github.com/restic/rest-server

**#59** · Restore
- **Fehler:** Die Wiederherstellung wurde nie geübt.
- **Folge:** Im Ernstfall läuft kein Verfahren. GitLab 2017: fünf Verfahren, keines funktionierte, u. a. wegen eines pg_dump-Versionskonflikts.
- **Prüfen:** Monatliche Übung in einen leeren Container: App startet, Zählungen stimmen, Dauer gemessen (RTO).
- **Quelle:** https://about.gitlab.com/blog/postmortem-of-database-outage-of-january-31/

**#60** · Backup
- **Fehler:** Backup-Fehler bleiben still.
- **Folge:** Wochenlang keine Sicherung. Bei GitLab wurden die Cron-Fehlermails wegen DMARC abgewiesen.
- **Prüfen:** Aktive Erfolgsmeldung (Heartbeat/Dead-man's-Switch). Alarm, wenn sie ausbleibt, nicht nur bei einem Fehler.
- **Quelle:** https://about.gitlab.com/blog/postmortem-of-database-outage-of-january-31/

**#61** · Backup
- **Fehler:** Inkonsistenter Schnappschuss: tar über laufende Schreibungen, die Bestände stammen aus verschiedenen Momenten.
- **Folge:** Der Restore enthält CRM-Verweise auf fehlende Kontakte oder halb geschriebene Dateien.
- **Prüfen:** Kurze globale Schreibpause oder ein Dateisystem-Snapshot. Im Archiv jeden Bestand entschlüsseln, parsen und mit Prüfsumme testen.
- **Quelle:** https://www.sqlite.org/backup.html (warum kein einfaches Kopieren) · (ergänzt)

**#62** · Backup
- **Fehler:** Die Backups sind verschlüsselt, aber der Schlüssel (age-Identität, Datenschlüssel) liegt nur auf dem Server oder im Backup selbst.
- **Folge:** Ist der Server weg, sind die Backups unlesbar.
- **Prüfen:** Auf dem Server nur der öffentliche age-Empfänger, der private Schlüssel offline. Der Datenschlüssel wird separat gesichert (#51). Die Übung läuft ohne Serverzugriff.
- **Quelle:** https://github.com/FiloSottile/age · https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html

**#63** · Restore
- **Fehler:** Es gibt nur eine Voll-Wiederherstellung, keine für einen Bestand, Haushalt oder Datensatz.
- **Folge:** Ein kleiner Schaden (misslungener Import) zwingt zum Zurückspielen des Ganzen, alle späteren Änderungen gehen verloren. Atlassian brauchte bis zu 14 Tage, weil eine Wiederherstellung in diesem Umfang nicht vorgesehen war.
- **Prüfen:** Werkzeug „Bestand X vom Datum Y als Vorschau, einzelne Zeilen übernehmen“.
- **Quelle:** https://www.atlassian.com/blog/atlassian-engineering/post-incident-review-april-2022-outage

**#64** · Backup
- **Fehler:** Aufbewahrung ohne Plan (nur 14 Tage oder unbegrenzt), RPO und RTO sind nicht festgelegt.
- **Folge:** Schleichende Korruption wird nach drei Wochen entdeckt, dann sind alle Kopien schon kaputt. Oder die unbegrenzte Aufbewahrung verletzt Löschfristen.
- **Prüfen:** Generationen (z. B. 14 täglich, 8 wöchentlich, 12 monatlich), im Löschkonzept begründet.
- **Quelle:** https://www.bsi.bund.de/DE/Themen/Unternehmen-und-Organisationen/Standards-und-Zertifizierung/IT-Grundschutz/IT-Grundschutz-Kompendium/IT-Grundschutz-Bausteine/Bausteine_Download_Edition_node.html (CON.3 Datensicherungskonzept)

## 11 · Audit, Protokoll & Nachvollziehbarkeit (4)

**#65** · Audit
- **Fehler:** Ein Änderungsprotokoll ohne Werte, und niemand hat entschieden, wie ein alter Stand rekonstruiert wird.
- **Folge:** „Was stand vorher, wer hat es geändert?“ lässt sich nur über das Backup beantworten, falls überhaupt.
- **Prüfen:** Immer Akteur (Person, ZOE, Import, Arbeiter), Anlass und Kennung protokollieren. Vorher-Fassung im Tagesarchiv oder verschlüsselt mit Frist.
- **Quelle:** https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html

**#66** · Audit
- **Fehler:** Das Protokoll ist manipulierbar (gleicher Speicher, gleiche Rechte, keine Verkettung).
- **Folge:** Nach einem Vorfall gibt es keinen belastbaren Nachweis.
- **Prüfen:** Hash-Kette je Eintrag und regelmäßige Kopie außerhalb des Servers.
- **Quelle:** https://www.usenix.org/legacy/event/sec09/tech/full_papers/crosby.pdf

**#67** · Audit
- **Fehler:** „Nur anhängend“ ist in Wahrheit Lesen, Anhängen und ganzes Neuschreiben einer JSON-Datei.
- **Folge:** O(n) je Eintrag, unbegrenztes Wachstum, Platte voll.
- **Prüfen:** Echtes Anhängen (JSONL, `appendFile`), Tagesrotation, Frist. (ergänzt)
- **Quelle:** https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html

**#68** · Audit
- **Fehler:** Kennungen im Protokoll gelten als „keine Personendaten“.
- **Folge:** Pseudonyme Daten sind personenbezogen. Das Protokoll fällt unter Auskunft und Löschung.
- **Prüfen:** Protokoll in die Art.-15/17-Pfade aufnehmen oder eine Frist festlegen.
- **Quelle:** https://www.edpb.europa.eu/our-work-tools/documents/public-consultations/2025/guidelines-012025-pseudonymisation_en

## 12 · Datenschutz & Löschung (6)

**#69** · DSGVO
- **Fehler:** Art. 17 erreicht die Nebenkopien nicht: Backups, `archiv/`, Exporte, Caches, Embeddings/FTS, ZOE-Protokolle, `heads-replay-*`, Git-Historie.
- **Folge:** Eine gelöschte Person taucht in ZOE-Antworten oder nach einem Restore wieder auf.
- **Prüfen:** Liste aller Kopien je Bestand führen. Backups „beyond use“ und mit fester Frist. Doku §3.8 nennt offene Stellen.
- **Quelle:** https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-erasure/ · https://www.bits.gmbh/das-recht-auf-loeschung-und-backups-ein-unloesbares-dilemma/

**#70** · DSGVO
- **Fehler:** Es gibt keine Löschliste für Wiederherstellungen.
- **Folge:** Ein Restore holt gelöschte Personen zurück.
- **Prüfen:** Grabstein-Liste (nur HMAC der Kennung) außerhalb der Backups, die das Restore-Skript zwingend anwendet.
- **Quelle:** https://datenschutz-agentur.de/blog/loeschpflichten-in-backups/

**#71** · DSGVO
- **Fehler:** Sperrliste oder Pseudonyme als ungesalzener Hash (SHA-256 der E-Mail).
- **Folge:** Per Wörterbuch umkehrbar, also weder anonym noch sicher.
- **Prüfen:** HMAC-SHA-256 mit geheimem Pepper (getrennt vom Datenschlüssel). Vorher normalisieren (trim, klein, NFC). Die Rotation ist eingeplant.
- **Quelle:** https://www.ftc.gov/policy/advocacy-research/tech-at-ftc/2024/07/no-hashing-still-doesnt-make-your-data-anonymous · EDPB 01/2025 (s. o.)

**#72** · DSGVO
- **Fehler:** Die Einschränkung nach Art. 18 wirkt nur in der Oberfläche.
- **Folge:** Arbeiter, Export, Kampagnen und ZOE verarbeiten gesperrte Daten weiter.
- **Prüfen:** Das Sperrmerkmal wird zentral in der Lesefunktion ausgewertet, mit Test je Leser. (ergänzt)
- **Quelle:** https://dsgvo-gesetz.de/art-18-dsgvo/

**#73** · DSGVO
- **Fehler:** Die Löschfristen stehen im Konzept, aber kein Lauf setzt sie um.
- **Folge:** Daten ohne Zweck bleiben für immer.
- **Prüfen:** Löschklassen (Startzeitpunkt + Frist) je Datenart, nächtlicher Lauf mit Bericht.
- **Quelle:** https://www.din-66398.de/inhalt/i-din66398/loeschklassen.html

**#74** · DSGVO
- **Fehler:** Ein neuer Bestand mit Personenbezug wird nicht im zentralen Register eingetragen.
- **Folge:** Auskunft (Art. 15) und Löschung (Art. 17) sind still unvollständig.
- **Prüfen:** Ein Test gleicht alle Bestandsnamen gegen `person-bestaende.ts` ab: neuer Bestand ohne Eintrag → Test rot. (ergänzt)
- **Quelle:** https://dsgvo-gesetz.de/art-17-dsgvo/

## 13 · Grenzen & Wachstum (6)

**#75** · Wachstum
- **Fehler:** Bei jedem Zugriff wird der ganze Bestand gelesen, entschlüsselt und geparst.
- **Folge:** O(n) je Klick. Auf 1 vCPU blockieren `JSON.parse`/`stringify` die Event-Loop, alle Anfragen warten.
- **Prüfen:** Event-Loop-Verzögerung und Parse-Zeit je Bestand messen. Grenzwert siehe „Ab wann SQLite“. Doku: Hochrechnung 6–8 MB je Klick bei 5.000 Kontakten.
- **Quelle:** https://www.sqlite.org/fasterthanfs.html · DATENARCHITEKTUR.md §2

**#76** · Wachstum
- **Fehler:** Der Spitzenverbrauch an Speicher (Parse, Kopie, Base64 +33 %, Verschlüsselung) wird nicht bedacht.
- **Folge:** Bei 2 GB RAM beendet der OOM-Killer den Container, mitten im Schreiben.
- **Prüfen:** Spitzen-RSS beim größten Bestand ×3 messen, Speichergrenzen für Container und Heap setzen.
- **Quelle:** https://github.com/nodejs/node/issues/9489 · (ergänzt)

**#77** · Wachstum
- **Fehler:** Harte Grenzen bringen den Leser zum Absturz, statt dass der Schreiber ablehnt.
- **Folge:** Eine übergroße Datei legt alles lahm. Cloudflare 18.11.2025: eine Feature-Datei verdoppelte sich, die Größengrenze wurde überschritten, der Prozess stürzte ab.
- **Prüfen:** Grenzen beim Schreiben (413, Doku ✓), beim Lesen tolerant bleiben und Alarm geben.
- **Quelle:** https://blog.cloudflare.com/18-november-2025-outage/

**#78** · Wachstum
- **Fehler:** Unbegrenzt wachsende Listen im Datensatz (`Kontakt.aktivitaeten`, Verlauf).
- **Folge:** Ein Einzelobjekt wird riesig, jeder Patch schreibt alles mit.
- **Prüfen:** Wachsendes in einen eigenen Bestand, der nur angehängt wird, mit Obergrenze und Auslagerung. Doku §3.10.
- **Quelle:** DATENARCHITEKTUR.md §3.10 · (ergänzt)

**#79** · Wachstum
- **Fehler:** Die Platte läuft voll (Docker-Logs ohne Rotation, Backups auf derselben Platte, tmp).
- **Folge:** ENOSPC mitten im Schreiben, das Backup scheitert.
- **Prüfen:** Docker `log-opts max-size/max-file`, Alarm bei 80 %, Platzreserve.
- **Quelle:** https://docs.docker.com/engine/logging/drivers/json-file/

**#80** · Wachstum
- **Fehler:** Serverseitig keine Seiten oder Feldauswahl, der Client bekommt den ganzen Bestand.
- **Folge:** Unnötige Bytes, unnötiger Speicher und Daten, die die Seite gar nicht braucht.
- **Prüfen:** Seiten, Felder und Delta-Abgleich (Doku: Delta für Kontakte ✓).
- **Quelle:** https://linear.app/now/scaling-the-linear-sync-engine

## 14 · Import/Export & Portabilität (4)

**#81** · Import
- **Fehler:** Das Rückgängigmachen eines Import-Laufs überschreibt spätere Bearbeitungen.
- **Folge:** Beim Undo gehen Änderungen seit dem Import verloren.
- **Prüfen:** Undo prüft den Stand je Zeile. Geänderte Zeilen kommen auf eine Konfliktliste, statt überschrieben zu werden. (ergänzt)
- **Quelle:** CRM_FEHLER_PRUEFLISTE.md #25

**#82** · Import
- **Fehler:** Der Import ist nicht idempotent.
- **Folge:** Dieselbe Datei zweimal importiert ergibt doppelte Datensätze.
- **Prüfen:** Hash der Quelldatei plus natürlicher Schlüssel je Zeile.
- **Quelle:** https://stripe.com/blog/idempotency

**#83** · Export
- **Fehler:** Kein vollständiger, dokumentierter Export.
- **Folge:** Die Daten sind nur mit eigenem Code lesbar, Umzug oder SQLite-Umstieg werden riskant, Art. 20 ist nicht erfüllt.
- **Prüfen:** Export aller Bestände entschlüsselt, mit Schema-Doku. Rundtest: Export → Import ergibt denselben Stand.
- **Quelle:** https://www.sqlite.org/appfileformat.html · https://dsgvo-gesetz.de/art-20-dsgvo/

**#84** · Import
- **Fehler:** Fremdes JSON wird ungeprüft übernommen (`__proto__`, `constructor`, extreme Tiefe oder Größe).
- **Folge:** Prototype Pollution oder Abstürze.
- **Prüfen:** Schema-Prüfung, Map bzw. `Object.create(null)`, Grenzen für Tiefe und Größe.
- **Quelle:** https://cheatsheetseries.owasp.org/cheatsheets/Prototype_Pollution_Prevention_Cheat_Sheet.html

## 15 · Beobachtbarkeit & Integritätsprüfungen (5)

**#85** · Integrität
- **Fehler:** Keine regelmäßige Durchsicht, bei der jeder Bestand entschlüsselt, geparst, gegen das Schema und auf Verweise geprüft wird.
- **Folge:** Korruption fällt erst auf, wenn alle Backups sie schon enthalten.
- **Prüfen:** Nächtlicher Lauf mit Bericht. Für Backups `restic check --read-data-subset`.
- **Quelle:** https://restic.readthedocs.io/en/stable/045_working_with_repos.html

**#86** · Integrität
- **Fehler:** Fehler werden verschluckt (`catch {}`, `catch → null`, `.catch(() => {})`) in Datenpfaden.
- **Folge:** Stille Datenverluste.
- **Prüfen:** Codesuche und Lint-Regel, Doku-Regel „nie catch → null um loadJson“.
- **Quelle:** https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html

**#87** · Beobachtbarkeit
- **Fehler:** Keine Messwerte für Sperrwartezeit, Schreibdauer, Dateigröße sowie 409- und 413-Raten.
- **Folge:** Engpässe fallen erst auf, wenn etwas hängt.
- **Prüfen:** p50/p99 je Bestand, Wachstum je Tag, Anzeige beim HOI. (ergänzt)
- **Quelle:** https://martin.kleppmann.com/2026/03/24/designing-data-intensive-applications-2e.html (Perzentile)

**#88** · Beobachtbarkeit
- **Fehler:** Die Gesundheitsprüfung fragt nur „Prozess lebt“.
- **Folge:** Alles zeigt Grün, obwohl Bestände unlesbar, Backups alt oder die Platte voll sind.
- **Prüfen:** `/health` meldet Alter der letzten geprüften Sicherung, freien Platz und beschädigte Bestände. (ergänzt)
- **Quelle:** https://about.gitlab.com/blog/postmortem-of-database-outage-of-january-31/

**#89** · Integrität
- **Fehler:** Der Schrumpf-Schutz ist grob und protokolliert nichts.
- **Folge:** Eine berechtigte Massenlöschung (Art. 17) wird blockiert, oder ein schleichender Verlust unter der Schwelle bleibt unbemerkt.
- **Prüfen:** Zeilenzahl je Bestand und Tag protokollieren, Abweichungen über x % melden, Art.-17-Läufe freigeben. (ergänzt)
- **Quelle:** DATENARCHITEKTUR.md §3.1

## 16 · KI/Agenten-Zugriff auf Daten (5)

**#90** · KI
- **Fehler:** „Nur Lesen“ wird per Prompt geregelt statt über die Rechte der Werkzeuge.
- **Folge:** Eine Prompt Injection in Notiz, Mail oder Vault-Datei bringt ZOE zum Schreiben oder Versenden.
- **Prüfen:** Lesende und schreibende Werkzeuge serverseitig trennen. Schreiben nur als Vorschlag mit Klick.
- **Quelle:** https://genai.owasp.org/llmrisk/llm01-prompt-injection/ · https://www.promptfoo.dev/docs/red-team/owasp-llm-top-10/ (LLM06)

**#91** · KI
- **Fehler:** Das „tödliche Dreigespann“: private Daten, fremde Inhalte und ein Kanal nach außen (Markdown-Bilder oder Links, Web-Abruf, Mail) kommen zusammen.
- **Folge:** Daten werden über eine Bild-URL mit Parametern abgeflossen.
- **Prüfen:** ZOE-Ausgabe ohne externe Bilder und ohne automatische Links. Kein Web-Abruf im selben Lauf wie CRM-Daten.
- **Quelle:** https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/

**#92** · KI
- **Fehler:** Die KI liest an der Sicht-Schicht vorbei (direktes `loadJson`, Suchindex, Embeddings).
- **Folge:** Private Notizen der anderen Person, gesperrte oder gelöschte Daten landen im Kontext.
- **Prüfen:** Zugriff nur über die Sicht-Schicht (Doku: `crmSicht`). Test: Malins private Notiz darf im Kontext von Kevin nicht auftauchen.
- **Quelle:** https://www.confident-ai.com/blog/owasp-top-10-2025-for-llm-applications-risks-and-mitigation-techniques (LLM02/LLM08)

**#93** · KI
- **Fehler:** KI-Protokolle und Kontexte speichern vollständige Daten.
- **Folge:** Es entsteht eine Kopie außerhalb von Verschlüsselung und Löschkonzept, dazu kommt die Aufbewahrung beim Anbieter.
- **Prüfen:** Protokoll nur mit Kennungen (Doku ✓), Auftragsverarbeitungsvertrag bzw. keine Aufbewahrung beim Anbieter, Frist.
- **Quelle:** https://www.datenschutzkonferenz-online.de/media/oh/20240506_DSK_Orientierungshilfe_KI_und_Datenschutz.pdf

**#94** · KI
- **Fehler:** KI-Ausgaben werden ohne Herkunft als Fakt gespeichert.
- **Folge:** Halluzinationen werden zu Stammdaten.
- **Prüfen:** Merkmal `quelle: 'zoe'` und ein Verifiziert-Kennzeichen. Die KI überschreibt nie verifizierte Werte.
- **Quelle:** https://www.promptfoo.dev/docs/red-team/owasp-llm-top-10/ (LLM09)

## 17 · Wissens-/Brain-Speicher: Markdown & Git (6)

**#95** · Brain
- **Fehler:** Zwei Quellen der Wahrheit (Vault und App-Bestand) ohne festgelegte Richtung.
- **Folge:** Der Abgleich überschreibt in beide Richtungen oder schaukelt sich auf.
- **Prüfen:** Je Datenart genau eine Wahrheit und eine dokumentierte Richtung (Doku: „Vault bleibt Wahrheit“ ✓).
- **Quelle:** https://www.inkandswitch.com/local-first/

**#96** · Brain
- **Fehler:** Mehrere Sync-Mechanismen auf einem Vault (iCloud + Git + ggf. Obsidian Sync) bzw. `.git` in iCloud.
- **Folge:** Konfliktkopien, verlorene Notizen, beschädigte Git-Objekte.
- **Prüfen:** Genau eine Sync-Instanz je Vault. `.git` nie in einem Cloud-Ordner.
- **Quelle:** https://obsidian.md/help/sync-notes · https://architchandra.com/articles/a-side-effect-of-storing-a-git-repository-in-icloud-drive

**#97** · Brain
- **Fehler:** Automatische Commits vom Server und Bearbeitungen am Mac ohne Merge-Strategie.
- **Folge:** Die Historien laufen auseinander, ein Force-Push vernichtet Arbeit.
- **Prüfen:** Der Server schreibt nur in einen eigenen Ordner oder Zweig, nie Force-Push, Konflikte werden gemeldet statt aufgelöst. (ergänzt)
- **Quelle:** https://obsidian.md/help/sync-notes

**#98** · Brain
- **Fehler:** Personendaten oder Geheimnisse in der Git-Historie.
- **Folge:** Das Löschen der Datei löscht nichts, Klone und Remote behalten alles (Art. 17).
- **Prüfen:** Personenbezug im Vault klein halten. Löschen heißt Historie umschreiben (`git filter-repo`) und alle Kopien einbeziehen.
- **Quelle:** https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository

**#99** · Brain
- **Fehler:** Ein abgeleiteter Index (FTS5, Embeddings) veraltet oder hält Gelöschtes fest.
- **Folge:** Suche und ZOE finden Gelöschtes oder verweisen auf Notizen, die es nicht mehr gibt.
- **Prüfen:** Der Index ist rein abgeleitet und jederzeit neu baubar, Abgleich per Inhalts-Hash. Löschen entfernt die Indexeinträge sofort.
- **Quelle:** https://www.confident-ai.com/blog/owasp-top-10-2025-for-llm-applications-risks-and-mitigation-techniques (LLM08)

**#100** · Brain
- **Fehler:** Frontmatter ohne Schema, der YAML-Parser rät Typen („no“ → false, `2026-09-28` → Date, `010` → 8).
- **Folge:** Status, Freigaben (`freigegeben_von`) und Daten werden still falsch gelesen.
- **Prüfen:** Frontmatter-Schema je Notizart mit strikter Typisierung. Werte in Anführungszeichen. Test mit „Norway-Fällen“.
- **Quelle:** https://hitchdev.com/strictyaml/why/implicit-typing-removed/

---

## Die 15 wichtigsten für genau diese Bauart

Bauart: JSON-Bestände, 1 Server, 2 Personen, verschlüsselt, KI-Lesezugriff. Reihenfolge = Einschätzung aus Schaden × Wahrscheinlichkeit, noch nicht gegen den Code geprüft.

1. **#9 / #10 / #11:** Die Sperre gilt nur im Prozess, aber es gibt mehrere Schreiber (Arbeiter, Skripte, Deploy-Überlappung, doppelte Modulinstanz). Das ist der wahrscheinlichste verbleibende Weg zu stillem Datenverlust.
2. **#7:** Ein Lesefehler wird zu „leer“ und dann überschrieben. Laut Doku am 27.09. behoben. Den Test dauerhaft halten, jeden neuen Leser dagegen prüfen.
3. **#2 / #3 / #5:** Die fsync-Kette (Datei → rename → Verzeichnis) muss vollständig sein, E/A-Fehler dürfen nie „weiter“ bedeuten. Das gilt auch für Archiv, Dateiablage und Skripte.
4. **#51 / #62:** Geht der Schlüssel verloren, sind alle Daten und Backups verloren. Hinterlegung an zwei Offline-Orten, Übung ohne Server.
5. **#57 / #58:** Die Backups liegen auf derselben Platte und sind vom Server aus löschbar. Eine Kopie gehört zu einem anderen Anbieter, nur anhängend.
6. **#59 / #60:** Restore nie geübt, Fehler bleiben still. Monatliche Übung, Heartbeat statt Fehlermail.
7. **#17:** Eine Operation über mehrere Bestände (crm→kontakte, Merge, Art. 17) bricht in der Mitte ab. Absichtsprotokoll plus Abschluss beim Start.
8. **#12:** Feste Sperr-Rangfolge und Erkennung von Wiedereintritt, sonst gibt es stille Deadlocks.
9. **#23 / #10:** Alte Codeversion (Arbeiter, alter Container) verwirft neue Felder. Immer dasselbe Image, unbekannte Felder durchreichen.
10. **#54 / #55:** Kein AAD (vertauschbare Haushalts-Bestände) und Klartext-Rückfall beim Lesen. Bestandsname als AAD, Klartext nur per Schalter.
11. **#45 / #92:** Cache oder KI-Sicht ohne Personenbezug lässt Private Daten zwischen Kevin und Malin durchsickern. Test mit zwei Sitzungen.
12. **#69 / #70 / #99:** Art. 17 erreicht Archiv, Backups, Embeddings und Git nicht, und ein Restore holt Gelöschtes zurück. Löschliste nach jedem Restore, Index sofort bereinigen.
13. **#75 / #76:** Volle O(n)-Lesevorgänge und Spitzen-RAM auf 1 vCPU/2 GB. Messen, bevor es wehtut (Kriterien unten).
14. **#90 / #91:** ZOE „nur lesen“ muss im Werkzeug erzwungen sein, Kanäle nach außen gehören geschlossen (Bilder, Links, Web-Abruf).
15. **#85 / #61:** Nächtliche Durchsicht (entschlüsseln, parsen, Schema, Verweise, Zeilenzahlen) und ein konsistenter Backup-Schnappschuss. Beides zusammen erkennt Korruption, solange noch saubere Kopien existieren.

## Ab wann SQLite statt JSON

**Einschätzung:** Kevins Entscheidung vom 27.09. (JSON bleibt, neu bewerten ab etwa 5.000 Kontakten) ist für zwei Personen vertretbar, **wenn** #9, #17 und #57–#62 gelöst sind. Die Kontaktzahl allein ist aber ein schwacher Auslöser. Besser sind messbare Kriterien. **SQLite lohnt, sobald eines davon zutrifft:**

1. **Tempo:** Der größte Bestand braucht beim Entschlüsseln und Parsen auf dem Server mehr als etwa 50 ms (p95), oder die Event-Loop-Verzögerung liegt beim Öffnen von Markttraktion über 100 ms. Faustwert: entschlüsselt über etwa 5 MB je Bestand.
2. **Atomarität:** Mehr als 2–3 Operationen müssen regelmäßig mehrere Bestände atomar ändern (Lead→Mandat, Merge, Art. 17, Kampagnen-Ergebnis). Ein eigenes Journal (#17) ist dann teurer und riskanter als SQLite-Transaktionen.
3. **Mehrere Schreiber:** Der Arbeiter muss dauerhaft selbst schreiben, und die Sperrwartezeit liegt bei p99 über 200 ms. SQLite im WAL-Modus erlaubt gleichzeitige Leser und serialisiert Schreiber sauber über Prozesse hinweg. Quelle: https://sqlite.org/whentouse.html
4. **Abfragen:** Es gibt Abfragen über Beziehungen oder Filter, die heute quadratisch laufen (Doku §3.7), oder es braucht Indizes auf Kennung, `firmaId`, Mail und Bezug.
5. **Wachstum:** Aktivitäten oder Protokolle mit mehr als etwa 50.000 Zeilen, die nur angehängt werden. Als Tabelle mit Index sind sie trivial, als JSON jedes Mal voll neu geschrieben.

**Was SQLite löst:** #1–#8 (atomarer Commit, Journal), #9/#17 (Transaktionen, Sperre über Prozesse hinweg), #61 (Online-Backup-API bzw. `VACUUM INTO` statt Kopieren), #75/#80 (Indizes, Seiten), #22 (`PRAGMA user_version`).

**Was SQLite nicht löst:** Schlüsselverwaltung, Hinterlegung und Rotation (#50–#52, mit SQLCipher oder SQLite3MultipleCiphers bleibt das Problem gleich), Art. 17 in Kopien (#69/#70), KI-Rechte (#90–#92), Offsite-Backups und Restore-Übungen (#57–#60).

**Wenn SQLite, dann so:**
- lokales ext4-Volume, nie Netzlaufwerk oder Sync-Ordner
- WAL-Modus, ein Schreibprozess
- Backup mit `.backup` oder Litestream, nie `cp` der laufenden Datei
- versionierte Migrationen
- zuerst nur Kontakte, CRM und Aktivitäten (dort sitzen Größe, Beziehungen und Mehrbestands-Operationen), der Rest bleibt JSON
- Übernahme mit Abgleich der Zeilenzahl, Vorschau und Voll-Export vorher (Doku §6)

Quellen: https://www.sqlite.org/howtocorrupt.html · https://www.sqlite.org/backup.html

**Postgres** erst bei mehreren App-Servern, Zugriff von außen oder deutlich mehr als zwei gleichzeitigen Schreibern. Für MAKE OS ist das nicht absehbar.

---

**Unsicher bzw. nicht verifiziert:**
- Ob Node `fs.fsync` auf ein Verzeichnis-Handle in eurem Container/Volume wirkt: auf Linux/ext4 üblich, auf dem Server prüfen.
- Temporal-Unterstützung im Browser.
- Die csoonline-URL bei #58 ist nur ein allgemeiner Verweis; belastbar sind thehackernews und restic.

**Quellen (Auswahl, alle inline oben):**
[GitLab Postmortem 2017](https://about.gitlab.com/blog/postmortem-of-database-outage-of-january-31/) · [Atlassian PIR 2022](https://www.atlassian.com/blog/atlassian-engineering/post-incident-review-april-2022-outage) · [Cloudflare 18.11.2025](https://blog.cloudflare.com/18-november-2025-outage/) · [SQLite Atomic Commit](https://www.sqlite.org/atomiccommit.html) · [SQLite How To Corrupt](https://www.sqlite.org/howtocorrupt.html) · [SQLite When To Use](https://sqlite.org/whentouse.html) · [PostgreSQL Fsync Errors](https://wiki.postgresql.org/wiki/Fsync_Errors) · [LWN fsync surprise](https://lwn.net/Articles/752063/) · [Pillai et al. OSDI 2014](https://www.usenix.org/conference/osdi14/technical-sessions/presentation/pillai) · [Dan Luu Files are hard](https://danluu.com/file-consistency/) · [Stripe Idempotency](https://stripe.com/blog/idempotency) · [Stripe Online Migrations](https://stripe.com/blog/online-migrations) · [Figma Multiplayer](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/) · [Linear Sync Engine](https://linear.app/now/scaling-the-linear-sync-engine) · [DDIA 2. Aufl. 2026](https://martin.kleppmann.com/2026/03/24/designing-data-intensive-applications-2e.html) · [AWS Transactional Outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html) · [NIST SP 800-38D](https://csrc.nist.gov/pubs/sp/800/38/d/final) · [Tink AEAD](https://developers.google.com/tink/aead) · [OWASP Key Management](https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html) · [FTC Hashing 2024](https://www.ftc.gov/policy/advocacy-research/tech-at-ftc/2024/07/no-hashing-still-doesnt-make-your-data-anonymous) · [EDPB Pseudonymisation 01/2025](https://www.edpb.europa.eu/our-work-tools/documents/public-consultations/2025/guidelines-012025-pseudonymisation_en) · [ICO Right to Erasure](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-erasure/) · [bits.gmbh Backups & Löschung](https://www.bits.gmbh/das-recht-auf-loeschung-und-backups-ein-unloesbares-dilemma/) · [DIN 66398 Löschklassen](https://www.din-66398.de/inhalt/i-din66398/loeschklassen.html) · [BSI Grundschutz-Bausteine](https://www.bsi.bund.de/DE/Themen/Unternehmen-und-Organisationen/Standards-und-Zertifizierung/IT-Grundschutz/IT-Grundschutz-Kompendium/IT-Grundschutz-Bausteine/Bausteine_Download_Edition_node.html) · [OVH-Brand Urteil](https://www.datacenterdynamics.com/en/news/ovhcloud-ordered-to-pay-250k-to-two-customers-who-lost-data-in-strasbourg-data-center-fire/) · [Code Spaces 2014](https://thehackernews.com/2014/06/cyber-attack-on-code-spaces-puts.html) · [Hetzner Backups](https://docs.hetzner.com/cloud/servers/backups-snapshots/overview/) · [Docker json-file](https://docs.docker.com/engine/logging/drivers/json-file/) · [Prisma/Next.js globalThis](https://www.prisma.io/docs/orm/more/troubleshooting/nextjs) · [V8-Stringgrenze](https://github.com/nodejs/node/issues/9489) · [OWASP LLM01](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) · [Willison Lethal Trifecta](https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/) · [Obsidian Sync-Hinweise](https://obsidian.md/help/sync-notes) · [Git in iCloud](https://architchandra.com/articles/a-side-effect-of-storing-a-git-repository-in-icloud-drive)
