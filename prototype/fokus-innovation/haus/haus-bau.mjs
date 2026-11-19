// MAKE Innovation · „Das Haus“: baut aus den Quellen in diesem Ordner die Fahrt der Startseite (15 Szenen).
//   buehne.html     Rahmen der Bühne (Zeichenfläche, Szenen, Leisten, Etagenwahl, Gastwunsch)
//   szenen.json     die 15 Szenen als Daten (Texte, Kacheln, Preis, Knopf, Bild). Eine neue Etage ist ein neuer Eintrag.
//   stufen.json     Fundament · Wachstum · Skalieren (Szene 14 und die Pakete der Kurz-Startseite)
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

const ART = ['eingang', 'problem', 'fahrt', 'etage', 'tresen', 'pakete', 'finale'];

/**
 * @param h Helfer der Website: angebot(id), produktPfad(a), monatlich(a), kurzname(id), ziel(wert) → { href, mail? }
 */
export function hausBauen(h) {
  const szenenDatei = lade('szenen.json'), stufenDatei = lade('stufen.json'), zieleRoh = lade('ziele.json');
  const szenen = szenenDatei.szenen, stufen = stufenDatei.stufen;
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
  if (szenen.length !== 15) throw new Error(`Haus: 15 Szenen erwartet, ${szenen.length} gefunden`);
  if (new Set(szenen.map((s) => s.id)).size !== szenen.length) throw new Error('Haus: Kennungen der Szenen müssen eindeutig sein');
  const stufenIds = stufen.map((s) => s.id);
  for (const s of szenen) {
    if (!ART.includes(s.art)) throw new Error(`Haus: Szene ${s.id}: unbekannte Art ${s.art}`);
    if (s.stufe && !stufenIds.includes(s.stufe)) throw new Error(`Haus: Szene ${s.id}: Stufe ${s.stufe} gibt es nicht`);
    if (!s.bild || typeof s.bild.p !== 'number') throw new Error(`Haus: Szene ${s.id}: bild.p fehlt`);
    if (s.kacheln && s.kacheln.length !== 3) throw new Error(`Haus: Szene ${s.id}: genau drei Kacheln`);
  }
  for (const st of stufen) for (const id of st.etagen) if (!ids.has(id)) throw new Error(`Haus: Stufe ${st.id} nennt die Szene ${id}, die es nicht gibt`);
  if (!stufen.some((s) => s.id === stufenDatei.empfohlen)) throw new Error('Haus: empfohlene Stufe fehlt');

  // ── Preise: aus den Angeboten der Website ──
  const zahl = (x) => String(x).replace(/^ab /, '').split(' / ')[0].replace(/ €$/, '').trim();
  const wert = (a) => Number(zahl(a.preis).replace(/\./g, ''));
  const preisZeile = (spec) => {
    const alle = spec.angebote.map((id) => { const a = h.angebot(id); if (!a) throw new Error(`Haus: Preis „${spec.label}“ nennt das Angebot „${id}“, das es in den Daten der Website nicht gibt (oder es ist ausgeblendet)`); if (!/\d/.test(a.preis)) throw new Error(`Haus: Angebot ${id} hat keinen Preis in Zahlen`); return a; });
    const klein = alle.reduce((x, y) => (wert(y) < wert(x) ? y : x));
    const zusatz = h.monatlich(klein) ? ' im Monat' : klein.preis_zusatz === 'je Abend' ? ' je Abend' : '';
    return `${spec.label} ab ${zahl(klein.preis)} €${zusatz}`;
  };

  // ── Markup der Szenen ──
  const alink = (art, name, text, extra = '') => `<a class="alink ${art}" href="${platz(name)}"${extra}>${PF}<span class="t-caption">${e(text)}</span></a>`;
  const stufeName = (id) => (id ? stufen.find((s) => s.id === id).name : '');
  const kachelnHtml = (k) => `<ul class="sz-kacheln">${k.map((x) => `<li><b>${e(x.t)}</b>${x.d ? `<span>${e(x.d)}</span>` : ''}</li>`).join('')}</ul>`;
  const foto = (text, klasse = '') => `<div class="sz-foto${klasse}" role="img" aria-label="${e(text)}"><span>${e(text)}</span></div>`;
  const kopfHtml = (s, hid) => {
    const E = s.etage, teile = [`<span class="sz-nr">${e(E.nr)}</span>`, `<span class="sz-name">${e(E.name)}${E.unter ? `: ${e(E.unter)}` : ''}</span>`];
    if (E.tag) teile.push(`<span class="sz-tag">${e(E.tag)}</span>`);
    if (s.stufe) teile.push(`<span class="sz-stufe">${e(stufeName(s.stufe))}</span>`);
    return `<h2 class="sz-kopf" id="${hid}">${teile.join('<span class="sz-sep" aria-hidden="true"> · </span>')}</h2>`;
  };
  const NEWSLETTER = `<form class="nl" id="newsletter" data-newsletter novalidate>
<p class="nl-zeile"><label class="nl-feld"><span class="sr-only">Deine E-Mail-Adresse</span><input type="email" name="email" autocomplete="email" inputmode="email" placeholder="Deine E-Mail-Adresse" required></label><button type="submit" class="alink mehr"><span class="t-caption">Erste Folge zuerst hören</span></button></p>
<fieldset class="nl-wahl"><legend class="sr-only">Wofür möchtest du dich eintragen?</legend>
<label><input type="checkbox" name="wahl" value="podcast" checked><span>Podcast</span></label><label><input type="checkbox" name="wahl" value="events"><span>Event-Einladungen</span></label><label><input type="checkbox" name="wahl" value="updates"><span>Updates</span></label></fieldset>
<p class="nl-recht">Du bekommst zuerst eine Bestätigungsmail und kannst dich jederzeit abmelden. Mehr dazu im <a href="/datenschutz/">Datenschutz</a>.</p>
<p class="nl-meldung" role="status" aria-live="polite"></p>
</form><noscript><p class="nl-ohne"><a class="alink mehr" href="/newsletter">${PF}<span class="t-caption">Erste Folge zuerst hören</span></a></p></noscript>`;

  const panel = (s, i) => {
    const hid = `sz-${s.id}-h`, offen = `<section class="sz sz-${s.art}${s.stufe ? ` st-${s.stufe}` : ''}" id="szene-${s.id}" data-szene="${i}" aria-labelledby="${hid}"><div class="sz-innen">`;
    const zu = '</div></section>';
    if (s.art === 'eingang') return `${offen}<h1 class="sz-titel" id="${hid}">${e(s.titel)}</h1><p class="sz-pitch">${e(s.pitch)}</p><a class="sz-hinweis" href="#szene-${szenen[i + 1].id}"><span>${e(s.hinweis)}</span><svg class="sz-pfeil" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v15M6 13l6 6 6-6"/></svg></a>${zu}`;
    if (s.art === 'problem') return `${offen}<h2 class="sz-links" id="${hid}">${e(s.links)}</h2><p class="sz-rechts">${e(s.rechts)}</p>${zu}`;
    if (s.art === 'fahrt') {
      return `${offen}<h2 class="sz-kopf sz-kopf-klein" id="${hid}">${e(s.kopf)}</h2><p class="sz-lead">${e(s.text)}</p><ul class="sz-stufenzeile">${stufen.map((st) => `<li class="st-${st.id}">${e(st.name)}</li>`).join('')}</ul><p class="sz-klein">${e(s.klein)}</p>${zu}`;
    }
    if (s.art === 'tresen') {
      return `${offen}${kopfHtml(s, hid)}<p class="sz-satz">${e(s.satz)}</p>${foto(s.foto, ' sz-foto-gross')}<ul class="sz-weichen">${s.weichen.map((w) => {
        const txt = `<b>${e(w.t)}</b>${PF}`;
        return w.ziel ? `<li><a class="weiche" href="${platz(w.ziel)}">${txt}</a></li>` : `<li><button type="button" class="weiche" data-aktion="${e(w.aktion)}">${txt}</button></li>`;
      }).join('')}</ul><p class="sz-zeile">${e(s.zeile)}</p>${zu}`;
    }
    if (s.art === 'pakete') {
      const emp = stufenDatei.empfohlen;
      return `${offen}<h2 class="sz-kopf sz-kopf-klein" id="${hid}">${e(s.kopf)}</h2><p class="sz-lead">${e(s.text)}</p><ul class="sz-pakete">${stufen.map((st) => `<li class="fs-paket st-${st.id}${st.id === emp ? ' ist-empfohlen' : ''}">${st.id === emp ? `<span class="fs-paket-emp">${e(stufenDatei.empfehlung)}</span>` : ''}<h3>${e(st.name)}</h3><p class="fs-paket-satz">${e(st.satz)}</p><ul class="fs-paket-punkte">${st.punkte.map((p) => `<li>${e(p)}</li>`).join('')}</ul><p class="fs-paket-ab">${e(st.ab)}</p>${alink('mehr', st.knopf.ziel, st.knopf.text)}</li>`).join('')}</ul><p class="sz-zusagen">${e(stufenDatei.zusagen)}</p><p class="sz-leise"><a class="sz-textlink" href="${platz(stufenDatei.unsicher.ziel)}">${e(stufenDatei.unsicher.text)} →</a></p>${zu}`;
    }
    if (s.art === 'finale') return `${offen}<h2 class="sz-titel sz-titel-final" id="${hid}">${e(s.titel)}</h2>${foto(s.foto, ' sz-foto-gross')}<p class="sz-final-knopf">${alink('erst gross', s.knopf.ziel, s.knopf.text)}</p><p class="sz-mikro">${e(s.mikro)}</p>${zu}`;
    // Etage: immer dieselben Plätze
    const teile = [kopfHtml(s, hid), `<p class="sz-satz">${e(s.satz)}</p>`];
    if (s.newsletter) teile.push(NEWSLETTER);
    else {
      if (s.mit) teile.push(`<p class="sz-mit"><span class="sz-cap">Das nimmst du mit</span>${e(s.mit)}</p>`);
      if (s.kacheln) teile.push(kachelnHtml(s.kacheln));
      if (s.kennzeichen) teile.push(`<p class="sz-kennzeichen">${e(s.kennzeichen)}</p>`);
      if (s.preis) teile.push(`<p class="sz-preis"><b>${e(preisZeile(s.preis))}</b>${s.preis.zusatz ? `<span>${e(s.preis.zusatz)}</span>` : ''}<small>Alle Preise netto.</small></p>`);
    }
    if (s.absender) teile.push(`<p class="sz-absender">${e(s.absender)}</p>`);
    if (s.foto) teile.push(`<div class="sz-kevin">${foto(s.foto)}<p>${e(s.fotoSatz || '')}</p></div>`);
    const fuss = [];
    if (s.knopf) fuss.push(alink('mehr sz-knopf', s.knopf.ziel, s.knopf.text));
    if (s.leise) fuss.push(s.leise.aktion ? `<button type="button" class="sz-leise" data-aktion="${e(s.leise.aktion)}">${e(s.leise.text)}</button>` : `<a class="sz-leise" href="${platz(s.leise.ziel)}">${e(s.leise.text)}</a>`);
    if (fuss.length) teile.push(`<div class="sz-fuss">${fuss.join('')}</div>`);
    return `${offen}${teile.join('')}${zu}`;
  };

  // ── Leisten: Etagen links, Stufen rechts ──
  const etagen = []; // je Etage die erste Szene
  szenen.forEach((s, i) => { if (s.art === 'etage' || s.art === 'tresen') { const nr = s.etage.nr; const alt = etagen.find((x) => x.nr === nr); if (alt) alt.szenen.push(s.id); else etagen.push({ nr, kurz: nr === 'Erdgeschoss' ? 'EG' : nr === 'Eingangshalle' ? 'Halle' : nr === 'Dach' ? 'Dach' : nr.replace(/^Etage /, ''), name: s.art === 'tresen' ? 'Eingangshalle, Tresen' : s.etage.name.replace(/^Podcast „Fokus Innovation“$/, 'Podcast und Deine Bühne'), stufe: s.stufe, szenen: [s.id] }); } });
  const etagenNav = `<nav class="etagen" id="etagen" aria-label="Etagen"><ol>${[...etagen].reverse().map((E) => `<li><a href="#szene-${E.szenen[0]}" data-szenen="${E.szenen.join(' ')}" data-stufe="${E.stufe}" aria-label="${e(E.nr)}: ${e(E.name)}" title="${e(E.nr)}: ${e(E.name)}"><span>${e(E.kurz)}</span></a></li>`).join('')}</ol></nav>`;
  const erste = (st) => szenen.find((s) => s.stufe === st.id).id;
  const stufenNav = `<nav class="fahrt-stufen" id="stufen" aria-label="Stufen"><ol>${[...stufen].reverse().map((st) => `<li class="st-${st.id}"><a href="#szene-${erste(st)}" data-stufe="${st.id}" aria-label="Stufe ${e(st.name)}"><span>${e(st.name)}</span></a></li>`).join('')}</ol></nav>`;
  const wahlListe = etagen.slice().reverse().map((E) => `<li class="st-${E.stufe}"><a href="#szene-${E.szenen[0]}" data-szenen="${E.szenen.join(' ')}"><b>${e(E.kurz)}</b><span>${e(E.nr === 'Eingangshalle' || E.nr === 'Erdgeschoss' ? E.nr : `${E.nr} · ${E.name}`)}</span></a></li>`).join('');

  // ── Rahmen ──
  let m = les('buehne.html').replace(/<!--[\s\S]*?-->\n?/g, '');
  const ersetze = (marke, text) => { if (m.split(marke).length !== 2) throw new Error(`Haus: Marke ${marke} muss genau einmal in buehne.html stehen`); m = m.replace(marke, () => text); };
  ersetze('{{szenen}}', szenen.map(panel).join('\n'));
  ersetze('{{snaps}}', szenen.map((s, i) => `<span class="snap" data-szene="${i}"></span>`).join(''));
  ersetze('{{etagen}}', etagenNav);
  ersetze('{{stufen}}', stufenNav);
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
  const einsetzen = (marke, wertDaten) => { const re = new RegExp(`/\\*${marke}\\*/[\\s\\S]*?/\\*${marke}-ENDE\\*/`); if (!re.test(js)) throw new Error(`Haus: Marke ${marke} fehlt im Skript`); js = js.replace(re, () => daten(wertDaten)); };
  einsetzen('SZENEN', szenen.map((s) => ({ id: s.id, art: s.art, stufe: s.stufe, ...s.bild })));
  einsetzen('ZIELE', ZIELE);
  js = jsOhneKommentare(mitZiel(js, false));
  if (/mailto:[^'"`\s]*@|[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/.test(js)) throw new Error('Haus: E-Mail-Adresse im Skript. Adressen stehen nur im Markup (data-anfrage-mail, data-anfrage-mails).');
  if (/\{\{ziel:/.test(js)) throw new Error('Haus: Linkziel im Skript nicht ersetzt');
  if (/style=|setAttribute\(\s*['"]style/.test(js)) throw new Error('Haus: style-Attribut im Skript (Sicherheitsregeln der Website)');
  try { new vm.Script(js, { filename: 'js/haus.js' }); } catch (err) { throw new Error(`Haus: js/haus.js ist nach dem Bau kein gültiges Skript mehr (${err.message})`); }
  const frueh = jsOhneKommentare(les('haus-frueh.js'));
  try { new vm.Script(frueh, { filename: 'js/haus-frueh.js' }); } catch (err) { throw new Error(`Haus: js/haus-frueh.js ist kein gültiges Skript (${err.message})`); }

  return { markup: m.trim(), css, js, frueh, ziele: ZIELE, hinweise, stufen: stufenDatei };
}
