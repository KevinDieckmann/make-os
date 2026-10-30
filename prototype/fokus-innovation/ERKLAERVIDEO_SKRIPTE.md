# Drei Erklärvideos: Sichtbarkeit · Vertrieb · Innovation

Skripte für Gemini (Veo), Stand 30.10.2026. Jedes Video besteht aus 9 Szenen zu je 8 Sekunden, also rund 72 Sekunden. Jede Szene wird in Gemini als eigener Clip erzeugt. Sprecher, Untertitel, Texte und Logo kommen erst im Schnitt dazu.

## Unsere CI auf einen Blick

- **Farben:** Nacht `#0B0C0F` (dunkle Szenen, Abspann) · Papier `#F6F4F0` und Sand `#EDE6DA` (helle Szenen) · Tinte `#111316` (Schrift auf Papier) · Hell `#F2F3F3` (Schrift auf Dunkel). Akzent nur der Kern-Ton: Lavendel `#A78BFA` auf Dunkel, Violett `#7C3AED` auf Papier, sparsam, nie als Fläche.
- **Schrift:** Schibsted Grotesk für Untertitel, Texte im Schnitt und Abspann (wie auf fokusinnovation.de). Titel kräftig (600), Fließtext normal, keine zweite Schrift.
- **Logo:** offener Ring, Kern in Lavendel, kleiner Punkt mittig in der Lücke oben rechts. Datei `assets/zeichen.svg` (auf Dunkel) bzw. `assets/zeichen-papier.svg` (auf Papier). Nie verzerren, nie einfärben, nie nachzeichnen lassen.
- **Wortmarke:** „FOKUS“ in Versalien mit weitem Abstand, darunter „Innovation“. **Claim:** „Fortschritt braucht Fokus.“
- **Ton:** Sie-Ansprache, ruhig und selbstbewusst, kurze Sätze, keine Superlative.
- **Bildsprache:** ruhig, dokumentarisch, echtes Licht; dunkle Szenen mit dem weichen violetten Raum-Schein wie im Film der Startseite; kein Neon, keine Roboter, keine leuchtenden Gehirne.
- **Kennzeichnung:** im Abspann immer „Stimme: KI · Bilder teilweise KI-generiert“.

## So erstellen Sie die Videos in Gemini

1. **Gemini öffnen und die Videoerstellung (Veo) wählen.** Format 16:9. Für alle Szenen eines Videos dieselben Einstellungen verwenden.
2. **Prompt je Szene zusammensetzen:**
   - den Stilblock (unten, unverändert)
   - den Bild-Prompt der Szene (Spalte „Bild“)
   - die Zeile `Avoid:` mit dem Negativ-Prompt
3. **Einen Clip von 8 Sekunden erzeugen.** Je Szene zwei bis drei Varianten erzeugen und die ruhigste nehmen.
4. **Jeden Clip prüfen:** keine lesbaren Texte, Logos oder Bildschirme, keine erkennbaren Gesichter, keine verformten Hände. Wenn doch, neu erzeugen.
5. **Ton aus Gemini nicht verwenden.** Der Stilblock verlangt nur Raumklang. Sprecher und Musik kommen im Schnitt dazu.
6. **Im Schnittprogramm zusammensetzen.** Das geht in DaVinci Resolve, CapCut oder iMovie:
   - die Clips in der Reihenfolge der Tabelle
   - den Sprechertext als KI-Stimme (deutsch, wörtlich wie in der Tabelle)
   - Untertitel
   - die Texte aus der Spalte „Text im Schnitt“
   - den Abspann
7. **KI kennzeichnen:** Im Abspann steht immer „Stimme: KI · Bilder teilweise KI-generiert“.

## Für alle drei Videos gleich

### Stilblock (vor jeden Szenen-Prompt, unverändert kopieren)

```
Calm documentary realism, editorial and serious, like a short film for a consultancy, not a tech ad.
Natural light, soft contrast, fine film grain, 35mm look, shallow depth of field, slow camera moves
(push-in, gentle dolly, a little handheld). Real, believable places in Germany: small office, meeting
room, workshop, kitchen table, conference hall. Colour palette: deep night tones #0B0C0F, warm paper
tones #F6F4F0 and sand #EDE6DA, neutral greys, and a single muted lavender accent #A78BFA used
sparingly. In night scenes a very soft, wide lavender-indigo glow fills the space behind the centre
of the frame, edges stay dark and calm. People shown from behind, in silhouette, as hands, or out of
focus — no recognisable faces, no real persons, no celebrities. No text, no letters, no logos, no
readable screens or documents. One continuous 8-second shot without cuts. Ambient room sound only,
no dialogue, no voice, no music.
```

