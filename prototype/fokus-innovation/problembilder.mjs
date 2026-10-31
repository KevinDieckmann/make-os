// Problem-Bilder für die rechte Seite im Kopf der Seiten (Kevin 30.10.: „da rechts ist immer super platz für eine
// visualisierung des Problems … und bedenk platzhalter für die videos“). Jedes Bild zeigt einmal „Heute“ und geht dann in
// „Mit Fokus“ über (CSS in css/fokus.css › Problem-Bilder, ausgelöst von .erscheint.sichtbar; bei „Bewegung reduzieren“
// gleich der Endzustand). Reines SVG mit Klassen — keine Inline-Stile, kein Skript (CSP 'self'). Farben nur aus dem Logo.
//
// Videos: Steht für eine Seite ein Video in fokus.json › videos (Datei + Standbild), ersetzt es das Bild rechts
// (`buehne`). Fehlt es, bleibt das Problem-Bild. Für Seiten, deren rechte Seite schon belegt ist (Bereiche, Check),
// gibt `videoAbschnitt` einen eigenen Abschnitt unter dem Kopf zurück — ohne Video nichts.

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const text = (x, y, inhalt, klasse = 'pb-text', anker = 'middle') => `<text class="${klasse}" x="${x}" y="${y}" text-anchor="${anker}">${esc(inhalt)}</text>`;

