# Stilblatt „Das Haus“: Menschen und Räume

Gilt für die Fahrt durch das Haus und für alles, was später daraus entsteht (Erklärvideos, Reels). Quelle des Stils ist der Code: `haus/figuren.js` (Menschen), `haus/haus.js` (Räume, Licht). Diese Datei wird nicht ausgeliefert.

Prüfmittel: `node werkzeug/haus-figurenblatt.mjs <zielordner> [profilordner] [nur]` zeichnet alle Menschen ohne Haus: `figuren-1…5.png` (von vorn in der eigenen Standhaltung, Dreiviertelprofil, Seite, sitzend; Tag und Abend), `haltungen-1…2.png` (jede stehende Haltung des Hauses an zwei Menschen), `sitzen.png` (von vorn, Dreiviertel, Seite, von hinten; am Tisch, im Sessel, im Publikum; Möbel in derselben Sicht), `koepfe-1…3.png` (Kopf und Schultern groß: vorn, Dreiviertel sprechend, Profil, fast Profil am Abend), `leben.png` (Standbilder über die Zeit: Gespräch zu zweit, Menschen in Ruhe), `gang.png` (12 Geh-Phasen, Aufstehen), `stufen.png` (die drei Detailstufen in echter Größe, Rückansichten). Nach jeder Änderung an `figuren.js` ansehen.

## 1 · Grundsatz
Flächig gezeichnet, keine Fotos, keine Verläufe als Ersatz für Form. Eine Form hat eine Eigenfarbe, eine Schattenseite mit klarer Kante und eine schmale Lichtkante zur Lichtquelle. Linien gibt es nur dort, wo Stoff oder Haut eine Kante hat (Saum, Falte, Lid, Braue), nie als Umriss um die Figur.

## 2 · Proportionen (`B`, `RUMPF`, `GES`, `KOPF` in `figuren.js`)
- Körper 1,74 m bei `gr` 1, gerechnet mit 7,5 Köpfen; der Kopf wird um `KOPF` = 1,05 größer gezeichnet (gut 7 Köpfe): Das Gesicht trägt die Figur.
- Hüftgelenk 0,93 m, Oberschenkel 0,43, Unterschenkel 0,415, Oberarm 0,285, Unterarm 0,255, Hand 0,165 (halb Handfläche, halb Finger).
- Statur `schmal | mittel | kraeftig` (0,92 · 1 · 1,1 der Breite), Form `a` (breitere Schultern) oder `b` (schmalere Schultern, breitere Hüfte). Der Rumpf ist eine Folge von Querschnitten (`RUMPF`: Höhe, halbe Breite, halbe Tiefe); die Schulterlinie trägt der Rumpf, der Arm setzt 13 % unter dem Schultergelenk an (keine Polster).
- Der Kopf ist ein Zylinder mit Gesicht (`kopfBau`): Aus dem Drehwinkel folgen Maske des Gesichts, Ohren (`ohr`), Augen 24 Grad neben der Mitte (`auge`), Nase und Mund (`merk`). So stimmt jede Ansicht zwischen frontal und Profil ohne eigene Zeichnung.
- Je Mensch eigene Maße (alle freiwillig, `figuren.json`): `bauch` (trägt an Taille und Hüfte auf), `schulter` (Faktor der Breite), `kopfgr`, `nase`, `rund` (runder Rücken, Kopf vorn), `alter: alt`, `ansatz: hoch`. Der Rumpf eines Menschen steht in `m.Q`.
- Hals: am Ansatz breiter als oben, setzt hinter dem Kiefer an; der Kopf sitzt eine Spur vor den Schultern. Der Kragen liegt vor dem Hals (`kragen`): Der Hals steckt im Ausschnitt, nie obenauf.