### Negativ-Prompt (immer als `Avoid:` anhängen)

```
neon, glow effects, lens flares, holograms, robots, sci-fi, futuristic UI, floating data streams,
circuit boards, matrix code, glowing brains, AI imagery, stock-photo smiles, handshake clichés,
rockets, light bulbs, trophies, flags, readable text, letters, numbers on screens, logos, brand names,
watermarks, recognisable faces, distorted hands, extra fingers, cartoon, 3D render look,
oversaturated colours, fast cuts, shaky chaos, dialogue, spoken words, music
```

### Stimme, Untertitel, Musik

- **Stimme:** ruhige deutsche KI-Stimme, warm und sachlich, mittleres Tempo. Sie siezt, spricht in kurzen Sätzen und verwendet keine Superlative.
- **Untertitel:** immer an, deutsch, in einer Grotesk nahe Schibsted Grotesk.
  - weiß auf dunklen Szenen, Tinte #111316 auf hellen Szenen
  - im unteren Drittel, höchstens zwei Zeilen
- **Musik:** reduziertes Klavier mit leisen Streichern, kein Trailer-Pathos.
  - Szenen 1–3: sparsam und unruhig
  - ab Szene 4: ein ruhiger, fester Puls
  - in den Szenen 8 und 9: öffnet sie sich leicht
- **Geräusche:** leise und nie laut, zum Beispiel Telefonvibration, Tastatur, Papier, Stimmengemurmel.
- **„Text im Schnitt“:** Diese Spalte gibt es pro Szene. Der Text erscheint ruhig in der Bildmitte und bleibt 3–4 Sekunden stehen.

### Abspann (Szene 9 in jedem Video)

- Die Szene ist ein dunkler Hintergrund #0B0C0F (Platte aus Gemini). Das Logo kommt aus der Datei `assets/zeichen.svg`:
  - Ring und lila Kern
  - der Punkt läuft durch die Lücke und bleibt mittig in der Lücke stehen
- **Darunter:**
  - die Wortmarke „FOKUS Innovation“
  - der Claim „Fortschritt braucht Fokus.“
  - der Aufruf des jeweiligen Videos
- **Unten links, klein:** „Stimme: KI · Bilder teilweise KI-generiert“

### Feste Regeln

- **Nie nennen:** den Namen unserer eigenen Software, Partnerprodukte, Kunden, Investoren und fremde Vorlagen, auf denen etwas aufbaut.
- **Keine echten Personen:** Kevin und Malin werden nicht als KI-Personen erzeugt. Gibt es echte Aufnahmen von ihnen, ersetzen diese die Szenen 5–7.
- **Höchstens eine Zahl je Video**, nur die angegebene, mit Quelle. Keine Preise.
- **Keine Technik-Klischees:** KI wird nur als unscharfer Bildschirm oder als Ergebnis auf Papier gezeigt, nie als Roboter, Gehirn oder Lichtgitter.
- **Verbotene Wörter:** Dashboard, Tool, Disruption, Reporting, „einfach zu bedienen“.

### Was am Ende herauskommt (je Video)

1. **Hauptfassung:** 16:9, 1920 × 1080, 24 fps, rund 72 s. Stimme bei −16 LUFS, Untertitel zusätzlich als SRT-Datei.
2. **Hochformat 9:16** (1080 × 1920, rund 40 s): Szenen 1, 3, 4, 8 und 9, Untertitel groß in der Mitte.
3. **Vorschaubild:** das ruhigste Bild aus Szene 4, ohne Text. Der Titel kommt im Schnitt dazu.

---

## Video 1 · Sichtbarkeit

**Kernbotschaft (in den ersten 8 Sekunden):** Entschieden wird, bevor Sie im Raum sind.
**Offene Frage:** In Szene 2 fragen wir: „Steht Ihr Name auf der Liste?“ Szene 8 beantwortet die Frage.
**Aufruf:** „Sichtbarkeitstest starten · fokusinnovation.de“

