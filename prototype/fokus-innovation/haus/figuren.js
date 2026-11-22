/* MAKE Innovation · „Das Haus“: das Figuren-System (QUELLE; haus-bau.mjs setzt es an der Marke FIGUREN-SYSTEM in js/haus.js ein).
   Menschen als Daten statt als Einzelzeichnung: Ein Mensch (haus/figuren.json › menschen) hat Statur, Haut, Haare, Kleidung; eine Haltung ist ein Satz von Gelenkwinkeln.
   Daraus rechnet skelett() die Gelenke im Raum des Körpers (rechts, oben, vorn), malen() dreht sie in die Blickrichtung und zeichnet sie flächig, wie in einem gezeichneten Erklärfilm:
   je Fläche eine Eigenfarbe, eine Schattenseite mit klarer Kante, eine Lichtkante zur Lichtquelle; Kleidung mit Schnitt (Kragen, Revers, Knopfleiste, Saum, Bündchen, Gürtel),
   Hände, die etwas tun, ein Gesicht mit Ausdruck. Wie viel davon gezeichnet wird, hängt an der Größe im Bild (drei Stufen: klein, mittel, groß; STUFEN).
   Die Figur kann in jede Richtung schauen (dreh), also auch um Möbel herum gehen und sich umdrehen. Das System kennt weder Raum noch Kamera:
   Es zeichnet an eine Bildstelle (x0, y0 = Boden unter dem Körper, k = Pixel je Meter). Regeln des Stils: haus/STIL.md. Prüfen: werkzeug/haus-figurenblatt.mjs. */
