// MAKE Innovation · „Das Haus“: baut aus den Quellen in diesem Ordner die Fahrt der Startseite.
//   buehne.html     Rahmen der Bühne (Zeichenfläche, Szenen, Leisten, Etagenwahl, Gastwunsch)
//   szenen.json     der Ablauf: die Szenen in der Reihenfolge der Fahrt, mit der Stelle der Zeichnung
//   raeume.json     die Räume: Etage, Name, Nutzenzeile, Satz, Farbe, Tür und die Leistungen (Menschen im Raum) mit Angebot, Varianten, Figur, Platz und Weg
//   figuren.json    die Menschen des Hauses: Statur, Haut, Haare, Kleidung
//   figuren.js      das Figuren-System (zeichnet die Menschen in jeder Haltung und Blickrichtung); der Bau setzt es in haus.js ein
//   ziele.json      alle Linkziele, aufgelöst über die Helfer der Website
//   haus.css        Stile (mit „rem“ als Einheit des Hauses, siehe Kopf der Datei)
//   haus.js         Skript (Zeichnung der Räume, Ablauf der Fahrt, Leisten)
//   haus-frueh.js   winziges Skript, das vor allem anderen läuft: Rückkehrer landen sofort in der Kurz-Startseite
// bauen.mjs ruft hausBauen() und schreibt css/haus.css, js/haus.js und js/haus-frueh.js. Es gibt nur diese eine Preisliste:
// Jeder Ab-Preis im Haus entsteht aus makeinnovation/inhalt/inhalt.json › angebote; fehlt ein Angebot, bricht der Bau ab.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const HIER = dirname(fileURLToPath(import.meta.url));
const les = (name) => readFileSync(join(HIER, name), 'utf8');
const lade = (name) => JSON.parse(les(name));
const e = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const PF = '<svg aria-hidden="true"><use href="#i-arrow"/></svg>';

/** Stile ohne Kommentare (Zeichenketten bleiben). */
function cssOhneKommentare(text) {
  let aus = '', i = 0;
  while (i < text.length) {
    const z = text[i];
    if (z === '"' || z === "'") { let j = i + 1; while (j < text.length && text[j] !== z) { if (text[j] === '\\') j++; j++; } aus += text.slice(i, j + 1); i = j + 1; }
    else if (z === '/' && text[i + 1] === '*') { const ende = text.indexOf('*/', i + 2); i = ende < 0 ? text.length : ende + 2; }
    else { aus += z; i++; }
  }
  return aus.replace(/[ \t]+$/gm, '').replace(/\n{2,}/g, '\n').replace(/^\n+/, '');
}

