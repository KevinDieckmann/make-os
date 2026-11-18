// MAKE Innovation · „Das Haus“: baut aus den Quellen in diesem Ordner die Bühne der Startseite.
//   buehne.html      Markup der Bühne (Auftakt, sieben Halte, Schalter, Finale, Dock)
//   haus.css         Stile (mit „rem“ als Einheit des Hauses, siehe Kopf der Datei)
//   haus.js          Skript (Szene, Zeitachse, Schalter)
//   pakete.json      Pakete und Rollen der Räume, OHNE Preise: die kommen aus den Daten der Website
//   haus.json        die sieben Etagen (Akzent, Preiszeile für die Fassung ohne Skript)
//   verbindungen.json  „Spielt zusammen mit“
//   ziele.json       alle Linkziele, aufgelöst über die Helfer der Website
//   lenis.min.js     Lenis 1.3.26 (MIT, Lizenz daneben)
// bauen.mjs ruft hausBauen() und schreibt css/haus.css, js/haus.js und js/lenis.min.js. Es gibt nur diese eine Preisliste:
// Jeder Ab-Preis im Haus entsteht aus makeinnovation/inhalt/inhalt.json › angebote; weicht ein Paketname ab, bricht der Bau ab.
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

/**
 * @param h Helfer der Website: angebot(id), produktPfad(a), monatlich(a), kurzname(id), ziel(wert) → { href, mail? }
 */
