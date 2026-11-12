/* ─── MAKE Revenue · Erstgespräch vereinbaren ─────────────────────────────────────────────────────────
   Übernommen von der Schwesterseite MAKE Studios (anfrage.js), angepasst auf Vertrieb: Themenwahl statt Branchen.
   Verhalten unverändert: Nichts wird gespeichert oder gesendet. Die Anfrage öffnet das E-Mail-Programm mit fertigem Text.
   Ohne JavaScript führen alle Knöpfe zum Kontakt bzw. zur E-Mail.
   Stile nur über Klassen und CSSOM (style.setProperty): kein Inline-Stil, CSP-tauglich. */
(() => {
  'use strict';
  const D = document, W = window, H = D.documentElement;
  // Die Kontaktadresse steht nur im HTML (erster mailto-Verweis der Seite), nie im Skript: eine Stelle je Seite, und der
  // Wächter des Repos lässt keine echten Adressen in Code-Dateien zu.
  const ZIEL = (() => { const a = D.querySelector('a[href^="mailto:"]'); return a ? decodeURIComponent(a.getAttribute('href').slice(7).split('?')[0]) : ''; })();

  const THEMEN = { systemvertrieb: 'Digitaler Systemvertrieb', zeit: 'Vertrieb auf Zeit', workshop: 'Tagesworkshop Vertrieb', netzwerk: 'Netzwerken und Events', offen: 'Noch offen' };

  function el(tag, attrs, kinder) {
    const n = D.createElement(tag);
    if (attrs) Object.keys(attrs).forEach((k) => {
      const v = attrs[k];
      if (v === false || v === null || v === undefined) return;
      if (k === 'text') n.textContent = v;
      else n.setAttribute(k, v === true ? '' : String(v));
    });
    (kinder || []).forEach((k) => { if (k !== null && k !== undefined && k !== false) n.append(k); });
    return n;
  }

  // ═══ Kalender: Werktage in Berlin (ohne Wochenende, gesetzliche Feiertage Berlin, 24.12. und 31.12.) ═══
  const TAG_KURZ = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const TAG_LANG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const MONAT = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const zwei = (z) => (z < 10 ? '0' : '') + z;
  const schluessel = (d) => d.getFullYear() + '-' + zwei(d.getMonth() + 1) + '-' + zwei(d.getDate());
  function ostern(j) { // Gaußsche Osterformel (gregorianisch)
    const a = j % 19, b = Math.floor(j / 100), c = j % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const monat = Math.floor((h + l - 7 * m + 114) / 31), tag = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(j, monat - 1, tag, 12);
  }
  const feiertagCache = {};
  function feiertage(j) {
    if (feiertagCache[j]) return feiertagCache[j];
    const o = ostern(j);
    const um = (n) => schluessel(new Date(j, o.getMonth(), o.getDate() + n, 12));
    const s = new Set([j + '-01-01', j + '-03-08', um(-2), um(1), j + '-05-01', um(39), um(50), j + '-10-03', j + '-12-24', j + '-12-25', j + '-12-26', j + '-12-31']);
    feiertagCache[j] = s;
    return s;
  }
  const werktag = (d) => d.getDay() !== 0 && d.getDay() !== 6 && !feiertage(d.getFullYear()).has(schluessel(d));
  function wunschtage(anzahl, vorlauf) {
    const h = new Date();
    const d = new Date(h.getFullYear(), h.getMonth(), h.getDate(), 12);
    let n = 0;
    while (n < vorlauf) { d.setDate(d.getDate() + 1); if (werktag(d)) n++; }
    const liste = [];
    while (liste.length < anzahl) { if (werktag(d)) liste.push(new Date(d)); d.setDate(d.getDate() + 1); }
    return liste;
  }
  function tagAusSchluessel(s) { const t = s.split('-').map(Number); return new Date(t[0], t[1] - 1, t[2], 12); }

  // ═══ Erstgespräch vereinbaren ═══
  const dlg = D.getElementById('buchen');
  let oeffnen = null;
  if (dlg && typeof dlg.showModal === 'function') oeffnen = buchenAufbauen(dlg);

  D.querySelectorAll('[data-buchen]').forEach(verbinden);
  // „…/#erstgespraech“ oder „#erstgespraech-<thema>“ öffnet das Fenster direkt.
  // Ohne JavaScript springt „#erstgespraech“ zum Kontakt (id an .kontakt-aktionen).
  function ausAdresse() {
    if (!oeffnen) return;
    const m = /^#erstgespraech(?:-([a-z]+))?$/.exec(W.location.hash);
    if (!m) return;
    W.history.replaceState(null, '', W.location.pathname + W.location.search);
    oeffnen(m[1] ? { thema: m[1] } : null);
  }
  ausAdresse();
  W.addEventListener('hashchange', ausAdresse);
  function verbinden(a) {
    if (!oeffnen) return;
    a.addEventListener('click', (e) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      oeffnen(a.dataset.buchen ? { thema: a.dataset.buchen } : null);
    });
  }

  function buchenAufbauen(dlg) {
    const form = dlg.querySelector('form');
    const teile = Array.from(dlg.querySelectorAll('[data-teil]'));
    const inhalt = dlg.querySelector('.buchen-inhalt');
    const fertig = dlg.querySelector('.buchen-fertig');
    const fuss = dlg.querySelector('.buchen-fuss');
    const anzeige = dlg.querySelector('.buchen-schritt');
    const zaehler = anzeige.querySelector('b');
    const balken = dlg.querySelector('.buchen-balken');
    const zurueck = dlg.querySelector('[data-zurueck]');
    const weiter = dlg.querySelector('[data-weiter]');
    const kopieren = dlg.querySelector('[data-kopieren]');
    const kopie = dlg.querySelector('.buchen-kopie');
    const erneut = dlg.querySelector('[data-erneut]');
    let schritt = 0, abgeschickt = false, mailUrl = '', mailText = '';

    // Wunschtage: zehn Werktage, frühestens übermorgen (Werktag)
    const tage = dlg.querySelector('.buchen-tage');
    wunschtage(10, 2).forEach((d) => {
      tage.append(el('label', { class: 'wahl wahl-tag' }, [
        el('input', { type: 'radio', name: 'tag', value: schluessel(d) }),
        el('span', null, [el('small', { text: TAG_KURZ[d.getDay()] }), zwei(d.getDate()) + '.' + zwei(d.getMonth() + 1) + '.'])
      ]));
    });

    const wert = (name) => { const f = form.elements[name]; return f ? String(f.value || '').trim() : ''; };
    const beschriftung = (name, v) => {
      const i = form.querySelector('input[name="' + name + '"][value="' + v + '"]');
      if (!i) return v;
      return i.dataset.text || i.closest('label').textContent.replace(/\s+/g, ' ').trim();
    };

    form.addEventListener('change', (e) => {
      const gruppe = e.target.closest('[data-feld]');
      if (gruppe && gruppe.classList.contains('hat-fehler')) fehlerWeg(gruppe);
    });
    form.addEventListener('input', (e) => {
      const gruppe = e.target.closest && e.target.closest('[data-feld]');
      if (gruppe && gruppe.classList.contains('hat-fehler')) fehlerWeg(gruppe);
    });

    function zeigen(n, fokus) {
      schritt = n;
      teile.forEach((t, i) => { t.hidden = i !== n; });
      fertig.hidden = true; fuss.hidden = false; anzeige.hidden = false;
      zaehler.textContent = String(n + 1);
      balken.style.setProperty('--anteil', String((n + 1) / teile.length));
      zurueck.hidden = n === 0;
      weiter.textContent = n === teile.length - 1 ? 'Anfrage senden' : 'Weiter';
      inhalt.scrollTop = 0;
      if (fokus) { const h = teile[n].querySelector('.buchen-frage'); if (h) h.focus({ preventScroll: true }); }
    }

    // ─── Prüfen ───
    function fehler(gruppe, satz) {
      gruppe.classList.add('hat-fehler');
      const p = gruppe.querySelector('.feld-fehler');
      p.textContent = satz; p.hidden = false;
      if (!p.id) p.id = 'fehler-' + gruppe.dataset.feld;
      gruppe.querySelectorAll('input, textarea').forEach((i) => { i.setAttribute('aria-invalid', 'true'); i.setAttribute('aria-describedby', p.id); });
    }
    function fehlerWeg(gruppe) {
      gruppe.classList.remove('hat-fehler');
      const p = gruppe.querySelector('.feld-fehler');
      if (p) { p.hidden = true; p.textContent = ''; }
      gruppe.querySelectorAll('[aria-invalid]').forEach((i) => { i.removeAttribute('aria-invalid'); i.removeAttribute('aria-describedby'); });
    }
    const MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    function pruefen(n) {
      const teil = teile[n];
      teil.querySelectorAll('[data-feld]').forEach(fehlerWeg);
      const regeln = {
        thema: () => (wert('thema') ? '' : 'Bitte wählen Sie ein Thema.'),
        art: () => (wert('art') ? '' : 'Bitte wählen Sie, wie wir sprechen.'),
        tag: () => (wert('tag') ? '' : 'Bitte wählen Sie einen Wunschtag.'),
        zeit: () => (wert('zeit') ? '' : 'Bitte wählen Sie ein Zeitfenster.'),
        name: () => (wert('name') ? '' : 'Bitte nennen Sie Ihren Namen.'),
        unternehmen: () => (wert('unternehmen') ? '' : 'Bitte nennen Sie Ihr Unternehmen.'),
        email: () => (!wert('email') ? 'Bitte geben Sie Ihre E-Mail-Adresse an.' : (MAIL.test(wert('email')) ? '' : 'Bitte prüfen Sie die E-Mail-Adresse.'))
      };
      let erstes = null;
      teil.querySelectorAll('[data-feld]').forEach((g) => {
        const r = regeln[g.dataset.feld];
        const satz = r ? r() : '';
        if (satz) { fehler(g, satz); if (!erstes) erstes = g; }
      });
      if (erstes) {
        const ziel = erstes.querySelector('input:not([type="radio"]):not([type="checkbox"]), textarea') || erstes.querySelector('input');
        if (ziel) ziel.focus();
        return false;
      }
      return true;
    }

    // ─── Text der Anfrage ───
    function anfrageText() {
      const z = [];
      z.push('Guten Tag,', '', 'ich möchte ein Erstgespräch mit MAKE Revenue vereinbaren.', '');
      z.push('Unternehmen: ' + wert('unternehmen'));
      z.push('Worum es geht: ' + (THEMEN[wert('thema')] || '-'));
      if (wert('ziel')) z.push('Was soll in 90 Tagen anders sein: ' + wert('ziel'));
      const d = tagAusSchluessel(wert('tag'));
      z.push('Wann passt ein Gespräch: ' + TAG_LANG[d.getDay()] + ', ' + d.getDate() + '. ' + MONAT[d.getMonth()] + ' ' + d.getFullYear() + ', ' + beschriftung('zeit', wert('zeit')) + ' (' + beschriftung('art', wert('art')) + ')');
      z.push('');
      z.push('Name: ' + wert('name'));
      z.push('E-Mail: ' + wert('email'));
      if (wert('telefon')) z.push('Telefon: ' + wert('telefon'));
      if (wert('web')) z.push('Website: ' + wert('web'));
      if (wert('nachricht')) z.push('', 'Nachricht:', wert('nachricht'));
      z.push('', 'Viele Grüße', wert('name'));
      return z.join('\n');
    }

    function senden() {
      const betreff = 'Erstgespräch: ' + wert('unternehmen');
      const text = anfrageText();
      mailUrl = 'mailto:' + ZIEL + '?subject=' + encodeURIComponent(betreff) + '&body=' + encodeURIComponent(text.replace(/\n/g, '\r\n'));
      mailText = 'An: ' + ZIEL + '\nBetreff: ' + betreff + '\n\n' + text;
      abgeschickt = true;
      teile.forEach((t) => { t.hidden = true; });
      fuss.hidden = true; anzeige.hidden = true; fertig.hidden = false;
      kopie.hidden = true; kopie.value = mailText;
      kopieren.textContent = 'Text kopieren';
      balken.style.setProperty('--anteil', '1');
      erneut.setAttribute('href', mailUrl);
      inhalt.scrollTop = 0;
      const h = fertig.querySelector('.buchen-frage');
      if (h) h.focus({ preventScroll: true });
      erneut.click(); // öffnet das E-Mail-Programm (mailto), innerhalb des Klicks der Person
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (abgeschickt || !pruefen(schritt)) return;
      if (schritt < teile.length - 1) zeigen(schritt + 1, true);
      else senden();
    });
    zurueck.addEventListener('click', () => { if (schritt > 0) zeigen(schritt - 1, true); });

    kopieren.addEventListener('click', () => {
      const zeigeKopie = () => { kopie.hidden = false; kopie.focus(); kopie.select(); kopieren.textContent = 'Text markiert'; };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(mailText).then(() => { kopieren.textContent = 'Kopiert'; }, zeigeKopie);
      } else zeigeKopie();
    });

    dlg.querySelectorAll('[data-zu]').forEach((b) => b.addEventListener('click', () => dlg.close()));
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); }); // Klick auf den Hintergrund
    dlg.addEventListener('close', () => { H.classList.remove('dialog-offen'); });

    return function oeffnenBuchen(vorgabe) {
      if (vorgabe && vorgabe.thema && THEMEN[vorgabe.thema]) {
        const r = form.querySelector('input[name="thema"][value="' + vorgabe.thema + '"]');
        if (r) r.checked = true;
      }
      if (abgeschickt) { abgeschickt = false; schritt = 0; }
      H.classList.add('dialog-offen');
      if (!dlg.open) dlg.showModal();
      zeigen(schritt, true);
    };
  }
})();