**Warum es wirkt:**
- **Einstieg beim Problem:** Wer sein Problem spürt, aber noch keine Lösung kennt, wird bei genau diesem Problem abgeholt (Schwartz, *Breakthrough Advertising*: Besucher, die ihr Problem kennen).
- **Selbstbezug:** Die Frage „Steht Ihrer darauf?“ zwingt zum Bezug auf sich selbst. Was Menschen auf sich beziehen, behalten sie besser (Rogers, Kuiper & Kirker 1977).
- **Konkrete Szene:** Die Liste mit drei Namen ist ein konkretes Bild statt der abstrakten Aussage „Sichtbarkeit fehlt“ (Heath & Heath, *Made to Stick*).
- **Offene Frage:** Sie bleibt bis Szene 8 offen. Unterbrochenes will man zu Ende sehen (Ovsiankina-Effekt, Ghibellini & Meier 2025).
- **Der Kunde ist der Held:** Fokus Innovation tritt erst in Szene 4 als Begleiter auf (Miller, *StoryBrand*).
- **Blick zur Mitte:** Der Lichtpunkt, der in Szene 1 in der Bildmitte aufgeht, holt den Blick dorthin. Ein Bewegungsbeginn fängt Aufmerksamkeit (Abrams & Christ 2003).

| # | Zeit | Bild (Prompt für Gemini) | Kamera | Sprecher (deutsch, wörtlich) | Text im Schnitt |
|---|---|---|---|---|---|
| 1 | 0–8 s | Late evening in a quiet apartment. A person seen from behind sits at a laptop on a kitchen table, scrolling through search results that are completely blurred. Several soft, unreadable answer cards appear on the screen. In the centre of the frame a single small lavender point of light slowly fades in within the soft room glow. | slow push-in from behind | „Entschieden wird, bevor Sie im Raum sind. Ihr nächster Kunde sucht gerade nach einer Lösung, ohne Sie zu fragen.“ | „Entschieden wird, bevor Sie im Raum sind.“ |
| 2 | 8–16 s | Morning light on the same table. A hand writes a short list of three lines on a paper notepad (lines unreadable, no letters), pauses, and taps the pen on the paper. A coffee cup, the laptop closed. | macro, gentle dolly | „Gelesen wird überall, gefragt wird auch die KI. Am Ende stehen drei Namen auf einer Liste. Steht Ihrer darauf?“ | „57 % sahen in einer Woche KI-Antworten in Suchmaschinen.“ Darunter klein: „Quelle: Reuters Institute, Generative AI and News Report 2026, Befragung in neun Ländern (Deutschland nicht darunter)“ |
| 3 | 16–24 s | A small, tidy company office in the evening. A carefully made product (neutral object, no brand) stands on a shelf. A founder seen from behind looks at a laptop showing a website with long, dense blocks of text (blurred, unreadable) and leans back, thoughtful. | static, very slow push-in | „Ihr Produkt ist gut. Aber Ihre Website erklärt es erst im dritten Absatz, und in der Fachpresse sprechen andere.“ | — |
| 4 | 24–32 s | Dark ground #0B0C0F. Many small grey paper circles and notes drift slowly and without direction, then gather calmly towards one point in the centre, where a soft lavender light sits. The wide lavender-indigo glow tightens around the centre. | top-down, slow rotation | „Sichtbar wird, wer in einem Satz sagt, was er löst. Diesen Satz schärfen wir mit Ihnen.“ | „Positionierung“ |
| 5 | 32–40 s | A bright meeting room with paper tones. Two people seen from behind sit at a table with paper sketches (unreadable). Then a laptop shows a calm, light website with a large image and generous white space (blurred, no text). A hand scrolls once. | gentle cut after 4 s, slow push-in | „Daraus bauen wir eine Website, die in fünf Sekunden zeigt, was Sie lösen, und Anfragen bringt.“ | „Homepages“ |
| 6 | 40–48 s | A small video set in an office: a camera on a tripod in the foreground, soft daylight, a person out of focus in the background explaining something with calm hand movements in front of a whiteboard (unreadable). | slow lateral dolly past the camera | „Videos erklären Ihr Produkt, auch wenn Sie gerade nicht da sind. Einmal gedreht, arbeiten sie jeden Tag.“ | „Videos“ |
| 7 | 48–56 s | Hands leaf through a trade magazine on a wooden table (pages unreadable). Then: a small conference stage seen from behind the audience, a speaker in silhouette in warm stage light, rows of listeners out of focus. | gentle cut after 4 s, slow push-in towards the stage | „Mit PR und Kommunikation kommen Sie dorthin, wo Ihre Kunden lesen und zuhören: in Fachmedien und auf Bühnen.“ | „PR und Kommunikation“ |
| 8 | 56–64 s | The kitchen table from scene 2 in daylight. The paper list with three lines lies there, one line is now circled in lavender ink. A hand picks up a phone and lifts it to make a call. | slow pull-back | „Wenn der nächste Kunde sucht, steht Ihr Name schon auf der Liste. Dann sind Sie im Raum.“ | — |
| 9 | 64–72 s | Dark background #0B0C0F, nothing else, a very soft lavender glow in the centre (plate for the end card). | still | „Fokus Innovation. Fortschritt braucht Fokus. Machen Sie den Sichtbarkeitstest auf fokusinnovation.de.“ | Abspann mit Logo, „FOKUS Innovation“, „Fortschritt braucht Fokus.“, „Sichtbarkeitstest starten · fokusinnovation.de“, klein: „Stimme: KI · Bilder teilweise KI-generiert“ |