## 3 · Farbe (`tonwerte`, `toene`)
Je Eigenfarbe vier Tonwerte, gerechnet für das Licht der Szene (`LICHT` in `haus.js`):
- `m` Eigenfarbe (Farbe × `amb` + `heb`), `d` Schattenseite (78 % davon, zu 20 % in die Schattenfarbe des Raums gemischt), `l` Lichtkante (zur Lichtfarbe gemischt, heller), `t` tief (56 %, für Falten, Säume, Fugen; nie als Fläche).
- Haut, Haare, Oberteil, Hose bzw. Rock, Schuhe, Sohle, Tasche bekommen je diese vier Werte. Lippen = Haut zu 42 % nach Rot gemischt. Augenweiß und Zähne sind gebrochenes Weiß und laufen durch dieselbe Rechnung (sie leuchten am Abend nicht).
- Farbwert `akzent` im Datensatz = Farbe des Raums (Studios Orange, Revenue Blau, sonst Lavendel). Je Mensch höchstens ein Stück in Akzentfarbe.
- Der violette Hauptknopf (`#7C3AED`) kommt an keinem Menschen vor.

## 4 · Licht und Schatten
- Richtung zum Licht `L` je Szene (bzw. zur Leuchte am Platz, `platzLicht`). Glieder: Schatten als Sichel an der dem Licht abgewandten Kante (23 % des Halbmessers), am Körperansatz ohne Ring (`oa`). Rumpf: Schattenband über 40 % der Schattenhälfte (`band`), Lichtband 5 %. Gesicht: Schattenstreifen 20 % der Breite, Licht auf Stirn und Wange.
- Schlagschatten: Arm auf dem Körper (nur große Stufe), Kopf auf dem Hals. Am Boden: Kontaktschatten unter den Füßen und ein zweiter, weicher Schatten vom Licht weg (`maleMensch`).
- Lichtkante (`saum`) in der Farbe des Lichts, Deckkraft 0,2 bis 0,8 je nachdem, wie quer das Licht steht; im Haar in Haarfarbe. Gegenlicht (`gegen`) nur als feiner Strich an der Schattenkante, nie am Hals.
- Tageszeit: `LICHT.studios` (Mittag, hell, weiche Schatten) · `revenue` (kühl) · `innovation` (wärmer, Licht von rechts) · `pr` (goldene Stunde) · `abend`, `nacht` (dunkel, warme Lichtkante). Die Räume selbst folgen `TON` und `TAG`.

## 5 · Kleidung (`kleid`, Daten `ober`, `unter`, `schuhe`)
- `shirt` (runder Ausschnitt, kurze Ärmel mit Saum), `pulli` (Kragenbündchen, Ärmelbündchen, Saum), `hoodie` (Kapuze als Kragen, Kordeln, Bauchtasche; von hinten die Kapuze), `hemd`/`bluse` (Kragen, Knopfleiste, Knöpfe, Brusttasche, Manschette, in der Hose mit Gürtel und Schnalle; `aermel: hoch` = hochgekrempelt), `blazer` (offen: Hemd in `zwei`, Revers, Knopf, Taschenklappen, Hemdmanschette).
- Hose `schnitt: schmal | gerade | weit`: Das Hosenbein verjüngt sich zum Knie, die Wade trägt leicht auf, der Saum ist je Schnitt enger oder weiter; es endet mit gerader Saumkante über dem Schuh und steht vorn auf dem Spann auf (eine Falte darüber). `laenge: kurz` = 7/8-Hose, der Knöchel ist zu sehen. Rock bis über das Knie mit Saum und Falten.
- Blazer geschlossen (ein Knopf) oder `offen`: Die Vorderkanten fallen auseinander, Hemd und Gürtel sind zu sehen. Pulli mit `kragen: rolli`.
- Schuhe: Turnschuh (helle Sohle, Schnürung) oder Lederschuh (dünne dunkle Sohle, Absatz). Von vorn ist der Schuh vorn breit und flach und wird zur Ferse schmal (`schuh › zu`), nie ein Tropfen; die Füße stehen je Mensch leicht nach außen gedreht (`stand.aus`).
- Falten: Ellbogen und Knie (auf der Beugeseite; gestreckt nur eine, leise; gebeugt drei), Achsel (ein bis zwei), Taille (zwei), Schulter (eine), Schritt (zwei, dazu bei Hemd in der Hose die Tascheneingriffe), über dem Saum (eine); alle in `t`, Deckkraft unter 0,6. Nie mehr als drei Linien an einer Stelle.
- Von hinten nie eine leere Fläche: Kragen im Nacken, Naht über dem Rückgrat, Passe bzw. Kapuze.

