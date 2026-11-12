// Gezeichnete Bewegungen (11.11.2026): die Formensprache des Zeichens (Kugel, Balken, Linien) läuft durch die Seite.
// Je Bereich eine ruhige Zeichnung auf dunklem Grund wie im Film: Sichtbarkeit (Signale werden zu Anfragen), Vertrieb (eine geordnete
// Strecke bis zum Abschluss), Innovation (ein Ablauf, der im Alltag ankommt). Dazu „Wir sitzen mit in Ihrem Team“ auf Papier, die
// Zeichen der zwei Einstiege und die Bahn der Belegzahlen.
// Reines SVG mit Klassen: keine Inline-Stile, kein Skript (CSP 'self'). Die Bewegung steht in css/fokus.css › Gezeichnete Bewegungen,
// ausgelöst von .erscheint.sichtbar, einmal und nur im Sichtfeld. Ohne Skript und bei „Bewegung reduzieren“ steht gleich das Endbild.
// Beschriftungen sind HTML über der Zeichnung (feste Schriftgröße, auch am Handy lesbar); die Aussage trägt das aria-label der Figur.
//
// Erklärvideos: Die dunkle Fläche hat das Format 16:10. Liegt später ein Video vor, kann es genau diese Fläche übernehmen; bis dahin
// steht die Zeichnung vollständig da (kein leerer Player).

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const r1 = (n) => Math.round(n * 10) / 10;

// Zeichen „Durchbruch“ (Spur · Wand · Kern) wie in bauen.mjs › MARKE_PFAD, hier nur für die Zeichnungen.
const SPUR = 'M6,18.5H14.5M4,24H14.5M8,29.5H14.5';
const WAND = 'M18.8,6H24.2A0.8,0.8 0 0 1 25,6.8V12.44A12.8,12.8 0 0 0 18,21.25V6.8A0.8,0.8 0 0 1 18.8,6ZM18,26.75A12.8,12.8 0 0 0 25,35.56V41.2A0.8,0.8 0 0 1 24.2,42H18.8A0.8,0.8 0 0 1 18,41.2Z';

const figur = (art, label, svg, marken, { klasse = '', box = '0 0 640 400' } = {}) => `<figure class="grafik g-${art}${klasse ? ` ${klasse}` : ''} erscheint" role="img" aria-label="${esc(label)}"><svg viewBox="${box}" aria-hidden="true" focusable="false">${svg}</svg>${marken.map(([k, txt]) => `<span class="g-marke ${k}" aria-hidden="true">${esc(txt)}</span>`).join('')}</figure>`;

/** Sichtbarkeit: vom Angebot gehen Signale aus, aus Menschen, die sie erreichen, werden Anfragen. */
const sichtbarkeit = () => {
  const [cx, cy] = [196, 204];
  const bogen = (r, i) => {
    const w = (34 * Math.PI) / 180;
    return `<path class="g-welle w${i + 1}" pathLength="1" d="M${r1(cx + r * Math.cos(-w))} ${r1(cy + r * Math.sin(-w))}A${r} ${r} 0 0 1 ${r1(cx + r * Math.cos(w))} ${r1(cy + r * Math.sin(w))}"/>`;
  };
  const kunden = [[468, 112, 1], [566, 150, 0], [500, 206, 1], [598, 242, 0], [528, 300, 1], [606, 338, 0]];
  let n = 0;
  const linien = kunden.filter((k) => k[2]).map(([x, y], i) => {
    const d = Math.hypot(x - cx, y - cy);
    const [ux, uy] = [(cx - x) / d, (cy - y) / d];
    return `<path class="g-anfrage a${i + 1}" pathLength="1" d="M${r1(x + ux * 15)} ${r1(y + uy * 15)}L${r1(cx - ux * 54)} ${r1(cy - uy * 54)}"/>`;
  }).join('');
  return figur('sichtbarkeit', 'Zeichnung: Von Ihrem Angebot gehen Signale aus. Aus Menschen, die sie erreichen, werden Anfragen.', `
<path class="g-spur" d="M86 182H140M72 204H140M100 226H140"/>
<circle class="g-hof" cx="${cx}" cy="${cy}" r="66"/>
${[100, 170, 240].map(bogen).join('')}
${linien}
${kunden.map(([x, y, an]) => `<circle class="g-kunde${an ? ` an k${++n}` : ''}" cx="${x}" cy="${y}" r="11"/>`).join('')}
<circle class="g-kern" cx="${cx}" cy="${cy}" r="42"/>`, [['m1', 'Ihr Angebot'], ['m2', 'Signale'], ['m3', 'Anfragen']]);
};