---

## Video 2 · Vertrieb

**Kernbotschaft (in den ersten 8 Sekunden):** Ihr Vertrieb ist eine Person.
**Offene Frage:** In Szene 4 fragen wir: „Und wenn Sie zwei Wochen ausfallen?“ Szene 8 beantwortet die Frage.
**Aufruf:** „Vertriebscheck starten · fokusinnovation.de“

**Warum es wirkt:**
- **Einstieg beim Problem:** Der erste Satz nennt das Problem, das Gründer kennen, aber selten so aussprechen. Der Vertrieb hängt an ihnen selbst (Schwartz, Besucher, die ihr Problem kennen).
- **Konkrete Szene:** Das Messegespräch und das Angebot, das seit drei Wochen im Entwurf liegt, sind Szenen, in denen man sich wiedererkennt (Heath & Heath).
- **Verlust, ruhig benannt:** Der Auftrag geht an den, der zuerst nachfasst. Ein Verlust wirkt stärker als derselbe Gewinn (Tversky & Kahneman 1981). Er wird ruhig benannt, ohne Drohkulisse.
- **Offene Frage:** „Was, wenn Sie ausfallen?“ bleibt drei Szenen lang offen und wird in Szene 8 mit demselben Satz beantwortet (Ovsiankina-Effekt).
- **Der Gründer bleibt der Held:** Wir bauen das System und treten zurück, sobald das Team selbst abschließt (StoryBrand).

| # | Zeit | Bild (Prompt für Gemini) | Kamera | Sprecher (deutsch, wörtlich) | Text im Schnitt |
|---|---|---|---|---|---|
| 1 | 0–8 s | Night in a small office. A founder seen from behind juggles a laptop, a notebook and a coffee cup at a cluttered desk. On the desk a phone lights up silently with a soft lavender glow in the centre of the frame (screen unreadable). | slow push-in from behind | „Ihr Vertrieb ist eine Person. Und diese Person führt nebenbei das ganze Unternehmen.“ | „Ihr Vertrieb ist eine Person.“ |
| 2 | 8–16 s | Close-up of a laptop showing an open document draft and an inbox (completely blurred, unreadable). Next to it a desk calendar whose pages slowly turn over by themselves, three weeks passing (no readable dates). | macro, gentle dolly | „Das Gespräch auf der Messe lief gut. Das Angebot liegt seit drei Wochen im Entwurf.“ | — |
| 3 | 16–24 s | Split mood: in a bright office elsewhere, a person seen from behind makes a short phone call and ticks off a line on a printed list (unreadable). Cut to the founder's desk at night: the phone lies there silent. | gentle cut after 4 s | „Den Auftrag bekommt, wer zuerst nachfasst. Nicht immer das bessere Produkt.“ | „47,3 % der Selbständigen und Kleinstunternehmen klagten im Juli 2026 über fehlende Aufträge.“ Darunter klein: „Quelle: ifo Institut, 07.08.2026“ |
| 4 | 24–32 s | The founder's office in daylight, the desk chair empty, a jacket gone from the hook. On the desk the phone vibrates again and again, nobody answers. | static long shot | „Und wenn Sie zwei Wochen ausfallen? Dann steht der Vertrieb still, weil er in Ihrem Kopf liegt.“ | — |
| 5 | 32–40 s | A bright workshop room. A whiteboard with boxes and arrows (unreadable), paper notes being sorted into clear columns by two people seen from behind. Warm daylight, focused calm. | slow push-in towards the whiteboard | „Im Tagesworkshop legen wir an einem Tag fest: Zielkunden, Ablauf, nächste Schritte. Danach wissen Sie, woran es hängt.“ | „Tagesworkshop“ |
| 6 | 40–48 s | A small team at work: one person makes a call and writes a short note, another moves a paper card from one column to the next on a wall board (unreadable). Friday afternoon: a short meeting at a table with a printed one-page overview showing simple bars (no digits). | gentle cuts every 3–4 s | „Als Head of Sales bauen wir Ihren Vertrieb mit System: Ablauf, Kennzahlen, Wochenbericht. Jede Anfrage bekommt einen nächsten Schritt.“ | „Head of Sales“ |
| 7 | 48–56 s | A new team member seen from behind at a desk, an experienced colleague sits next to them and points calmly at a printed conversation guide (unreadable). Then the new team member takes a call alone while the colleague steps back. | slow lateral dolly | „Als Chief Sales Officer führen wir Ihr Team, bis es selbst abschließt. Dann treten wir zurück.“ | „Chief Sales Officer“ |
| 8 | 56–64 s | The founder's office from scene 4 in daylight, chair still empty. The phone rings and a team member picks it up calmly, notes something and nods. On the wall a calendar is well filled (unreadable). | slow pull-back | „Und wenn Sie zwei Wochen ausfallen? Ihr Vertrieb läuft weiter. Er ist keine Person mehr, sondern ein System.“ | — |
| 9 | 64–72 s | Dark background #0B0C0F, nothing else, a very soft lavender glow in the centre (plate for the end card). | still | „Fokus Innovation. Fortschritt braucht Fokus. Machen Sie den Vertriebscheck auf fokusinnovation.de.“ | Abspann mit Logo, „FOKUS Innovation“, „Fortschritt braucht Fokus.“, „Vertriebscheck starten · fokusinnovation.de“, klein: „Stimme: KI · Bilder teilweise KI-generiert“ |