## 6 · Kopf, Gesicht, Haare
- Profil: Die Profillinie hat Stirn, Braue, Nasenwurzel, Nasenrücken, Nasenspitze, Oberlippe, Mundspalt, Unterlippe, Kinnfalte, Kinn (`PROFIL`), der Kieferwinkel sitzt unter dem Ohr. Dreht sich der Kopf, entfällt das Schattenband längs der Profillinie: Sieht das Gesicht zum Licht, liegt die Seitenfläche (Schläfe, Wange, Kiefer) mit gerader Kante im Schatten; sieht es vom Licht weg, nur der Kiefer. Im Dreiviertelprofil bleiben beide Augen Augen (das ferne rückt an die Kante und verschwindet erst jenseits von 65 Grad), der Nasenrücken ist eine feine Linie, die ferne Mundhälfte kürzer als die nahe. Langes Haar fällt im Profil hinter dem Ohr, das Gesicht bleibt frei.
- Mund: in Ruhe geschlossen mit leichtem Ausdruck. Offen nur beim Sprechen: flach, oben gerade, mit Zähnen und Unterlippe, nie eine runde Öffnung.
- Gesicht: Augen mit Weiß, Iris (`augen`), Pupille, Glanzpunkt, Oberlid mit Wimpernrand, Lidfalte; Braue in dunkler Haarfarbe, innen kräftig; Nase von vorn als Schattenfläche mit Nasenflügeln, im Profil als Teil der Silhouette; Mund als Linie mit gehobenen Winkeln (freundlich), gerade (konzentriert, `mund` < 0) oder offen mit Zähnen (spricht, `mund` > 0,15). Ein Hauch Lippenfarbe auf der Wange.
- Haare: `kurz | bob | lang | dutt | zopf | locken`, dazu `pony`, `scheitel` (links, rechts, mitte). Der Schädel in Haarfarbe (Schattenseite, Eigenfarbe), Haaransatz mit Scheitel als Form über der Stirn, Strähnen vor dem Ohr bei Bob und langem Haar, Kotelette bei kurzem Haar, Haaransatz im Nacken von hinten.
- Zubehör aus den Daten: `bart`, `brille` (Bügel bis zum Ohr), `kopfhoerer`, `ohrring`, `uhr`.
- Blick und Kopf folgen der Tätigkeit (`blick` am Platz, `kd`, `kn`, `schau`). Niemand soll wie eine bestimmte echte Person aussehen.

## 7 · Hände (`handBau`, `handMal`)
Handfläche, Finger, Daumen zur Körpermitte. Fünf Haltungen aus der Armstellung (`HAND`): `locker` (hängt, Finger leicht eingerollt), `offen` (spricht, zeigt die Handfläche), `zeigt` (Zeigefinger gestreckt), `tippt` (Finger gefächert), `greift` (um den Gegenstand geschlossen). Dazu `weg` (die Hand steckt in der Tasche oder liegt hinter dem Arm). Große Stufe: einzelne Finger in jeder Haltung (auch locker und greifend) mit Schattenkante, Knöchel als kleine Tonfläche, Licht auf dem Handrücken, eine Kante zwischen Daumen und Handfläche; mittlere: Fingergruppe mit zwei Linien; kleine: eine Form.