const FIG = (() => {
  const PI = Math.PI;
  const lerp = (a, b, t) => a + (b - a) * t;
  const grenze = (v, a, b) => Math.min(b, Math.max(a, v));
  const weich = (t) => { t = grenze(t, 0, 1); return t * t * (3 - 2 * t); };
  const KOPF = 1.05; // der Kopf ist eine Spur größer als gemessen (gut 7 Köpfe statt 7,5): das Gesicht trägt die Figur
  const STUFEN = [52, 150]; // Pixel je Meter: darunter klein (nur Flächen), bis zur zweiten Zahl mittel (Gesicht, Hände, Schnitt der Kleidung), darüber groß (alles)

  /* ── Farben: vier Tonwerte je Eigenfarbe, gerechnet für das Licht eines Raums: l Lichtkante · m Eigenfarbe · d Schattenseite · t tief (Linien, Falten, Fugen) ── */
  const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const misch = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const css = (c, a) => (a == null ? `rgb(${Math.round(grenze(c[0], 0, 255))},${Math.round(grenze(c[1], 0, 255))},${Math.round(grenze(c[2], 0, 255))})` : `rgba(${Math.round(grenze(c[0], 0, 255))},${Math.round(grenze(c[1], 0, 255))},${Math.round(grenze(c[2], 0, 255))},${a})`);
  /* licht = { id, amb: [r, g, b] (so hell und so getönt liegt die Eigenfarbe im Raum, 0 … 1), licht: [r, g, b] Farbe der Lichtquelle, schatten: [r, g, b] Farbe der Schatten } */
  function tonwerte(farbe, licht) {
    const hb = licht.heb ?? 16, m = [farbe[0] * licht.amb[0] + hb, farbe[1] * licht.amb[1] + hb * 0.9, farbe[2] * licht.amb[2] + hb]; // ganz dunkle Kleidung bleibt vor dunklem Grund lesbar
    const hell = (m[0] + m[1] + m[2]) / 765, l = misch(m, licht.licht, 0.1 + 0.16 * hell).map((v) => v * 1.1 + 5), d = misch(m.map((v) => v * 0.78), licht.schatten, 0.2), t = misch(m.map((v) => v * 0.56), licht.schatten, 0.3); // dunkle Stoffe bekommen keinen weißen Streifen
    return { l: css(l), m: css(m), d: css(d), t: css(t), roh: m };
  }
  function toene(m, licht) {
    const c = m._ton || (m._ton = {}); if (c[licht.id]) return c[licht.id];
    const t = { haut: tonwerte(m.haut, licht), haar: tonwerte(m.haar, licht), ober: tonwerte(m.ober.farbe, licht), unter: tonwerte(m.unter.farbe, licht), schuh: tonwerte(m.schuhe.farbe, licht),
      zwei: tonwerte(m.ober.zwei || [236, 232, 226], licht), sohle: tonwerte(m.schuhe.sohle || [232, 228, 220], licht), ding: tonwerte([36, 35, 46], licht), tasche: tonwerte(m.tasche || [58, 50, 46], licht),
      lippe: tonwerte(misch(m.haut, [168, 70, 72], 0.42), licht), weiss: tonwerte([246, 242, 236], licht), auge: tonwerte(m.augen, licht), gold: tonwerte([226, 190, 110], licht), guertel: tonwerte([46, 36, 32], licht) };
    c[licht.id] = t; return t;
  }

  /* ── Menschen ── gr = Körpergröße (1 = 1,74 m), statur = schmal | mittel | kraeftig, form = a (breitere Schultern) | b (schmalere Schultern, breitere Hüfte).
     Merkmale (alle freiwillig): frisur = kurz | bob | lang | dutt | zopf | locken · pony · scheitel = links | rechts | mitte · bart · brille · kopfhoerer · ohrring · uhr · augen (Farbe)
     ober = { art: shirt | pulli | hoodie | hemd | bluse | blazer, farbe, zwei (Hemd unter dem Blazer, Kragen), aermel: 'hoch' (hochgekrempelt) } · unter = { art: hose | rock, farbe, schnitt: schmal | gerade | weit }
     schuhe = { farbe, sohle, art: sneaker | leder } · tasche (Farbe)
     Haltung und Statur (freiwillig): stand = { l, r (was der freie Arm tut: EIGEN), breit, vor, aus, spitze, kopf } · sitzt (SITZART) · rund · bauch · schulter · kopfgr · nase · alter: 'alt' · ansatz: 'hoch' · ober.offen · ober.kragen: 'rolli' · unter.laenge: 'kurz' */
  const STATUR = { schmal: 0.92, mittel: 1, kraeftig: 1.1 };
  function mensch(id, d, akzent) {
    const f = (x, ers) => hex(x === 'akzent' ? akzent : x || ers), b = d.form === 'b', w = STATUR[d.statur] || 1, sohle = d.schuhe && d.schuhe.sohle ? f(d.schuhe.sohle) : null, ba = d.bauch || 0, sf = d.schulter || 1;
    const Q = RUMPF[b ? 'b' : 'a'].map((r, i) => (i === 1 ? [r[0], r[1] + 0.012 * ba, r[2] + 0.03 * ba, r[3] + 0.02 * ba] : i === 2 ? [r[0], r[1] + 0.036 * ba, r[2] + 0.055 * ba, r[3] + 0.034 * ba] : i === 3 ? [r[0], r[1] + 0.008 * ba, r[2] + 0.014 * ba, r[3] + 0.006 * ba] : i === 4 || i === 5 ? [r[0], r[1] * sf, r[2], r[3]] : r)); // der Rumpf dieses Menschen: Bauch (0 … 1) trägt an Taille und Hüfte auf, schulter = Faktor der Schulterbreite
    return { id, gr: d.gr || 1, w, b, Q, kg: d.kopfgr || 1, alt: d.alter === 'alt' ? 1 : 0, ansatz: d.ansatz === 'hoch' ? 1 : 0, sb: (b ? 0.176 : 0.198) * (0.5 + 0.5 * w) * sf, hb: 0.09, haut: f(d.haut, '#c99676'), haar: f(d.haar, '#2a1d17'), frisur: d.frisur || 'kurz', bart: !!d.bart, pony: !!d.pony,
      scheitel: d.scheitel === 'rechts' ? 1 : d.scheitel === 'mitte' ? 0 : -1, ohrring: !!d.ohrring, uhr: !!d.uhr, augen: f(d.augen, '#3b2a22'),
      ober: { art: (d.ober && d.ober.art) || 'pulli', farbe: f(d.ober && d.ober.farbe, '#4a4a58'), zwei: d.ober && d.ober.zwei ? f(d.ober.zwei) : null, hoch: !!(d.ober && d.ober.aermel === 'hoch'), rolli: !!(d.ober && d.ober.kragen === 'rolli'), offen: !!(d.ober && d.ober.offen) },
      unter: { art: (d.unter && d.unter.art) || 'hose', farbe: f(d.unter && d.unter.farbe, '#2b2d3a'), schnitt: (d.unter && d.unter.schnitt) || 'gerade', kurz: !!(d.unter && d.unter.laenge === 'kurz') },
      schuhe: { farbe: f(d.schuhe && d.schuhe.farbe, '#e6e1d8'), sohle, leder: d.schuhe && d.schuhe.art ? d.schuhe.art === 'leder' : !!sohle && sohle[0] + sohle[1] + sohle[2] < 300 }, tasche: d.tasche ? f(d.tasche) : null, kopfhoerer: !!d.kopfhoerer, brille: !!d.brille, nase: d.nase || 1, _ton: null,
      eig: (() => { const e = d.stand || {}, hoodie = d.ober && d.ober.art === 'hoodie', arm = (x) => (x === 'tasche' && hoodie ? 'bauchtasche' : EIGEN[x] ? x : 'haengt'); // wie dieser Mensch steht und sitzt (figuren.json › stand, sitzt, rund)
        return { l: arm(e.l), r: arm(e.r), breit: e.breit || 0, vor: e.vor ?? 0.045, aus: e.aus ?? 0.2, spitze: e.spitze ? 0.45 : 0, ks: e.kopf || 0, rund: d.rund || 0, sitz: SITZART[d.sitzt] ? d.sitzt : 'gerade' }; })() };
  }

  /* ── Haltungen ── Winkel in Bogenmaß. Bein: [vor, ab, Knie, Fuß] · Arm: [vor, ab, Ellbogen, einwärts]. px, py, pf = Becken (rechts, hoch, vor) gegenüber dem Stand.
     neig = Rumpf nach vorn, seit = zur Seite, dreh = Schultern gegen das Becken verdreht · kd, kn, ks = Kopf gedreht (nach rechts), genickt, geneigt.
     hl, hr = was die Hand tut (locker | offen | zeigt | tippt | greift) · mund: 0 = freundlich, > 0 = spricht (so weit offen), < 0 = konzentriert · blinz: 1 = Augen zu · schau = Blick zur Seite (−1 … 1) */
  const neutral = () => ({ px: 0, py: 0, pf: 0, neig: 0.02, seit: 0, dreh: 0, kd: 0, kn: 0, ks: 0, bl: [0.02, 0.045, 0.04, 0], br: [0.02, 0.045, 0.04, 0], al: [0.03, 0.07, 0.2, 0.12], ar: [0.03, 0.07, 0.2, 0.12], hebL: 0, hebR: 0, boden: true, hl: 'locker', hr: 'locker', mund: 0, blinz: 0, schau: 0, atem: 0,
    bk: 0, sk: 0, aus: 0.13, st: 0, si: 0, ei: 0, fl: 0, fr: 0, w: 0 }); // bk = Becken gekippt (rechte Hüfte höher), sk = Schulterlinie gekippt (rechte Schulter höher) · aus = Füße nach außen gedreht · st = Stand (die Füße stehen fest, skelett() setzt die Beine) · si = sitzt · ei = Eigenart des Menschen wirkt (0 … 1) · fl, fr = der Arm ist frei (hängt) · w = Gewicht (−1 links … 1 rechts)
  const ARME = { // je Arm
    haengt: [0.03, 0.07, 0.2, 0.12], tippt: [0.42, 0.14, 1.22, 0.36], maus: [0.5, 0.2, 1.1, 0.1], kamera: [0.55, 0.12, 1.55, 0.3], griff: [0.34, 0.16, 1.4, 0.16], filmt: [0.78, 0.2, 1.42, 0.52],
    zeigt: [1.02, 0.2, 0.42, 0.0], schreibt: [1.12, 0.06, 0.82, 0.12], haelt: [0.2, 0.12, 1.5, 0.5], spricht: [0.24, 0.16, 1.5, 0.18], offen: [0.42, 0.42, 0.9, -0.1], telefon: [0.42, 0.34, 2.5, 0.55],
    traegt: [0.0, 0.07, 0.1, 0.0], greift: [0.5, 0.1, 0.25, 0.0], schoss: [0.3, 0.1, 1.0, 0.3], huefte: [-0.3, 0.62, 0.84, 1.34], becher: [0.08, 0.1, 1.62, 0.34],
    hosentasche: [-0.2, 0.2, 0.62, 0.48], bauchtasche: [-0.15, 0.14, 1.15, 0.75], kreuz: [0.1, 0.08, 1.94, 1.13], quer: [0.0, 0.06, 1.5, 1.12], kinn: [0.3, 0.0, 2.6, 0.62], mappe: [0.05, 0.08, 1.75, 0.75], ruecken: [-0.5, 0.1, 0.3, 1.0], gefasst: [0.1, 0.1, 0.32, 0.78], lehne: [0.1, 0.42, 0.5, 0.1], auflage: [0.22, 0.3, 0.95, -0.05],
  };
  /* Eigenart im Stand: was ein Mensch mit einem freien Arm tut (figuren.json › stand › l, r). a = Armstellung, h = Hand (weg = nicht zu sehen), d = was die Hand hält, paar = braucht beide Arme frei (sonst hängt der Arm) */
  const EIGEN = { haengt: { a: null }, tasche: { a: 'hosentasche', h: 'weg' }, bauchtasche: { a: 'bauchtasche', h: 'weg' }, huefte: { a: 'huefte', h: 'greift' }, kreuz: { a: 'kreuz', h: 'greift', paar: 1 }, kreuzu: { a: 'kreuz', h: 'weg', paar: 1 }, quer: { a: 'quer', h: 'locker', paar: 1 }, kinn: { a: 'kinn', h: 'locker', paar: 1 },
    becher: { a: 'becher', h: 'greift', d: 'becher' }, mappe: { a: 'mappe', h: 'greift', d: 'mappe' }, ruecken: { a: 'ruecken', h: 'locker', paar: 1 }, gefasst: { a: 'gefasst', h: 'locker', paar: 1 } };
  /* Eigenart im Sitzen (figuren.json › sitzt): Zugaben auf die Beinwinkel [rechts, links] */
  const SITZART = { gerade: null, versetzt: [[-0.045, 0.02, -0.345, 0.08], [0, 0.02, 0.38, -0.3]], weit: [[0, 0.16, 0, 0], [0, 0.16, 0, 0]], zurueck: [[0, 0.03, 0.42, -0.24], [0, 0.02, 0.34, -0.2]], ueber: [[0.2, -0.52, -0.1, -0.35], [0, -0.04, -0.12, 0.04]] };
  const HAND = { haengt: 'locker', tippt: 'tippt', maus: 'greift', kamera: 'greift', griff: 'greift', filmt: 'greift', zeigt: 'zeigt', schreibt: 'greift', haelt: 'greift', spricht: 'offen', offen: 'offen', telefon: 'greift', traegt: 'greift', greift: 'offen', schoss: 'locker', huefte: 'greift', becher: 'greift', lehne: 'greift', auflage: 'locker' };
  /* Knick im Handgelenk (Auftrag AA): Bei der Hand an der Hüfte und am Kinn liegt die Hand nicht in der Verlängerung des Unterarms. Je Haltung: wohin die Hand zeigt [nach außen, nach oben, nach vorn] und zu welchem Anteil.
     Hüfte: Die Finger liegen nach vorn unten auf dem Beckenkamm. Kinn: Die Hand kippt nach vorn, das Kinn ruht auf den Fingern. Nur in den Stufen mittel und groß (skelett: knick). */
  const KNICK = { huefte: [0.08, -0.72, 0.68, 0.8], kinn: [-0.35, 0.25, 0.9, 0.75] };
  const arme = (p, l, r) => { p.al = ARME[l].slice(); p.ar = ARME[r].slice(); p.hl = HAND[l] || 'locker'; p.hr = HAND[r] || 'locker'; p.kl = KNICK[l] ? l : ''; p.kr = KNICK[r] ? r : ''; return p; };
  /* Stand mit verlagertem Gewicht: w = −1 (links) … 1 (rechts): Standbein gestreckt unter dem Körper, Spielbein locker, die Hüfte schiebt zur Standseite, die Schultern gleichen aus */
  function steh(w = 0, armL = 'haengt', armR = 'haengt') {
    const p = neutral(), a = Math.abs(w);
    p.w = w; p.st = 1; p.ei = w === 0 ? 0 : 1; p.fl = armL === 'haengt' ? 1 : 0; p.fr = armR === 'haengt' ? 1 : 0; // w = 0 genau: die Grundstellung (aus ihr geht es los), ohne Eigenart
    p.px = 0.046 * w; p.seit = -0.05 * w; p.bk = 0.1 * w; p.sk = -0.14 * w; p.ks = 0.035 * w; p.dreh = 0.05 * w; p.py = -0.006 * a; // die Hüfte des Standbeins steht höher und schiebt zur Seite, die Schulterlinie kippt dagegen
    const stand = [0.0, 0.045 - 0.04 * a, 0.02, 0], frei = [0.12 * a + 0.02, 0.05 + 0.05 * a, 0.24 * a + 0.04, 0.06 * a]; // nur für Übergänge: Im Stand setzt skelett() die Beine auf die festen Füße
    p.br = w >= 0 ? stand : frei; p.bl = w >= 0 ? frei : stand;
    arme(p, armL, armR);
    for (const [A, frei2, s2] of [[p.ar, p.fr, w], [p.al, p.fl, -w]]) if (frei2) { const st = Math.max(0, s2), sp = Math.max(0, -s2); A[0] += 0.07 * sp - 0.04 * st; A[1] += 0.03 * st; A[2] += 0.1 * sp; } // hängende Arme: am Standbein liegt der Arm an der Hüfte, am Spielbein fällt er locker nach vorn
    return p;
  }
  /* Sitz: hoehe = Sitzfläche über dem Boden in Metern (Stuhl 0,46 · Hocker 0,66), gr = Körpergröße des Menschen.
     art (freiwillig) = tisch | gespraech | zuhoeren | sessel; ohne Angabe folgt sie aus den Armen: Wer tippt oder schreibt, sitzt vorgebeugt am Tisch; wer spricht, aufrecht und zugewandt; sonst angelehnt.
     Das Becken sitzt hinten auf der Fläche (pf < 0), die Oberschenkel liegen auf, die Unterschenkel stehen, die Füße am Boden; wie die Beine stehen, ist Eigenart des Menschen (figuren.json › sitzt). */
  const AM_TISCH = { tippt: 1, maus: 1, schreibt: 1 }, IM_GESPRAECH = { spricht: 1, offen: 1, zeigt: 1 };
  function sitz(hoehe = 0.46, gr = 1, armL = 'schoss', armR = 'schoss', art = '') {
    const p = neutral(), hy = (hoehe + 0.088) / gr, t = Math.acos(grenze((hy - 0.5) / 0.43, 0, 0.98)); // der Oberschenkel fällt bis zum Knie in 0,5 m Höhe
    p.py = hy - 0.93; p.boden = false; p.si = 1;
    const fuss = 0.085 / 1, k2 = Math.acos(grenze((hy - 0.43 * Math.cos(t) - fuss) / 0.415, 0, 1)); // Unterschenkel so weit zurück, dass der Fuß am Boden steht
    p.bl = [t, 0.1, t + k2, 0]; p.br = [t, 0.1, t + k2, 0];
    if (hoehe > 0.55) { p.bl = [t, 0.12, t + 0.25, -0.3]; p.br = [t + 0.12, 0.1, t - 0.2, 0.05]; p.si = 0; p.neig = 0.06; return arme(p, armL, armR); } // Hocker: ein Fuß auf der Strebe, einer vorn am Boden
    const a = art || (AM_TISCH[armL] || AM_TISCH[armR] ? 'tisch' : IM_GESPRAECH[armL] || IM_GESPRAECH[armR] ? 'gespraech' : 'zuhoeren');
    if (a === 'tisch') { p.neig = 0.17; p.pf = -0.06; p.kn = 0.07; } // vorgebeugt, die Unterarme auf dem Tisch
    else if (a === 'gespraech') { p.neig = 0.09; p.pf = -0.05; }
    else if (a === 'sessel') { p.neig = -0.15; p.pf = -0.09; }
    else { p.neig = -0.09; p.pf = -0.045; } // angelehnt
    return arme(p, armL, armR);
  }
  /* Gehen: ph = Phase (2π = zwei Schritte; 0 = rechtes Bein steht unter dem Körper, das linke schwingt vorbei: so beginnt der Gang aus dem Stand),
     tr = Arm trägt etwas (schwingt kaum): 'l' | 'r' | '', weit = Schrittlänge (1 = 0,7 m je Schritt: so weit muss die Figur je halber Phase bewegt werden, dann steht der Fuß am Boden).
     Die Füße werden gesetzt, nicht geschwungen: Das Standbein wandert gleichmäßig unter dem Körper nach hinten (60 % der Zeit), rollt über die Spitze ab und schwingt vor;
     Hüfte und Knie folgen dem Fuß (zwei Glieder, ein Ziel). Der Körper hebt und senkt sich je Schritt einmal, die Schultern drehen gegen die Hüfte, die Arme schwingen gegen die Beine. */
  const SCHRITT_M = 0.7, STAND = 0.6, VORN = 0.34, ABROLL = 0.72;
  function geh(ph, tr = '', weit = 1, wR = weit, wL = weit, wN = weit) { // wR, wL = Schrittlänge, mit der der rechte bzw. linke Fuß zuletzt aufgesetzt hat (er steht, bis er abhebt) · wN = Schrittlänge, mit der der schwingende Fuß aufsetzen wird: So wird der erste Schritt kurz und der letzte auch, ohne dass ein Fuß rutscht
    const p = neutral(), hub = Math.min(1, weit / 0.7); // kleine Schritte: weniger Auf und Ab, die Arme schwingen kaum (weit → 0 ist fast der Stand)
    p.py = -(0.012 + 0.034 * hub) - 0.022 * hub * Math.cos(2 * ph + 0.3 * 4 * PI) - 0.02 * Math.max(0, weit - 1); p.neig = 0.02 + 0.03 * hub + 0.08 * Math.max(0, weit - 1);
    const hoch = B.hy + p.py - 0.01, max = B.os + B.us - 0.004;
    const bein = (f, w) => {
      const weg = 2 * SCHRITT_M * w * STAND, vorn = VORN * w, hb = Math.min(1, w / 0.6), hn = Math.min(1, wN / 0.6), roll = ABROLL * hb;
      const u = (((f / (2 * PI) + 0.3) % 1) + 1) % 1; let x, y = 0.085, fuss = 0;
      if (u < STAND) { // steht: der Knöchel wandert nach hinten; am Ende hebt sich die Ferse, die Spitze bleibt stehen
        const xl = vorn - weg * (u / STAND), ab = weich((u - STAND * 0.66) / (STAND * 0.34)) * roll;
        x = xl + 0.14 * (1 - Math.cos(ab)); y = 0.085 + 0.14 * Math.sin(ab); fuss = u < 0.07 ? 0.3 * hb * (1 - u / 0.07) : -ab;
      } else { // schwingt vor: hebt ab, zieht durch, die Spitze kommt hoch, die Ferse setzt auf
        const s = (u - STAND) / (1 - STAND), x0 = vorn - weg + 0.14 * (1 - Math.cos(roll)), e = s * s * (3 - 2 * s);
        x = lerp(x0, VORN * wN, e); y = 0.085 + 0.14 * Math.sin(roll) * (1 - s) * (1 - s) + 0.075 * lerp(hb, hn, s) * Math.sin(PI * s); fuss = lerp(-roll, 0.3 * hn, weich(s * 1.15));
      }
      const Y = hoch - y, D = Math.min(max, Math.hypot(x, Y)), phi = Math.atan2(x, Y), A = Math.acos(grenze((B.os * B.os + D * D - B.us * B.us) / (2 * B.os * D), -1, 1)), K = Math.acos(grenze((B.os * B.os + B.us * B.us - D * D) / (2 * B.os * B.us), -1, 1));
      return [phi + A, 0.03, PI - K, fuss];
    };
    const arm = (f, traegt) => { const c = Math.cos(f + 0.3 * 2 * PI - 0.25 - (traegt ? 0.45 : 0)), k = traegt ? 0.22 : 1; return [(0.36 * c * hub + 0.03) * k, 0.07, traegt ? 0.12 : 0.2 + 0.08 * hub + 0.24 * hub * Math.max(0, c), 0.12]; }; // der Arm schwingt gegen das Bein derselben Seite; der Arm mit der Tasche schwingt kaum und etwas später (die Tasche ist träge)
    p.br = bein(ph, wR); p.bl = bein(ph + PI, wL); p.ar = arm(ph + PI, tr === 'r'); p.al = arm(ph, tr === 'l'); if (tr === 'r') p.hr = 'greift'; if (tr === 'l') p.hl = 'greift';
    const w = ph + 0.3 * 2 * PI; p.dreh = 0.12 * hub * Math.cos(w); p.px = 0.014 * hub * Math.sin(w - 0.5); p.seit = 0.02 * hub * Math.sin(w - 0.5); p.kn = 0.02; p.kd = -0.06 * hub * Math.cos(w); // der Kopf bleibt in Gehrichtung, wenn die Schultern drehen
    return p;
  }
  /* In den Knien: t = Winkel der Oberschenkel (0 = steht gerade). Die Füße bleiben unter dem Körper, die Hüfte sinkt. Für das Aufstehen und Hinsetzen. */
  function hocke(t, armL = 'schoss', armR = 'schoss') {
    const p = neutral(); p.py = -(B.os + B.us) * (1 - Math.cos(t)) * 0.98; p.bl = [t, 0.07, 2 * t, 0]; p.br = [t, 0.07, 2 * t, 0]; return arme(p, armL, armR);
  }
  /* Zwischen zwei Haltungen */
  function zwischen(a, b, t) {
    if (t <= 0) return a; if (t >= 1) return b;
    const p = {}; for (const k in a) { const x = a[k], y = b[k]; p[k] = Array.isArray(x) ? x.map((v, i) => lerp(v, y[i], t)) : typeof x === 'number' || typeof x === 'boolean' ? lerp(+x, +(y ?? x), t) : t < 0.5 ? x : y; } // (auch Eigenart und freie Arme gleiten: Die Hand kommt aus der Tasche, die Arme lösen sich; ein Sprung im ersten Bild fiel auf)
    return p;
  }
  /* Ruhiges, unregelmäßiges Rauschen (−1 … 1): zwei Schwingungen mit krummen Verhältnissen, je Figur anders (saat) */
  const rausch = (t, saat, tempo = 1) => 0.6 * Math.sin(t * 0.00071 * tempo + saat * 12.9) + 0.4 * Math.sin(t * 0.00123 * tempo + saat * 4.7 + 1.3);
  /* Halten, springen, halten (0 … 1): ein Wert, der alle takt ms neu gewählt wird und in weichMs hinübergleitet. Für Blicke und das Verlagern des Gewichts: Menschen bewegen sich in Ereignissen, nicht in Wellen. */
  const zufall = (n, saat) => { const x = Math.sin(n * 127.1 + saat * 311.7) * 43758.5453; return x - Math.floor(x); };
  const stufe = (t, saat, takt, weichMs = 160) => { const u = (t + saat * 977) / takt, n = Math.floor(u), a = zufall(n - 1, saat), b = zufall(n, saat); return lerp(a, b, weich(((u - n) * takt) / weichMs)); };
  /* Weiche Kurve einer Bewegung mit Anlauf und Ausklang (0 … 1; Tempo und Beschleunigung sind an beiden Enden null) · hin, halten, zurück (ms) */
  const sanft = (u) => { u = grenze(u, 0, 1); return u * u * u * (u * (6 * u - 15) + 10); };
  const bogen = (ms, an, halt, ab) => (ms <= 0 ? 0 : ms < an ? sanft(ms / an) : ms < an + halt ? 1 : 1 - sanft((ms - an - halt) / ab));
  /* Kennzahl einer Haltung: Zwei Haltungen mit derselben Kennzahl sehen gleich aus (auf ein Fünfhundertstel Bogenmaß). Ein Ruhebild wird nur neu gezeichnet, wenn sie sich ändert: In Ruhe steht das Bild wirklich still. */
  function sig(p) { let h = 7; for (const k in p) { const v = p[k]; if (typeof v === 'number') h = (h * 31 + Math.round(v * 500)) | 0; else if (Array.isArray(v)) for (const x of v) h = (h * 31 + Math.round(x * 500)) | 0; else if (typeof v === 'string') h = (h * 31 + v.length * 7 + (v.charCodeAt(0) || 0)) | 0; } return h; }
  /* Leben in Ruhe, das den Körper nicht bewegt: Lidschlag (alle drei bis sechs Sekunden, manchmal doppelt) und Blick (hält und springt). Alles andere (Gewicht verlagern, Kopf wenden, Nicken, Gesten, Arbeit der Hände)
     sind einzelne Bewegungen mit Anlauf und Ausklang, die der Taktgeber des Raums vergibt (haus.js › regen): Dazwischen steht ein Mensch still. Kein Rauschen, keine Wellen: Sie wirkten im Bild als Zittern. p wird verändert. t in ms, saat je Figur */
  function leben(p, t, saat) {
    if (!t) return p;
    const sa = ((saat % 1) + 1) % 1, takt = 3200 + sa * 2600, bl = (t + saat * 1700) % takt; p.blinz = bl < 150 || (bl > 420 && bl < 540 && saat % 2 > 1.4) ? 1 : 0;
    p.schau = (zufall(Math.floor((t + saat * 3224) / (2300 + sa * 2100)), saat + 3.3) * 2 - 1) * 0.8;
    return p;
  }
  /* Gespräch zu zweit: Wer spricht, wer hört zu. paar = Kennzahl des Gesprächs (für beide gleich), teil = 0 | 1. Liefert { rede: 0 … 1 (dieser Mensch spricht gerade), nick: 0 … 1 (er nickt, während der andere spricht) }.
     Die Wortwechsel dauern drei bis sechs Sekunden und sind ungleich lang; zwischen ihnen liegt eine kurze Pause. Nie sprechen beide zugleich. */
  function gespraech(t, paar = 0, teil = 0) {
    const u = t * 0.00023 + paar * 7.13 + 0.35 * rausch(t, paar + 2.2, 0.22), n = Math.floor(u), f = u - n, dran = (((n % 2) + 2) % 2) === (teil ? 1 : 0), an = weich(f / 0.07) * (1 - weich((f - 0.86) / 0.1));
    return { rede: dran ? an : 0, nick: dran ? 0 : Math.max(0, Math.sin((f - 0.38) * PI * 5)) * (f > 0.38 && f < 0.78 ? 1 : 0) };
  }
  /* Sprechen und Zuhören auf eine Haltung legen (nach leben): Wer dran ist, bewegt den Mund in Silben und gestikuliert mit den Armen, die dafür frei sind (Hand offen); wer zuhört, hält die Hände ruhig, sieht hin und nickt. */
  function reden(p, t, saat, paar = 0, teil = 0) {
    if (!t) return p;
    const g = gespraech(t, paar, teil), n1 = rausch(t, saat + 1.7, 1.5), n2 = rausch(t, saat + 2.9, 1.1);
    p.mund = g.rede > 0.05 ? g.rede * (0.3 + 0.5 * Math.abs(Math.sin(t * 0.011 + saat * 3))) : 0; p.kn += 0.075 * g.nick + 0.03 * g.rede * n1;
    for (const [A, h] of [[p.ar, p.hr], [p.al, p.hl]]) if (h === 'offen') { A[0] += g.rede * (0.14 * n1 + 0.05); A[2] += g.rede * 0.22 * n2 - (1 - g.rede) * 0.35; A[1] += g.rede * 0.06 * n2; } // wer zuhört, lässt die Hände sinken
    p.rede = g.rede; return p;
  }
  /* ── Skelett im Raum des Körpers: [rechts, oben, vorn] in Metern eines 1,74 m großen Menschen (rund 7,5 Köpfe: der Kopf misst 0,235 m) ── */
  const B = { hy: 0.93, ob: 0.285, ub: 0.255, hand: 0.165, os: 0.43, us: 0.415 };
  const HB = 0.09, TRINKT = [0.75, 0.12, 2.3, 0.5]; // halber Abstand der Hüftgelenke · Arm mit dem Becher am Mund
  function skelett(p, m, knick = true) {
    const E = m.eig, ei = p.ei || 0, stw = p.st || 0, si = p.si || 0, sbk = Math.sin(p.bk || 0), neig = p.neig + 0.05 * E.rund;
    let al = p.al, ar = p.ar, hl = p.hl, hr = p.hr, dl = null, dr = null, bl = p.bl, br = p.br, py = p.py, ks = p.ks, kn = p.kn, ausR = p.aus ?? 0.13, ausL = ausR, knL = p.kl ? [p.kl, 1] : null, knR = p.kr ? [p.kr, 1] : null;
    if (ei > 0.01) { // freie Arme nehmen die Gewohnheit dieses Menschen an (Hand in der Tasche, Arme verschränkt, Becher …)
      const gl = EIGEN[E.l], gr = EIGEN[E.r], wl = ei * (p.fl || 0) * (gl.paar ? p.fr || 0 : 1), wr = ei * (p.fr || 0) * (gr.paar ? p.fl || 0 : 1);
      if (wl > 0.01 && gl.a) { const z = ARME[gl.a], t = weich(wl); al = al.map((v, i) => lerp(v, z[i], t)); if (KNICK[gl.a]) knL = [gl.a, t]; if (wl > 0.5) { hl = gl.h; dl = gl.d || null; } }
      if (wr > 0.01 && gr.a) { const z = ARME[gr.a], t = weich(wr); ar = ar.map((v, i) => lerp(v, z[i], t)); if (KNICK[gr.a]) knR = [gr.a, t]; if (wr > 0.5) { hr = gr.h; dr = gr.d || null; } }
      ks += E.ks * ei;
      const zug = (p.zug || 0) * ei; // die kleine Bewegung aus der Gewohnheit
      if (zug > 0.01) for (const [g2, w2, li] of [[gl, wl, 1], [gr, wr, 0]]) if (w2 > 0.5) { let A = li ? al : ar;
        if (g2.a === 'becher') { A = A.map((v, i) => lerp(v, TRINKT[i], zug)); kn -= 0.1 * zug; } else if (g2.a === 'mappe') { A = A.map((v, i) => v + [0.12, 0, -0.3, -0.25][i] * zug); kn += 0.24 * zug; } else if (g2.a === 'kinn') { A = A.map((v, i) => v + [0, 0, -0.16, 0][i] * zug); kn += 0.06 * zug; }
        if (li) al = A; else ar = A; }
    }
    if (stw > 0.001) { // Stand: Die Füße stehen fest (Breite, Versatz und Drehung sind Eigenart), das Becken wandert mit dem Gewicht über ihnen; beide Beine folgen ihrem Fuß (zwei Glieder, ein Ziel). So rutscht kein Fuß, wenn das Gewicht wandert.
      const w = p.w || 0;
      const ziel = (s) => { const frei = Math.max(0, -s * w), roll = ei * E.spitze * weich((frei - 0.25) / 0.5); return { x: s * (0.105 + ei * E.breit), z: ei * s * E.vor * 0.5 + 0.14 * (1 - Math.cos(roll)), y: 0.085 + 0.14 * Math.sin(roll), fuss: -roll, frei }; };
      const lage = (s, Z) => { const dx = s * (Z.x - (p.px + s * HB)); let ab = dx / 0.596; ab -= (B.os * Math.sin(ab) + B.us * Math.sin(0.4 * ab) - dx) / (B.os * Math.cos(ab) + 0.4 * B.us * Math.cos(0.4 * ab));
        const l1 = B.os * Math.cos(ab), l2 = B.us / Math.hypot(Math.sin(0.4 * ab), 1); return { ab, l1, l2, x: Z.z - p.pf, max: l1 + l2 - 0.0015 }; };
      const ZR = ziel(1), ZL = ziel(-1), GR = lage(1, ZR), GL = lage(-1, ZL);
      const hoch = (s, Z, G) => Math.sqrt(Math.max(0.01, G.max * G.max - G.x * G.x)) + Z.y - s * HB * sbk + 0.01; // so hoch kann die Beckenmitte über diesem Fuß höchstens stehen
      const hy = Math.min(hoch(1, ZR, GR), hoch(-1, ZL, GL));
      const loes = (s, Z, G) => { const Y = hy - 0.01 + s * HB * sbk - Z.y, D = Math.min(G.max, Math.hypot(G.x, Y)), phi = Math.atan2(G.x, Y), A = Math.acos(grenze((G.l1 * G.l1 + D * D - G.l2 * G.l2) / (2 * G.l1 * D), -1, 1)), K = Math.acos(grenze((G.l1 * G.l1 + G.l2 * G.l2 - D * D) / (2 * G.l1 * G.l2), -1, 1)); return [phi + A, G.ab, PI - K, Z.fuss]; };
      const nR = loes(1, ZR, GR), nL = loes(-1, ZL, GL);
      py = lerp(p.py, hy - B.hy, stw); br = br.map((v, i) => lerp(v, nR[i], stw)); bl = bl.map((v, i) => lerp(v, nL[i], stw));
      ausR = lerp(ausR, E.aus + 0.1 * ZR.frei, ei * stw); ausL = lerp(ausL, E.aus + 0.1 * ZL.frei, ei * stw);
    }
    if (si > 0.001) { const Z = SITZART[E.sitz]; if (Z) { br = br.map((v, i) => v + si * Z[0][i]); bl = bl.map((v, i) => v + si * Z[1][i]); } if (E.sitz === 'weit') ausR = ausL = lerp(ausR, 0.3, si); }
    const hip = [p.px, B.hy + py, p.pf];
    const sn = Math.sin(neig), cn = Math.cos(neig), ss = Math.sin(p.seit), cs = Math.cos(p.seit), T = [ss, cn * cs, sn * cs];
    const sp = (y, v = 0) => [hip[0] + T[0] * y, hip[1] + T[1] * y - sn * v, hip[2] + T[2] * y + cn * v];
    const st = Math.sin(p.dreh), ct = Math.cos(p.dreh), sc = sp(0.475), sb = m.sb, hb = m.hb, ssk = Math.sin(p.sk || 0);
    const schulter = (s, heb) => [sc[0] + s * cs * ct * sb, sc[1] - s * ss * sb + s * ssk * sb + heb, sc[2] + s * st * sb];
    const arm = (S, A, s, kq) => {
      const a = A[0] + neig * 0.5, U = [s * Math.sin(A[1]), -Math.cos(a) * Math.cos(A[1]), Math.sin(a) * Math.cos(A[1])], el = [S[0] + U[0] * B.ob, S[1] + U[1] * B.ob, S[2] + U[2] * B.ob];
      const a2 = a + A[2], b2 = A[1] - A[3], F = [s * Math.sin(b2), -Math.cos(a2) * Math.cos(b2), Math.sin(a2) * Math.cos(b2)], hg = [el[0] + F[0] * B.ub, el[1] + F[1] * B.ub, el[2] + F[2] * B.ub];
      let G = F; if (kq && knick) { const K = KNICK[kq[0]], u = K[3] * kq[1], g = [lerp(F[0], s * K[0], u), lerp(F[1], K[1], u), lerp(F[2], K[2], u)], n = Math.hypot(g[0], g[1], g[2]) || 1; G = [g[0] / n, g[1] / n, g[2] / n]; } // die Hand knickt im Handgelenk ab
      return { s: S, e: el, h: hg, f: [hg[0] + G[0] * B.hand, hg[1] + G[1] * B.hand, hg[2] + G[2] * B.hand], F };
    };
    const bein = (L, s, aus) => {
      const H = [hip[0] + s * hb, hip[1] - 0.01 + s * hb * sbk, hip[2] - s * st * 0.4 * hb], U = [s * Math.sin(L[1]), -Math.cos(L[0]) * Math.cos(L[1]), Math.sin(L[0]) * Math.cos(L[1])], kn = [H[0] + U[0] * B.os, H[1] + U[1] * B.os, H[2] + U[2] * B.os];
      const a2 = L[0] - L[2], V = [s * Math.sin(L[1] * 0.4), -Math.cos(a2), Math.sin(a2)], kc = Math.hypot(V[0], V[1], V[2]), an = [kn[0] + (V[0] / kc) * B.us, kn[1] + (V[1] / kc) * B.us, kn[2] + (V[2] / kc) * B.us];
      const fp = L[3], D = [s * aus, Math.sin(fp), Math.cos(fp)];
      const ferse = [an[0] - D[0] * 0.045, an[1] - 0.045 - D[1] * 0.045, an[2] - D[2] * 0.045], spitze = [an[0] + D[0] * 0.165, an[1] - 0.054 + D[1] * 0.165, an[2] + D[2] * 0.165];
      return { h: H, k: kn, a: an, ferse, spitze, tief: Math.min(ferse[1] - 0.04, spitze[1] - 0.031) };
    };
    const hals = sp(0.555, 0.008), kopf = [hals[0] + Math.sin(ks) * 0.13, hals[1] + 0.128 * Math.cos(kn * 0.7), hals[2] + 0.128 * Math.sin(kn * 0.7) + 0.024 + 0.024 * E.rund]; // der Kopf sitzt eine Spur vor den Schultern (bei rundem Rücken weiter)
    const R = arm(schulter(1, p.hebR), ar, 1, knR), L = arm(schulter(-1, p.hebL), al, -1, knL), bR = bein(br, 1, ausR), bL = bein(bl, -1, ausL);
    return { hip, sp, T, R, L, bR, bL, hals, kopf, hl, hr, dl, dr, grund: (+p.boden || 0) * Math.min(bR.tief, bL.tief) }; // (boden kann zwischen zwei Haltungen ein Anteil sein: Beim Aufstehen sinkt die Figur stetig auf ihre Füße, statt in einem Bild zu springen)
  }

  /* ── Formen ── */
  function kapsel(g, ax, ay, ra, bx, by, rb) { const w = Math.atan2(by - ay, bx - ax); g.moveTo(ax + ra * Math.cos(w + PI / 2), ay + ra * Math.sin(w + PI / 2)); g.arc(ax, ay, ra, w + PI / 2, w + PI * 1.5); g.arc(bx, by, rb, w - PI / 2, w + PI / 2); g.closePath(); }
  const kap = (g, s, zu = 0) => kapsel(g, s.a[0], s.a[1], s.ra + zu, s.b[0], s.b[1], s.rb + zu);
  /* Geschlossener, weicher Zug durch Punkte (Catmull-Rom) in einen Pfad; dx, dy = versetzt */
  function zug(q, P0, dx = 0, dy = 0) {
    const n = P0.length; let fl = 0; for (let i = 0; i < n; i++) { const a = P0[i], b = P0[(i + 1) % n]; fl += a[0] * b[1] - b[0] * a[1]; }
    const P = fl < 0 ? P0.slice().reverse() : P0; q.moveTo(P[0][0] + dx, P[0][1] + dy); // immer im selben Umlaufsinn (wie Kapseln, Kreise, Rechtecke): So lassen sich die Teile zu einem Umriss vereinen, ohne dass sich Überlappungen aufheben
    for (let i = 0; i < n; i++) { const a = P[(i + n - 1) % n], b = P[i], c = P[(i + 1) % n], d = P[(i + 2) % n]; q.bezierCurveTo(b[0] + (c[0] - a[0]) / 6 + dx, b[1] + (c[1] - a[1]) / 6 + dy, c[0] - (d[0] - b[0]) / 6 + dx, c[1] - (d[1] - b[1]) / 6 + dy, c[0] + dx, c[1] + dy); }
    q.closePath();
  }
  const eck = (g, P) => { g.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) g.lineTo(P[i][0], P[i][1]); g.closePath(); };
  const fuell = (g, farbe, fn) => { g.beginPath(); fn(g); g.fillStyle = farbe; g.fill(); };
  const strich = (g, farbe, breite, fn, a = 1) => { g.beginPath(); fn(g); g.strokeStyle = farbe; g.lineWidth = breite; g.lineCap = 'round'; g.lineJoin = 'round'; if (a < 1) g.globalAlpha = a; g.stroke(); if (a < 1) g.globalAlpha = 1; };
  /* Rumpf: Querschnitte von unten nach oben: [Höhe über dem Hüftgelenk, halbe Breite, halbe Tiefe, nach vorn versetzt] */
  const RUMPF = {
    a: [[-0.07, 0.15, 0.1, -0.012], [0.02, 0.17, 0.114, -0.016], [0.17, 0.152, 0.104, 0.004], [0.35, 0.182, 0.12, 0.018], [0.47, 0.212, 0.104, 0.004], [0.528, 0.14, 0.078, 0], [0.572, 0.056, 0.058, 0.012]],
    b: [[-0.07, 0.158, 0.106, -0.014], [0.02, 0.184, 0.12, -0.02], [0.17, 0.134, 0.096, 0.004], [0.345, 0.166, 0.126, 0.03], [0.47, 0.19, 0.098, 0.004], [0.528, 0.124, 0.072, 0], [0.572, 0.05, 0.054, 0.012]],
  };
  /* Blick auf die Figur: Gelenke → Bildpunkte [x, y, Größe durch Nähe, Tiefe] */
  function sichtVon(m, sk, o, x0, y0, k) {
    const dreh = o.dreh || 0, cd = Math.cos(dreh), sd = Math.sin(dreh), auge = (o.auge ?? 1.5) / m.gr, dz = Math.max(1.2, (o.dz ?? 6) / m.gr);
    return (q) => { const vx = -q[0] * cd + q[2] * sd, vy = q[1] - sk.grund, vz = q[0] * sd + q[2] * cd, nah = 1 + grenze(vz / dz, -0.25, 0.25); return [x0 + vx * k * nah, y0 - vy * k + vz * k * grenze((auge - vy) / dz, -0.14, 0.45), nah, vz]; };
  }
  /* Wie viel Platz eine Haltung braucht: Abstand der äußersten Gelenke von der Bodenstelle in Metern (bei k0 = 1): l, r (links, rechts), o (nach oben), u (nach unten). Ohne Luft für Haare, Hände und Dinge in der Hand. */
  function rahmen(m, p, o) {
    const sk = skelett(p, m), pt = sichtVon(m, sk, o, 0, 0, m.gr), R = { l: 0.2, r: 0.2, o: 0, u: 0 };
    for (const q of [sk.hip, sk.kopf, sk.hals, sk.R.s, sk.R.e, sk.R.h, sk.R.f, sk.L.s, sk.L.e, sk.L.h, sk.L.f, sk.bR.h, sk.bR.k, sk.bR.a, sk.bR.ferse, sk.bR.spitze, sk.bL.h, sk.bL.k, sk.bL.a, sk.bL.ferse, sk.bL.spitze]) { const b = pt(q); R.l = Math.max(R.l, -b[0]); R.r = Math.max(R.r, b[0]); R.o = Math.max(R.o, -b[1]); R.u = Math.max(R.u, b[1]); }
    R.o += 0.15 * m.gr; return R; // über dem Mittelpunkt des Kopfs liegt noch der halbe Kopf samt Haar
  }

  /* Eine Figur malen. g = Zeichenfläche · m = Mensch · p = Haltung · x0, y0 = Bildstelle des Bodens unter dem Körper · k = Pixel je Meter (ohne Körpergröße)
     o: dreh (0 = schaut zum Betrachter, π/2 = nach rechts, π = in den Raum hinein, −π/2 = nach links) · auge = Höhe des Betrachters über dem Boden der Figur · dz = Abstand (beides in Metern)
        licht = Lichtrechnung des Raums (siehe tonwerte) · L = [x, y] Richtung zum Licht im Bild · saum = { farbe: 'r,g,b', a } Lichtkante · rand = { farbe: 'r,g,b', px } Umriss beim Hervorheben
        r, l = was die rechte bzw. linke Hand hält: tasche | handy | handyhoch | tablet | stift | becher | mappe (ohne Angabe: was zur Gewohnheit des freien Arms gehört) · fein = false: immer die kleine Stufe · teil = [von, bis]: nur diese Scheibe (Anteile der Teile, von hinten nach vorn) · leicht = ohne Lichtkanten, Falten und Ausschnitt (für Bilder, die unterwegs entstehen)
        modus: 'umriss' = nur die gestrichelte Kontur (für den leeren Platz; g muss dann eine eigene, leere Fläche sein) · 'rand' = nur der Lichtsaum des Hervorhebens (o.rand) */
  function malen(g, m, p, x0, y0, k0, o) {
    const k = k0 * m.gr, sk = skelett(p, m, !(o.fein === false || k < STUFEN[0])), dreh = o.dreh || 0, cd = Math.cos(dreh), sd = Math.sin(dreh), pt = sichtVon(m, sk, o, x0, y0, k);
    const D = o.fein === false || k < STUFEN[0] ? 0 : k < STUFEN[1] ? 1 : 2, T = toene(m, o.licht), L = o.L || [-0.5, -0.86], lx = L[0], ly = L[1];
    const kante = D && o.saum && o.saum.a > 0.02 ? `rgba(${o.saum.farbe},${Math.min(1, o.saum.a * 1.9)})` : null, gegen = D && o.licht.gegen ? `rgba(${o.licht.gegen},${o.licht.gegenA ?? 0.3})` : null; // gegen = schwaches zweites Licht von der anderen Seite: löst dunkle Kleidung vom dunklen Raum
    const leicht = !!o.leicht; // leicht = für Bilder, die unterwegs entstehen (Gehen, Aufstehen): ohne Lichtkanten, Falten und Ausschnitt (Striche und Ausschnitte kosten die Grafikkarte am meisten)
    const teile = []; // { d: Tiefe, pfad(): Umriss als Path2D, mal(g) }
    const seg = (a, b, ra, rb, ton, oa) => ({ a, b, ra: ra * k * a[2], rb: rb * k * b[2], ton, oa }); // oa = am Anfang kein Schattenring (das Glied setzt am Körper an: Hüfte, Schulter)
    const mitte = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)];
    /* Ein Glied aus Stücken (Kapseln): Eigenfarbe, Schattenseite als schmale Kapsel innen an der dem Licht abgewandten Kante, Lichtkante zur Lichtquelle; falten = Gelenke mit Falten im Stoff */
    const gliedMal = (gg, S, os, falten) => {
      const N = S.map((s) => { const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1], len = Math.hypot(dx, dy), nx = len > 0.5 ? -dy / len : -lx, ny = len > 0.5 ? dx / len : -ly, nl = nx * lx + ny * ly; return [nx, ny, nl >= 0 ? -1 : 1, Math.abs(nl), len]; }); // je Stück: Normale, Seite des Schattens, wie quer das Licht steht, Länge
      for (const s of S) fuell(gg, s.ton.d, (q) => kap(q, s));
      S.forEach((s, i) => { const [nx, ny, sch, , ] = N[i], e = 0.23, ea = s.oa ? 0 : e; fuell(gg, s.ton.m, (q) => kapsel(q, s.a[0] - sch * nx * s.ra * ea, s.a[1] - sch * ny * s.ra * ea, s.ra * (1 - ea), s.b[0] - sch * nx * s.rb * e, s.b[1] - sch * ny * s.rb * e, s.rb * (1 - e))); });
      if (D && !leicht) S.forEach((s, i) => { const [nx, ny, sch, quer, len] = N[i]; if (s.ra < 2.5 || len < s.ra) return;
        if (!os) strich(gg, kante || s.ton.l, Math.max(1, s.ra * 0.1), (q) => { q.moveTo(s.a[0] - sch * nx * s.ra * 0.88, s.a[1] - sch * ny * s.ra * 0.88); q.lineTo(s.b[0] - sch * nx * s.rb * 0.88, s.b[1] - sch * ny * s.rb * 0.88); }, 0.22 + 0.55 * quer);
        if (gegen && !os) strich(gg, gegen, Math.max(1, s.ra * 0.09), (q) => { q.moveTo(s.a[0] + sch * nx * s.ra * 0.92, s.a[1] + sch * ny * s.ra * 0.92); q.lineTo(s.b[0] + sch * nx * s.rb * 0.92, s.b[1] + sch * ny * s.rb * 0.92); });
      });
      if (D && falten && !leicht) for (const J of falten) { // Falten im Stoff: kurze Bögen quer über das Gelenk, auf der Seite, zu der es beugt
        const st = S.find((q) => q.b === J), nb = S.find((q) => q.a === J); if (!st || !nb || st.rb < 3) continue;
        const r = st.rb, w1 = Math.atan2(J[1] - st.a[1], J[0] - st.a[0]), w2 = Math.atan2(nb.b[1] - J[1], nb.b[0] - J[0]); let kn = w2 - w1; while (kn > PI) kn -= 2 * PI; while (kn < -PI) kn += 2 * PI;
        const seite = kn > 0 ? 1 : -1, wm = (w1 + w2) / 2 + (seite * PI) / 2, staerke = Math.min(1, 0.3 + Math.abs(kn)), ax = Math.cos((w1 + w2) / 2), ay = Math.sin((w1 + w2) / 2);
        for (const [ab, l2] of D > 1 && Math.abs(kn) > 0.3 ? [[-0.34, 0.5], [0.02, 0.72], [0.36, 0.44]] : [[0, 0.6]]) { const cx = J[0] + ax * r * ab, cy = J[1] + ay * r * ab;
          strich(gg, st.ton.t, Math.max(1, r * 0.09), (q) => { q.moveTo(cx + Math.cos(wm) * r * 0.92, cy + Math.sin(wm) * r * 0.92); q.quadraticCurveTo(cx + Math.cos(wm) * r * 0.4 + ax * r * 0.12, cy + Math.sin(wm) * r * 0.4 + ay * r * 0.12, cx + Math.cos(wm) * r * (0.92 - l2 * 1.5), cy + Math.sin(wm) * r * (0.92 - l2 * 1.5)); }, (Math.abs(kn) > 0.3 ? 0.55 : 0.4) * staerke); }
      }
    };
    const glied = (S, d, os, falten, extra) => teile.push({ d, pfad: () => { const q = new Path2D(); for (const s of S) kap(q, s); return q; }, mal: (gg) => { gliedMal(gg, S, os, falten); if (extra) extra(gg); } });

    // ── Beine, Schuhe ──
    const rock = m.unter.art === 'rock', schn = m.unter.schnitt === 'schmal' ? 0.9 : m.unter.schnitt === 'weit' ? 1.14 : 1, hf = m.b ? 1.04 : 1, vorn = cd, seitlich = sd; // vorn > 0: wir sehen die Vorderseite
    for (const bn of [sk.bR, sk.bL]) {
      const H = pt(bn.h), Kn = pt(bn.k), A = pt(bn.a), F = pt(bn.ferse), Z = pt(bn.spitze), bt = rock ? T.haut : T.unter, d0 = (H[3] + 2 * Kn[3] + A[3]) / 4, dB = Kn[3] - H[3] < 0.2 ? Math.min(d0, pt(sk.hip)[3] + 0.003) : d0;
      const kr = 0.066 * schn, wr = 0.067 * schn, sr = m.unter.schnitt === 'schmal' ? 0.047 : m.unter.schnitt === 'weit' ? 0.072 : 0.057, fein = D && !leicht && !rock; // Radien an Knie, Wade und Saum: Das Hosenbein verjüngt sich zum Knie, die Wade trägt auf, der Saum ist je Schnitt enger oder weiter
      const As = m.unter.kurz && !rock && !leicht ? mitte(Kn, A, 0.86) : A, ul = Math.hypot(As[0] - Kn[0], As[1] - Kn[1]), se = sr * k * As[2], Ae = fein ? mitte(Kn, As, 1 - Math.min(0.3, (0.8 * se) / (ul || 1))) : As, Wd = mitte(Kn, A, 0.3); // As = wo das Hosenbein endet (7/8-Hose: über dem Knöchel; in der leichten Fassung wie jede Hose, das spart zwei Flächen je Bein)
      const S = rock ? [seg(H, Kn, 0.074, 0.05, bt, 1), seg(Kn, mitte(Kn, A, 0.34), 0.05, 0.054, bt), seg(mitte(Kn, A, 0.34), A, 0.054, 0.034, bt)] : fein ? [seg(H, Kn, 0.098 * hf, kr, bt, 1), seg(Kn, Wd, kr, wr, bt), seg(Wd, Ae, wr, sr, bt)] : [seg(H, Kn, 0.098 * hf, kr, bt, 1), seg(Kn, As, kr, sr, bt)];
      if (As !== A) glied([seg(As, A, 0.04, 0.034, T.haut)], dB - 0.001, true, null, null); // der Knöchel
      glied(S, dB, true, rock ? null : [Kn], fein && ul > se ? (gg) => { // der Saum: Das Hosenbein endet gerade über dem Schuh und steht vorn auf dem Spann auf (eine Falte darüber)
        const ux = (As[0] - Kn[0]) / ul, uy = (As[1] - Kn[1]) / ul, qx = -uy, qy = ux, sch = qx * lx + qy * ly >= 0 ? -1 : 1, C = [As[0] + ux * se * 0.3, As[1] + uy * se * 0.3], b2 = se;
        fuell(gg, bt.m, (q) => eck(q, [[Ae[0] - qx * se, Ae[1] - qy * se], [Ae[0] + qx * se, Ae[1] + qy * se], [C[0] + qx * b2, C[1] + qy * b2], [C[0] - qx * b2, C[1] - qy * b2]]));
        fuell(gg, bt.d, (q) => eck(q, [[Ae[0] + sch * qx * se, Ae[1] + sch * qy * se], [C[0] + sch * qx * b2, C[1] + sch * qy * b2], [C[0] + sch * qx * b2 * 0.56, C[1] + sch * qy * b2 * 0.56], [Ae[0] + sch * qx * se * 0.54, Ae[1] + sch * qy * se * 0.54]]));
        strich(gg, bt.t, Math.max(1, 0.011 * k), (q) => { q.moveTo(C[0] - qx * b2 * 0.86, C[1] - qy * b2 * 0.86 - uy * 0.006 * k); q.lineTo(C[0] + qx * b2 * 0.86, C[1] + qy * b2 * 0.86 - uy * 0.006 * k); }, 0.6);
        const fx2 = As[0] - ux * se * 1.5, fy2 = As[1] - uy * se * 1.5, vs = Z[0] - F[0] >= 0 ? 1 : -1; // die Falte liegt auf der Seite der Fußspitze
        strich(gg, bt.t, Math.max(1, 0.007 * k), (q) => { q.moveTo(fx2 + vs * qx * se * 0.95, fy2 + vs * qy * se * 0.95 - uy * se * 0.1); q.quadraticCurveTo(fx2 + ux * se * 0.5, fy2 + uy * se * 0.5, fx2 - vs * qx * se * 0.5, fy2 - vs * qy * se * 0.5 + uy * se * 0.25); }, 0.42);
        if (D > 1 && vorn > 0.3) { const r = kr * k * Kn[2]; strich(gg, bt.t, Math.max(1, 0.006 * k), (q) => { q.moveTo(Kn[0] - r * 0.5, Kn[1] + r * 0.25); q.quadraticCurveTo(Kn[0], Kn[1] + r * 0.7, Kn[0] + r * 0.5, Kn[1] + r * 0.25); }, 0.3); } // von vorn: die Kniescheibe als feiner Bogen
      } : null);
      teile.push({ d: rock ? (F[3] + Z[3]) / 2 + 0.004 : dB - 0.002, pfad: () => { const q = new Path2D(); kapsel(q, F[0], F[1], 0.046 * k * F[2], Z[0], Z[1], 0.036 * k * Z[2]); return q; }, mal: (gg) => schuh(gg, m, T, A, F, Z, k, lx, ly, D, rock) }); // das Hosenbein fällt über den Schuh
    }
    // ── Becken und Rumpf ──
    const Q = m.Q, atem = 1 + 0.012 * (p.atem || 0), ebene = (i) => {
      const [y, a, b, v] = Q[i], gew = grenze((y - 0.02) / 0.44, 0, 1), w = dreh - p.dreh * gew, c = pt(sk.sp(y, v));
      return { c, w: Math.hypot(a * m.w * Math.cos(w), b * (0.6 + 0.4 * m.w) * (i === 3 ? atem : 1) * Math.sin(w)) * k * c[2] };
    };
    const E = Q.map((_, i) => ebene(i)), unten = E[0].c, oben = E[E.length - 1].c, al = Math.hypot(oben[0] - unten[0], oben[1] - unten[1]) || 1, nx = -(oben[1] - unten[1]) / al, ny = (oben[0] - unten[0]) / al;
    const kipp = [p.bk + p.seit, p.bk + p.seit, 0.4 * (p.bk + p.seit), 0.5 * p.sk, p.sk, p.sk, 0.3 * p.sk], ax = (oben[0] - unten[0]) / al, ay = (oben[1] - unten[1]) / al; // Becken und Schulterlinie stehen schräg zur Achse des Rumpfs (Standbein, Spielbein): Die Querschnitte werden geschert
    const rand2 = (i, s, f = 1) => { const e = E[i], sh = -s * cd * kipp[i] * Q[i][1] * m.w * k * e.c[2] * f; return [e.c[0] + s * nx * e.w * f + ax * sh, e.c[1] + s * ny * e.w * f + ay * sh]; };
    const kontur = (von, bis, kappeU = 0) => { const li = [], re = []; for (let i = von; i <= bis; i++) { li.push(rand2(i, -1)); re.push(rand2(i, 1)); } if (kappeU) { const e = E[von]; li.unshift([e.c[0] - nx * e.w * 0.62, e.c[1] - ny * e.w * 0.62 + kappeU * k]); re.unshift([e.c[0] + nx * e.w * 0.62, e.c[1] + ny * e.w * 0.62 + kappeU * k]); } return [...li, ...re.reverse()]; };
    const rumpfTiefe = pt(sk.sp(0.25))[3], art = m.ober.art, rein = art === 'hemd' || art === 'bluse', lang = art === 'blazer' || art === 'hoodie', von = rein ? 2 : 1;
    const sSch = nx * lx + ny * ly >= 0 ? -1 : 1; // auf dieser Seite des Rumpfs liegt der Schatten
    const band = (gg, vonI, bisI, s, f0, f1, farbe) => fuell(gg, farbe, (q) => { const P = []; for (let i = vonI; i <= bisI; i++) P.push(rand2(i, s, f0)); for (let i = bisI; i >= vonI; i--) P.push(rand2(i, s, f1)); zug(q, P); }); // ein Streifen längs des Rumpfs, zwischen zwei Anteilen der halben Breite
    { const pk = kontur(0, 2, 0.03), dP = pt(sk.hip)[3] + 0.006; // Becken: der Hosenbund, darunter der Schritt
      teile.push({ d: dP, pfad: () => { const q = new Path2D(); zug(q, pk); return q; }, mal: (gg) => { fuell(gg, T.unter.m, (q) => zug(q, pk)); band(gg, 0, 2, sSch, 0.96, 0.62, T.unter.d);
        if (D && rein) { const a = rand2(2, -1), b = rand2(2, 1), h = 0.03 * k; strich(gg, T.guertel.m, h, (q) => { q.moveTo(a[0] + nx * h * 0.4, a[1] + h * 0.6); q.lineTo(b[0] - nx * h * 0.4, b[1] + h * 0.6); }); // Gürtel mit Schnalle
          if (vorn > 0.25) { const mx = E[2].c[0] + Q[2][2] * seitlich * k * 0.9, my = E[2].c[1] + h * 0.6; fuell(gg, T.gold.m, (q) => q.rect(mx - h * 0.62, my - h * 0.6, h * 1.24, h * 1.2)); fuell(gg, T.guertel.m, (q) => q.rect(mx - h * 0.32, my - h * 0.3, h * 0.64, h * 0.6)); } }
        if (D > 1 && !leicht && !rock && vorn > 0.3) { const u = E[0].c, w0 = E[0].w, vx = Q[0][2] * seitlich * k * 0.9, ut = T.unter.t, lw2 = Math.max(1, 0.006 * k); // der Schritt: zwei Falten, die vom Schritt nach außen ziehen; bei Hemd in der Hose dazu die Eingriffe der Taschen
          for (const s2 of [-1, 1]) { strich(gg, ut, lw2, (q) => { q.moveTo(u[0] + vx + s2 * 0.012 * k, u[1] + 0.02 * k); q.quadraticCurveTo(u[0] + vx + s2 * w0 * 0.3, u[1] + 0.004 * k, u[0] + vx + s2 * w0 * 0.62, u[1] - 0.03 * k); }, 0.4);
            if (rein) strich(gg, ut, lw2, (q) => { const a = rand2(2, s2, 0.62), b = rand2(1, s2, 0.97); q.moveTo(a[0] + vx, a[1] + 0.04 * k); q.quadraticCurveTo(lerp(a[0], b[0], 0.75) + vx, lerp(a[1], b[1], 0.35), b[0], b[1] - 0.02 * k); }, 0.45); } } } }); }
    if (rock) { // Rock bis über das Knie: von der Hüfte zu den beiden Knien, mit Saum
      const kR = pt(sk.bR.k), kL = pt(sk.bL.k), li = kR[0] < kL[0] ? kR : kL, re = kR[0] < kL[0] ? kL : kR, sa = 0.088 * k;
      const P = [rand2(2, -1), rand2(1, -1, 1.04), [li[0] - sa, li[1] - 0.02 * k], [li[0] - sa * 0.6, li[1] + 0.05 * k], [re[0] + sa * 0.6, re[1] + 0.05 * k], [re[0] + sa, re[1] - 0.02 * k], rand2(1, 1, 1.04), rand2(2, 1)];
      teile.push({ d: Math.max(kR[3], kL[3], pt(sk.hip)[3]) + 0.012, pfad: () => { const q = new Path2D(); zug(q, P); return q; }, mal: (gg) => { fuell(gg, T.unter.m, (q) => zug(q, P));
        const s = sSch, a = s < 0 ? P[2] : P[5], b = s < 0 ? P[3] : P[4], c = s < 0 ? P[1] : P[6], w = (re[0] - li[0] + 2 * sa) * 0.24; fuell(gg, T.unter.d, (q) => zug(q, [c, a, b, [b[0] - s * w, b[1]], [a[0] - s * w * 0.9, a[1]], [c[0] - s * w * 0.6, c[1]]]));
        if (D) { strich(gg, T.unter.t, Math.max(1, 0.009 * k), (q) => { q.moveTo(P[3][0], P[3][1] - 0.022 * k); q.lineTo(P[4][0], P[4][1] - 0.022 * k); }, 0.6); if (D > 1) for (const t of [0.3, 0.52, 0.74]) strich(gg, T.unter.t, Math.max(1, 0.006 * k), (q) => { const x = lerp(P[3][0], P[4][0], t); q.moveTo(x, P[3][1] - 0.03 * k); q.lineTo(lerp(P[1][0], P[6][0], t), lerp(P[1][1], P[6][1], t) + 0.07 * k); }, 0.35); } } });
    }
    const ok = kontur(von, 6, lang ? 0.06 : rein ? 0.012 : 0.035), dO = Math.max(rumpfTiefe + 0.01, pt(sk.hip)[3] + 0.008), armPfade = [];
    teile.push({ d: dO, pfad: () => { const q = new Path2D(); zug(q, ok); return q; }, mal: (gg) => { // das Oberteil liegt immer über dem Hosenbund (auch von hinten und vorgebeugt)
      const q = new Path2D(); zug(q, ok); gg.fillStyle = T.ober.m; gg.fill(q);
      if (!D) { band(gg, von, 5, sSch, 0.95, 0.6, T.ober.d); if (vorn > 0.2 && (art === 'blazer' || rein)) fuell(gg, art === 'blazer' ? T.zwei.m : T.haut.m, (h) => { const c = E[6].c, u = E[art === 'blazer' ? 2 : 4].c, b = E[6].w * 1.1 * vorn, v = Q[5][2] * seitlich * k * 0.9; eck(h, [[c[0] + v - b, c[1]], [c[0] + v + b, c[1]], [u[0] + v, u[1]]]); }); return; }
      if (leicht) { band(gg, von, 4, sSch, 0.96, 0.6, T.ober.d); kleid(gg); return; }
      gg.save(); gg.clip(q);
      band(gg, von, 4, sSch, 1.08, 0.6, T.ober.d); band(gg, von, 4, -sSch, 1.08, 0.95, kante || T.ober.l);
      if (D > 1) for (const [ap, ad] of armPfade) if (ad > dO) { gg.translate(-lx * 0.03 * k, -ly * 0.03 * k + 0.012 * k); gg.fillStyle = T.ober.d; gg.fill(ap); gg.translate(lx * 0.03 * k, ly * 0.03 * k - 0.012 * k); } // der Schlagschatten der Arme auf dem Körper
      kleid(gg);
      gg.restore();
    } });
    /* Schnitt des Oberteils: Ausschnitt, Kragen, Revers, Knopfleiste, Taschen, Saum; von hinten Kragen, Naht, Kapuze. Gezeichnet innerhalb des Rumpfs (Ausschnitt gesetzt). */
    function kleid(gg) {
      const mi = (i, dy = 0) => { const e = E[i], v = Q[i][2] * seitlich * k * 0.9; return [e.c[0] + v, e.c[1] + dy * k]; }, lw = (f) => Math.max(1, f * k), hw = E[6].w;
      const c6 = mi(6), c5 = mi(5), c4 = mi(4), c3 = mi(3), c2 = mi(2), c1 = mi(1), br = hw * 1.22 * Math.max(0, vorn), zw = T.zwei, ob = T.ober;
      const quer = (i, dy, farbe, breit, a = 1) => strich(gg, farbe, breit, (h) => { const A = rand2(i, -1, 1.1), Z = rand2(i, 1, 1.1); h.moveTo(A[0], A[1] + dy * k); h.quadraticCurveTo(E[i].c[0], E[i].c[1] + (dy + 0.012) * k, Z[0], Z[1] + dy * k); }, a);
      if (vorn > 0.18) {
        if (art === 'blazer' && m.ober.offen) { // die Jacke fällt offen: Die Vorderkanten hängen auseinander, das Hemd ist bis zum Gürtel zu sehen, darunter die Hose
          const hy = c1[1] + 0.13 * k, g2 = [c2[0], c2[1] + 0.035 * k];
          fuell(gg, zw.m, (h) => eck(h, [[c6[0] - br, c6[1] - 0.01 * k], [c6[0] + br, c6[1] - 0.01 * k], [c3[0] + br * 0.8, c3[1]], [g2[0] + br * 0.74, g2[1]], [g2[0] - br * 0.74, g2[1]], [c3[0] - br * 0.8, c3[1]]]));
          fuell(gg, zw.d, (h) => eck(h, [[c6[0] + sSch * br, c6[1] - 0.01 * k], [c6[0] + sSch * br * 0.3, c6[1]], [g2[0] + sSch * br * 0.2, g2[1]], [g2[0] + sSch * br * 0.74, g2[1]], [c3[0] + sSch * br * 0.8, c3[1]]]));
          fuell(gg, T.unter.m, (h) => eck(h, [[g2[0] - br * 0.74, g2[1]], [g2[0] + br * 0.74, g2[1]], [c1[0] + br * 1.05, c1[1]], [c1[0] + br * 1.3, hy], [c1[0] - br * 1.3, hy], [c1[0] - br * 1.05, c1[1]]]));
          strich(gg, T.guertel.m, lw(0.024), (h) => { h.moveTo(g2[0] - br * 0.74, g2[1] + 0.012 * k); h.lineTo(g2[0] + br * 0.74, g2[1] + 0.012 * k); }); if (!leicht) fuell(gg, T.gold.m, (h) => h.rect(g2[0] - 0.014 * k, g2[1], 0.028 * k, 0.024 * k));
          fuell(gg, T.haut.m, (h) => eck(h, [[c6[0] - br * 0.8, c6[1] - 0.012 * k], [c6[0] + br * 0.8, c6[1] - 0.012 * k], [c5[0], c5[1] + 0.05 * k]]));
          if (D > 1) { strich(gg, zw.t, lw(0.005), (h) => { h.moveTo(c5[0], c5[1] + 0.05 * k); h.lineTo(g2[0], g2[1]); }, 0.4); for (const t of [0.3, 0.55, 0.8]) fuell(gg, zw.t, (h) => h.arc(lerp(c5[0], g2[0], t), lerp(c5[1] + 0.05 * k, g2[1], t), lw(0.005), 0, PI * 2)); }
          for (const s of [-1, 1]) { const u = [c3[0] + s * br * 0.8, c3[1] + 0.03 * k], P = [[c6[0] + s * br * 1.02, c6[1] - 0.012 * k], [c4[0] + s * br * 1.9, c4[1] + 0.03 * k], [c3[0] + s * br * 1.4, c3[1] - 0.01 * k], u, [c3[0] + s * br * 0.8, c3[1] - 0.02 * k]];
            fuell(gg, s === sSch ? ob.d : ob.l, (h) => eck(h, P)); strich(gg, ob.t, lw(0.006), (h) => { h.moveTo(P[1][0], P[1][1]); h.lineTo(P[2][0], P[2][1]); h.lineTo(u[0], u[1]); }, 0.55);
            if (!leicht) fuell(gg, s === sSch ? ob.t : ob.d, (h) => eck(h, [u, [g2[0] + s * br * 0.74, g2[1]], [c1[0] + s * br * 1.05, c1[1]], [c1[0] + s * br * 1.3, hy], [c1[0] + s * br * 1.62, hy], [c1[0] + s * br * 1.34, c1[1]], [g2[0] + s * br * 1.0, g2[1]], [u[0] + s * br * 0.2, u[1]]])); // der Blick auf das Futter an der Vorderkante
            if (D > 1) strich(gg, ob.t, lw(0.006), (h) => { const x = c1[0] + s * E[1].w * 0.6; h.moveTo(x - 0.035 * k * vorn, c1[1] - 0.04 * k); h.lineTo(x + 0.035 * k * vorn, c1[1] - 0.035 * k); }, 0.5); }
        } else if (art === 'blazer') { // geschlossen getragen: das Hemd darunter als V bis zum Knopf, zwei Revers
          const kn = [c2[0], c2[1] + 0.03 * k];
          fuell(gg, zw.m, (h) => eck(h, [[c6[0] - br, c6[1] - 0.01 * k], [c6[0] + br, c6[1] - 0.01 * k], [c3[0] + br * 0.72, c3[1]], kn, [c3[0] - br * 0.72, c3[1]]]));
          fuell(gg, zw.d, (h) => eck(h, [[c6[0] + sSch * br, c6[1] - 0.01 * k], [c6[0] + sSch * br * 0.3, c6[1]], kn, [c3[0] + sSch * br * 0.72, c3[1]]]));
          fuell(gg, T.haut.m, (h) => eck(h, [[c6[0] - br * 0.8, c6[1] - 0.012 * k], [c6[0] + br * 0.8, c6[1] - 0.012 * k], [c5[0], c5[1] + 0.05 * k]]));
          if (D > 1) { strich(gg, zw.t, lw(0.005), (h) => { h.moveTo(c5[0], c5[1] + 0.05 * k); h.lineTo(kn[0], kn[1]); }, 0.4); for (const s of [-1, 1]) fuell(gg, zw.l, (h) => eck(h, [[c6[0] + s * br * 0.84, c6[1] - 0.016 * k], [c6[0] + s * br * 0.2, c5[1] + 0.012 * k], [c6[0] + s * br * 0.62, c5[1] + 0.05 * k]])); }
          for (const s of [-1, 1]) { const P = [[c6[0] + s * br * 1.02, c6[1] - 0.012 * k], [c4[0] + s * br * 1.9, c4[1] + 0.03 * k], [c3[0] + s * br * 1.28, c3[1] - 0.02 * k], kn, [c3[0] + s * br * 0.72, c3[1]]]; fuell(gg, s === sSch ? ob.d : ob.l, (h) => eck(h, P)); strich(gg, ob.t, lw(0.006), (h) => { h.moveTo(P[1][0], P[1][1]); h.lineTo(P[2][0], P[2][1]); h.lineTo(P[3][0], P[3][1]); }, 0.55); }
          strich(gg, ob.t, lw(0.007), (h) => { h.moveTo(kn[0], kn[1]); h.quadraticCurveTo(kn[0] - sSch * 0.01 * k, lerp(kn[1], c1[1], 0.6), c1[0] + br * 0.3, c1[1] + 0.1 * k); }, 0.6);
          if (D > 1) { fuell(gg, ob.t, (h) => h.arc(kn[0] - br * 0.14, kn[1] + 0.018 * k, lw(0.008), 0, PI * 2)); for (const s of [-1, 1]) strich(gg, ob.t, lw(0.006), (h) => { const x = c1[0] + s * E[1].w * 0.56; h.moveTo(x - 0.035 * k * vorn, c1[1] - 0.04 * k); h.lineTo(x + 0.035 * k * vorn, c1[1] - 0.035 * k); }, 0.5); } // Knopf, Taschenklappen
        } else if (rein) { // Hemd, Bluse: Kragen, Knopfleiste, Knöpfe; in der Hose
          fuell(gg, T.haut.m, (h) => eck(h, [[c6[0] - br * 0.86, c6[1] - 0.012 * k], [c6[0] + br * 0.86, c6[1] - 0.012 * k], [c5[0], c5[1] + (art === 'bluse' ? 0.085 : 0.06) * k]]));
          strich(gg, ob.t, lw(0.006), (h) => { h.moveTo(c5[0], c5[1] + 0.06 * k); h.lineTo(c2[0], c2[1]); }, 0.5);
          if (D > 1) { strich(gg, ob.l, lw(0.004), (h) => { h.moveTo(c5[0] + lw(0.012), c5[1] + 0.07 * k); h.lineTo(c2[0] + lw(0.012), c2[1]); }, 0.7); for (const t of [0.22, 0.5, 0.78]) fuell(gg, ob.t, (h) => h.arc(lerp(c5[0], c2[0], t), lerp(c5[1] + 0.06 * k, c2[1], t), lw(0.006), 0, PI * 2));
            if (art === 'hemd') strich(gg, ob.t, lw(0.005), (h) => { const x = c3[0] - 0.085 * k * vorn, y = c3[1] - 0.03 * k; h.rect(x - 0.03 * k * vorn, y, 0.06 * k * vorn, 0.065 * k); }, 0.4); } // Brusttasche
          for (const s of [-1, 1]) { const P = [[c6[0] + s * br * 0.9, c6[1] - 0.022 * k], [c6[0] + s * br * 1.75, c6[1] + 0.02 * k], [c5[0] + s * br * 0.9, c5[1] + 0.07 * k], [c5[0] + s * br * 0.08, c5[1] + 0.045 * k]]; fuell(gg, m.ober.zwei ? zw.m : ob.l, (h) => eck(h, P)); strich(gg, ob.t, lw(0.005), (h) => eck(h, P), 0.5); }
        } else if (art === 'hoodie') { // Kapuzenpulli: die Kapuze liegt als Kragen um den Hals, zwei Kordeln, Bauchtasche, Bündchen
          for (const s of [-1, 1]) fuell(gg, s === sSch ? ob.t : ob.d, (h) => eck(h, [[c6[0] + s * br * 0.5, c6[1] - 0.02 * k], [c6[0] + s * br * 2.1, c6[1] + 0.005 * k], [c4[0] + s * br * 1.5, c4[1] + 0.05 * k], [c5[0] + s * br * 0.1, c5[1] + 0.085 * k]]));
          fuell(gg, T.haut.m, (h) => h.ellipse(c6[0], c6[1] - 0.006 * k, br * 0.8, 0.03 * k, 0, 0, PI));
          for (const s of [-1, 1]) { strich(gg, zw.m, lw(0.007), (h) => { h.moveTo(c5[0] + s * br * 0.3, c5[1] + 0.075 * k); h.lineTo(c5[0] + s * br * 0.36, c3[1] + 0.03 * k); }); if (D > 1) fuell(gg, zw.d, (h) => h.rect(c5[0] + s * br * 0.36 - lw(0.006), c3[1] + 0.02 * k, lw(0.012), lw(0.024))); }
          strich(gg, ob.t, lw(0.007), (h) => { const y = lerp(c2[1], c1[1], 0.25), w = E[1].w * 0.62 * vorn; h.moveTo(c1[0] - w, c1[1] + 0.035 * k); h.lineTo(c2[0] - w * 0.62, y); h.lineTo(c2[0] + w * 0.62, y); h.lineTo(c1[0] + w, c1[1] + 0.035 * k); }, 0.55);
        } else if (art === 'pulli') { // Pullover: runder Kragen mit Bündchen
          fuell(gg, T.haut.m, (h) => h.ellipse(c6[0], c6[1] - 0.004 * k, br * 0.9, 0.026 * k, 0, 0, PI));
          strich(gg, ob.l, lw(0.018), (h) => h.ellipse(c6[0], c6[1] - 0.004 * k, br * 1.02, 0.036 * k, 0, 0.08, PI - 0.08)); strich(gg, ob.t, lw(0.005), (h) => h.ellipse(c6[0], c6[1] - 0.004 * k, br * 1.2, 0.05 * k, 0, 0.1, PI - 0.1), 0.45);
        } else { // T-Shirt: runder Ausschnitt mit schmaler Kante
          fuell(gg, T.haut.m, (h) => h.ellipse(c6[0], c6[1] - 0.002 * k, br * 1.0, 0.038 * k, 0, 0, PI));
          strich(gg, ob.d, lw(0.009), (h) => h.ellipse(c6[0], c6[1] - 0.002 * k, br * 1.06, 0.044 * k, 0, 0.05, PI - 0.05));
        }
      } else if (vorn < -0.1) { // von hinten: nie eine leere Fläche. Kragen im Nacken, die Naht über dem Rückgrat, Kapuze bzw. Passe
        const hint = Math.min(1, (-0.1 - vorn) / 0.5), bh = hw * (1.3 - 0.4 * Math.abs(seitlich)), mx = c6[0] - 2 * Q[6][2] * seitlich * k * 0.9;
        if (art === 'hoodie') { const P = [[mx - bh * 1.5, c6[1] - 0.012 * k], [mx + bh * 1.5, c6[1] - 0.012 * k], [mx + bh * 1.75, c4[1] + 0.05 * k], [mx, c4[1] + 0.17 * k], [mx - bh * 1.75, c4[1] + 0.05 * k]]; fuell(gg, ob.d, (h) => zug(h, P)); fuell(gg, ob.m, (h) => zug(h, P.map((q) => [q[0] + lx * 0.012 * k - (q[0] - mx) * 0.1, q[1] - 0.016 * k]))); }
        else strich(gg, art === 'blazer' || rein ? (m.ober.zwei ? zw.m : ob.l) : ob.l, lw(art === 'shirt' ? 0.012 : 0.022), (h) => h.ellipse(mx, c6[1] + 0.012 * k, bh, 0.024 * k, 0, 0.1, PI - 0.1), 0.9 * hint);
        if (Math.abs(seitlich) < 0.7 && art !== 'hoodie') strich(gg, ob.t, lw(0.006), (h) => { h.moveTo(E[5].c[0], E[5].c[1] + 0.04 * k); h.quadraticCurveTo(E[3].c[0] - seitlich * 0.03 * k, E[3].c[1], E[von].c[0], E[von].c[1] + 0.03 * k); }, 0.4 * hint);
        if (rein && D > 1) quer(4, 0.055, ob.t, lw(0.005), 0.4 * hint); // die Passe des Hemds
      }
      if (leicht) return;
      // Falten zur Taille, Saum
      if (Math.abs(seitlich) < 0.85) for (const s2 of [-1, 1]) { const A4 = rand2(4, s2, 0.93), w3 = E[3].w; strich(gg, ob.t, lw(0.006), (h) => { h.moveTo(A4[0], A4[1] + 0.09 * k); h.quadraticCurveTo(A4[0] - s2 * w3 * 0.2, A4[1] + 0.118 * k, A4[0] - s2 * w3 * 0.4, A4[1] + 0.1 * k); }, 0.36); // die Falte aus der Achsel
        if (D > 1) strich(gg, ob.t, lw(0.005), (h) => { h.moveTo(A4[0] - s2 * w3 * 0.04, A4[1] + 0.125 * k); h.quadraticCurveTo(A4[0] - s2 * w3 * 0.16, A4[1] + 0.15 * k, A4[0] - s2 * w3 * 0.3, A4[1] + 0.14 * k); }, 0.26); }
      for (const s2 of [-1, 1]) { const e2 = E[2], x2 = e2.c[0] + s2 * e2.w * 0.64; strich(gg, ob.t, lw(0.007), (h) => { h.moveTo(x2 + s2 * 0.012 * k, e2.c[1] - 0.075 * k); h.quadraticCurveTo(x2 - s2 * 0.028 * k, e2.c[1] + 0.005 * k, x2 + s2 * 0.014 * k, e2.c[1] + 0.075 * k); }, 0.42); }
      if (D > 1) { const e4 = E[4], sx = e4.c[0] + sSch * e4.w * 0.5; strich(gg, ob.t, lw(0.006), (h) => { h.moveTo(sx, e4.c[1] + 0.05 * k); h.quadraticCurveTo(sx - sSch * 0.03 * k, lerp(e4.c[1], E[3].c[1], 0.5), sx - sSch * 0.012 * k, E[3].c[1] + 0.02 * k); }, 0.3); } // eine Falte von der Schulter
      if (!rein && art !== 'blazer') { quer(1, lang ? 0.045 : 0.024, ob.t, lw(0.007), 0.5); if (D > 1 && art !== 'shirt') quer(1, lang ? 0.07 : 0.05, ob.l, lw(0.005), 0.5); } // der Saum (bei Pulli und Hoodie ein Bündchen)
    }
    // ── Arme, Hände, was sie halten ──
    const kurzArm = art === 'shirt', weite = art === 'blazer' ? 1.08 : art === 'hoodie' ? 1.1 : art === 'pulli' ? 1.04 : 0.97, hochA = m.ober.hoch && rein;
    for (const [ar, s, ding, hp] of [[sk.R, 1, o.r || sk.dr, sk.hr], [sk.L, -1, o.l || sk.dl, sk.hl]]) {
      const S0 = pt(ar.s), El = pt(ar.e), S = mitte(S0, El, 0.13), Hg = pt(ar.h), Fi = pt(ar.f), neben = 0.03 * (s * sd > 0 ? 1 : s * sd < -0.2 ? -1 : 0) + 0.012, dU = (El[3] + Hg[3]) / 2 + neben, ob = T.ober, ht = T.haut;
      let St, extra = null;
      if (kurzArm) { const mi = mitte(S, El, 0.6); St = [seg(mi, El, 0.044, 0.038, ht), seg(El, Hg, 0.039, 0.029, ht), seg(S, mi, 0.052, 0.05, ob, 1)]; extra = D ? (gg) => { const u = St[2], w = Math.atan2(u.b[1] - u.a[1], u.b[0] - u.a[0]); strich(gg, ob.t, Math.max(1, 0.01 * k), (q) => q.arc(u.b[0], u.b[1], u.rb * 0.97, w - 1.3, w + 1.3), 0.6); } : null; }
      else if (hochA) { const mi = mitte(El, Hg, 0.3); St = [seg(mi, Hg, 0.04, 0.029, ht), seg(S, El, 0.052 * weite, 0.05 * weite, ob, 1), seg(El, mi, 0.05 * weite, 0.05 * weite, ob)]; extra = D ? (gg) => { const u = St[2], w = Math.atan2(u.b[1] - u.a[1], u.b[0] - u.a[0]); strich(gg, ob.l, Math.max(1.5, 0.026 * k), (q) => q.arc(u.b[0], u.b[1], u.rb * 0.9, w - 1.2, w + 1.2)); strich(gg, ob.t, Math.max(1, 0.006 * k), (q) => q.arc(u.b[0] - Math.cos(w) * 0.02 * k, u.b[1] - Math.sin(w) * 0.02 * k, u.rb * 0.97, w - 1.2, w + 1.2), 0.5); } : null; }
      else { const bu = mitte(El, Hg, 0.86); St = [seg(S, El, 0.053 * weite, 0.05 * weite, ob, 1), seg(El, Hg, 0.05 * weite, (art === 'hoodie' ? 0.044 : 0.04) * weite, ob)];
        extra = D ? (gg) => { const w = Math.atan2(Hg[1] - El[1], Hg[0] - El[0]), r = St[1].rb, cx = Math.cos(w), sy = Math.sin(w); // Bündchen bzw. Manschette am Handgelenk
          if (art === 'blazer') strich(gg, T.zwei.m, Math.max(1.5, 0.02 * k), (q) => q.arc(Hg[0] + cx * 0.012 * k, Hg[1] + sy * 0.012 * k, r * 0.86, w - 1.25, w + 1.25));
          else if (rein) { strich(gg, ob.l, Math.max(1.5, 0.03 * k), (q) => q.arc(bu[0], bu[1], r * 0.84, w - 1.2, w + 1.2)); strich(gg, ob.t, Math.max(1, 0.005 * k), (q) => q.arc(bu[0] - cx * 0.016 * k, bu[1] - sy * 0.016 * k, r, w - 1.2, w + 1.2), 0.5); }
          else { strich(gg, ob.d, Math.max(1.5, 0.028 * k), (q) => q.arc(bu[0] + cx * 0.012 * k, bu[1] + sy * 0.012 * k, r * 0.86, w - 1.2, w + 1.2)); if (D > 1) strich(gg, ob.t, Math.max(1, 0.005 * k), (q) => q.arc(bu[0] - cx * 0.004 * k, bu[1] - sy * 0.004 * k, r, w - 1.2, w + 1.2), 0.5); }
          strich(gg, ob.t, Math.max(1, 0.006 * k), (q) => q.arc(Hg[0], Hg[1], r * 0.98, w - 1.3, w + 1.3), 0.55); } : null; }
      if (m.uhr && s < 0 && D > 1) { const e0 = extra; extra = (gg) => { if (e0) e0(gg); const w = Math.atan2(Hg[1] - El[1], Hg[0] - El[0]), r = 0.031 * k * Hg[2]; strich(gg, T.ding.m, Math.max(1.5, 0.016 * k), (q) => q.arc(Hg[0] + Math.cos(w) * 0.02 * k, Hg[1] + Math.sin(w) * 0.02 * k, r, w - 1.3, w + 1.3)); }; }
      if (D > 1) { const q0 = new Path2D(); for (const x of St) kap(q0, x); armPfade.push([q0, dU]); }
      glied(St, dU, false, kurzArm ? null : [El], extra);
      const hand = handBau(Hg, Fi, k, -s * (cd >= 0 ? 1 : -1), hp, !!ding); // der Daumen liegt zur Körpermitte
      if (hp !== 'weg') teile.push({ d: dU + 0.0015, pfad: () => { const q = new Path2D(); for (const x of hand.S) kapsel(q, x[0], x[1], x[2], x[3], x[4], x[5]); return q; }, mal: (gg) => handMal(gg, hand, T.haut, lx, ly, D, leicht) });
      if (ding) teile.push({ d: dU + (ding === 'tasche' ? -0.002 : ding === 'mappe' ? -0.006 : 0.008), pfad: () => { const q = new Path2D(); if (ding === 'tasche') { const w = 0.38 * k, hh = 0.28 * k, hx = (Hg[0] + Fi[0]) / 2, hy = (Hg[1] + Fi[1]) / 2; q.roundRect(hx - w / 2, hy + 0.1 * k, w, hh, 0.03 * k); } return q; }, mal: (gg) => halten(gg, ding, Hg, Fi, k, T, s, o, D) });
    }
    // ── Hals, Kopf, Haare ──
    const Hl = pt(sk.hals), Ko = pt(sk.kopf), kw = dreh - p.kd, kk = k * Ko[2] * KOPF * m.kg, kt = Ko[3] + 0.04, K = kopfBau(m, Ko[0], Ko[1], kk, kw, p);
    { const hr = 0.052 + 0.006 * m.w, hx = Ko[0] - Math.sin(kw) * 0.016 * kk, Sh = [seg(Hl, [hx, Ko[1] + 0.035 * k, 1, 0], hr, 0.046, T.haut, 1)]; // der Hals: am Ansatz breiter (Nackenmuskel), oben setzt er hinter dem Kiefer an; unten ohne Schattenring, er geht in den Ausschnitt über
      teile.push({ d: kt - 0.012, pfad: () => { const q = new Path2D(); kap(q, Sh[0]); return q; }, mal: (gg) => { gliedMal(gg, Sh, true);
        if (D) { const u = Sh[0], a = mitte(u.a, u.b, 0.5), b = mitte(u.a, u.b, 0.92), vx = Math.sin(kw) * 0.012 * kk; fuell(gg, T.haut.d, (q) => kapsel(q, a[0] + vx, a[1], u.ra * 0.66, b[0] + vx, b[1], u.rb * 0.84)); // der Schatten des Kopfs auf dem Hals: nur unter dem Kinn
          if (!leicht) kragen(gg, Sh[0]); } } }); }
    /* Der Kragen vor dem Hals: Der Hals steckt im Ausschnitt (Shirt, Pulli, Kapuze) bzw. hinten im Kragen; bei Hemd und Blazer von vorn bleibt der Ausschnitt offen, dort zeigen zwei Linien zur Halsgrube. */
    function kragen(gg, u) {
      const hinten = vorn < -0.1, offen = !hinten && (rein || art === 'blazer'), r = u.ra, cx0 = u.a[0], cy0 = u.a[1] + 0.006 * k, ob = T.ober, lw = (f) => Math.max(1, f * k);
      if (offen) { if (D > 1 && vorn > 0.45) for (const s2 of [-1, 1]) strich(gg, T.haut.d, lw(0.004), (q) => { q.moveTo(cx0 + s2 * r * 0.78, cy0 - 0.045 * k); q.quadraticCurveTo(cx0 + s2 * r * 0.5, cy0 + 0.012 * k, cx0 + s2 * r * 0.1, cy0 + 0.034 * k); }, 0.32); return; }
      const ry = (hinten ? 0.016 : art === 'shirt' ? 0.03 : 0.022) * k, t = art === 'hoodie' ? 0.07 : 0.05, hoch = m.ober.rolli && art === 'pulli' ? 0.05 * k : 0; // Rollkragen: der Kragen steht am Hals hoch
      fuell(gg, hinten && art !== 'shirt' && art !== 'pulli' && art !== 'hoodie' ? (m.ober.zwei ? T.zwei.m : ob.l) : art === 'hoodie' ? ob.d : ob.m, (q) => { q.ellipse(cx0, cy0 - hoch, r * 1.1, ry, 0, 0, PI); q.ellipse(cx0, cy0, r * 1.34, ry + t * k, 0, PI, 0, true); if (hoch) q.rect(cx0 - r * 1.1, cy0 - hoch, r * 2.2, hoch); });
      if (hoch) { strich(gg, ob.l, lw(0.006), (q) => q.ellipse(cx0, cy0 - hoch, r * 1.1, ry, 0, 0.1, PI - 0.1), 0.8); strich(gg, ob.t, lw(0.005), (q) => q.ellipse(cx0, cy0 - hoch * 0.45, r * 1.12, ry, 0, 0.2, PI - 0.2), 0.4); }
      else if (art === 'pulli' || art === 'hoodie') { strich(gg, art === 'hoodie' ? ob.m : ob.l, lw(0.016), (q) => q.ellipse(cx0, cy0, r * 1.14, ry + 0.006 * k, 0, 0.12, PI - 0.12)); strich(gg, ob.t, lw(0.005), (q) => q.ellipse(cx0, cy0, r * 1.28, ry + 0.018 * k, 0, 0.2, PI - 0.2), 0.4); }
      else strich(gg, hinten ? ob.t : ob.d, lw(hinten ? 0.006 : 0.009), (q) => q.ellipse(cx0, cy0, r * 1.1, ry, 0, 0.08, PI - 0.08), hinten ? 0.5 : 1);
    }
    teile.push({ d: kt, pfad: () => K.pfad(), mal: (gg) => kopfMal(gg, m, T, K, D, lx, ly, o, kante, gegen) });
    if (m.frisur === 'lang' || m.frisur === 'zopf') { const hh = haarBau(m, K, k); teile.push({ d: K.fd > 0.1 ? rumpfTiefe - 0.02 : kt + 0.01, pfad: () => { const q = new Path2D(); zug(q, hh.P); return q; }, mal: (gg) => { fuell(gg, T.haar.d, (q) => zug(q, hh.P)); fuell(gg, T.haar.m, (q) => zug(q, hh.P.map((v) => [hh.cx + (v[0] - hh.cx) * 0.74 + lx * 0.012 * k, v[1] - 0.01 * k])));
      if (D > 1) for (const t of [0.3, 0.64]) strich(gg, T.haar.l, Math.max(1, 0.006 * k), (q) => { const x = lerp(hh.P[0][0], hh.P[1][0], t); q.moveTo(x, hh.P[0][1] + 0.05 * k); q.quadraticCurveTo(x + lx * 0.01 * k, lerp(hh.P[0][1], hh.yu, 0.5), x - hh.fx * 0.02 * k, hh.yu - 0.05 * k); }, 0.5); } }); }

    teile.sort((a, b) => a.d - b.d);
    // ── Ausgabe ──
    const aus = { kopf: [Ko[0], Ko[1] - 0.125 * kk], handR: pt(sk.R.h), handL: pt(sk.L.h) };
    const umrissPfad = () => { const U = new Path2D(); for (const t of teile) U.addPath(t.pfad()); return U; }; // alle Teile als ein Pfad: einmal gefüllt, überall gleich deckend
    if (o.modus === 'umriss') {
      const farbe = o.farbe || '255,255,255', U = umrissPfad();
      g.lineJoin = 'round'; g.lineCap = 'butt'; g.setLineDash([Math.max(4, 0.045 * k0), Math.max(3, 0.032 * k0)]); g.lineWidth = Math.max(2.2, 0.016 * k0) * 2; g.strokeStyle = `rgba(${farbe},.95)`;
      g.stroke(U);
      g.setLineDash([]); g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; g.fill(U);
      g.globalCompositeOperation = 'destination-over'; g.fillStyle = 'rgba(14,13,20,.42)'; g.fill(U);
      g.globalCompositeOperation = 'source-over';
      return aus;
    }
    if (o.rand && o.rand.px > 0.2) { // Hervorheben: ein Lichtsaum in der Raumfarbe rund um die ganze Figur (sie selbst bleibt farbig)
      const U = umrissPfad(); g.lineJoin = 'round';
      for (const [zu, al] of [[o.rand.px * 2.4, 0.22], [o.rand.px, 0.95]]) { g.fillStyle = g.strokeStyle = `rgba(${o.rand.farbe},${al * (o.rand.a ?? 1)})`; g.lineWidth = zu * 2; g.fill(U); g.stroke(U); }
    }
    if (o.modus === 'rand') return aus; // nur der Lichtsaum (als eigenes Bild vorgezeichnet: haus.js › ruheZeichnen)
    { const n = teile.length, a = o.teil ? Math.floor(n * o.teil[0]) : 0, b = o.teil ? Math.floor(n * o.teil[1]) : n; for (let i = a; i < b; i++) teile[i].mal(g); } // o.teil = [von, bis] (Anteile): nur diese Scheibe der Figur (ein großes Bild entsteht so über mehrere Takte, von hinten nach vorn)
    return aus;
  }

  /* Schuh: Sohle, Schaft, Kappe; Turnschuh mit heller Sohle und Schnürung, Lederschuh mit Absatz. A = Knöchel, F = Ferse, Z = Spitze (Bildpunkte); schaft = der Knöchel ist zu sehen (Rock) */
  function schuh(g, m, T, A, F, Z, k, lx, ly, D, schaft) {
    const dx = Z[0] - F[0], dy = Z[1] - F[1], len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, leder = m.schuhe.leder, so = (leder ? 0.012 : 0.022) * k;
    const zu = Z[3] > F[3] ? grenze(1.25 - len / (0.13 * k), 0, 1) : 0, ra = lerp(0.046, 0.037, zu) * k * F[2], rb = lerp(0.036, 0.05, zu) * k * Z[2], fl = 1 - 0.3 * zu; // zu = die Spitze zeigt auf uns: Wir sehen den Schuh von vorn oben, vorn breit und flach, zur Ferse hin schmal (kein Tropfen)
    const form = (q, x, y, f) => { if (zu < 0.3) return kapsel(q, F[0] + x, F[1] + y, ra * f, Z[0] + x, Z[1] + y, rb * f); q.ellipse(F[0] + x, F[1] + y, ra * f, ra * f, 0, 0, PI * 2); q.ellipse(Z[0] + x, Z[1] + y, rb * f, rb * f * fl, 0, 0, PI * 2); eck(q, [[F[0] + x - ra * f, F[1] + y], [F[0] + x + ra * f, F[1] + y], [Z[0] + x + rb * f, Z[1] + y], [Z[0] + x - rb * f, Z[1] + y]]); };
    fuell(g, T.sohle.m, (q) => form(q, 0, so, 1)); // die Sohle schaut unter dem Schaft hervor
    if (leder && D && len > ra) fuell(g, T.sohle.d, (q) => q.rect(Math.min(F[0] - ra * 0.9, F[0] + ra * 0.6), F[1] + ra * 0.3, ra * 1.5, ra * 0.7 + so)); // Absatz
    fuell(g, T.schuh.d, (q) => form(q, 0, 0, 1));
    fuell(g, T.schuh.m, (q) => form(q, lx * ra * 0.16, -ra * 0.22, 0.78));
    if (schaft && !leder) fuell(g, T.schuh.m, (q) => kapsel(q, A[0], A[1] + 0.02 * k, 0.04 * k * A[2], lerp(F[0], Z[0], 0.3), lerp(F[1], Z[1], 0.3), ra * 0.8));
    if (!D) return;
    if (D > 1 && zu > 0.5) { strich(g, T.schuh.t, Math.max(1, 0.006 * k), (q) => q.ellipse(Z[0], Z[1] - rb * 0.1, rb * 0.72, rb * 0.5, 0, PI * 1.08, PI * 1.92), 0.45); if (!leder) for (const t of [0.3, 0.52]) strich(g, T.sohle.l, Math.max(1, 0.007 * k), (q) => { const y = lerp(F[1], Z[1], t) - rb * 0.3; q.moveTo(lerp(F[0], Z[0], t) - rb * 0.3, y); q.lineTo(lerp(F[0], Z[0], t) + rb * 0.3, y); }, 0.8); } // von vorn: die Kappe und zwei Schnürungen
    if (D > 1 && len > ra * 1.6) { // von der Seite: Kappe und Schnürung
      strich(g, T.schuh.t, Math.max(1, 0.006 * k), (q) => q.arc(Z[0], Z[1], rb * 0.9, Math.atan2(uy, ux) + PI * 0.62, Math.atan2(uy, ux) + PI * 1.38), 0.5);
      if (!leder) for (const t of [0.36, 0.5, 0.64]) strich(g, T.sohle.l, Math.max(1, 0.007 * k), (q) => { const x = lerp(F[0], Z[0], t), y = lerp(F[1], Z[1], t) - lerp(ra, rb, t) * 0.66; q.moveTo(x - ux * 0.012 * k, y - 0.006 * k); q.lineTo(x + ux * 0.016 * k, y + 0.012 * k); }, 0.85);
    }
  }

  /* Hand: Handfläche, Finger als Gruppe (groß: einzeln), Daumen; je nach Tätigkeit offen, locker, zeigend, tippend oder greifend.
     Hg = Handgelenk, Fi = Fingerspitzen (Bildpunkte), seite = auf welcher Seite der Daumen liegt (1 | −1). Liefert die Formen als Kapseln [ax, ay, ra, bx, by, rb, art] (art: 0 Handfläche, 1 Finger, 2 Daumen). */
  function handBau(Hg, Fi, k, seite, pose, haelt) {
    const gr = ((Hg[2] + Fi[2]) / 2) * k, dx = Fi[0] - Hg[0], dy = Fi[1] - Hg[1], roh = Math.hypot(dx, dy) || 1, len = Math.max(roh, 0.1 * gr), ux = dx / roh, uy = dy / roh, nx = -uy * seite, ny = ux * seite; // n zeigt zum Daumen
    const zu = haelt || pose === 'greift', br = (pose === 'offen' || pose === 'tippt' ? 0.043 : zu ? 0.04 : 0.035) * gr, S = [], F = [], kx = Hg[0] + ux * len * 0.5, ky = Hg[1] + uy * len * 0.5, fl = len * 0.5;
    const ri = (w) => [ux * Math.cos(w) - nx * Math.sin(w), uy * Math.cos(w) - ny * Math.sin(w)]; // Richtung der Finger, um w vom Daumen weg gedreht (w < 0: zum Daumen hin)
    S.push([Hg[0], Hg[1], 0.031 * gr, kx, ky, br, 0]);
    if (pose === 'zeigt' && !haelt) { // der Zeigefinger gestreckt, die anderen eingerollt
      const d = ri(0), c = ri(1.0); S.push([kx + nx * br * 0.5, ky + ny * br * 0.5, 0.012 * gr, kx + nx * br * 0.5 + d[0] * fl * 1.02, ky + ny * br * 0.5 + d[1] * fl * 1.02, 0.0098 * gr, 1]);
      S.push([kx - nx * br * 0.2, ky - ny * br * 0.2, br * 0.72, kx - nx * br * 0.2 + c[0] * fl * 0.22, ky - ny * br * 0.2 + c[1] * fl * 0.22, br * 0.62, 1]);
    } else if (zu) { const c = ri(-0.7); S.push([kx, ky, br * 0.98, kx + c[0] * fl * 0.45, ky + c[1] * fl * 0.45, br * 0.8, 1]); // die Finger schließen sich um den Gegenstand
      for (let i = 0; i < 4; i++) { const ab = lerp(0.66, -0.7, i / 3), r = 0.0118 * gr * (i === 3 ? 0.88 : 1), x = kx + nx * br * ab + ux * fl * 0.1, y = ky + ny * br * ab + uy * fl * 0.1; F.push([x, y, r, x + c[0] * fl * 0.5, y + c[1] * fl * 0.5, r * 0.92, 1]); } } // groß: vier Finger, quer über das, was sie halten
    else { const kr = pose === 'locker' ? -0.3 : 0, lg = pose === 'locker' ? 0.78 : pose === 'tippt' ? 0.84 : 1, sp = pose === 'offen' ? [-0.1, 0.13] : pose === 'tippt' ? [-0.14, 0.16] : [-0.04, 0.06]; // vier Finger, vom Zeigefinger (beim Daumen) zum kleinen Finger
      for (let i = 0; i < 4; i++) { const t = i / 3, ab = lerp(0.62, -0.72, t), d = ri(kr + lerp(sp[0], sp[1], t)), l = fl * lg * [0.92, 1, 0.94, 0.76][i], r = 0.0112 * gr * (i === 3 ? 0.88 : 1);
        F.push([kx + nx * br * ab, ky + ny * br * ab, r * 1.06, kx + nx * br * ab + d[0] * l, ky + ny * br * ab + d[1] * l, r * 0.88, 1]); }
      const d = ri(kr); S.push([kx, ky, br * 0.96, kx + d[0] * fl * lg * 0.86, ky + d[1] * fl * lg * 0.86, br * (pose === 'locker' ? 0.66 : 0.82), 1]); }
    const dd = ri(zu ? -0.3 : pose === 'offen' ? -0.95 : -0.6), d0x = Hg[0] + ux * len * 0.22 + nx * br * 0.72, d0y = Hg[1] + uy * len * 0.22 + ny * br * 0.72; // der Daumen steht zur Körpermitte ab
    S.push([d0x, d0y, 0.0142 * gr, d0x + dd[0] * 0.052 * gr, d0y + dd[1] * 0.052 * gr, 0.0112 * gr, 2]);
    return { S, F, gr, nx, ny, ux, uy, kx, ky, br, zu, pose };
  }
  function handMal(g, H, ton, lx, ly, D, leicht) {
    const einzeln = D > 1 && H.F.length > 0;
    for (const x of H.S) { if ((einzeln && x[6] === 1 && H.pose !== 'zeigt') || (x[6] === 2 && !D)) continue; fuell(g, ton.m, (q) => kapsel(q, x[0], x[1], x[2], x[3], x[4], x[5])); }
    if (einzeln) for (const x of H.F) fuell(g, ton.m, (q) => kapsel(q, x[0], x[1], x[2], x[3], x[4], x[5]));
    if (!D) return;
    const nl = H.nx * lx + H.ny * ly, sch = nl >= 0 ? -1 : 1, a = H.S[0]; // Schatten an der dem Licht abgewandten Kante der Handfläche
    fuell(g, ton.d, (q) => kapsel(q, a[0] + sch * H.nx * a[2] * 0.62, a[1] + sch * H.ny * a[2] * 0.62, a[2] * 0.36, a[3] + sch * H.nx * a[5] * 0.62, a[4] + sch * H.ny * a[5] * 0.62, a[5] * 0.36));
    if (einzeln) { // groß: jeder Finger mit Schattenkante, die Knöchel als kleine Tonfläche, Licht auf dem Handrücken, der Daumen abgesetzt
      for (const x of H.F) strich(g, ton.d, Math.max(0.8, x[2] * 0.32), (q) => { q.moveTo(x[0] + sch * H.nx * x[2] * 0.7, x[1] + sch * H.ny * x[2] * 0.7); q.lineTo(x[3] + sch * H.nx * x[5] * 0.7, x[4] + sch * H.ny * x[5] * 0.7); }, 0.8);
      g.globalAlpha = 0.5; fuell(g, ton.d, (q) => { for (const x of H.F) { q.moveTo(x[0] + x[2] * 0.6, x[1]); q.arc(x[0], x[1], x[2] * 0.6, 0, PI * 2); } }); g.globalAlpha = 1;
      strich(g, ton.l, Math.max(1, a[5] * 0.3), (q) => { q.moveTo(lerp(a[0], a[3], 0.25) - sch * H.nx * a[5] * 0.5, lerp(a[1], a[4], 0.25) - sch * H.ny * a[5] * 0.5); q.lineTo(a[3] - sch * H.nx * a[5] * 0.5 - H.ux * a[5] * 0.5, a[4] - sch * H.ny * a[5] * 0.5 - H.uy * a[5] * 0.5); }, 0.55);
      const d = H.S.find((x) => x[6] === 2); if (d) strich(g, ton.d, Math.max(0.8, d[2] * 0.3), (q) => { q.moveTo(d[0] - H.nx * d[2] * 0.75 - H.ux * d[2], d[1] - H.ny * d[2] * 0.75 - H.uy * d[2]); q.lineTo(d[3] - H.nx * d[5] * 0.75, d[4] - H.ny * d[5] * 0.75); }, 0.7); // die Kante zwischen Daumen und Handfläche
    } else if (!leicht) { const f = H.S.find((x) => x[6] === 1); if (f && H.pose !== 'zeigt' && f[2] > 2.2) for (const v of H.zu ? [-0.45, 0, 0.45] : [-0.3, 0.32]) strich(g, ton.d, Math.max(0.8, H.gr * 0.004), (q) => { q.moveTo(lerp(f[0], f[3], 0.25) + H.nx * f[2] * v, lerp(f[1], f[4], 0.25) + H.ny * f[2] * v); q.lineTo(f[3] + H.nx * f[5] * v * 1.1, f[4] + H.ny * f[5] * v * 1.1); }, 0.7); } // Linien zwischen den Fingern
  }

  /* Kopf als Zylinder mit Gesicht: kw = Drehung des Kopfs zum Betrachter (0 = sieht uns an). Aus dem Winkel folgen die Lage von Gesicht, Ohren, Augen, Nase und Mund (auch im Dreiviertelprofil).
     GES: Höhenlinien des Gesichts von oben nach unten: [Höhe (nach unten, Meter), halbe Breite von vorn, Abstand der Profillinie von der Achse, Lage der hinteren Kante (Haaransatz, Kiefer) als Anteil, Vorsprung im Profil] */
  const GES = [[-0.076, 0.048, 0.078, 0.2, 0], [-0.052, 0.066, 0.088, 0.14, 0], [-0.024, 0.0715, 0.092, 0.1, 0.002], [0, 0.072, 0.086, 0.09, 0], [0.026, 0.072, 0.09, 0.09, 0.022], [0.04, 0.0705, 0.09, 0.09, 0.002], [0.058, 0.067, 0.092, 0.12, 0.003], [0.074, 0.061, 0.086, 0.1, 0], [0.094, 0.047, 0.088, 0.3, 0.002], [0.111, 0.026, 0.078, 0.66, 0]]; // im Profil sitzt der Kieferwinkel unter dem Ohr (hintere Kante bei 0,1), von dort läuft der Kiefer nach vorn zum Kinn
  /* Die Profillinie fein: [Höhe, Vorsprung vor der Grundlinie des Gesichts] von der Stirn über Braue, Nasenwurzel, Nasenrücken, Nasenspitze, Oberlippe, Mundspalt, Unterlippe, Kinnfalte bis zum Kinn. Sie zählt, sobald sich der Kopf dreht. */
  const PROFIL = [[-0.076, 0], [-0.058, 0.001], [-0.04, 0.003], [-0.024, 0.0055], [-0.008, 0.0005], [0.006, 0.007], [0.018, 0.017], [0.029, 0.027], [0.0365, 0.013], [0.043, 0.004], [0.05, 0.0078], [0.0575, 0.002], [0.065, 0.0066], [0.076, 0.0005], [0.09, 0.0062], [0.102, 0.002], [0.111, 0]];
  const gesAn = (y) => { let i = 0; while (i < GES.length - 2 && GES[i + 1][0] < y) i++; const a = GES[i], b = GES[i + 1], t = grenze((y - a[0]) / (b[0] - a[0]), 0, 1); return [lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; };
  function kopfBau(m, cx, cy, kk, kw, p) {
    const fx = Math.sin(kw), fd = Math.cos(kw), s = fx >= 0 ? 1 : -1, sa = Math.abs(fx), nick = (p.kn || 0) * 0.05 * kk, fr = m.frisur;
    const fern = [], nahe = [];
    for (const [y, wf, rp, hk, nase] of GES) { const xf = Math.max(Math.hypot(wf * fd, rp * sa), (rp + nase) * sa), xn = Math.min(xf, -wf * fd + rp * hk * sa); fern.push([cx + s * xf * kk, cy + y * kk + nick]); nahe.push([cx + s * xn * kk, cy + y * kk + nick]); }
    const kante = (y, v = 0) => { const [wf, rp] = gesAn(y); return cx + s * Math.max(Math.hypot(wf * fd, rp * sa), (rp + v) * sa) * kk; }; // die ferne Kante des Gesichts in der Höhe y (im Profil die Profillinie), v = Vorsprung
    const fein = sa > 0.2 ? PROFIL.map(([y, v]) => [kante(y, v * (v > 0.01 ? m.nase : 1)), cy + y * kk + nick]) : fern;
    const breit = (fern[3][0] - nahe[3][0]) * s, maske = breit > 0.01 * kk ? [[(fern[0][0] + nahe[0][0]) / 2, fern[0][1] - 0.004 * kk], ...fein, [(fern[9][0] + nahe[9][0]) / 2 + s * sa * 0.006 * kk, cy + 0.119 * kk + nick], ...nahe.slice().reverse()] : null;
    const vol = fr === 'locken' ? 1.14 : fr === 'bob' ? 1.08 : fr === 'lang' ? 1.07 : fr === 'kurz' ? 1.045 : 1.03, srx = Math.hypot(0.079 * fd, 0.1 * sa) * vol * kk, sx = cx - s * sa * 0.012 * kk, sy = cy - 0.008 * kk, sot = 0.112 * vol * kk, sub = (fr === 'bob' ? 0.1 : 0.078) * kk;
    const ohr = (e) => ({ x: cx + e * fd * 0.079 * kk, y: cy + 0.014 * kk + nick, t: -e * fx }); // e = 1: das rechte Ohr der Figur; t = wie sehr es uns zugewandt ist
    const merk = (phi, r) => ({ x: cx + r * Math.sin(kw + phi) * kk, t: Math.cos(kw + phi) }); // ein Merkmal des Gesichts am Winkel phi auf dem Zylinder: Bildstelle und Zuwendung (1 = zeigt zu uns)
    const auge = (e, r = 0.073) => { const A = merk(e * 0.42, r), fernes = e * s > 0 && sa > 0.12; if (fernes && fd < 0.42) return null; // e = 1: das rechte Auge der Figur. Liefert Bildstelle und Breite (t) oder nichts, wenn es verdeckt ist
      const t = Math.max(A.t, fd * 0.92); if (t < 0.16) return null; return { x: fernes ? s * Math.min(s * A.x, s * kante(-0.001) - (0.0128 * t + 0.0018) * 1.2 * kk - 0.003 * kk) : A.x, t, fernes }; };
    const pfad = () => { const q = new Path2D(), lo = fr === 'locken' ? 0.02 * kk : 0; q.ellipse(sx, sy - lo * 0.5, srx + lo, Math.max(sot, sub) + lo, 0, 0, PI * 2); if (maske) zug(q, maske); if (fr === 'bob' || fr === 'lang') q.ellipse(sx, cy + 0.04 * kk, srx * 1.04, 0.1 * kk, 0, 0, PI * 2); if (fr === 'dutt') q.arc(cx - fx * 0.07 * kk, cy - 0.128 * kk, 0.042 * kk, 0, PI * 2); return q; };
    return { cx, cy, kk, kw, fx, fd, s, sa, nick, fern, nahe, maske, kante, auge, breit, vol, srx, sx, sy, sot, sub, ohr, merk, pfad, mund: p.mund || 0, blinz: p.blinz || 0, schau: p.schau || 0, fr };
  }
  function kopfMal(g, m, T, K, D, lx, ly, o, kante, gegen) {
    const { cx, cy, kk, fx, fd, s, sa, nick, fern, nahe, maske, srx, sx, sy, sot, sub, fr } = K, H = T.haar, S = T.haut, lw = (f) => Math.max(1, f * kk), wl = Math.atan2(ly, lx);
    const schale = (q, dx = 0, dy = 0, f = 1) => { q.ellipse(sx + dx, sy + dy, srx * f, sot * f, 0, PI, PI * 2); q.ellipse(sx + dx, sy + dy, srx * f, sub * f, 0, 0, PI); };
    const ohrMal = (e) => { const O = K.ohr(e), rx = (0.01 + 0.014 * Math.max(0, O.t)) * kk, ry = 0.029 * kk; fuell(g, S.m, (q) => q.ellipse(O.x, O.y, rx, ry, 0, 0, PI * 2)); if (D) { fuell(g, S.d, (q) => q.ellipse(O.x + (O.t > 0.4 ? s * 0.002 * kk : 0), O.y + 0.002 * kk, rx * 0.5, ry * 0.58, 0, 0, PI * 2)); if (m.ohrring) fuell(g, T.gold.l, (q) => q.arc(O.x, O.y + ry * 1.05, lw(0.0075), 0, PI * 2)); } };
    const ohrFrei = fr !== 'bob' && fr !== 'lang';
    // 1 · hinter dem Schädel: Dutt, die Locken als Kranz, Ohren am Rand
    if (fr === 'dutt') { const bx = cx - fx * 0.07 * kk, by = cy - (0.128 - 0.02 * Math.max(0, -fd)) * kk, br = 0.042 * kk; fuell(g, H.d, (q) => q.arc(bx, by, br, 0, PI * 2)); fuell(g, H.m, (q) => q.arc(bx + lx * br * 0.2, by + ly * br * 0.2, br * 0.78, 0, PI * 2)); if (D > 1) strich(g, H.l, lw(0.005), (q) => q.arc(bx, by, br * 0.55, wl - 0.9, wl + 0.9), 0.7); }
    if (fr === 'locken') for (let i = 0; i <= 10; i++) { const w = PI * (0.98 + (i / 10) * 1.04), r = 0.03 * kk * (0.9 + (0.2 * ((i * 7) % 3)) / 2); fuell(g, i % 2 ? H.m : H.d, (q) => q.arc(sx + Math.cos(w) * srx * 0.96, sy + Math.sin(w) * sot * 0.94, r, 0, PI * 2)); }
    if (ohrFrei) for (const e of [-1, 1]) { const t = K.ohr(e).t; if (t > -0.3 && t <= 0.35) ohrMal(e); }
    // 2 · der Schädel in Haarfarbe: Schattenseite, Eigenfarbe, ein Glanzlicht in Richtung des Lichts
    fuell(g, H.d, (q) => schale(q)); fuell(g, H.m, (q) => schale(q, lx * srx * 0.11, ly * sot * 0.1, 0.89));
    if (D > 1 && fr !== 'locken') for (const [f, a, b] of [[0.82, -0.9, -0.2], [0.5, -0.3, 0.6]]) strich(g, H.d, lw(0.004), (q) => q.ellipse(sx, sy, srx * f, sot * f, 0, wl + PI + a, wl + PI + b), 0.5); // Strähnen im Schatten
    // 3 · das Gesicht
    if (maske) {
      fuell(g, S.m, (q) => zug(q, maske));
      const rechts = s > 0 ? fern : nahe, links = s > 0 ? nahe : fern, kanteS = lx < 0 ? rechts : links, gegenS = lx < 0 ? links : rechts, zs = lx < 0 ? 1 : -1; // Schattenseite des Gesichts: die dem Licht abgewandte Kante
      const streif = (R, G2, a, b, f) => { const P = []; for (let i = a; i <= b; i++) P.push(R[i]); for (let i = b; i >= a; i--) P.push([lerp(R[i][0], G2[i][0], f * (i === b || i === a ? 0.4 : 1)), R[i][1]]); return P; };
      { const t = weich((sa - 0.3) / 0.4), vorn = kanteS === fern, f = vorn ? lerp(0.2, 0, t) : lerp(0.2, 0.36, t); // gedreht: Sieht das Gesicht vom Licht weg, entfällt das Band an der Profillinie; sieht es zum Licht, liegt die Seitenfläche (Schläfe, Wange, Kiefer) im Schatten
        if (f > 0.03 && (vorn || t < 0.15)) fuell(g, S.d, (q) => zug(q, streif(kanteS, gegenS, 1, 9, f)));
        else if (f > 0.03) { const a = 2, b = 9, P = [], x0 = lerp(nahe[a][0], fern[a][0], 0.12 + 0.1 * t), x1 = lerp(nahe[b][0], fern[b][0], 0.25 + 0.5 * t); // die Seitenfläche: hinten die Kante des Gesichts, vorn eine gerade Kante von der Schläfe zum Kinn
          for (let i = a; i <= b; i++) P.push(nahe[i]); for (let i = b; i >= a; i--) P.push([lerp(x0, x1, Math.pow((i - a) / (b - a), 1.6)), nahe[i][1]]); fuell(g, S.d, (q) => zug(q, P)); }
        if (vorn && t > 0.5 && D && !o.leicht) fuell(g, S.d, (q) => zug(q, streif(nahe, fern, 7, 9, 0.5 * t))); } // dafür der Schatten unter dem Kiefer
      if (D) { fuell(g, S.l, (q) => zug(q, streif(gegenS, kanteS, 1, 4, 0.1))); // Licht auf Stirn und Wange
        if (D > 1) { const wx = lerp(gegenS[4][0], kanteS[4][0], 0.26), wy = cy + 0.034 * kk + nick; g.globalAlpha = 0.22; fuell(g, T.lippe.m, (q) => q.ellipse(wx, wy, 0.017 * kk * Math.max(0.4, fd), 0.011 * kk, 0, 0, PI * 2)); g.globalAlpha = 1; } } // ein Hauch Farbe auf der Wange
      if (m.bart) { const P = [...fern.slice(5), [(fern[9][0] + nahe[9][0]) / 2, cy + 0.121 * kk + nick], ...nahe.slice(4).reverse()], mu = K.merk(0, 0.085); // Vollbart: Wangen, Oberlippe und Kinn; der Mund bleibt frei
        fuell(g, H.m, (q) => zug(q, P)); fuell(g, H.d, (q) => zug(q, streif(kanteS, gegenS, 5, 9, 0.3)));
        fuell(g, H.m, (q) => eck(q, [nahe[2], [nahe[2][0] + s * 0.014 * kk, nahe[2][1]], [nahe[5][0] + s * 0.02 * kk, nahe[5][1]], nahe[5]])); // Koteletten
        fuell(g, S.m, (q) => q.ellipse(grenze(mu.x, Math.min(nahe[6][0], fern[6][0]) + 0.014 * kk, Math.max(nahe[6][0], fern[6][0]) - 0.014 * kk), cy + 0.06 * kk + nick, 0.017 * kk * Math.max(0.45, fd), 0.008 * kk, 0, 0, PI * 2)); }
      if (D && fd > -0.25) gesicht(g, m, T, K, D, lx, ly, zs);
      else if (!D && fd > 0.2) for (const e of [-1, 1]) { const A = K.merk(e * 0.42, 0.074); if (A.t > 0.3) fuell(g, 'rgba(34,24,28,.7)', (q) => q.ellipse(A.x, cy - 0.002 * kk, Math.max(0.7, 0.007 * kk), Math.max(0.8, 0.009 * kk), 0, 0, PI * 2)); }
    }
    // 4 · Haare vor dem Gesicht: Haaransatz mit Scheitel, Pony, Strähnen vor den Ohren
    if (maske && fd > -0.3) {
      const stirnA = nahe[1], stirnB = fern[1], mi = [lerp(nahe[0][0], fern[0][0], 0.5 + 0.28 * m.scheitel * s * Math.max(0, fd)), nahe[0][1]], tief = m.pony ? 0.05 : fr === 'locken' ? 0.03 : m.ansatz ? -0.006 : 0.012, oben = cy - 0.1 * kk, ecke = m.ansatz ? 0.016 * kk : 0; // ansatz hoch: Der Haaransatz liegt höher, an den Schläfen weicht er zurück
      const P = [[stirnA[0] - s * 0.006 * kk, stirnA[1] + 0.012 * kk], [lerp(stirnA[0], mi[0], 0.55), stirnA[1] - (0.014 - tief) * kk - ecke], [mi[0], mi[1] + (m.pony ? tief : 0.004) * kk - ecke * 0.3], [lerp(stirnB[0], mi[0], 0.5), stirnB[1] - (0.02 - tief) * kk - ecke], [stirnB[0] + s * 0.004 * kk, stirnB[1] + 0.006 * kk], [stirnB[0] - s * 0.01 * kk, oben], [stirnA[0] + s * 0.012 * kk, oben]];
      fuell(g, H.m, (q) => zug(q, P));
      if (D) strich(g, H.d, lw(0.005), (q) => { q.moveTo(P[0][0], P[0][1]); q.quadraticCurveTo(P[1][0], P[1][1], P[2][0], P[2][1]); q.quadraticCurveTo(P[3][0], P[3][1], P[4][0], P[4][1]); }, 0.45);
      if (D > 1 && fr !== 'locken') strich(g, H.l, lw(0.006), (q) => { q.moveTo(mi[0], mi[1] - 0.004 * kk); q.quadraticCurveTo(lerp(mi[0], stirnB[0], 0.5), oben + 0.012 * kk, stirnB[0] - s * 0.014 * kk, stirnB[1] - 0.02 * kk); }, 0.6); // der Scheitel fängt Licht
      if (fr === 'locken') for (let i = 0; i < 4; i++) { const t = (i + 0.5) / 4; fuell(g, i % 2 ? H.d : H.m, (q) => q.arc(lerp(stirnA[0], stirnB[0], t), stirnA[1] + 0.004 * kk, 0.021 * kk, 0, PI * 2)); }
      if (fr === 'bob' || fr === 'lang') for (const R of sa < 0.55 ? [nahe, fern] : [nahe]) { const au = R === nahe ? -s : s, lg = fr === 'bob' ? 8 : 9, P2 = [], yv = (i) => cy + GES[i][0] * kk + (i > 7 ? (i - 7) * 0.02 * kk : 0) + nick; // die Strähne liegt vor dem Ohr auf der Wange und fällt bis zum Kinn bzw. auf die Schulter
        for (let i = 1; i <= lg; i++) P2.push([R[Math.min(i, 7)][0] + au * 0.02 * kk, yv(i)]);
        for (let i = lg; i >= 1; i--) P2.push([R[Math.min(i, 7)][0] - au * (i < 3 ? 0.016 : 0.004) * kk, yv(i)]);
        fuell(g, au * lx > 0 ? H.m : H.d, (q) => zug(q, P2)); }
    }
    if (ohrFrei) for (const e of [-1, 1]) if (K.ohr(e).t > 0.35) { ohrMal(e); if (D > 1 && fr === 'kurz') { const O = K.ohr(e); fuell(g, H.m, (q) => eck(q, [[O.x + s * 0.012 * kk, O.y - 0.045 * kk], [O.x + s * 0.03 * kk, O.y - 0.04 * kk], [O.x + s * 0.022 * kk, O.y - 0.005 * kk], [O.x + s * 0.012 * kk, O.y - 0.012 * kk]])); } } // Kotelette vor dem Ohr
    if (D && fd < -0.2 && ohrFrei && fr !== 'zopf') strich(g, H.d, lw(0.005), (q) => { q.moveTo(sx - srx * 0.5, sy + sub * 0.86); q.quadraticCurveTo(sx, sy + sub * 1.2, sx + srx * 0.5, sy + sub * 0.86); }, 0.5); // von hinten: der Haaransatz im Nacken
    if (m.brille && D && fd > -0.1) brille(g, K, D);
    if (m.kopfhoerer || o.kopfhoerer) { // Kopfhörer: der Bügel über dem Scheitel, eine Muschel je sichtbarem Ohr
      strich(g, T.ding.m, lw(0.017), (q) => q.ellipse(sx, sy + 0.012 * kk, Math.abs(fd) * 0.084 * kk + 0.01 * kk, sot + 0.012 * kk, 0, PI * 1.04, PI * 1.96));
      for (const e of [-1, 1]) { const O = K.ohr(e); if (O.t < -0.3) continue; const rx = (0.014 + 0.02 * Math.max(0, O.t)) * kk; fuell(g, T.ding.m, (q) => q.roundRect(O.x - rx, O.y - 0.036 * kk, rx * 2, 0.07 * kk, rx * 0.7)); if (D) fuell(g, T.ding.l, (q) => q.roundRect(O.x - rx * 0.5, O.y - 0.026 * kk, rx, 0.05 * kk, rx * 0.4)); }
    }
    if (kante && D && !o.leicht) strich(g, H.l, lw(0.007), (q) => q.ellipse(sx, sy, srx - lw(0.0035), sot - lw(0.0035), 0, wl - 0.5, wl + 0.5), 0.8);
    if (gegen && D && !o.leicht && ly > 0.2) strich(g, gegen, lw(0.008), (q) => q.ellipse(sx, sy, srx - lw(0.004), sot - lw(0.004), 0, wl + PI - 0.6, wl + PI + 0.6)); // Gegenlicht nur, wenn es von oben kommt (im Haar), nie als Bogen über Kinn und Hals
  }
  /* Gesicht: Augen mit Lid und Braue, Nase als Fläche und Schatten, Mund mit Ausdruck. zs = Seite des Schattens im Bild (−1 links, 1 rechts) */
  function gesicht(g, m, T, K, D, lx, ly, zs) {
    const { cy, kk, fx, fd, s, sa, nick, fern, nahe } = K, S = T.haut, lw = (f) => Math.max(0.8, f * kk), dunkel = 'rgba(30,22,26,.9)', ay = cy - 0.001 * kk + nick, zu = K.blinz > 0.5;
    for (const e of [-1, 1]) { // Augen: sitzen 24 Grad neben der Mitte auf dem Zylinder; sie werden schmaler, je weiter sie sich wegdrehen
      const A = K.auge(e); if (!A) continue;
      const bw = (0.0128 * A.t + 0.0018) * kk, bh = 0.0066 * kk, bx = A.x, innen = -e * (fd >= 0 ? 1 : -1); // innen = Richtung zur Nase im Bild
      if (D > 1 && !zu) { fuell(g, T.weiss.m, (q) => q.ellipse(bx, ay, bw, bh, 0, 0, PI * 2));
        const ix = bx + grenze(K.schau * 0.0034 * kk + fx * 0.002 * kk, -bw * 0.4, bw * 0.4), ir = Math.min(bw * 0.72, 0.0058 * kk); fuell(g, T.auge.m, (q) => q.ellipse(ix, ay + 0.0004 * kk, ir, 0.0061 * kk, 0, 0, PI * 2)); fuell(g, '#17110f', (q) => q.ellipse(ix, ay + 0.0004 * kk, ir * 0.5, 0.003 * kk, 0, 0, PI * 2));
        fuell(g, 'rgba(255,255,255,.85)', (q) => q.arc(ix + lx * 0.002 * kk, ay - 0.0022 * kk, Math.max(0.6, 0.0013 * kk), 0, PI * 2));
        strich(g, dunkel, lw(0.0032), (q) => { q.moveTo(bx - bw * 1.08, ay + 0.001 * kk); q.quadraticCurveTo(bx, ay - bh * 1.75, bx + bw * 1.08, ay + 0.001 * kk); }); // das Oberlid mit Wimpernrand
        strich(g, S.d, lw(0.002), (q) => { q.moveTo(bx - bw, ay - bh * 1.5); q.quadraticCurveTo(bx, ay - bh * 2.5, bx + bw, ay - bh * 1.5); }, 0.7); // die Lidfalte
      } else if (zu) strich(g, dunkel, lw(0.003), (q) => { q.moveTo(bx - bw * 1.05, ay); q.quadraticCurveTo(bx, ay + bh * 0.9, bx + bw * 1.05, ay); });
      else fuell(g, dunkel, (q) => q.ellipse(bx, ay, Math.max(0.8, bw * 0.55), Math.max(0.9, 0.0072 * kk), 0, 0, PI * 2));
      const by = ay - (0.0205 + (K.mund > 0.15 ? 0.002 : 0)) * kk, bb = bw * 1.5; // die Braue: innen kräftig, nach außen dünn; konzentriert senkt sie sich zur Nase
      strich(g, T.haar.roh[0] + T.haar.roh[1] + T.haar.roh[2] > 420 ? T.haar.d : T.haar.t, lw(D > 1 ? 0.0052 : 0.006), (q) => { q.moveTo(bx + innen * bb * 0.8, by + (K.mund < 0 ? 0.0035 : 0.0012) * kk); q.quadraticCurveTo(bx - innen * bb * 0.1, by - 0.0045 * kk, bx - innen * bb * 0.95, by + 0.0012 * kk); }, 0.92);
    }
    const N = K.merk(0, 0.088), nx0 = grenze(N.x, Math.min(nahe[4][0], fern[4][0]) + 0.004 * kk, Math.max(nahe[4][0], fern[4][0]) - 0.002 * kk), ny0 = cy + 0.026 * kk + nick;
    if (sa < 0.5) { fuell(g, S.d, (q) => eck(q, [[nx0 + fx * 0.004 * kk, ay + 0.004 * kk], [nx0 + zs * 0.0125 * kk + fx * 0.006 * kk, ny0 + 0.006 * kk], [nx0 + fx * 0.008 * kk, ny0 + 0.01 * kk], [nx0 - zs * 0.004 * kk, ny0 + 0.004 * kk]])); // Nase von vorn: der Schatten auf der Seite ohne Licht, darunter die Nasenflügel
      if (D > 1) { strich(g, S.t, lw(0.0026), (q) => { q.moveTo(nx0 - 0.0085 * kk, ny0 + 0.006 * kk); q.quadraticCurveTo(nx0 + fx * 0.006 * kk, ny0 + 0.013 * kk, nx0 + 0.0085 * kk, ny0 + 0.006 * kk); }, 0.55); fuell(g, S.l, (q) => q.ellipse(nx0 - zs * 0.003 * kk + fx * 0.006 * kk, ny0 - 0.004 * kk, 0.0035 * kk, 0.008 * kk, 0, 0, PI * 2)); } }
    else if (D > 1) { const tip = K.kante(0.029, 0.027 * m.nase), un = K.kante(0.043, 0.004); // gedreht: Nasenflügel, der Schatten unter der Nase; im Dreiviertelprofil dazu der Nasenrücken als feine Linie
      strich(g, S.t, lw(0.0026), (q) => q.arc(tip - s * 0.021 * kk, ny0 + 0.0065 * kk, 0.0062 * kk, s > 0 ? PI * 0.55 : -0.4, s > 0 ? PI * 1.4 : PI * 0.45), 0.5);
      fuell(g, S.d, (q) => eck(q, [[tip - s * 0.003 * kk, ny0 + 0.0085 * kk], [un - s * 0.001 * kk, cy + 0.043 * kk + nick], [un - s * 0.019 * kk, cy + 0.041 * kk + nick], [tip - s * 0.016 * kk, ny0 + 0.011 * kk]]));
      if (sa < 0.9) strich(g, S.d, lw(0.0028), (q) => { const nw = K.merk(0, 0.088).x, sp = K.merk(0, 0.113).x; q.moveTo(nw + s * 0.004 * kk, ay + 0.003 * kk); q.quadraticCurveTo(lerp(nw, sp, 0.6) + s * 0.004 * kk, ny0 - 0.012 * kk, Math.min(s * sp, s * tip - 0.002 * kk) * s, ny0 + 0.003 * kk); }, 0.45 * (1 - weich((sa - 0.75) / 0.15))); }
    /* Mund: in Ruhe geschlossen, mit leichtem Ausdruck; offen nur beim Sprechen (flach, mit Zähnen, keine runde Öffnung). Gedreht ist die ferne Hälfte kürzer als die nahe, im Profil beginnt er an der Profillinie. */
    const M = K.merk(0, 0.084), my = cy + 0.0585 * kk + nick, auf = Math.max(0, K.mund), mw = 0.0215 * kk * (0.34 + 0.66 * Math.max(0, fd)), wF = mw * (1 - 0.6 * sa), wN = mw * (1 + 0.35 * sa);
    const xf = s * Math.min(s * (M.x + s * wF), s * K.kante(0.0575, 0.002) - 0.0022 * kk), xn = s * Math.max(s * (xf - s * (wF + wN)), s * nahe[6][0] + 0.006 * kk), mx = (xf + xn) / 2, hw = Math.abs(xf - xn) / 2, li = Math.min(xf, xn), re = Math.max(xf, xn), nahL = xn < xf; // xf = ferner, xn = naher Mundwinkel
    if (auf > 0.15) { const h = (0.0034 + 0.0068 * auf) * kk;
      fuell(g, 'rgba(78,32,36,.95)', (q) => { q.moveTo(li + hw * 0.08, my - 0.0006 * kk); q.lineTo(re - hw * 0.08, my - 0.0006 * kk); q.quadraticCurveTo(re - hw * 0.1, my + h * 1.5, mx, my + h * 1.55); q.quadraticCurveTo(li + hw * 0.1, my + h * 1.5, li + hw * 0.08, my - 0.0006 * kk); });
      if (D > 1) { fuell(g, T.weiss.m, (q) => q.rect(li + hw * 0.34, my - 0.0002 * kk, hw * 1.32, Math.min(0.0027 * kk, h * 0.5)));
        strich(g, T.lippe.m, lw(0.0034), (q) => { q.moveTo(li + hw * 0.2, my + h * 1.28); q.quadraticCurveTo(mx, my + h * 1.9, re - hw * 0.2, my + h * 1.28); }); }
      strich(g, T.lippe.d, lw(0.0036), (q) => { q.moveTo(li, my - 0.0012 * kk); q.quadraticCurveTo(mx, my - 0.003 * kk, re, my - 0.0012 * kk); });
    } else { const bog = K.mund < 0 ? 0.0006 : 0.0052, yF = my - bog * 0.5 * kk * (1 - 0.8 * sa), yN = my - bog * 0.5 * kk * (1 + 0.7 * sa); // freundlich: die Mundwinkel heben sich (im Profil nur der nahe)
      strich(g, T.lippe.d, lw(0.0042), (q) => { q.moveTo(xn, yN); q.quadraticCurveTo(mx, my + bog * kk, xf, yF); });
      if (D > 1) { strich(g, T.lippe.m, lw(0.0035), (q) => { q.moveTo(mx - hw * 0.62, my + 0.0048 * kk); q.quadraticCurveTo(mx, my + 0.0085 * kk, mx + hw * 0.62, my + 0.0048 * kk); }, 0.75);
        if (K.mund >= 0) { fuell(g, S.d, (q) => q.arc(xn - (nahL ? 1 : -1) * hw * 0.1, yN - 0.0012 * kk, lw(0.0018), 0, PI * 2)); if (sa < 0.5) fuell(g, S.d, (q) => q.arc(xf + (nahL ? 1 : -1) * hw * 0.1, yF - 0.0012 * kk, lw(0.0018), 0, PI * 2)); } } }
    if (D > 1 && m.alt && sa < 0.75) { // Alter: Falten von den Nasenflügeln zu den Mundwinkeln, eine Linie auf der Stirn, ein Fältchen am nahen Auge
      for (const e of sa < 0.35 ? [-1, 1] : [nahL ? -1 : 1]) strich(g, S.d, lw(0.0026), (q) => { q.moveTo(nx0 + e * 0.014 * kk, ny0 + 0.006 * kk); q.quadraticCurveTo(mx + e * (hw + 0.012 * kk), my - 0.012 * kk, mx + e * (hw + 0.008 * kk), my + 0.004 * kk); }, 0.5);
      strich(g, S.d, lw(0.0024), (q) => { q.moveTo(nx0 - 0.026 * kk * fd, cy - 0.046 * kk + nick); q.quadraticCurveTo(nx0, cy - 0.05 * kk + nick, nx0 + 0.026 * kk * fd, cy - 0.046 * kk + nick); }, 0.4); }
    if (D > 1 && sa < 0.9) strich(g, S.d, lw(0.003), (q) => { q.moveTo(mx - hw * 0.5, my + 0.018 * kk); q.quadraticCurveTo(mx, my + 0.0215 * kk, mx + hw * 0.5, my + 0.018 * kk); }, 0.5); // die Falte über dem Kinn
  }
  function brille(g, K, D) {
    const { cy, kk, nick } = K, ay = cy + 0.001 * kk + nick, lw = Math.max(1, 0.0042 * kk), R = [];
    for (const e of [-1, 1]) { const A = K.auge(e, 0.079); if (!A) continue; const w = (0.019 * A.t + 0.003) * kk, h = 0.0145 * kk; R.push([A.x, w]);
      if (D > 1) { g.globalAlpha = 0.16; fuell(g, '#dfe9ff', (q) => q.roundRect(A.x - w, ay - h, 2 * w, 2 * h, h * 0.55)); g.globalAlpha = 1; }
      strich(g, 'rgba(24,20,26,.92)', lw, (q) => q.roundRect(A.x - w, ay - h, 2 * w, 2 * h, h * 0.55));
      const O = K.ohr(e); if (O.t > 0.1) strich(g, 'rgba(24,20,26,.85)', lw * 0.8, (q) => { q.moveTo(A.x + (O.x > A.x ? w : -w), ay - h * 0.4); q.lineTo(O.x, O.y - 0.012 * kk); }); }
    if (R.length === 2) strich(g, 'rgba(24,20,26,.92)', lw, (q) => { const a = R[0][0] < R[1][0] ? R[0] : R[1], b = a === R[0] ? R[1] : R[0]; q.moveTo(a[0] + a[1], ay - 0.003 * kk); q.quadraticCurveTo((a[0] + b[0]) / 2, ay - 0.008 * kk, b[0] - b[1], ay - 0.003 * kk); });
  }
  /* Langes Haar bzw. Zopf: fällt hinter dem Hals auf den Rücken (von hinten davor, von vorn dahinter) */
  function haarBau(m, K, k) {
    const { cx, cy, kk, fx, fd, srx, sx } = K;
    if (m.frisur === 'zopf') { const bx = cx - fx * 0.085 * kk, by = cy - 0.02 * kk, yu = by + 0.3 * k, b = 0.03 * kk; return { P: [[bx - b, by], [bx + b, by], [bx + b * 1.1 - fx * 0.03 * kk, lerp(by, yu, 0.5)], [bx + b * 0.5 - fx * 0.05 * kk, yu], [bx - b * 0.5 - fx * 0.05 * kk, yu], [bx - b * 1.1 - fx * 0.03 * kk, lerp(by, yu, 0.5)]], cx: bx - fx * 0.02 * kk, yu, fx }; }
    const sa2 = fx * fx, b = srx * (0.98 + 0.06 * Math.abs(fd)) * (1 - 0.42 * sa2), hx = sx - fx * (0.02 + 0.028 * sa2) * kk, y0 = cy - 0.02 * kk, yu = cy + 0.31 * kk; // im Profil fällt das Haar hinter dem Ohr (schmaler, nach hinten gerückt): Das Gesicht bleibt frei
    return { P: [[hx - b, y0], [hx + b, y0], [hx + b * 1.08, lerp(y0, yu, 0.5)], [hx + b * 0.94, yu - 0.01 * kk], [hx + b * 0.4, yu + 0.012 * kk], [hx - b * 0.4, yu + 0.012 * kk], [hx - b * 0.94, yu - 0.01 * kk], [hx - b * 1.08, lerp(y0, yu, 0.5)]], cx: hx, yu, fx };
  }
  /* Was eine Hand hält. Hg = Handgelenk, Fi = Fingerspitzen (Bildpunkte) */
  function halten(g, ding, Hg, Fi, k, T, s, o, D) {
    const hx = (Hg[0] + Fi[0]) / 2, hy = (Hg[1] + Fi[1]) / 2;
    if (ding === 'tasche') { // Tasche in der Hand: zwei Henkel, der Körper mit Klappe und Schnalle
      const w = 0.38 * k, h = 0.28 * k, x = hx - w / 2, y = hy + 0.1 * k, t = T.tasche;
      strich(g, t.d, Math.max(1.2, 0.016 * k), (q) => { q.moveTo(x + w * 0.24, y + 2); q.quadraticCurveTo(hx - w * 0.06, hy - 0.01 * k, hx, hy); q.quadraticCurveTo(hx + w * 0.06, hy - 0.01 * k, x + w * 0.76, y + 2); });
      fuell(g, t.m, (q) => q.roundRect(x, y, w, h, 0.03 * k)); fuell(g, t.d, (q) => q.roundRect(x + (o.L && o.L[0] < 0 ? w * 0.72 : 0), y, w * 0.28, h, 0.03 * k));
      fuell(g, t.l, (q) => q.roundRect(x + w * 0.04, y + h * 0.04, w * 0.92, h * 0.4, 0.024 * k)); strich(g, t.t, Math.max(1, 0.006 * k), (q) => { q.moveTo(x + w * 0.04, y + h * 0.44); q.lineTo(x + w * 0.96, y + h * 0.44); }, 0.6);
      if (D) fuell(g, T.gold.m, (q) => q.rect(x + w * 0.46, y + h * 0.38, w * 0.08, h * 0.13));
      return;
    }
    if (ding === 'handy' || ding === 'handyhoch') { // Telefon: der Bildschirm leuchtet zu uns, wenn wir der Figur über die Schulter sehen
      const hoch = ding === 'handyhoch', w = (hoch ? 0.078 : 0.074) * k, h = (hoch ? 0.158 : 0.15) * k, bild = Math.cos(o.dreh || 0) < 0.15;
      g.save(); g.translate(lerp(Hg[0], Fi[0], 0.62), lerp(Hg[1], Fi[1], 0.62) - h * 0.3); g.rotate(hoch ? 0 : 0.12 * s);
      fuell(g, '#0b0b12', (q) => q.roundRect(-w / 2, -h / 2, w, h, w * 0.18));
      if (bild) { fuell(g, o.schirm || 'rgba(232,226,255,.92)', (q) => q.rect(-w * 0.4, -h * 0.43, w * 0.8, h * 0.86)); fuell(g, 'rgba(20,18,30,.5)', (q) => q.rect(-w * 0.4, -h * 0.05, w * 0.8, h * 0.12)); }
      else { fuell(g, 'rgba(255,255,255,.16)', (q) => q.arc(-w * 0.2, -h * 0.32, w * 0.13, 0, PI * 2)); if (D > 1) strich(g, 'rgba(255,255,255,.2)', 1, (q) => q.roundRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2, w * 0.16)); }
      g.restore(); return;
    }
    if (ding === 'tablet') { const w = 0.27 * k, h = 0.2 * k; g.save(); g.translate(hx - s * w * 0.3 * Math.sin(o.dreh || 0), hy - h * 0.35); fuell(g, '#0d0d15', (q) => q.roundRect(-w / 2, -h / 2, w, h, w * 0.06)); fuell(g, 'rgba(226,220,250,.86)', (q) => q.rect(-w * 0.44, -h * 0.4, w * 0.88, h * 0.8));
      if (D > 1) { fuell(g, 'rgba(60,52,96,.5)', (q) => { q.rect(-w * 0.38, -h * 0.3, w * 0.4, h * 0.07); q.rect(-w * 0.38, -h * 0.14, w * 0.62, h * 0.05); q.rect(-w * 0.38, -h * 0.02, w * 0.5, h * 0.05); }); fuell(g, 'rgba(124,58,237,.6)', (q) => q.rect(-w * 0.38, h * 0.14, w * 0.22, h * 0.12)); } g.restore(); return; }
    if (ding === 'mappe') { // Tablet in der Hülle, mit dem Unterarm an die Brust gedrückt: liegt hinter Arm und Hand
      const cd = Math.cos(o.dreh || 0), w = 0.2 * k * Math.abs(cd) + 0.024 * k, h = 0.27 * k, t = T.ding; g.save(); g.translate(Hg[0] + (Hg[0] - Fi[0]) * 0.42, Hg[1] + (Hg[1] - Fi[1]) * 0.42 - 0.07 * k); g.rotate(-0.1 * s * cd);
      fuell(g, t.d, (q) => q.roundRect(-w / 2, -h / 2, w, h, 0.016 * k)); fuell(g, t.m, (q) => q.roundRect(-w / 2 + (o.L && o.L[0] < 0 ? 0 : w * 0.16), -h / 2, w * 0.84, h, 0.016 * k));
      if (D > 1) { strich(g, t.l, Math.max(1, 0.005 * k), (q) => q.roundRect(-w / 2 + 0.012 * k, -h / 2 + 0.012 * k, w - 0.024 * k, h - 0.024 * k, 0.01 * k), 0.35); strich(g, t.t, Math.max(1, 0.008 * k), (q) => { q.moveTo(w * 0.28, -h / 2); q.lineTo(w * 0.28, h / 2); }, 0.7); }
      g.restore(); return; }
    if (ding === 'stift') { strich(g, '#17161f', Math.max(1.5, 0.014 * k), (q) => { const mx = lerp(Hg[0], Fi[0], 0.6), my = lerp(Hg[1], Fi[1], 0.6); q.moveTo(mx, my); q.lineTo(mx + (Fi[0] - Hg[0]) * 0.75, my + (Fi[1] - Hg[1]) * 0.75 - 0.03 * k); }); return; }
    if (ding === 'becher') { const w = 0.07 * k, h = 0.1 * k, bx = lerp(Hg[0], Fi[0], 0.6), by = lerp(Hg[1], Fi[1], 0.6); fuell(g, 'rgb(230,224,216)', (q) => q.roundRect(bx - w / 2, by - h * 0.8, w, h, w * 0.15)); if (D) fuell(g, 'rgb(196,188,180)', (q) => q.rect(bx + w * 0.2, by - h * 0.8, w * 0.3, h)); }
  }

  /* Eine Tasche, die am Boden steht (neben dem Platz ihres Menschen) */
  function tasche(g, m, licht, x, y, k) {
    const T = toene(m, licht).tasche, w = 0.38 * k, h = 0.28 * k;
    schatten(g, x, y, k, 0.26, 0.2, 0.4);
    strich(g, T.d, Math.max(1.2, 0.016 * k), (q) => q.ellipse(x, y - h, w * 0.26, h * 0.34, 0, PI, PI * 2));
    fuell(g, T.m, (q) => q.roundRect(x - w / 2, y - h, w, h, 0.03 * k)); fuell(g, T.d, (q) => q.roundRect(x - w / 2 + w * 0.72, y - h, w * 0.28, h, 0.03 * k));
    fuell(g, T.l, (q) => q.roundRect(x - w / 2 + w * 0.04, y - h + h * 0.04, w * 0.92, h * 0.4, 0.024 * k)); strich(g, T.t, Math.max(1, 0.006 * k), (q) => { q.moveTo(x - w * 0.46, y - h * 0.56); q.lineTo(x + w * 0.46, y - h * 0.56); }, 0.6);
  }
  /* Weicher Schatten am Boden: eine flache, dunkle Ellipse unter der Figur */
  function schatten(g, x, y, k, breit = 0.46, flach = 0.2, a = 0.5) {
    const r = breit * k; g.save(); g.translate(x, y); g.scale(1, flach);
    const s = g.createRadialGradient(0, 0, 0, 0, 0, r); s.addColorStop(0, `rgba(0,0,0,${a})`); s.addColorStop(0.55, `rgba(0,0,0,${a * 0.45})`); s.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = s; g.beginPath(); g.arc(0, 0, r, 0, PI * 2); g.fill(); g.restore();
  }

  /* Eigene Flächen: Was steht, wird einmal gezeichnet und danach nur noch an seine Stelle gesetzt (Umrisse leerer Plätze, Menschen in der Ferne).
     schluessel = alles, wovon das Bild abhängt; ändert er sich, wird neu gezeichnet. */
  const FLAECHEN = new Map();
  function stempel(ziel, name, schluessel, x0, y0, k0, male, a = 1, halten = false, kBild = 0) { // halten = ein vorhandenes Bild bleibt, auch wenn der Schlüssel nicht mehr genau passt (unterwegs wird nichts neu gezeichnet); es wird dann in der passenden Größe eingesetzt
    let f = FLAECHEN.get(name); const kb = kBild || k0, neu = !f || (!(halten && f.key) && (f.key !== schluessel || f.k !== kb));
    if (!f) { const c = document.createElement('canvas'); f = { c, g: c.getContext('2d'), key: '' }; FLAECHEN.set(name, f); }
    if (neu) { const w = Math.ceil(kb * 2.4) + 8, h = Math.ceil(kb * 2.5) + 8; if (f.c.width !== w || f.c.height !== h) { f.c.width = w; f.c.height = h; } else f.g.clearRect(0, 0, w, h); /* dieselbe Größe: keine neue Fläche anlegen (das kostet die Grafikkarte mehr als das Zeichnen) */ f.key = schluessel; f.k = kb; f.ay = h - Math.ceil(kb * 0.3) - 4; f.aus = male(f.g, w / 2, f.ay, kb) || null; stempel.neu = (stempel.neu || 0) + 1; }
    const w = f.c.width, h = f.c.height, s = k0 / f.k;
    if (a < 1) ziel.globalAlpha *= a;
    if (s === 1) ziel.drawImage(f.c, Math.round(x0 - w / 2), Math.round(y0 - f.ay)); else ziel.drawImage(f.c, x0 - (w / 2) * s, y0 - f.ay * s, w * s, h * s);
    if (a < 1) ziel.globalAlpha /= a;
    return f.aus ? { kopf: [(f.aus.kopf[0] - w / 2) * s + x0, (f.aus.kopf[1] - f.ay) * s + y0] } : null;
  }

  /* Nur zum Messen: wo Kopf, Becken, Knöchel und Hände einer Haltung im Bild liegen (dieselbe Rechnung wie malen) und wo die Knöchel im Raum des Körpers stehen */
  function punkte(m, p, x0, y0, k0, o) { const sk = skelett(p, m), pt = sichtVon(m, sk, o, x0, y0, k0 * m.gr), b = (q) => pt(q).slice(0, 2); return { kopf: b(sk.kopf), hip: b(sk.hip), fr: b(sk.bR.a), fl: b(sk.bL.a), hr: b(sk.R.h), hl: b(sk.L.h), ar: sk.bR.a, al: sk.bL.a, grund: sk.grund }; }
  stempel.mp = () => { let n = 0; for (const x of FLAECHEN.values()) n += (x.c.width * x.c.height) / 1e6; return n; };
  return { mensch, malen, rahmen, steh, sitz, geh, hocke, zwischen, leben, gespraech, reden, rausch, ARME, schatten, tasche, stempel, weich, SCHRITT_M, STUFEN, punkte, sanft, bogen, sig, zufall };
})();