---

## Video 3 · Innovation

**Kernbotschaft (in den ersten 8 Sekunden):** KI braucht Struktur.
**Offene Frage:** Szene 1 fragt: „Was davon spart wirklich Zeit?“ Szene 8 beantwortet die Frage.
**Aufruf:** „Innovations-Check starten · fokusinnovation.de“

**Warum es wirkt:**
- **Einstieg bei einem bekannten Zustand:** Alle probieren KI aus, jeder anders, niemand weiß, was es bringt. Das holt Zuschauer ab, die das Problem kennen (Schwartz).
- **Konkrete Szene:** Das Angebot, für das Zahlen aus drei Listen und zwei Postfächern zusammengesucht werden, ist ein Bild aus dem eigenen Alltag (Heath & Heath, Selbstbezug nach Rogers u. a. 1977).
- **Ruhig benannter Verlust:** KI ohne Struktur beschleunigt nur das Durcheinander (Tversky & Kahneman).
- **Die eine Zahl stützt diese Aussage:** Die Aufbereitung der Daten ist für die Hälfte der KI-Nutzer ein großer Kostenpunkt.
- **Offene Frage:** Szene 1 fragt, Szene 8 antwortet: „Jetzt können Sie es messen.“ (Ovsiankina-Effekt).

| # | Zeit | Bild (Prompt für Gemini) | Kamera | Sprecher (deutsch, wörtlich) | Text im Schnitt |
|---|---|---|---|---|---|
| 1 | 0–8 s | Evening in an open office. Several laptops on different desks each show a different chat window (completely blurred, unreadable). A person seen from behind switches between two of them. In the centre of the frame a small lavender point of light fades in within the soft room glow. | slow push-in | „Alle reden über KI. In Ihrem Team nutzen sie einige, jeder anders. Was davon spart wirklich Zeit?“ | „KI braucht Struktur.“ |
| 2 | 8–16 s | Hands search through three paper folders, a printed spreadsheet and a phone with an inbox (all unreadable) to put together a single page. Sticky notes, a pen, a cold desk lamp. | macro, gentle dolly | „Für ein einfaches Angebot suchen Sie Zahlen aus drei Listen, zwei Postfächern und dem Kopf eines Kollegen zusammen.“ | — |
| 3 | 16–24 s | Dark table, paper cards and notes lie scattered and overlapping. A hand tries to arrange them, but they slide back into disorder. | top-down, very slow push-in | „KI macht daraus nichts Besseres. Ohne klare Abläufe und saubere Daten beschleunigt sie nur das Durcheinander.“ | „50 % der Unternehmen, die KI nutzen, nennen die Aufbereitung von Daten als großen Kostenpunkt.“ Darunter klein: „Quelle: Bitkom, KI-Studie 2026“ |
| 4 | 24–32 s | Dark ground #0B0C0F. The same paper cards slowly arrange themselves into clean, even rows. In the centre a calm lavender point of light, the wide glow tightens around it. | top-down, slow rotation | „Deshalb fangen wir bei den Abläufen an: Wer macht was, wann, mit welchen Daten? Erst dann kommt KI.“ | „Erst Struktur, dann KI.“ |
| 5 | 32–40 s | A bright meeting room. A team seen from behind maps a process on a whiteboard with boxes and arrows (unreadable). Then: a calm shelf with neatly labelled folders (labels unreadable), everything in one place. | gentle cut after 4 s | „Wir bringen Wissen, Abläufe und Daten an einen Ort. Darauf können KI und Automatisierung sicher zugreifen.“ | „Abläufe und Daten“ |
| 6 | 40–48 s | A person writes at a laptop, a draft fills the screen quickly (blurred, unreadable). A colleague next to them reads a printed page, makes one note with a pen and nods. | slow push-in over the shoulder | „Dann übernimmt KI Routine: Angebote, Antworten, Wissen auf Abruf. Mit klaren Regeln, wer was wofür nutzt.“ | „KI im Alltag“ |
| 7 | 48–56 s | Friday afternoon, an empty desk. A phone lights up briefly (unreadable), a calendar on a screen fills in by itself (blurred), and a printer softly outputs a one-page weekly overview with simple bars (no digits). Nobody touches anything. | static, very slow push-in | „Was ohne Handarbeit laufen kann, läuft automatisch: Anfragen landen am richtigen Ort, Erinnerungen kommen von selbst.“ | „Automatisierung“ |
| 8 | 56–64 s | The open office from scene 1 in daylight. The team looks at one shared screen (blurred), relaxed. One person puts on a jacket and leaves on time. | slow pull-back | „Und was davon spart wirklich Zeit? Jetzt können Sie es messen. Und Ihr Team geht pünktlich nach Hause.“ | — |
| 9 | 64–72 s | Dark background #0B0C0F, nothing else, a very soft lavender glow in the centre (plate for the end card). | still | „Fokus Innovation. Fortschritt braucht Fokus. Starten Sie mit dem Innovations-Check auf fokusinnovation.de.“ | Abspann mit Logo, „FOKUS Innovation“, „Fortschritt braucht Fokus.“, „Innovations-Check starten · fokusinnovation.de“, klein: „Stimme: KI · Bilder teilweise KI-generiert“ |