## 7a · Haltung im Stand (`steh`, `skelett`, Daten `stand`)
- Niemand steht symmetrisch. Das Gewicht liegt auf einem Bein (`w`): Die Hüfte des Standbeins steht höher und schiebt zur Seite (`bk`, `px`), die Schulterlinie kippt dagegen (`sk`), der Rumpf gleicht aus, der Kopf bleibt aufrecht oder neigt sich leicht (`stand.kopf`). Das Spielbein ist im Knie gelöst, bei manchen steht es auf der Fußspitze (`stand.spitze`).
- Die Füße stehen fest (Breite, Versatz, Drehung je Mensch: `stand.breit`, `vor`, `aus`); das Becken wandert über ihnen, beide Beine folgen ihrem Fuß. Wandert das Gewicht, rutscht kein Fuß.
- Freie Arme tun, was dieser Mensch immer tut (`stand.l`, `stand.r`): Hand in der Tasche (`tasche`; im Kapuzenpulli in der Bauchtasche), an der Hüfte (`huefte`), Arme verschränkt (`kreuz` + `kreuzu`), Hand am Kinn mit gestütztem Ellbogen (`kinn` + `quer`), Becher (`becher`), Tablet im Arm (`mappe`), Hände auf dem Rücken (`ruecken`) oder vor dem Körper gefasst (`gefasst`). Haltungen aus zwei Armen gelten nur, wenn beide frei sind. Ein Mensch steht immer gleich da; was der Platz vorgibt (tippen, filmen, zeigen), geht vor.
- `steh(0, …)` genau ist die Grundstellung ohne Eigenart: Aus ihr geht es los.

## 7b · Sitzen (`sitz`, Daten `sitzt`)
- Das Becken sitzt hinten auf der Fläche, die Oberschenkel liegen auf, die Unterschenkel stehen, die Füße am Boden. Der Rücken folgt der Tätigkeit: am Tisch vorgebeugt (tippt, schreibt), im Gespräch aufrecht und zugewandt, beim Zuhören angelehnt; `art: sessel` = tief angelehnt, Arme `auflage` auf den Lehnen.
- Die Beine sind Eigenart: `gerade`, `versetzt` (ein Fuß vor, einer unter dem Stuhl), `weit`, `zurueck` (beide Füße unter dem Stuhl, auf den Ballen), `ueber` (ein Bein über dem anderen; nicht mit Rock).

## 8 · Detailstufen nach Größe im Bild (`STUFEN` = 52, 150 Pixel je Meter)
- klein (unter 52): nur Flächen und Schattenseite, Augenpunkte, kein Schnitt der Kleidung.
- mittel (bis 150): Gesicht (Augen als Punkte mit Braue, Mund), Hände mit Daumen, Schnitt der Kleidung, Lichtkante. So entstehen die Geh-Bilder.
- groß (darüber): alles: Lid, Iris, Zähne, einzelne Finger, Knöpfe, Schnürung, Schlagschatten, Strähnen.
- leicht (`o.leicht`, für alles, was unterwegs entsteht: Gehen, Aufstehen, Passanten): mittlere Stufe ohne Lichtkanten, Falten und Ausschnitt. In Bewegung fällt das nicht auf, und der Lauf bleibt flüssig.