/** Die Bilder: Titel (für Screenreader), Satz darunter, SVG-Inhalt. */
const BILDER = {
  // In den Markt: das Kernproblem der Startseite — gutes Produkt, kleiner Umsatz.
  'produkt-umsatz': {
    titel: 'Ihr Produkt ist besser, als Ihr Umsatz zeigt. Mit Sichtbarkeit und planbarem Vertrieb schließt sich die Lücke.',
    satz: 'Das Produkt ist gut, der Umsatz klein. Dazwischen fehlen meist Sichtbarkeit und ein Vertrieb, der planbar läuft.',
    svg: () => `
<line class="pb-achse" x1="60" y1="200" x2="340" y2="200"/>
<line class="pb-moeglich" x1="80" y1="50" x2="330" y2="50"/>
${text(80, 40, 'Was möglich ist', 'pb-text pb-klein', 'start')}
<rect class="pb-produkt" x="105" y="50" width="76" height="150" rx="3"/>
<rect class="pb-umsatz" x="219" y="50" width="76" height="150" rx="3"/>
<g class="pb-luecke"><line x1="257" y1="58" x2="257" y2="146"/><path d="M251 64 L257 56 L263 64 M251 140 L257 148 L263 140"/>${text(271, 106, 'Lücke', 'pb-text pb-klein', 'start')}</g>
<g class="pb-geist"><line x1="219" y1="152" x2="303" y2="152"/>${text(309, 156, 'heute', 'pb-text pb-klein', 'start')}</g>
<circle class="pb-punkt" cx="257" cy="50" r="6"/>
${text(143, 224, 'Ihr Produkt')}${text(257, 224, 'Ihr Umsatz')}`,
  },
  // Sichtbarkeit: in der Antwort von Suche und KI-Assistent nicht vorkommen.
  gefunden: {
    titel: 'Eine Antwort von Suchmaschine oder KI-Assistent mit drei Anbietern. Ihr Unternehmen fehlt, mit klarer Beschreibung steht es oben.',
    satz: 'Kunden fragen Google und KI-Assistenten. Wer dort nicht klar beschrieben ist, kommt in der Antwort nicht vor.',
    svg: () => `
<rect class="pb-feld" x="36" y="16" width="328" height="34" rx="17"/>
<circle class="pb-funke" cx="56" cy="33" r="5"/>
${text(70, 37, 'Wer bietet das in meiner Nähe an?', 'pb-text', 'start')}
${[0, 1, 2].map((i) => `<g class="pb-zeile pb-z${i + 1}"><circle class="pb-grau" cx="58" cy="${78 + i * 40}" r="7"/><rect class="pb-grau" x="74" y="${71 + i * 40}" width="${[200, 170, 186][i]}" height="9" rx="4.5"/><rect class="pb-grau-zart" x="74" y="${85 + i * 40}" width="${[140, 120, 150][i]}" height="6" rx="3"/></g>`).join('')}
<g class="pb-eigen">
<rect class="pb-eigen-rahmen" x="40" y="186" width="320" height="36" rx="8"/>
<circle class="pb-eigen-punkt" cx="58" cy="204" r="7"/>
<text class="pb-text pb-eigen-vorher" x="74" y="208" text-anchor="start">Ihr Unternehmen? Fehlt.</text>
<text class="pb-text pb-eigen-nachher" x="74" y="208" text-anchor="start">Ihr Unternehmen</text>
</g>`,
  },
  // Innovation / Ins Unternehmen: einzelne Werkzeuge ohne Verbindung — dann ein Ablauf.
  inseln: {
    titel: 'Fünf Werkzeuge ohne Verbindung. Verbunden zu einem Ablauf spart KI im Alltag Zeit.',
    satz: 'Einzelne KI-Tools sparen wenig. Erst wenn Abläufe und Daten verbunden sind, spart KI jede Woche Zeit.',
    svg: () => {
      const knoten = [[30, 28, 'KI-Tool'], [268, 22, 'Tabellen'], [24, 172, 'Postfach'], [276, 168, 'CRM'], [150, 196, 'Angebote']];
      const mitte = [200, 116];
      return `
${knoten.map(([x, y]) => `<line class="pb-verbindung" pathLength="1" x1="${x + 51}" y1="${y + 15}" x2="${mitte[0]}" y2="${mitte[1]}"/>`).join('')}
${knoten.map(([x, y, n], i) => `<g class="pb-knoten pb-k${i + 1}"><rect x="${x}" y="${y}" width="102" height="30" rx="15"/>${text(x + 51, y + 20, n, 'pb-text pb-klein')}</g>`).join('')}
<circle class="pb-punkt pb-mitte" cx="${mitte[0]}" cy="${mitte[1]}" r="9"/>
<g class="pb-mitte-text"><rect class="pb-schild" x="${mitte[0] - 42}" y="${mitte[1] - 40}" width="84" height="22" rx="11"/><text class="pb-text pb-klein pb-akzent-text" x="${mitte[0]}" y="${mitte[1] - 25}" text-anchor="middle">Ein Ablauf</text></g>`;
    },
  },
  // Über uns: viele Dienstleister, viele Abstimmungen — dann ein Team mit allen Fachleuten (Kevin 31.10.: Netzwerk nicht nennen).
  netzwerk: {
    titel: 'Heute stimmen Sie fünf Dienstleister einzeln ab. Bei uns sind die Fachleute in einem Team, mit einem Ansprechpartner.',
    satz: 'Fünf Dienstleister heißt fünf Abstimmungen. Bei uns sind die Fachleute im Team, und Sie haben einen Ansprechpartner.',
    svg: () => {
      const fach = ['Design', 'Video', 'Technik', 'Presse', 'Vertrieb'].map((n, i) => [300, 26 + i * 44, n]);
      return `
${fach.map(([x, y]) => `<line class="pb-wirr" x1="66" y1="120" x2="${x - 4}" y2="${y + 13}"/>`).join('')}
${fach.map(([x, y]) => `<line class="pb-verbindung" pathLength="1" x1="196" y1="120" x2="${x - 4}" y2="${y + 13}"/>`).join('')}
<line class="pb-fuehrung" pathLength="1" x1="66" y1="120" x2="186" y2="120"/>
${fach.map(([x, y, n]) => `<g class="pb-knoten pb-fest"><rect x="${x - 4}" y="${y}" width="88" height="26" rx="13"/>${text(x + 40, y + 17, n, 'pb-text pb-klein')}</g>`).join('')}
<circle class="pb-sie" cx="56" cy="120" r="10"/>${text(56, 150, 'Sie', 'pb-text pb-klein')}
<g class="pb-kern"><circle class="pb-punkt" cx="196" cy="120" r="10"/>${text(186, 146, 'Ein Team', 'pb-text pb-klein pb-akzent-text', 'end')}</g>`;
    },
  },
  // Preise: Stunden ohne Ende — dann ein fester Preis.
  festpreis: {
    titel: 'Abrechnung nach Stunden mit offenem Endpreis. Bei uns stehen Preis, Umfang und Lieferzeit vorher fest.',
    satz: 'Abrechnung nach Stunden macht Kosten unplanbar. Bei uns stehen Preis, Umfang und Lieferzeit vorher fest.',
    svg: () => `
<g class="pb-stunden">${Array.from({ length: 8 }, (_, i) => `<rect class="pb-grau pb-h${i + 1}" x="${54 + (i % 2) * 46}" y="${176 - Math.floor(i / 2) * 30}" width="40" height="24" rx="4"/>`).join('')}
${text(100, 222, 'Stunden: offen', 'pb-text pb-klein')}<text class="pb-text pb-gross" x="100" y="48" text-anchor="middle">?</text></g>
<g class="pb-preis"><rect class="pb-preis-karte" x="196" y="40" width="168" height="150" rx="10"/>
${text(280, 76, 'Festpreis', 'pb-text pb-titel-text')}
${['Preis', 'Umfang', 'Lieferzeit'].map((n, i) => `<circle class="pb-haken-punkt" cx="222" cy="${108 + i * 26}" r="6"/>${text(236, 112 + i * 26, `${n} fest`, 'pb-text pb-klein', 'start')}`).join('')}</g>`,
  },
};