---

## Quellen der Zahlen (jeweils nur eine je Video)

- **Sichtbarkeit:**
  - Reuters Institute for the Study of Journalism (Universität Oxford), „Generative AI and News Report 2026“, 29.10.2026
  - Befragung in neun Ländern durch YouGov, Deutschland ist nicht darunter
  - https://reutersinstitute.politics.ox.ac.uk/generative-ai-and-news-report-2026-standalone-tools-information-infrastructure
- **Vertrieb:**
  - ifo Institut, „Knapp die Hälfte der Selbständigen klagt über Auftragsmangel“, 07.08.2026
  - https://www.ifo.de/fakten/2026-08-07/knapp-die-haelfte-der-selbstaendigen-klagt-ueber-auftragsmangel
- **Innovation:**
  - Bitkom, KI-Studie 2026, 14.09.2026
  - https://www.bitkom.org/Presse/Presseinformation/Erstmals-nutzt-Mehrheit-Unternehmen-KI

## Quellen der Psychologie

- **Schwartz, E.** (1966): *Breakthrough Advertising.* Darin die Stufen, wie bewusst Kunden ihr Problem und die Lösung kennen.
- **Rogers, T. B., Kuiper, N. A., Kirker, W. S.** (1977): Self-reference and the encoding of personal information. *JPSP* 35(9).
- **Heath, C., Heath, D.** (2007): *Made to Stick,* Prinzip „konkret“.
- **Tversky, A., Kahneman, D.** (1981): The framing of decisions and the psychology of choice. *Science* 211.
- **Ghibellini, R., Meier, B.** (2025): Ovsiankina-Effekt. Unterbrochenes wird gern fortgesetzt.
- **Miller, D.** (2017): *Building a StoryBrand.* Der Kunde ist der Held, die Marke der Begleiter.
- **Abrams, R. A., Christ, S. E.** (2003): Motion onset captures attention. *Psychological Science* 14.
- **Fessenden, T.** (2018, Nielsen Norman Group): Scrolling and Attention. Der erste Bildschirm bekommt den größten Teil der Aufmerksamkeit. Deshalb steht die Kernbotschaft immer in den ersten 8 Sekunden.
