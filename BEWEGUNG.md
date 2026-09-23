# Bewegung und Zustand — was den Empfang lebendig macht

Kevin, 07.09.2026: *„da funktioniert ja wirklich noch gar nichts auf Level und
das Ganze kann viel ästhetischer sein … das ganze UX-Design ist ja ein Grauen,
da ist ja nichts Lebendiges dran."*

Berechtigt. Der Empfang war ein Bild, ein Absatz und ein Eingabefeld. Nichts
davon wusste, ob jemand im Raum ist.

Grundlage ist eine Recherche zum Stand der Technik (ChatGPT Advanced Voice,
ElevenLabs, assistant-ui, orb-ui, Google/Gemini, Linear, Motion.dev,
Streamdown). Unten steht, was davon eingebaut wurde und **warum** — die
Begründung ist wichtiger als die Liste, weil sie sagt, was man beim nächsten
Mal nicht wieder anfassen muss.

---

## Die zwei Regeln, aus denen der Rest folgt

**1. Die Oberfläche muss zeigen, was passiert — ohne dass man es liest.**
Ein Bildschirm, der bei Stille und beim Sprechen gleich aussieht, ist eine
Anzeige, kein Gegenüber.

**2. Alles, was sich bewegt, kostet Rechenzeit — also darf sich nur bewegen,
was etwas bedeutet.** Das Gerüst des Hirns (rund 400 Elemente) wird nicht je
Bild neu gebaut, sondern nur, wenn sich Zustand oder Auslastung ändern.

---

## 1 — Der Orb reagiert auf die echte Stimme
`hooks/useLautstaerke.ts`, `lib/make-one/pegel.ts`

Web-Audio-Analyse des Mikrofons. Nicht der Gesamtmittelwert, sondern nur das
Sprachband (85 Hz – 1,4 kHz): sonst schlägt der Kranz beim Lüfter aus.
`autoGainControl: false`, weil der Browser sonst laut und leise gleich laut
macht — und genau der Unterschied ist hier die ganze Information.

## 2 — Hüllkurve statt Rohwert
`lib/make-one/pegel.ts`

Schnell hoch (0,35), langsam runter (0,08). Ohne sie folgt der Ausschlag jedem
Stimmbandschlag und flackert. Mit ihr fühlt es sich an wie ein Pegelmesser.

## 3 — Beim Zuhören schrumpft der Orb, beim Sprechen wächst er
`components/os/JarvisHirn.tsx`, Feld `richtung` in `TON`

Der wichtigste Einzelgriff. Beide Zustände hängen an einem Pegel — wenn beide
wachsen würden, wüsste man nie, wer gerade dran ist.

## 4 — Vier Zustände mit eigener Farbe
`ruht` Türkis · `hoert` kühles Blau · `denkt` Bernstein · `spricht` helles Türkis

Bernstein ist ausschließlich für „denkt nach" reserviert — der einzige Zustand,
in dem Kevin nichts tun kann und eine andere Farbe echte Information trägt.

## 5 — Zustandswechsel werden nachgezogen, nicht geschaltet
`hooks/useAtem.ts`, `useNachziehen()`

Rund 350 ms. Ein harter Wechsel liest sich wie ein ausgetauschtes Bild, ein
Übergang wie dasselbe Wesen in einer anderen Verfassung.

## 6 — Der Kern ist eine verformte Fläche, kein Kreis
`blob()` in `JarvisHirn.tsx`

Drei überlagerte Sinuswellen mit teilerfremden Frequenzen (0,9 / 0,61 / 1,37).
Das Muster wiederholt sich erst nach Minuten — das Auge findet keinen Rhythmus
und liest es als „lebt". Kein Zufall im Spiel: Server und Browser müssen
dieselben Koordinaten bekommen.

## 7 — Der Stimmkranz
60 Striche um den Kern, jeder mit eigener Phase. Der eine Ort, an dem man
SIEHT, dass zugehört wird. Ohne Pegel liegt er flach an — er verschwindet
nicht, er ruht.

## 8 — Atem statt Puls
4–6 Sekunden Periode. Alles unter zwei Sekunden liest das Auge als Puls, und
Puls heißt Alarm.

## 9 — Farbsaum wie durch eine Linse
Zwei versetzte Kopien des Kerns in Bernstein und Weiß, additiv überlagert.
Nimmt der Grafik die perfekte digitale Sauberkeit.

## 10 — Zustandswechsel als einmalige Welle
`.hirn-welle`, per `key={zustand}` neu eingehängt, damit sie wirklich jedes Mal
neu anläuft.

## 11 — Vignette
Die billigste Einzelmaßnahme im ganzen Katalog: macht den Orb ohne jede
Änderung am Orb zum optischen Zentrum.

## 12 — Der Raum nimmt die Zustandsfarbe an
Zwei gestapelte Lichtschichten hinter dem Hirn. Wenn Jarvis denkt, wird der
ganze Bildschirm bernsteinfarben — das sieht man aus zwei Metern.

## 13 — Filmkorn, 2,8 %
Bricht das Banding in den Verläufen. Wandert alle 110 ms um ganze Pixel:
statisches Korn liest sich als Schmutz, bewegtes als Filmmaterial.
`background-position` ist dafür die günstigste Eigenschaft.

## 14 — Parallaxe mit Nachlauf
Außen und innen wandern gegenläufig — Tiefe ohne eine einzige Schattenfläche.
Nur auf Geräten mit echtem Zeiger.

## 15 — Text kommt Wort für Wort an
`Ankunft` in `JarvisStart.tsx`, 180 ms, Deckkraft + Weichzeichner.
Der Weichzeichner kaschiert die stoßweise Ankunft, reine Deckkraft tut das
nicht. Zwischenräume bleiben roher Text — ein Zeilenumbruch in einem
`inline-block` bricht nur innerhalb des Kastens, und die Aufzählungen standen
sonst als eine einzige lange Zeile da.