/** Vertrieb: eine geordnete Strecke. Die Kugel läuft von der Anfrage über Gespräch und Angebot bis durch die Wand: der Abschluss. */
const vertrieb = () => figur('vertrieb', 'Zeichnung: Eine geordnete Strecke von der Anfrage über Gespräch und Angebot bis zum Abschluss. Heute gehen unterwegs Anfragen verloren.', `
<path class="g-verloren v1" d="M96 210C150 160 196 128 246 104"/>
<path class="g-verloren v2" d="M306 210C308 250 296 290 268 318"/>
<path class="g-verloren v3" d="M384 210C404 176 420 152 438 132"/>
<circle class="g-ende v1" cx="252" cy="101" r="5"/><circle class="g-ende v2" cx="263" cy="322" r="5"/><circle class="g-ende v3" cx="442" cy="126" r="5"/>
<line class="g-bahn" x1="96" y1="210" x2="470" y2="210"/>
<line class="g-strecke" pathLength="1" x1="96" y1="210" x2="446" y2="210"/>
<circle class="g-station s1" cx="96" cy="210" r="9"/><circle class="g-station s2" cx="240" cy="210" r="9"/><circle class="g-station s3" cx="384" cy="210" r="9"/>
<g transform="translate(426 114) scale(4)"><path class="g-logo-spur" pathLength="1" d="${SPUR}"/><path class="g-wand" d="${WAND}"/><circle class="g-kern g-laeufer" cx="30.5" cy="24" r="10.2"/></g>`, [['m1', 'Anfrage'], ['m2', 'Gespräch'], ['m3', 'Angebot'], ['m4', 'Abschluss']]);

/** Innovation: Abläufe, Daten, KI und Software werden ein Ablauf. Die Kugel läuft ihn einmal ab und kommt in der Mitte an: bei Ihrem Team. */
const innovation = () => {
  const [cx, cy, r] = [320, 196, 118];
  const knoten = [[cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy]];
  return figur('innovation', 'Zeichnung: Abläufe, Daten, KI und Software werden zu einem Ablauf verbunden, mit dem Ihr Team im Alltag arbeitet.', `
<circle class="g-ring" cx="${cx}" cy="${cy}" r="${r}"/>
<path class="g-umlauf" pathLength="1" d="M${cx} ${cy - r}A${r} ${r} 0 1 1 ${cx - 0.1} ${cy - r}"/>
${knoten.map(([x, y], i) => `<line class="g-speiche p${i + 1}" pathLength="1" x1="${x + (x === cx ? 0 : x > cx ? -14 : 14)}" y1="${y + (y === cy ? 0 : y > cy ? -14 : 14)}" x2="${cx + (x === cx ? 0 : x > cx ? 44 : -44)}" y2="${cy + (y === cy ? 0 : y > cy ? 44 : -44)}"/>`).join('')}
${knoten.map(([x, y], i) => `<circle class="g-knoten n${i + 1}" cx="${x}" cy="${y}" r="11"/>`).join('')}
<circle class="g-hof" cx="${cx}" cy="${cy}" r="56"/>
<g class="g-bahn-dreh"><circle class="g-kern g-laeufer" cx="${cx}" cy="${cy}" r="34"/></g>`, [['m1', 'Abläufe'], ['m2', 'Daten'], ['m3', 'KI'], ['m4', 'Software'], ['m5', 'Ihr Team']]);
};

const BEREICH = { sichtbarkeit, vertrieb, innovation };
/** Die Zeichnung eines Bereichs (dunkle Fläche, 16:10). */
export const bereichGrafik = (k) => (BEREICH[k] ? BEREICH[k]() : '');