/** Skript ohne Kommentare. Kennt Zeichenketten, Vorlagen-Zeichenketten (auch verschachtelt) und Muster nach ( = , : ! & | ? */
export function jsOhneKommentare(q) {
  let aus = '', i = 0; const n = q.length;
  const kette = (z) => { let j = i + 1; while (j < n && q[j] !== z) { if (q[j] === '\\') j++; j++; } aus += q.slice(i, j + 1); i = j + 1; };
  const vorlage = () => { // steht auf dem öffnenden Backtick
    aus += q[i++];
    while (i < n && q[i] !== '`') {
      if (q[i] === '\\') { aus += q.slice(i, i + 2); i += 2; }
      else if (q[i] === '$' && q[i + 1] === '{') { aus += '${'; i += 2; code('}'); aus += '}'; i++; }
      else aus += q[i++];
    }
    aus += '`'; i++;
  };
  const letztes = () => { let j = aus.length - 1; while (j >= 0 && /\s/.test(aus[j])) j--; return j < 0 ? '' : aus[j]; };
  function code(bis) {
    let tiefe = 0;
    while (i < n) {
      const z = q[i];
      if (bis && z === bis && tiefe === 0) return;
      if (z === '{') tiefe++; else if (z === '}') tiefe--;
      if (z === '"' || z === "'") kette(z);
      else if (z === '`') vorlage();
      else if (z === '/' && q[i + 1] === '/') { while (i < n && q[i] !== '\n') i++; }
      else if (z === '/' && q[i + 1] === '*') { const ende = q.indexOf('*/', i + 2); i = ende < 0 ? n : ende + 2; }
      else if (z === '/' && /[(=,:!&|?]/.test(letztes())) { // ein Muster: bis zum schließenden Schrägstrich, Klassen [...] beachten
        let j = i + 1, klasse = false;
        while (j < n && (klasse || q[j] !== '/')) { if (q[j] === '\\') j++; else if (q[j] === '[') klasse = true; else if (q[j] === ']') klasse = false; j++; }
        aus += q.slice(i, j + 1); i = j + 1;
      } else { aus += z; i++; }
    }
  }
  code('');
  return aus.replace(/[ \t]+$/gm, '').replace(/\n{2,}/g, '\n').replace(/^\n+/, '');
}

const ART = ['eingang', 'problem', 'empfang', 'raum', 'tuer', 'finale'];
const FARBEN = ['studios', 'revenue', 'lavendel'];
const FIGUREN_DACH = ['gruppe', 'buehne']; // auf dem Dach stellt die Zeichnung die Menschen selbst
const HALTUNGEN = ['tippt', 'sitzt', 'sitzt-spricht', 'sitzt-sessel', 'sessel-spricht', 'kamera', 'vor-kamera', 'aufnahme', 'filmt', 'zeigt', 'schreibt', 'haelt', 'spricht', 'steht', 'telefon']; // dieselbe Liste wie HALT in haus.js

/**
 * @param h Helfer der Website: angebot(id), produktPfad(a), monatlich(a), kurzname(id), ziel(wert) → { href, mail? },
 *          satz(a) → ein Satz zum Angebot, punkte(a) → Stichpunkte („Das ist drin“), dateiDa(pfad) → liegt die Datei im Ordner der Website?
 */
export function hausBauen(h) {
  const szenenDatei = lade('szenen.json'), raeumeDatei = lade('raeume.json'), zieleRoh = lade('ziele.json'), MENSCHEN = lade('figuren.json').menschen;
  const szenen = szenenDatei.szenen, raeume = raeumeDatei.raeume;
  const hinweise = [];

  // ── Linkziele ──
  const ZIELE = {}, MAILS = {};
  const setze = (name, wert) => { const z = h.ziel(wert); if (!z || !z.href) throw new Error(`Haus: Linkziel „${name}“ (${wert}) lässt sich nicht auflösen`); ZIELE[name] = z.href; if (z.mail) MAILS[z.href] = z.mail; };
  for (const [name, wert] of Object.entries(zieleRoh)) if (!name.startsWith('_')) setze(name, wert);
  const ids = new Set(szenen.map((s) => s.id));
  /** Platzhalter im Markup: {{ziel:name}}; „szene:<kennung>“ führt auf die Szene selbst. */
  const ziel = (name) => {
    if (name.startsWith('szene:')) { const id = name.slice(6); if (!ids.has(id)) throw new Error(`Haus: Szene „${id}“ gibt es nicht (Ziel ${name})`); return `#szene-${id}`; }
    if (!(name in ZIELE)) throw new Error(`Haus: Linkziel fehlt in ziele.json: ${name}`);
    return ZIELE[name];
  };
  const platz = (name) => (name.startsWith('szene:') ? ziel(name) : `{{ziel:${name}}}`);

  // ── Prüfung der Szenenliste ──
  if (new Set(szenen.map((s) => s.id)).size !== szenen.length) throw new Error('Haus: Kennungen der Szenen müssen eindeutig sein');
  if (szenen[0].art !== 'eingang' || szenen[szenen.length - 1].art !== 'finale') throw new Error('Haus: Die Fahrt beginnt mit der Szene „eingang“ und endet mit „finale“');
  const raumVon = (id) => { const r = raeume.find((x) => x.id === id); if (!r) throw new Error(`Haus: Raum „${id}“ fehlt in raeume.json`); return r; };
  for (const s of szenen) {
    if (!ART.includes(s.art)) throw new Error(`Haus: Szene ${s.id}: unbekannte Art ${s.art}`);
    if (!s.bild || typeof s.bild.p !== 'number') throw new Error(`Haus: Szene ${s.id}: bild.p fehlt`);
    if (s.art === 'raum') raumVon(s.raum);
    for (const alt of s.alt ?? []) if (ids.has(alt)) throw new Error(`Haus: Szene ${s.id}: die alte Kennung „${alt}“ ist auch eine neue`);
  }
  for (const r of raeume) if (!szenen.some((s) => s.art === 'raum' && s.raum === r.id)) throw new Error(`Haus: Raum „${r.id}“ steht in raeume.json, aber in keiner Szene`);

  // ── Preise: aus den Angeboten der Website (eine Preisliste). Jede Leistung eines Raums wird hier zu Varianten mit Preis, Rhythmus, Satz, Stichpunkten und Link. ──
  const zahl = (x) => String(x).replace(/^ab /, '').split(' / ')[0].replace(/ €$/, '').trim();
  const wert = (preis) => { const n = Number(zahl(preis).replace(/\./g, '')); if (!Number.isFinite(n) || n <= 0) throw new Error(`Haus: „${preis}“ ist kein Preis in Zahlen`); return n; };
  const geld = (n) => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} €`;
  const RHYTHMUS = { e: 'einmalig', m: 'im Monat', a: 'je Abend' };
  // Ein auf der Website ausgeblendetes Angebot darf im Haus stehen, wenn raeume.json es nennt: Preis und Text kommen trotzdem aus der einen Preisliste, einen Link „Mehr dazu“ gibt es dann nicht (die Seite existiert nicht). Der Bau meldet es.
  const verborgen = new Set();
  const holeAngebot = (id, wo) => { let a = h.angebot(id); if (!a && h.angebotAusgeblendet) { a = h.angebotAusgeblendet(id); if (a && !verborgen.has(id)) { verborgen.add(id); hinweise.push(`${wo}: Das Angebot „${id}“ ist auf der Website ausgeblendet, steht aber im Haus (ohne Link „Mehr dazu“)`); } } if (!a) throw new Error(`Haus: ${wo} nennt das Angebot „${id}“, das es in den Daten der Website nicht gibt (oder es ist ausgeblendet)`); return a; };
  const rhythmus = (a) => (h.monatlich(a) ? 'm' : /^je Abend/.test(a.preis_zusatz ?? '') ? 'a' : 'e');
  const laufzeit = (a) => (h.monatlich(a) ? (a.preis_zusatz.split(',')[1] ?? '').trim() : ''); // „pro Monat, mindestens 3 Monate“ → „mindestens 3 Monate“
  const dreiPunkte = (liste) => (liste ?? []).filter(Boolean).slice(0, 3);
  const leistungBauen = (R, L) => {
    const wo = `Raum ${R.id}, Leistung ${L.id}`;
    if (!/^[a-z][a-z0-9-]*$/.test(L.id ?? '')) throw new Error(`Haus: ${wo}: id fehlt oder hat andere Zeichen als a–z, 0–9 und Bindestrich`);
    if (!Array.isArray(L.platz) || L.platz.length !== 2) throw new Error(`Haus: ${wo}: platz = [x, z] fehlt`);
    if (!L.figur) throw new Error(`Haus: ${wo}: figur fehlt`);
    if (!FIGUREN_DACH.includes(L.figur.art)) { // ein Mensch (und Begleitung) aus figuren.json, mit Haltung und Weg zur Tür
      if (!Array.isArray(R.plan?.tuer) || R.plan.tuer.length !== 2) throw new Error(`Haus: Raum ${R.id}: plan.tuer = [x0, x1] fehlt (die Tür in der Rückwand)`);
      const punkt = (q) => Array.isArray(q) && q.length === 2 && q.every((v) => typeof v === 'number');
      for (const f of [L.figur, ...(L.figur.mit ?? [])]) {
        if (!MENSCHEN[f.mensch]) throw new Error(`Haus: ${wo}: den Menschen „${f.mensch}“ gibt es in figuren.json nicht`);
        if (!HALTUNGEN.includes(f.haltung)) throw new Error(`Haus: ${wo}: haltung „${f.haltung}“ gibt es nicht (${HALTUNGEN.join(' | ')})`);
        if (typeof f.blick !== 'number') throw new Error(`Haus: ${wo}: blick fehlt (Grad: 0 = in den Raum hinein, 90 = nach rechts, 180 = zu uns)`);
        if (!Array.isArray(f.weg) || !f.weg.every(punkt)) throw new Error(`Haus: ${wo}: weg = [[x, z], …] fehlt (Wegpunkte um die Möbel herum bis vor die Tür)`);
        if (f !== L.figur && !punkt(f.platz)) throw new Error(`Haus: ${wo}: Begleitung ${f.mensch} braucht einen eigenen platz`);
      }
    }
    let V;
    if (L.frei) {
      if (!L.satz) throw new Error(`Haus: ${wo}: eine freie Leistung braucht einen satz`);
      V = [{ name: '', frei: L.frei, satz: L.satz, punkte: dreiPunkte(L.punkte), mehr: null }];
    } else if (L.varianten) {
      V = L.varianten.map((v) => { const a = holeAngebot(v.angebot, wo); return { name: v.name, kennung: a.id, preis: wert(a.preis), r: rhythmus(a), laufzeit: laufzeit(a), satz: v.satz ?? L.satz ?? h.satz(a), punkte: dreiPunkte(v.punkte ?? L.punkte ?? h.punkte(a)), mehr: verborgen.has(a.id) ? null : h.produktPfad(a) }; });
    } else if (L.stufen) {
      const a = holeAngebot(L.angebot, wo); if (!a.stufen?.length) throw new Error(`Haus: ${wo}: das Angebot ${a.id} hat keine Stufen`);
      V = a.stufen.map((st) => ({ name: st.name, kennung: `${a.id}-${st.name.toLowerCase()}`, preis: wert(st.preis), r: rhythmus(a), laufzeit: laufzeit(a), satz: L.satz ?? h.satz(a), punkte: dreiPunkte(st.punkte ?? [st.workshop ? `Workshop: ${st.workshop}` : '', st.ergebnis]), mehr: h.produktPfad(a) }));
    } else {
      const a = holeAngebot(L.angebot, wo);
      V = [{ name: '', kennung: a.id, preis: wert(a.preis), r: rhythmus(a), laufzeit: laufzeit(a), satz: L.satz ?? h.satz(a), punkte: dreiPunkte(L.punkte ?? h.punkte(a)), mehr: verborgen.has(a.id) ? null : h.produktPfad(a) }];
    }
    for (const v of V) { if (!v.satz) throw new Error(`Haus: ${wo}${v.name ? ` (${v.name})` : ''}: kein Satz in den Daten, bitte satz in raeume.json angeben`); v.ab = v.frei ? v.frei : `ab ${geld(v.preis)}`; v.wie = v.frei ? '' : RHYTHMUS[v.r]; }
    return { id: L.id, name: L.name, V, figur: L.figur, platz: L.platz, hoch: L.hoch, knopf: L.knopf };
  };
  const RAEUME = raeume.map((R) => {
    if (!FARBEN.includes(R.farbe)) throw new Error(`Haus: Raum ${R.id}: farbe ${R.farbe} gibt es nicht (${FARBEN.join(' | ')})`);
    const L = R.leistungen.map((x) => leistungBauen(R, x));
    if (new Set(L.map((x) => x.id)).size !== L.length) throw new Error(`Haus: Raum ${R.id}: Kennungen der Leistungen müssen eindeutig sein`);
    return { ...R, L, szene: szenen.find((s) => s.art === 'raum' && s.raum === R.id).id };
  });
  /** Summen der Ab-Preise je Rhythmus als Satz (dieselbe Regel rechnet haus.js im Browser nach). wahl = [[Leistung, Variante]] */
  const summenText = (wahl) => {
    const s = { e: 0, m: 0, a: 0 }; for (const [, v] of wahl) if (!v.frei) s[v.r] += v.preis;
    const teile = ['e', 'm', 'a'].filter((r) => s[r] > 0).map((r) => `${RHYTHMUS[r]} ab ${geld(s[r])}`.replace(/ /g, '\u00a0'));
    return teile.length ? teile.join('\u00a0· ') : wahl.length ? 'kostenlos' : 'noch nichts gewählt';
  };
  const laufzeitText = (wahl) => wahl.filter(([, v]) => v.laufzeit).map(([l, v]) => `${l.name}: ${v.laufzeit}`).join(' · ');
  const wasText = (wahl) => (wahl.length ? wahl.map(([l, v]) => `${l.name}${v.name ? ` ${v.name}` : ''}`).join(' · ') : 'nichts gewählt');
  const voll = (R) => R.L.map((l) => [l, l.V[0]]);

  // ── Markup der Szenen ──
  const alink = (art, name, text, extra = '') => `<a class="alink ${art}" href="${platz(name)}"${extra}>${PF}<span class="t-caption">${e(text)}</span></a>`;
  const kopfHtml = (E, hid, unter) => {
    const vor = [`<span class="sz-nr">${e(E.nr)}</span>`];
    if (E.tag) vor.push(`<span class="sz-tag">${e(E.tag)}</span>`);
    // Rangfolge: kleine Vorzeile (Etage), darunter der Name als große Überschrift, die Nutzenzeile als zweite, kleinere Zeile
    return `<div class="sz-kopfblock"><p class="sz-vor" id="${hid}-v">${vor.join('<span class="sz-sep" aria-hidden="true"> · </span>')}</p><h2 class="sz-kopf" id="${hid}"><span class="sz-name">${e(E.name)}</span>${unter ? `<span class="sz-unter">${e(unter)}</span>` : ''}</h2></div>`;
  };
  const NEWSLETTER = `<form class="nl" id="newsletter" data-newsletter novalidate>
<p class="nl-zeile"><label class="nl-feld"><span class="sr-only">Deine E-Mail-Adresse</span><input type="email" name="email" autocomplete="email" inputmode="email" placeholder="Deine E-Mail-Adresse" required></label><button type="submit" class="alink mehr"><span class="t-caption">Bescheid geben</span></button></p>
<fieldset class="nl-wahl"><legend class="sr-only">Wofür möchtest du dich eintragen?</legend>
<label><input type="checkbox" name="wahl" value="podcast" checked><span>Podcast</span></label><label><input type="checkbox" name="wahl" value="events"><span>Event-Einladungen</span></label><label><input type="checkbox" name="wahl" value="updates"><span>Updates</span></label></fieldset>
<label class="nl-einw" data-einw hidden><input type="checkbox" name="einwilligung"><span data-wortlaut></span></label>
<div class="nl-falle" aria-hidden="true"><label>Webseite <input name="webseite" tabindex="-1" autocomplete="off"></label></div>
<p class="nl-recht">Du bekommst zuerst eine Bestätigungsmail und kannst dich jederzeit abmelden. Mehr dazu im <a href="/datenschutz/">Datenschutz</a>.</p>
<p class="nl-meldung" role="status" aria-live="polite"></p>
</form><noscript><p class="nl-ohne"><a class="alink mehr" href="/newsletter">${PF}<span class="t-caption">Bescheid geben</span></a></p></noscript>`;

  /** Foto im Empfang: liegt die Datei vor, steht das Bild da (feste Maße, lädt erst in der Nähe), sonst der Rahmen mit dem Platzhalter. */
  const fotoHtml = (f) => {
    if (!h.dateiDa(f.datei)) { hinweise.push(`Foto ${f.datei} fehlt, es steht der Platzhalter ${f.platzhalter}`); return `<div class="sz-foto sz-foto-gross" role="img" aria-label="${e(f.platzhalter)}"><span class="ph">${e(f.platzhalter)}</span></div>`; }
    const eng = '(max-width: 767.98px), (max-width: 1100px) and (max-aspect-ratio: 9/10)';
    const webp = (datei, breiten) => breiten.map((w) => [datei.replace(/\.jpe?g$/, `-${w}.webp`), w]).filter(([d]) => h.dateiDa(d)).map(([d, w]) => `/${e(d)} ${w}w`).join(', '); // kleinere Fassungen neben dem Bild (name-320.webp …): der Browser nimmt die passende
    const querW = f.quer && h.dateiDa(f.quer) ? webp(f.quer, [640, 1000, 1400]) : '', hochW = webp(f.datei, [320, 480, 700]);
    const quer = f.quer && h.dateiDa(f.quer) ? `${querW ? `<source media="${eng}" type="image/webp" srcset="${querW}" sizes="100vw" width="${f.querBreite}" height="${f.querHoehe}">` : ''}<source media="${eng}" srcset="/${e(f.quer)}" width="${f.querBreite}" height="${f.querHoehe}">` : '';
    const hoch = hochW ? `<source type="image/webp" srcset="${hochW}" sizes="(max-width: 767.98px) 42vw, 180px" width="${f.breite}" height="${f.hoehe}">` : '';
    return `<figure class="sz-bild"><picture>${quer}${hoch}<img src="/${e(f.datei)}" width="${f.breite}" height="${f.hoehe}" alt="${e(f.alt)}" loading="lazy" decoding="async"></picture></figure>`;
  };

  /** Ein Raum: die Tafel mit der Liste (echte Knöpfe), die Paket-Leiste, je Leistung eine Karte und die Schilder über den Figuren. Liste, Karten, Schilder und Raum zeigen denselben Zustand (haus.js). */
  const raumHtml = (s, hid, R) => {
    const liste = R.L.map((l) => {
      const v = l.V[0];
      return `<li class="rl-z" data-l="${l.id}"><button type="button" class="rl-an" aria-pressed="true" data-raum-aktion="paket" data-l="${l.id}"><span class="rl-haken" aria-hidden="true"></span><span class="rl-t"><b>${e(l.name)}</b><span class="rl-var" data-var>${e(v.name)}</span></span><span class="rl-preis" data-ab>${e(v.ab)}</span><span class="sr-only" data-stand>in deinem Paket</span></button><button type="button" class="rl-mehr" data-raum-aktion="oeffnen" data-l="${l.id}" aria-label="${e(l.name)}: Details ansehen"><span>Details</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button></li>`;
    }).join('');
    const karte = (l) => {
      const kid = `rk-${s.id}-${l.id}`;
      const wahl = l.V.length > 1 ? `<div class="rk-wahl" role="group" aria-label="Variante wählen">${l.V.map((v, i) => `<button type="button" aria-pressed="${i === 0}" data-raum-aktion="variante" data-v="${i}">${e(v.name)}</button>`).join('')}</div>` : '';
      const block = (v, i) => {
        const knopf = l.knopf ? alink('mehr', l.knopf.ziel, l.knopf.text) : v.mehr ? `<a class="alink mehr" href="${e(v.mehr)}">${PF}<span class="t-caption">Mehr dazu</span></a>` : '';
        return `<div class="rk-v" data-v="${i}"${i ? ' hidden' : ''}><p class="rk-satz">${e(v.satz)}</p>${v.punkte.length ? `<p class="sz-cap">Das ist drin</p><ul class="rk-punkte">${v.punkte.map((x) => `<li>${e(x)}</li>`).join('')}</ul>` : ''}<p class="rk-preis"><b>${e(v.ab)}</b>${v.frei ? '' : `<span>${e(v.wie)}${v.laufzeit ? ` · ${e(v.laufzeit)}` : ''} · netto</span>`}</p>${knopf}</div>`;
      };
      return `<article class="rk" id="${kid}" data-l="${l.id}" aria-labelledby="${kid}-h" hidden><button type="button" class="rk-zurueck" data-raum-aktion="zurueck"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg><span>Zurück in den Raum</span></button><h3 class="rk-name" id="${kid}-h">${e(l.name)}</h3>${wahl}${l.V.map(block).join('')}<button type="button" class="rk-schalter" aria-pressed="true" data-raum-aktion="paket" data-l="${l.id}"><span class="rl-haken" aria-hidden="true"></span><span data-schalter>In meinem Paket</span></button></article>`;
    };
    const schilder = R.L.map((l) => `<button type="button" class="schild" data-raum-aktion="oeffnen" data-l="${l.id}" tabindex="-1"><b>${e(l.name)}</b><span data-ab>${e(l.V[0].ab)}</span></button>`).join('');
    const lz = laufzeitText(voll(R));
    return `<div class="rblatt"><div class="rt">${kopfHtml({ nr: R.etage.nr, name: R.name }, hid, R.nutzen)}<p class="sz-satz">${e(R.satz)}</p>${R.kennzeichen ? `<p class="sz-kennzeichen">${e(R.kennzeichen)}</p>` : ''}<ul class="rl" aria-label="Leistungen in diesem Raum">${liste}</ul><p class="rl-hilfe">Tipp auf einen Menschen im Raum oder auf „Details“. Nimmst du eine Leistung heraus, verlässt sie den Raum.</p>${R.link ? `<p class="rt-link">${alink('mehr', R.link.ziel, R.link.text)}</p>` : ''}</div>
<div class="rp"><p class="rp-text"><span class="sz-cap">Dein Paket</span><b data-summe>${e(summenText(voll(R)))}</b><small><span data-laufzeit>${e(lz)}</span><span>Summe der Ab-Preise, netto.</span></small></p>${alink('erst', 'erstgespraech', 'Erstgespräch buchen')}</div></div>
${R.L.map(karte).join('\n')}
<div class="schilder" aria-hidden="true">${schilder}</div>
<button type="button" class="raum-alle" data-raum-aktion="alle" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v4.5h4.5"/></svg><span>Alle wieder im Raum</span></button>`;
  };

  const panel = (s, i) => {
    const hid = `sz-${s.id}-h`, R = s.art === 'raum' ? RAEUME.find((x) => x.id === s.raum) : null;
    const klasse = s.art === 'raum' ? `sz-raum f-${R.farbe}` : s.art === 'empfang' || s.art === 'tuer' ? `sz-etage sz-${s.art}` : `sz-${s.art}`;
    const offen = `<section class="sz ${klasse} sz-${s.id}" id="szene-${s.id}" data-szene="${i}"${R ? ` data-raum="${R.id}"` : ''} aria-labelledby="${hid}"><div class="sz-innen">`;
    const zu = '</div></section>';
    if (s.art === 'eingang') return `${offen}<h1 class="sz-titel" id="${hid}">${e(s.titel)}</h1><p class="sz-pitch">${e(s.pitch)}</p><a class="sz-hinweis" href="#szene-${szenen[i + 1].id}"><span>${e(s.hinweis)}</span><svg class="sz-pfeil" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v15M6 13l6 6 6-6"/></svg></a>${zu}`;
    if (s.art === 'problem') return `${offen}<h2 class="sz-links" id="${hid}">${e(s.links)}</h2><p class="sz-rechts">${e(s.rechts)}</p>${zu}`;
    if (s.art === 'empfang') {
      return `${offen}${kopfHtml(s.etage, hid)}<p class="sz-satz">${e(s.satz)}</p><div class="sz-empfang-reihe">${fotoHtml(s.foto)}<ul class="sz-weichen">${s.weichen.map((w) => {
        const txt = `<b>${e(w.t)}</b>${PF}`;
        return w.ziel ? `<li><a class="weiche" href="${platz(w.ziel)}">${txt}</a></li>` : `<li><button type="button" class="weiche" data-aktion="${e(w.aktion)}">${txt}</button></li>`;
      }).join('')}</ul></div><p class="sz-zeile">${e(s.zeile)}</p>${zu}`;
    }
    if (s.art === 'raum') return `${offen}${raumHtml(s, hid, R)}${zu}`;
    if (s.art === 'tuer') return `${offen}${kopfHtml(s.etage, hid)}<p class="sz-satz">${e(s.satz)}</p><p class="sz-frage">${e(s.frage)}</p>${NEWSLETTER}${zu}`;
    // Finale: der Satz, darunter „Deine Auswahl“ je Raum mit dessen Leistungen und Ab-Summen (haus.js schreibt die gemerkte Auswahl hinein; bewusst keine Gesamtsumme über alle Räume) und der große Knopf
    const zeilen = RAEUME.map((R2) => `<li data-raum="${R2.id}"><a href="#szene-${R2.szene}"><b>${e(R2.name)}</b><span data-was>${e(wasText(voll(R2)))}</span><span data-ab>${e(summenText(voll(R2)))}</span></a></li>`).join('');
    return `${offen}<div class="fz"><h2 class="sz-titel sz-titel-final" id="${hid}">${e(s.titel)}</h2><div class="fa" data-auswahl><h3 class="sz-cap">${e(s.auswahl)}</h3><ul class="fa-liste">${zeilen}</ul><p class="fa-hinweis">Ab-Preise je Raum, netto. Was du wirklich brauchst, klären wir im Gespräch.</p></div><p class="sz-final-knopf">${alink('erst gross', s.knopf.ziel, s.knopf.text)}</p><p class="sz-mikro">${e(s.mikro)}</p></div>${zu}`;
  };

  // ── Leiste links: die Etagen (je Etage ihre Szene) ──
  const etagen = szenen.filter((s) => ['empfang', 'raum', 'tuer'].includes(s.art)).map((s) => {
    const R = s.art === 'raum' ? RAEUME.find((x) => x.id === s.raum) : null, E = R ? R.etage : s.etage;
    return { id: s.id, nr: E.nr, kurz: E.kurz, name: R ? R.name : s.etage.name, farbe: R ? R.farbe : 'lavendel', tag: s.etage?.tag };
  });
  const etagenNav = `<nav class="etagen" id="etagen" aria-label="Etagen"><ol>${[...etagen].reverse().map((E) => `<li><a class="f-${E.farbe}" href="#szene-${E.id}" data-szenen="${E.id}" aria-label="${e(E.nr)}: ${e(E.name)}" title="${e(E.nr)}: ${e(E.name)}"><span>${e(E.kurz)}</span></a></li>`).join('')}</ol></nav>`;
  const wahlListe = etagen.slice().reverse().map((E) => `<li class="f-${E.farbe}"><a href="#szene-${E.id}" data-szenen="${E.id}"><b>${e(E.kurz)}</b><span>${e(E.nr === E.name ? E.nr : `${E.nr} · ${E.name}`)}${E.tag ? ` (${e(E.tag.toLowerCase())})` : ''}</span></a></li>`).join('');

  // ── Rahmen ──
  let m = les('buehne.html').replace(/<!--[\s\S]*?-->\n?/g, '');
  const ersetze = (marke, text) => { if (m.split(marke).length !== 2) throw new Error(`Haus: Marke ${marke} muss genau einmal in buehne.html stehen`); m = m.replace(marke, () => text); };
  ersetze('{{szenen}}', szenen.map(panel).join('\n'));
  ersetze('{{anzahl}}', String(szenen.length));
  // Raststellen: je Szene eine, mit ihrer Gruppe. Die Gruppe bestimmt in haus.css die Länge von Halt und Fahrt (--halt-…, --fahrt-…): Auftakt (Szenen vor dem Haus),
  // Etage (Empfang, Räume, Dach), Tür (kurzer Halt vor der geschlossenen Tür) und Ende (letzte Szene: nach ihrem Halt folgt der Kreis). Eine neue Etage bekommt ihre Länge so von selbst.
  const gruppe = (s, i) => (i === szenen.length - 1 ? 'ende' : s.art === 'tuer' ? 'tuer' : s.art === 'empfang' || s.art === 'raum' ? 'etage' : 'auftakt');
  ersetze('{{snaps}}', szenen.map((s, i) => `<span class="snap snap-${gruppe(s, i)}" data-szene="${i}"></span>`).join(''));
  ersetze('{{etagen}}', etagenNav);
  ersetze('{{wahl}}', wahlListe);
  // Anfragen tragen ihre vorbereitete Mail (data-anfrage-mail). Im Skript steht nie eine Adresse: Das Skript liest die Tabelle am Abschnitt #top.
  const mitZiel = (t, mitMail = true) => t.replace(/href="\{\{ziel:([a-z0-9.-]+)\}\}"/g, (_, name) => { const href = ziel(name); return `href="${e(href)}"${mitMail && MAILS[href] ? ` data-anfrage-mail="${e(MAILS[href])}"` : ''}`; });
  m = mitZiel(m);
  if (Object.keys(MAILS).length) {
    const kopf = '<section id="top" class="track haus"';
    if (m.split(kopf).length !== 2) throw new Error('Haus: Anfang der Bühne (section#top) nicht genau einmal gefunden');
    m = m.replace(kopf, () => `${kopf} data-anfrage-mails="${e(JSON.stringify(MAILS))}"`);
  }
  const rest = m.match(/\{\{[^}]*\}\}|\sstyle="|<!--/); if (rest) throw new Error(`Haus: Rest im Markup der Bühne: ${rest[0]}`);

  // ── Stile ──
  let css = les('haus.css');
  css = cssOhneKommentare(css).replace(/(?<![\w.#-])(-?(?:\d+\.?\d*|\.\d+))rem\b/g, 'calc($1 * var(--hr))');
  if (/@media[^{]*var\(--hr\)/.test(css)) throw new Error('Haus: rem in einer Medienabfrage');

  // ── Skript ──
  const daten = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
  let js = les('haus.js');
  { const marke = '/*FIGUREN-SYSTEM*/'; if (js.split(marke).length !== 2) throw new Error(`Haus: Marke ${marke} muss genau einmal in haus.js stehen`); js = js.replace(marke, () => les('figuren.js')); } // das Figuren-System ist eine eigene Quelle
  const einsetzen = (marke, wertDaten) => { const re = new RegExp(`/\\*${marke}\\*/[\\s\\S]*?/\\*${marke}-ENDE\\*/`); if (!re.test(js)) throw new Error(`Haus: Marke ${marke} fehlt im Skript`); js = js.replace(re, () => daten(wertDaten)); };
  einsetzen('SZENEN', szenen.map((s) => ({ id: s.id, art: s.art, raum: s.raum, alt: s.alt, ...s.bild })));
  // Die Räume für das Skript: nur, was Zeichnung und Rechnung brauchen (Kennungen, Plätze, Figuren, Preise als Zahl, Rhythmus). Alle Texte stehen im Markup.
  einsetzen('RAEUME', RAEUME.map((R) => ({ id: R.id, szene: R.szene, name: R.name, zeichnung: R.zeichnung, plan: R.plan, L: R.L.map((l) => ({ id: l.id, name: l.name, x: l.platz[0], z: l.platz[1], hoch: l.hoch, fig: l.figur, V: l.V.map((v) => ({ n: v.name, k: v.kennung, p: v.preis ?? 0, r: v.frei ? 'f' : v.r, ab: v.ab, lz: v.laufzeit || '' })) })) })));
  einsetzen('MENSCHEN', Object.fromEntries(Object.entries(MENSCHEN).filter(([id]) => /^[a-z]+$/.test(id))));
  einsetzen('ZIELE', ZIELE);
  js = jsOhneKommentare(mitZiel(js, false));
  if (/mailto:[^'"`\s]*@|[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/.test(js)) throw new Error('Haus: E-Mail-Adresse im Skript. Adressen stehen nur im Markup (data-anfrage-mail, data-anfrage-mails).');
  if (/\{\{ziel:/.test(js)) throw new Error('Haus: Linkziel im Skript nicht ersetzt');
  if (/style=|setAttribute\(\s*['"]style/.test(js)) throw new Error('Haus: style-Attribut im Skript (Sicherheitsregeln der Website)');
  try { new vm.Script(js, { filename: 'js/haus.js' }); } catch (err) { throw new Error(`Haus: js/haus.js ist nach dem Bau kein gültiges Skript mehr (${err.message})`); }
  const frueh = jsOhneKommentare(les('haus-frueh.js'));
  try { new vm.Script(frueh, { filename: 'js/haus-frueh.js' }); } catch (err) { throw new Error(`Haus: js/haus-frueh.js ist kein gültiges Skript (${err.message})`); }

  return { markup: m.trim(), css, js, frueh, ziele: ZIELE, hinweise, raeume: RAEUME, szenen: szenen.length };
}