## 16 — Gestaffelter Auftritt
Erst das Wesen, dann was es kann, dann wie man es bedient. Gleichzeitigkeit
liest sich als Sprung, Sequenz als Erwachen. `animation-fill-mode: both` —
ohne das blitzt jedes Element vorab in seinem Endzustand auf.

## 17 — Drei Punkte statt „denkt nach …"
Es steht nichts da, was man lesen und gleich wieder vergessen muss.

## 18 — Vier Einstiege, passend zur Tageszeit
`lib/make-one/empfang.ts`. Ein leeres Eingabefeld ist die unfreundlichste
Oberfläche, die es gibt — man weiß nicht, was das Ding kann.

## 19 — Leertaste halten und sprechen
Dazu `/` für das Feld und `Esc` zum Abbrechen. Mit sichtbaren Tastenhinweisen:
ein Kürzel, das nirgends steht, existiert nicht. Auf Geräten ohne Tastatur
werden die Hinweise ausgeblendet.

## 20 — Der Sprechknopf wächst mit der Lautstärke
Dazu ein Ring, der nach außen läuft, solange aufgenommen wird. Die Geste sitzt
unter dem Finger — man spürt sie förmlich.

## 21 — Taschenlampe unter dem Zeiger
Auf dunklem Grund wirkt eine aufgehellte Fläche matschig; ein weicher
Lichtfleck, der dem Finger folgt, wirkt nach Material.

## 22 — Fokusring für die Tastatur
`:focus-visible`, nicht `:focus` — sonst bekommt jeder Mausklick einen Rahmen,
man gewöhnt sich an, ihn wegzustylen, und so verschwindet Tastaturbedienbarkeit
aus Software.

## 23 — Kopf, Rolle, Fuß
Nur das Gespräch wächst; Hirn oben und Eingabe unten stehen fest. Vorher schob
eine lange Antwort das Eingabefeld aus dem Bild. Unten verankert über
`margin-top: auto` statt `justify-content: flex-end` — bei flex-end schneiden
manche Browser den Anfang ab, sobald mehr Inhalt da ist als Platz.

## 24 — Das Hirn tritt zurück, sobald geredet wird
Es bleibt sichtbar (der Zustand muss ablesbar bleiben), gibt aber den Platz an
das ab, was gerade gesagt wird.

## 25 — Barrierefreiheit: das Bild ist dekorativ
Das SVG ist `aria-hidden`. Was Jarvis tut, steht im Klartext darunter, mit
`aria-live="polite"` — Farbe und Bewegung allein zwingen zum Raten.
Mikrofonfehler stehen als `role="alert"` da, statt still zu scheitern.

## 26 — Ein Takt für die ganze Seite
`useAtem`. Mehrere Bildtakte nebeneinander sind der klassische Ruckelgrund.
Hält im Hintergrundtab an. Der Zustand geht nur alle 50 ms nach React — 60
Renderdurchläufe je Sekunde wären das Teuerste, was man in einer React-
Anwendung tun kann.

## 27 — Zufälliger Startpunkt der Uhr
Zwei Ladevorgänge sehen sonst identisch aus, und genau das verrät die Maschine.

## 28 — Nur `transform`, `opacity` und `filter` werden bewegt
Bei 60 Bildern je Sekunde bleiben 16,7 ms je Bild. Alles, was Layout oder
Neuzeichnen auslöst, ist draußen. Weichzeichnerstärken sind fest, nur ihre
Flächen bewegen sich.

## 29 — `prefers-reduced-motion`
Wird respektiert. Der Orb wird dabei nicht getötet — Amplitude auf null, Farbe
und Zustand bleiben lesbar.

## 30 — Und für die ganze Software, nicht nur den Empfang
- Der Seitenkopf (**34 Arbeitsseiten**) kommt gestaffelt an statt aufzublitzen.
- Karten heben sich beim Zeigen um einen Millimeter und bekommen eine hellere
  Kante.
- Jeder Knopf hellt beim Zeigen auf und senkt sich beim Drücken.
- Der Fokusring gilt überall.

Warum das über `filter` und `transform` läuft und nicht über Farben: die
Software setzt ihre Farben als Inline-Stil, und Inline schlägt Stylesheet. Die
beiden sind zugleich die einzigen Eigenschaften, die der Browser ohne
Neuaufbau der Seite zeichnen kann.

---

## Was bewusst NICHT gebaut wurde

**WebGL-Orb mit Icosahedron und Simplex-Rauschen.** Das ist die Technik hinter
ChatGPT Voice und ElevenLabs, und sie wäre eine Stufe schöner. Sie bringt aber
Three.js ins Paket und eine eigene Fehlerklasse (Grafiktreiber, Kontextverlust)
in eine Software, die auf einem Mac im Wohnzimmer zuverlässig starten soll.
Das SVG hier liefert den Charakter der Vorlage. Wenn du willst, dass es noch
eine Stufe weiter geht, ist das der nächste Schritt — dann aber als bewusste
Entscheidung, nicht nebenbei.

**Text-Einblendung an den Wortgrenzen der Sprachausgabe.** Wäre der größte
verbleibende Sprung: geschriebenes und gesprochenes Wort fallen exakt zusammen.
Braucht `SpeechSynthesisUtterance.onboundary`, das nicht jede Systemstimme
liefert. Später.

**Magnetische Knöpfe.** Effektvoll, aber in einer Software, in der man den
ganzen Tag arbeitet, eher störend als hilfreich.
