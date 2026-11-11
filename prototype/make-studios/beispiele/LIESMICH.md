# Beispielseiten von MAKE Studios

Unter `beispiele/<name>/` liegen ausgearbeitete Beispielseiten. Sie hängen unter der Hauptseite (Bereich „Beispielseiten“) und zeigen, wie ein fertiger Auftritt aussehen kann.

## Neue Seite anlegen

1. Ordner `_vorlage` kopieren und kurz benennen, zum Beispiel `cafe-am-markt` (nur Kleinbuchstaben, Ziffern und Bindestriche).
2. In `index.html` den Titel setzen: `Beispiel · Name des Betriebs · MAKE Studios`.
3. Inhalt in `<main>` bauen, Design in `seite.css` derselben Seite. Eigene Bilder und Schriften legen Sie in den Ordner der Seite.
4. Die Leiste am Ende (`ms-platz` und `ms-leiste`) bleibt unverändert.
5. Prüfen: `node beispiele/pruefen.mjs` (aus `prototype/make-studios`).
6. Erst wenn die Seite steht, auf der Hauptseite verlinken, zum Beispiel an der passenden Entwurfskarte mit `href="beispiele/<name>/"`. Vorher gibt es keinen Link dorthin.

## Regeln

- Erfundener Betrieb, erfundene Namen, deutlich als „Beispiel“ gekennzeichnet (Titel und Leiste).
- Zahlen und Aussagen nur mit echter Quelle; keine Preise.
- Ansprache mit „Sie“, kein Gedankenstrich „—“ im sichtbaren Text, MAKE immer in Großbuchstaben.
- Kein Inline-Skript, kein `<style>`-Block, keine `style`- oder `on…`-Attribute. Skripte als eigene Datei mit `defer`.
- Schriften selbst ausliefern (keine fremden Schriftdienste), keine Tracker, keine Formulare, die Daten versenden.
- `noindex, nofollow` bleibt gesetzt.

## Verbindung zur Hauptseite

- Das Zeichen und die Wortmarke in der Leiste führen zu `../../#beispielseiten` (Abschnitt „Beispielseiten“ auf der Hauptseite).
- „Erstgespräch“ führt zu `../../#erstgespraech` und öffnet dort das Buchungsfenster. Mit `#erstgespraech-gastro`, `-agentur`, `-immobilien` oder `-andere` ist die Branche schon gewählt (Bau, Handwerk und Sanierung laufen über `-andere`).