export function hausBauen(h) {
  const pakete = lade('pakete.json'), haus = lade('haus.json'), verbindungen = lade('verbindungen.json'), zieleRoh = lade('ziele.json');
  const hinweise = [];

  // ── Linkziele ──
  const ZIELE = {}, MAILS = {};
  const setze = (name, wert) => { const z = h.ziel(wert); if (!z || !z.href) throw new Error(`Haus: Linkziel „${name}“ (${wert}) lässt sich nicht auflösen`); ZIELE[name] = z.href; if (z.mail) MAILS[z.href] = z.mail; };
  for (const [name, wert] of Object.entries(zieleRoh)) if (!name.startsWith('_')) setze(name, wert);
  const ziel = (name) => { if (!(name in ZIELE)) throw new Error(`Haus: Linkziel fehlt in ziele.json: ${name}`); return ZIELE[name]; };

  // ── Preise und Namen: aus den Angeboten der Website ──
  const buchstaben = (s) => String(s).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/[^a-z0-9]/g, '');
  const zahl = (s) => String(s).replace(/^ab /, '').split(' / ')[0].replace(/ €$/, '').trim();
  const preisText = (a, stufe) => {
    const roh = stufe ? stufe.preis : a.preis; if (!/\d/.test(roh)) throw new Error(`Haus: Angebot ${a.id} hat keinen Preis in Zahlen`);
    return `ab ${zahl(roh)} €${h.monatlich(a) ? ' im Monat' : a.preis_zusatz === 'je Abend' ? ' je Abend' : ''}`;
  };
  const nameGleich = (unser, a) => { const u = buchstaben(unser); return [a.name, h.kurzname(a.id) ?? ''].map(buchstaben).some((w) => w && (w.includes(u) || u.includes(w))); };
  const abgleich = (wo, obj, name) => {
    const a = h.angebot(obj.angebot); if (!a) throw new Error(`Haus: ${wo} nennt das Angebot „${obj.angebot}“, das es in den Daten der Website nicht gibt (oder es ist ausgeblendet)`);
    if (obj.preis) throw new Error(`Haus: ${wo} hat „angebot“ und einen eigenen Preis. Der Preis kommt aus den Daten der Website.`);
    let stufe = null;
    if (obj.stufe) { stufe = (a.stufen ?? []).find((s) => s.name === obj.stufe); if (!stufe) throw new Error(`Haus: ${wo}: Stufe „${obj.stufe}“ fehlt bei ${a.id}`); }
    else if (!nameGleich(name, a)) throw new Error(`Haus: ${wo} heißt „${name}“, das Angebot der Website heißt „${a.name}“. Bitte angleichen.`);
    if (!stufe && buchstaben(name) !== buchstaben(a.name) && buchstaben(name) !== buchstaben(h.kurzname(a.id) ?? '')) hinweise.push(`${wo}: im Haus „${name}“, auf der Website „${a.name}“`);
    obj.preis = preisText(a, stufe);
    const zielName = `angebot.${a.id}`; if (!(zielName in ZIELE)) setze(zielName, `angebot:${a.id}`);
    obj.zum = zielName; delete obj.angebot; delete obj.stufe;
  };
  const raeume = Object.keys(pakete).filter((k) => !k.startsWith('_'));
  for (const k of raeume) {
    const D = pakete[k];
    if (D.angebot) abgleich(`Raum ${k}`, D, D.name);
    for (const L of D.linien) L.pakete.forEach((pa, i) => {
      if (pa.angebot) abgleich(`${k}.${L.id}.${i + 1}`, pa, pa.name);
      if (pa.link) ziel(pa.link[1]); if (pa.cta) ziel(pa.cta[1]);
    });
    if (D.cta) ziel(D.cta[1]);
  }
  delete pakete._hinweis;
  const paketPreis = (raum, linie, n) => { const D = pakete[raum], L = D.linien.find((x) => x.id === linie); const v = L.pakete[n - 1].preis || D.preis || ''; if (!v) throw new Error(`Haus: kein Preis für ${raum}.${linie}.${n}`); return v; };
  const abKlein = (raum, linie) => {
    const D = pakete[raum], wert = (p) => Number(p.match(/^ab ([\d.]+)/)[1].replace(/\./g, ''));
    const alle = [...D.linien.filter((L) => !linie || L.id === linie).flatMap((L) => L.pakete.map((p) => p.preis)), ...(linie ? [] : [D.preis ?? ''])].filter((p) => /^ab /.test(p ?? ''));
    if (!alle.length) throw new Error(`Haus: kein Ab-Preis für ${raum}${linie ? `.${linie}` : ''}`);
    return alle.reduce((x, y) => (wert(y) < wert(x) ? y : x));
  };
  const preisMuster = (s) => s.replace(/\{(ab|preis):([a-z0-9.-]+)\}/g, (_, art, pfad) => { const x = pfad.split('.'); return art === 'preis' ? paketPreis(x[0], x[1], Number(x[2])) : abKlein(x[0], x[1]); });

  // ── Markup ──
  let m = les('buehne.html').replace(/<!--[\s\S]*?-->\n?/g, '');
  // die sieben Etagen: Lage, Name und Etagenzahl aus den Halten
  const halte = [...m.matchAll(/<article class="fl" data-fl="\d"[\s\S]*?<\/article>/g)].map((x) => {
    const [lage, ...rest] = x[0].match(/<h2 class="fl-kicker[^>]*><span class="mark"><\/span>(.*?)<\/h2>/)[1].split(' · ');
    return { nr: x[0].match(/class="fl-no[^"]*" aria-hidden="true" data-word="([^"]+)"/)[1], lage, name: rest.join(' · ') };
  });
  if (halte.length !== 7 || haus.etagen.length !== 7) throw new Error('Haus: sieben Halte erwartet');
  const ETAGE = {};
  haus.etagen.forEach((C, i) => { if (C.id !== halte[i].nr.toLowerCase()) throw new Error(`Haus: Etage ${C.id} passt nicht zum Halt ${halte[i].nr}`); ETAGE[C.id] = { ...halte[i], ...C, name: C.name ?? halte[i].name, raum: raeume.find((k) => pakete[k].etage === C.id) }; });
  // „Spielt zusammen mit“: höchstens zwei Knöpfe je Halt, erst je Verbindung das erste Ziel
  const mit = (id) => {
    const V_ = verbindungen[id]; if (!V_) throw new Error(`Haus: Verbindungen fehlen für ${id}`);
    const paare = [...V_.map((V) => [V.zu[0], V]), ...V_.flatMap((V) => V.zu.slice(1).map((z) => [z, V]))].slice(0, 2);
    const kn = paare.map(([z, V]) => { const Z_ = ETAGE[z]; if (!Z_) throw new Error(`Haus: Verbindung zu unbekannter Etage ${z}`); return `<button type="button" class="mit-knopf mk-${z}" data-zu="${z}" title="${e(V.satz)}" aria-label="${e(Z_.lage)} · ${e(Z_.name)}: ${e(V.satz)}"><b aria-hidden="true">${e(Z_.nr)}</b><span aria-hidden="true">${e(Z_.name)}</span></button>`; }).join('');
    return `<div class="fl-mit" role="group" aria-labelledby="mit-${id}"><span class="cap" id="mit-${id}">Spielt zusammen mit</span><span class="mit-knoepfe">${kn}</span></div>`;
  };
  // Preiszeile und Pakete mit Link: nur ohne Skript (mit Skript nennt der Paketschalter Preise und Seiten)
  const preise = (id) => {
    const E = ETAGE[id], D = E.raum ? pakete[E.raum] : null;
    const zeile = E.preise ? `<p class="fl-preise">${e(preisMuster(E.preise))}${/ab \d/.test(preisMuster(E.preise)) ? '. Alle Preise netto.' : ''}</p>` : '';
    const eins = D && D.zum ? `<li>${e(D.preisVor || D.name)}, ${e(D.preis)}: <a href="{{ziel:${D.zum}}}">Zum Angebot</a></li>` : ''; // ein Preis für das Ganze (PR): eine Zeile statt einer je Baustein
    const punkte = eins || (D && !D.ohneSchalter ? D.linien.flatMap((L) => L.pakete.map((pa) => {
      const zum = pa.link ?? (pa.zum ? [pa.name, pa.zum] : D.zum ? [pa.name, D.zum] : null); if (!zum) return '';
      const name = D.linien.length > 1 && L.pakete.length > 1 ? `${L.name} ${pa.name}` : pa.name;
      return `<li>${e(name)}${pa.preis ? `, ${e(pa.preis)}` : ''}: <a href="{{ziel:${zum[1]}}}">${e(pa.link ? pa.link[0] : 'Zum Angebot')}</a></li>`;
    })).join('') : '');
    return zeile || punkte ? `<noscript>${zeile}${punkte ? `<ul class="fl-preise">${punkte}</ul>` : ''}</noscript>` : '';
  };
  m = m.replace(/\{\{mit:([a-z0-9]+)\}\}/g, (_, id) => mit(id)).replace(/\{\{preise:([a-z0-9]+)\}\}/g, (_, id) => preise(id));
  // der erste Titel steht ab dem ersten Bild da: seine Buchstaben schon im HTML
  m = m.replace(/data-word="([^"]+)" data-da><\/span>/g, (_, wort) => `data-word="${wort}"><span class="lt" aria-hidden="true">${wort.split(' ').map((w) => `<span class="lt-w">${[...w].map((b) => `<span class="lt-l">${e(b)}</span>`).join('')}</span>`).join('')}</span></span>`);
  const mitZiel = (t) => t.replace(/href="\{\{ziel:([a-z0-9.-]+)\}\}"/g, (_, name) => { const href = ziel(name); return `href="${e(href)}"${MAILS[href] ? ` data-anfrage-mail="${e(MAILS[href])}"` : ''}`; });
  m = mitZiel(m);
  const rest = m.match(/\{\{[^}]*\}\}|\sstyle="|<!--/); if (rest) throw new Error(`Haus: Rest im Markup der Bühne: ${rest[0]}`);

  // ── Stile ──
  let css = les('haus.css').replace('/*MK*/', haus.etagen.map((C) => `.mk-${C.id} { --mk: ${C.akz}; }`).join('\n'));
  css = cssOhneKommentare(css).replace(/(?<![\w.#-])(-?(?:\d+\.?\d*|\.\d+))rem\b/g, 'calc($1 * var(--hr))');
  if (/@media[^{]*var\(--hr\)/.test(css)) throw new Error('Haus: rem in einer Medienabfrage');

  // ── Skript ──
  const daten = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
  let js = les('haus.js');
  const einsetzen = (marke, wert) => { const re = new RegExp(`/\\*${marke}\\*/[\\s\\S]*?/\\*${marke}-ENDE\\*/`); if (!re.test(js)) throw new Error(`Haus: Marke ${marke} fehlt im Skript`); js = js.replace(re, () => daten(wert)); };
  einsetzen('PAKETE', pakete); einsetzen('ZIELE', ZIELE); einsetzen('MAILS', MAILS);
  js = jsOhneKommentare(mitZiel(js));
  if (/\{\{ziel:/.test(js)) throw new Error('Haus: Linkziel im Skript nicht ersetzt');
  if (/style=|setAttribute\(\s*['"]style/.test(js)) throw new Error('Haus: style-Attribut im Skript (Sicherheitsregeln der Website)');
  try { new vm.Script(js, { filename: 'js/haus.js' }); } catch (err) { throw new Error(`Haus: js/haus.js ist nach dem Bau kein gültiges Skript mehr (${err.message})`); }

  return { markup: m.trim(), css, js, ziele: ZIELE, hinweise, lenis: les('lenis.min.js'), lenisLizenz: les('lenis-LICENSE.txt') };
}
