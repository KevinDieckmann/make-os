# Malins Rückmeldung 27.09. — Plan (nur lokal, Upload erst auf Kevins Freigabe)

Quelle: Malin hat den Live-Stand getestet, Kevin hat es diktiert (27.09. abends). Drei Pakete, je Paket ein Bau-Agent, alles nur auf `entwicklung`, nichts nach Hetzner ohne ausdrückliches Wort.

## Paket A · Markttraktion — Kontaktakte übersichtlich
Stellen: `components/os/crm/Akte.tsx`, `components/os/crm/kontakt-teile.tsx` (Matrix/Stammdaten, Beziehung), `lib/crm/wertelisten.ts`, `components/os/crm/stammdaten/Wertelisten.tsx`.
1. **Weniger scrollen:** Die Akte bekommt oben einen kompakten Kopf (Name, Firma, Phase, Score, nächster Schritt, Kanäle) und darunter Reiter statt Endlos-Stapel: **Überblick · Stammdaten · Beziehung · Verlauf · Datenschutz** (Entscheidung Kevin, s. Fragen). Auf breiten Bildschirmen zwei Spalten je Reiter, Abschnitte einklappbar, zuletzt gewählter Reiter bleibt je Person gemerkt.
2. **Typ und Kategorie nach oben:** direkt unter dem Kopf, vor Branchen und dem Rest der Stammdaten.
3. **Branchen, Typ, Kategorie vollständig:** alle Werte der Werteliste sichtbar in einer scrollbaren Pillen-Box (max. ~4 Zeilen hoch, Suche ab 12 Werten), **„+ neu“ direkt in der Akte** legt den Wert in der Werteliste an (Stammdaten › Wertelisten bleibt der Ort zum Pflegen/Umbenennen). Gleiches Bauteil für alle drei Listen.

## Paket B · Finanzen privat (Haushalt) — Fixkosten, Rhythmus, Rechnungen
Stellen: `components/os/haushalt/Fixkosten.tsx`, `Schulden.tsx`, `lib/finanzen/haushalt/*` (einordnung, regeln), API `app/api/haushalt/*`.
4. **Fixkosten bearbeiten:** je Zeile Stift → Name, Betrag, Rhythmus, Kategorie, Konto ändern; **Umstufen auf „variabel“** nimmt den Posten aus den Fixkosten und ordnet ihn dem variablen Budget zu (Regel für den Empfänger, damit künftige Buchungen gleich landen — s. Frage), rückwirkend sichtbar in Ist/Soll.
5. **„Rhythmus unklar“ klären:** Klick auf den Chip öffnet die Wahl (monatlich, vierteljährlich, halbjährlich, jährlich, unregelmäßig) mit Vorschlag aus den Buchungsabständen; gespeichert als Regel, Chip verschwindet.
6. **Offene Rechnungen „bezahlt“:** Fehler beheben (Knopf schreibt heute nichts Sichtbares) — bezahlt setzt `erledigt` + `bezahlt_am`, Zeile rutscht nach „bezahlt“ (einklappbar), Summe offen aktualisiert sich; Test für den Schreibweg.

## Paket C · Ziele & Planung — Ziele, Meilensteine, Routinen
Stellen: `components/os/HorizontView.tsx`, `app/os/planung/*`, `components/os/RoutinenPlanerView.tsx`, `RitualView.tsx`, `types/routines.ts`, Speicher `routinen`, Home-Fläche (`components/os/flaeche/widgets.tsx`).
7. **Ziele links, Meilensteine rechts** (zwei Spalten, am Handy untereinander), **„+ neu“ oben** in beiden Spalten, offene nach Priorität, **erledigte rutschen in einen eigenen Bereich unten** in derselben Karte (3–4 sichtbar, Rest scrollt).
8. **Priorität per Pfeil** ▲▼ rechts an jeder Zeile (Ziele, Meilensteine, Routinen, Blöcke) — Reihenfolge wird gespeichert.
9. **Business-Einheiten:** Ziele/Meilensteine im Business nach Einheit filtern und zuordnen — Startliste **Selbstständigkeit · KD Ventures · Kunden**, weitere frei hinzufügbar (Werteliste je Haushalt).
10. **Ziel-Kaskade:** Jahresziel → Quartal → Woche → Tag automatisch abgeleitet (Zahlenziele anteilig, Termin-Ziele als Meilensteine im Quartal), abgeleitete Ziele sind als „abgeleitet“ markiert; auf jeder Ebene zusätzlich eigene Ziele anlegbar.
11. **Routinen:** Trennung **Privat / Business**, **Blöcke** je Wochentag (wann Privat, wann Arbeit — Wochenvorlage je Person), Routinen **je Person** (Malin, Kevin) und **gemeinsam** zuschaltbar, **Rhythmus** täglich · 3×/Woche · wöchentlich · monatlich · quartalsweise · halbjährlich · jährlich (z. B. Arzt, Steuererklärung) mit Fälligkeit, **Home zeigt die heute fälligen Routinen** (Widget, abhakbar), Reihenfolge per Pfeil.

## Entscheidungen Kevin (27.09. abends)
- Akte: **Reiter in der Akte** (Überblick · Stammdaten · Beziehung · Verlauf · Datenschutz), kompakter Kopf, je Reiter zwei Spalten.
- Fixkosten umstufen: **nur dieser Posten** (keine Empfänger-Regel).
- Ziel-Kaskade: **Zahlen anteilig, Termin-Ziele als Meilensteine**, Abgeleitetes markiert, eigene Ziele je Ebene.
- Business-Einheiten: **Selbstständigkeit · KD Ventures · Kunden** vorbelegt, **frei anlegbar** dazu.

## Prüfung & Abgabe
tsc/lint/vitest je Paket, Prüfbau 3011 mit Wegwerfkonto, Klick-Durchlauf, dann Kevin zeigt es Malin lokal. Upload erst auf Kevins Wort.