## 9 · Bewegung (Auftrag AB, 22.11.)
Grundsatz: **In Ruhe ist Ruhe.** Ein Mensch bewegt sich nur in einzelnen, weichen Bewegungen mit Anlauf und Ausklang; davor und danach steht sein Bild still. Kein Rauschen, keine Wellen, kein Atmen im Bild.
- **Kurven** (`FIG.sanft`, `FIG.bogen`): jede Bewegung beginnt und endet mit Tempo null (weiche Kurve fünften Grads); Gesten sind „hin, halten, zurück“ in festen Dauern. Lineare Übergänge und Schwingungen ohne Ende gibt es nicht.
- **Taktgeber je Raum** (`haus.js`: `taktGruppe`, `taktWer`, `taktArt`, `regen`): Alle `TAKT_H` = 1,7 s beginnt ein Takt; in jedem ist höchstens ein Mensch des Raums dran, nie derselbe zweimal hintereinander. Eine Bewegung dauert 0,6 bis 2,4 s. Also bewegen sich nie mehr als zwei zugleich (dazu höchstens ein Zuhörer, der nickt). Gesprochen wird nur in jedem zweiten Takt: nie zwei Reden zugleich, Gesprächspartner wechseln sich ab.
- **Was jemand tut**, folgt aus seiner Rolle: `rede` (ein Satz, 1,7 bis 2,4 s: Mund in Silben, die offenen Hände heben sich in 0,5 s, halten, sinken in 0,6 s; der Partner nickt am Ende) · Arbeit der Hände: `tipp` (eine Folge von Anschlägen, 1,7 s, dann Pause), `schrieb` (eine Zeile, 1,9 s), `zeig` (der Arm sinkt zur offenen Hand, hält 0,9 s, zeigt wieder), `schwenk` (die Kamera wandert in 1,25 s in eine neue Lage und bleibt) · `gewicht` (aufs andere Bein in 0,95 s, bleibt dort; die Füße stehen) · `kopf` (wendet sich in 0,8 s, bleibt) · `nick` (0,7 s) · `zug` (Gewohnheit: Schluck, Blick aufs Tablet, Hand vom Kinn: 0,56 s hin, 0,8 s halten, 0,66 s zurück).
- **Solange jemand geht oder kommt**, läuft die Uhr des Raums weiter: Wer gerade spricht oder trinkt, führt es zu Ende (niemand friert mitten in einer Geste ein). In dieser Zeit beginnt nur jeder zweite Takt (`taktGesperrt`): Neben den Gehenden macht höchstens ein anderer Mensch eine Bewegung.
- **Ohne den Körper zu bewegen:** Lidschlag alle 3 bis 6 s (150 ms), der Blick hält und springt alle 2,3 bis 4,4 s (`FIG.leben`).
- **Neu gezeichnet wird nur, was sich ändert** (`FIG.sig`, `lebSig`): Ein Ruhebild entsteht nur neu, wenn sich die Kennzahl der Haltung ändert; je Mensch höchstens rund 30-mal je Sekunde, je Bild höchstens einer.
- **Gehen** (`FIG.geh`, `gangSchritt`): 0,7 m je Schritt bei 1,4 m/s. Der erste Schritt beginnt aus dem Stand mit kurzer Schrittlänge (`W0` = 0,3) und wird mit dem Tempo länger, der letzte wird wieder kurz; die Schrittlänge gilt für einen Fuß ab dem Aufsetzen, die Schrittphase hängt am Weg und an der Schrittlänge des Standfußes: Er rutscht nicht. Der Fuß rollt über die Spitze ab, Knie und Hüfte folgen dem Fuß; der Körper hebt und senkt sich (2,2 cm), Schultern drehen gegen die Hüfte, Arme schwingen gegen die Beine, der Arm mit der Tasche kaum und etwas später; der Kopf bleibt ruhig und sieht voraus in die Kurve. Die Richtung folgt dem Weg weich (kein Knick), in Kurven dreht sich der Mensch um seinen Standfuß (`fussHalt`). An der Tür geht die freie Hand zum Griff.
- **Aufstehen und Hinsetzen** (`aufPose`): eine durchgehende Bewegung durch die Haltungen (lösen, vorbeugen, Gewicht über die Füße, aufrichten; weiche Kurve statt Halt an jeder Haltung), 1,2 s aus dem Sitz, 0,75 s aus dem Stand. Sie beginnt in genau der Haltung des Ruhebilds und endet in ihr. Ab `DREH_AB` = 0,3 der Zeit am Platz dreht sich der Mensch schon in die Gehrichtung; am Ende nimmt er das Gewicht aufs rechte Bein (`losPose`), der linke Fuß macht den ersten Schritt.
- **Zeichnung in Bewegung** (`bewSetzen`): Wer aufsteht, sich dreht, geht oder sich setzt, wird in jedem Bild neu gezeichnet (leichte Fassung, höchstens `BILD.K_BEW` = 200 Pixel je Meter, höchstens `BILD.BEW_JE_BILD` = 2 Menschen je Bild, sonst reihum): keine Phasen, keine Richtungen in Stufen. Das scharfe Ruhebild blendet 150 ms in das Bild der Bewegung über und zurück.
- **Was nie passiert:** ein Sprung in Lage, Größe oder Haltung zwischen Ruhe und Bewegung · ein Bild, das sich ohne Bewegung ändert · mehr als zwei Menschen, die sich im Raum zugleich bewegen · eine Bewegung ohne Ausklang · ein Fuß, der im Stand rutscht.
- Bei „weniger Bewegung“ und in der Sparstufe steht alles am Platz. Das Publikum auf dem Dach und die Passanten auf der Straße gehen weiter mit vorgezeichneten Phasen (viele zugleich, klein im Bild).