/** Paket-Seiten mit Bild — nur wo es das Problem der Seite zeigt (Kevin 30.10.: „nur ein wo es sinn macht“). */
export const BILD_JE_GRUPPE = { 'sichtbarkeit/homepages': 'gefunden' };

/** Das Problem-Bild als <figure> — oder das Video der Seite, wenn eines eingetragen ist. */
export function buehne(art, video) {
  if (video?.datei) return videoFigur(video);
  const b = BILDER[art];
  if (!b) throw new Error(`Problem-Bild „${art}“ gibt es nicht.`);
  return `<figure class="problem-bild pb-${art} erscheint" aria-label="${esc(b.titel)}"><figcaption class="pb-kopf"><span class="etikett">Das Problem</span><span class="pb-zustand" aria-hidden="true"><span class="pb-heute">Heute</span><span class="pb-fokus">Mit Fokus</span></span></figcaption>
<svg class="pb-svg" viewBox="0 0 400 236" aria-hidden="true" focusable="false">${b.svg()}</svg>
<p class="pb-satz">${esc(b.satz)}</p></figure>`;
}

/** Eingetragenes Video als Figur (Standbild, lädt erst beim Abspielen). */
export function videoFigur(v) {
  return `<figure class="video-buehne erscheint"><video controls preload="none" playsinline${v.bild ? ` poster="${esc(v.bild)}"` : ''}><source src="${esc(v.datei)}" type="video/mp4">Ihr Browser zeigt dieses Video nicht. <a href="${esc(v.datei)}">Video herunterladen</a>.</video>${v.titel ? `<figcaption class="leise klein-text">${esc(v.titel)}</figcaption>` : ''}</figure>`;
}

/** Eigener Abschnitt fürs Video, wo die rechte Seite schon belegt ist — ohne Video nichts. */
export function videoAbschnitt(video, ueberschrift = 'In 90 Sekunden erklärt.') {
  if (!video?.datei) return '';
  return `<section class="abschnitt video-abschnitt" aria-label="${esc(ueberschrift)}"><div class="w">${videoFigur({ ...video, titel: video.titel ?? ueberschrift })}</div></section>`;
}

export const PROBLEM_BILDER = Object.keys(BILDER);