/** „Wir sitzen mit in Ihrem Team“: Ihr Team als Runde, ein Platz ist unserer, von dort gehen Verbindungen zu allen. Auf Papier. */
export const teamGrafik = () => {
  const [cx, cy, r] = [306, 150, 100];
  const platz = (grad) => [r1(cx + r * Math.cos((grad * Math.PI) / 180)), r1(cy + r * Math.sin((grad * Math.PI) / 180))];
  const [wx, wy] = platz(180);
  const team = [120, 60, 0, -60, -120].map(platz);
  return figur('team', 'Zeichnung: Ihr Team sitzt in einer Runde. Einer der Plätze ist unserer, von dort gehen Verbindungen zu allen in der Runde.', `
<circle class="g-runde" cx="${cx}" cy="${cy}" r="${r}"/>
${team.map(([x, y], i) => { const d = Math.hypot(x - wx, y - wy); const [ux, uy] = [(x - wx) / d, (y - wy) / d]; return `<path class="g-faden f${i + 1}" pathLength="1" d="M${r1(wx + ux * 24)} ${r1(wy + uy * 24)}L${r1(x - ux * 17)} ${r1(y - uy * 17)}"/>`; }).join('')}
${team.map(([x, y]) => `<circle class="g-platz" cx="${x}" cy="${y}" r="15"/>`).join('')}
<circle class="g-platz frei" cx="${wx}" cy="${wy}" r="19"/>
<g class="g-gast"><path class="g-spur" d="M${wx - 78} ${wy - 10}H${wx - 34}M${wx - 90} ${wy}H${wx - 34}M${wx - 68} ${wy + 10}H${wx - 34}"/><circle class="g-kern" cx="${wx}" cy="${wy}" r="19"/></g>`, [['m1', 'Wir'], ['m2', 'Ihr Team']], { klasse: 'hell', box: '100 24 420 252' });
};

/** Zeichen der zwei Einstiege: in den Markt (die Kugel ist durch die Wand) und ins Unternehmen (die Kugel kommt im Haus an). */
export const tuerZeichen = (id) => (id === 'unternehmen'
  ? '<svg class="tuer-zeichen" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path class="spur" d="M2,18.5H11M0,24H11M4,29.5H11"/><rect class="haus" x="15.5" y="7" width="29" height="34" rx="3"/><circle class="kern" cx="30" cy="24" r="8.2"/></svg>'
  : `<svg class="tuer-zeichen" viewBox="2.7 5 38 38" aria-hidden="true" focusable="false"><path class="spur" d="${SPUR}"/><path class="wand" d="${WAND}"/><circle class="kern" cx="30.5" cy="24" r="10.2"/></svg>`);

/** Die Bahn einer Belegzahl: Linie von 0 bis zum Anteil, die Kugel am Ende, bei 100 % die Wand. seite.js lässt sie einmal mitlaufen. */
export const belegBahn = (anteil) => {
  const x = r1(16 + Math.max(0, Math.min(100, anteil)) * 2.6);
  return `<svg class="beleg-bahn" viewBox="0 0 300 28" aria-hidden="true" focusable="false"><line class="beleg-grund" x1="16" y1="14" x2="276" y2="14"/><rect class="beleg-wand" x="285" y="1" width="6" height="26" rx="1.2"/><line class="beleg-strecke" x1="16" y1="14" x2="${x}" y2="14"/><circle class="beleg-kugel" cx="${x}" cy="14" r="8"/></svg>`;
};

/**
 * Zeichen der Marken der Familie (11.11.2026). MAKE Studios: die Irisblende aus deren zeichen.svg (Maske, Farben über CSS-Klassen).
 * MAKE Revenue: der Kreis mit der Stufenlinie aus deren zeichen.svg (Favicon-Fassung: Minze auf dunkler Kachel, Strich 7).
 * schluessel macht die Masken-Kennung je Stelle eindeutig.
 */
export const markenZeichen = (id, schluessel = id) => (id === 'studios'
  ? `<svg class="marke-zeichen" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><defs><mask id="iris-${schluessel}" maskUnits="userSpaceOnUse" x="-10" y="-10" width="120" height="120"><circle cx="50" cy="50" r="46" fill="#fff"/><polygon points="50,70 32.68,60 32.68,40 50,30 67.32,40 67.32,60" fill="#000"/><path d="M50 70L15.36 90M32.68 60L-1.96 40M32.68 40L32.68 0M50 30L84.64 10M67.32 40L101.96 60M67.32 60L67.32 100" stroke="#000" stroke-width="5"/></mask></defs><rect class="mz-grund" width="100" height="100" rx="22"/><g transform="translate(50 50) scale(.76) translate(-50 -50)"><rect class="mz-farbe" x="-10" y="-10" width="120" height="120" mask="url(#iris-${schluessel})"/></g></svg>`
  : `<svg class="marke-zeichen" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><defs><mask id="stufe-${schluessel}" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100"><circle cx="50" cy="50" r="46" fill="#fff"/><path d="M-2 71H29.5V57H50V43H70.5V29H102" fill="none" stroke="#000" stroke-width="7"/></mask></defs><rect class="mz-grund" width="100" height="100" rx="22"/><g transform="translate(50 50) scale(.76) translate(-50 -50)"><rect class="mz-farbe" width="100" height="100" mask="url(#stufe-${schluessel})"/></g></svg>`);