## 10 · Räume
- Material: Boden mit Fuge oder Dielen und Spiegelung der Fenster, Sockelleiste mit Schattenfuge, Wände mit Paneelfugen, Glasfront mit Pfosten und der Stadt dahinter; Leuchten mit Lichtfleck. Geschrieben wird in Nachtfarben, den Tag rechnet `TON`.
- Farbe: Wände und Boden neutral und hell; die Farbe der Marke ist Akzent (Teppich, Möbel, Leuchtlinie, ein Kleidungsstück je Mensch), nie die Farbe des ganzen Raums (`SCHALE`).
- Jede Leistung hat ihren Platz mit den Gegenständen ihrer Arbeit; Bildschirme zeigen eine Oberfläche, die zur Leistung passt (`tex`), nie graue Balken.
- Tiefe: Vordergrund angeschnitten, Mitte mit den Menschen, Hintergrund mit Stadt; alles, was Menschen verdecken kann, ist ein Ding mit Tiefe (`ding`).
- Draußen (Straße, Dach, Stadt): dieselben Regeln. Häuser haben Fassaden (Fensterbänder, Lochfenster, Lisenen, Glasraster) und eine Dachkante, nie nur eine Fläche; Grün ist eine Krone aus runden Formen in drei Tönen (Schatten, Eigenfarbe, wenige Lichter oben rechts); Glas ist eine dünne helle Fläche mit Pfosten und Handlauf. Auf Schildern und Tafeln stehen nur Worte, die es im Haus gibt (Etagen aus den Daten, „Eröffnet bald“), sonst Formen.
- Wer miteinander spricht, spricht abwechselnd (`figur.gespraech`, `teil`); wer nur dasteht, steht in seiner eigenen Haltung (`haltung: steht`).

## 11 · Schärfe und Auflösung (`BILD` in `haus.js`)
- Steht die Kamera und bleibt der Besucher (kein Scrollen seit 400 ms: `bleibt`), entsteht jedes Ruhebild in genau der Größe, in der es gezeigt wird (`K_FEIN`, höchstens 900 Pixel je Meter, zusammen höchstens `FEIN_MP`), auf ganzen Pixeln (`feinSchritt`: erst die Fläche, dann zwei bis vier Scheiben, dann tauschen; vorn zuerst).
- In Bewegung: Die Ruhebilder der anderen bleiben in festen Stufen (`K_RUHE` 220); wer sich bewegt, hat seine eigene Fläche mit höchstens `K_BEW` = 200 Pixel je Meter, in jedem Bild neu gezeichnet (Abschnitt 9). Nur das Publikum auf dem Dach und die Passanten nutzen noch vorgezeichnete Phasen (`K_PUB` 45, `K_MAX` 90).

## 12 · Was man nie tut
- Kein Umriss um Figuren, keine Verläufe auf Menschen, kein Glanzstreifen in der Mitte eines Glieds (wirkt wie ein Rohr), kein weißer Lichtbogen im Haar (wirkt wie ein Haarreif).
- Keine zwei Menschen mit derselben Kombination aus Frisur, Oberteil und Zubehör, keine zwei mit derselben Statur und Standhaltung. Kein Mensch ganz in Akzentfarbe.
- Kein symmetrischer Stand, keine zwei gleich hängenden Arme, kein offener Mund in Ruhe, kein Gegenlicht-Bogen über Kinn oder Hals.
- Kein echtes Gesicht, kein Logo, keine Schrift auf Kleidung.
- Keine neue Zeichenfläche und kein Mensch in voller Zeichnung aus Pfaden, während sich im Bild etwas bewegt (siehe LIESMICH, „Flüssiger Lauf“). Ausnahme seit Auftrag AB: die Bewegten selbst, in der leichten Fassung auf ihrer eigenen kleinen Fläche, höchstens zwei je Bild.
