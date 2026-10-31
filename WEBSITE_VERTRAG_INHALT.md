# Vertrag: Inhalte der Website aus MAKE OS

Gepflegt unter Markttraktion › Website. Die statische Website liest nur diese drei offenen Wege (nur GET/HEAD, ohne Sitzung, nichts Persönliches):

| Weg | Antwort |
|---|---|
| `GET /api/website/inhalt` | JSON unten · `ETag` + `304` · `Cache-Control: public, max-age=300` · `X-Robots-Tag: noindex` · 429 bei zu vielen Abfragen |
| `GET /api/website/bild/<id>` | das Bild (JPEG/PNG/WebP, ≤ 8 MB, Ansichtsgröße ≤ 1568 px) — nur sichtbar + mit Alt-Text + in den Medien für „Website“ freigegeben, sonst 404 ohne Text |
| `GET /erstgespraech` | 302 auf die gewählte Buchungsseite · ohne Wahl auf die EINZIGE aktive Buchungsseite mit Adresse `erstgespraech-…` · sonst 404-Seite „Gerade sind keine Termine buchbar“ |

## Felder von `/api/website/inhalt`

Nur sichtbare Einträge, sortiert nach `rang`. Fehlt ein Feld, gibt es den Wert nicht.

- `ok`: `true` · `stand`: Fingerabdruck des Inhalts
- `angebote[]`: `id` (= Kennung der Seite, `[a-z0-9-]`), `bereich`, `titel`, `kurz?`, `preisText?` (wenn da: nicht leer, ≤ 60 Zeichen, ohne `<` `>`), `preisNetto?` (Cent), `ab?`, `monatlich?`, `bald?`, `seite?` (`/…` oder `https://…`)
- `bausteine[]`: `id`, `titel`, `bereich`, `preisNetto` (Cent, ganze Zahl > 0), `kurz?`, `seite`, `paket?` (Kennungen der Teile) — der Katalog `unterlagen/bausteine/katalog.json` mit den Anpassungen aus MAKE OS; ausgeblendete fehlen
- `events[]`: `id`, `titel`, `datum` (`JJJJ-MM-TT` oder `JJJJ-MM-TTThh:mm`, Berliner Wandzeit), `bis?`, `ort?`, `format?`, `anmeldung?` (`https://…` oder `/…`) — nur eigene Abende, geplant oder eingeladen, ab heute; nie Gäste
- `faq[]`: `id`, `frage`, `antwort`, `bereich?`, `gruppe?`
- `fakten[]`: `titel?`, `text` (Zeilen für llms.txt)
- `texte{}`: Schlüssel → Text (≤ 2.000 Zeichen), z. B. `events.einleitung`, `events.termine`
- `bilder[]`: `id`, `url` (`/api/website/bild/<id>`), `alt`

Beim Speichern prüft MAKE OS dieselben Formate (400 mit Satz) — es wird nie etwas Ungültiges ausgeliefert.

## Beispiel (erfunden)

```json
{
  "ok": true,
  "stand": "k3j9x0a1b2c3",
  "angebote": [{ "id": "beispiel-workshop", "bereich": "vertrieb", "titel": "Beispiel-Workshop", "kurz": "Ein Tag, ein Plan.", "preisText": "ab 1.000 €", "preisNetto": 100000, "ab": true, "seite": "/vertrieb/beispiel-workshop/" }],
  "bausteine": [{ "id": "beispiel-vorlage", "titel": "Beispiel-Vorlage", "bereich": "vertrieb", "preisNetto": 4900, "seite": "/bausteine/beispiel-vorlage/" }],
  "events": [{ "id": "we-0000", "titel": "Beispiel-Abend", "datum": "2026-12-03T18:30", "ort": "Beispielstadt", "format": "Dinner", "anmeldung": "/events/" }],
  "faq": [{ "id": "wq-0000", "frage": "Wie geht es los?", "antwort": "Mit einem Erstgespräch.", "gruppe": "Bevor Sie fragen" }],
  "fakten": [{ "titel": "Sitz", "text": "Beispielstadt" }],
  "texte": { "events.einleitung": "Wir bringen Menschen zusammen." },
  "bilder": [{ "id": "wb-0000", "url": "/api/website/bild/wb-0000", "alt": "Gäste im Gespräch" }]
}
```

Startwerte: `website/startwerte-inhalt.json` (vom Website-Bau) — in MAKE OS übernimmt ein Inhaber sie unter Website › Angebote & Preise (Vorschau zuerst, nur Fehlendes, nie überschreiben).
