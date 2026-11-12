/* ─── MAKE Studios · Erstgespräch buchen und Sichtbarkeits-Check ──────────────────────────────────────
   Unabhängig vom Film (studio.js): läuft auch mit „Bewegung reduzieren“ und wenn der Film ausfällt.
   Nichts wird gespeichert oder gesendet. Die Anfrage öffnet das E-Mail-Programm mit fertigem Text,
   der Check rechnet nur im Browser. Ohne JavaScript führen alle Knöpfe zum Kontakt bzw. zur E-Mail.
   Stile nur über Klassen und CSSOM (style.setProperty): kein Inline-Stil, CSP-tauglich. */
(() => {
  'use strict';
  const D = document, W = window, H = D.documentElement;
  // Die Kontaktadresse steht nur im HTML (erster mailto-Verweis der Seite), nicht im Skript: eine Stelle je Seite.
  const ZIEL = (() => { const a = D.querySelector('a[href^="mailto:"]'); return a ? decodeURIComponent(a.getAttribute('href').slice(7).split('?')[0]) : ''; })();
  const RUHIG = W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const BRANCHEN = { gastro: 'Café oder Restaurant', agentur: 'Agentur', immobilien: 'Immobilien', andere: 'Etwas anderes' };
  const BRANCHEN_GRUPPE = { gastro: 'Cafés & Restaurants', agentur: 'Agenturen', immobilien: 'Immobilien', andere: 'Ihr Betrieb' };

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

  // ═══ Erstgespräch buchen ═══
  const dlg = D.getElementById('buchen');
  let checkErgebnis = null;
  let oeffnen = null;
  if (dlg && typeof dlg.showModal === 'function') oeffnen = buchenAufbauen(dlg);

  D.querySelectorAll('[data-buchen]').forEach(verbinden);
  // Von Unterseiten (beispiele/…): „…/#erstgespraech“ oder „#erstgespraech-<branche>“ öffnet das Fenster direkt.
  // Ohne JavaScript springt „#erstgespraech“ zum Kontakt (id an .kontakt-aktionen).
  function ausAdresse() {
    if (!oeffnen) return;
    const m = /^#erstgespraech(?:-([a-z]+))?$/.exec(W.location.hash);
    if (!m) return;
    W.history.replaceState(null, '', W.location.pathname + W.location.search);
    // Wer direkt zum Gespräch kommt, sieht das Fenster sofort, ohne die Blende davor.
    const lader = D.querySelector('.lader');
    if (lader) lader.style.setProperty('display', 'none');
    oeffnen(m[1] ? { branche: m[1] } : null);
  }
  ausAdresse();
  W.addEventListener('hashchange', ausAdresse);
  function verbinden(a) {
    if (!oeffnen) return;
    a.addEventListener('click', (e) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      // data-buchen="<branche>" wählt die Branche vor, data-interesse="<wert>" das Interesse (zum Beispiel „social“)
      oeffnen(a.dataset.buchen || a.dataset.interesse ? { branche: a.dataset.buchen, interesse: a.dataset.interesse } : null);
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
    const gastro = dlg.querySelector('.buchen-gastro');
    const checkKasten = dlg.querySelector('.buchen-check');
    const checkText = dlg.querySelector('.buchen-check-text');
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
    const gewaehlt = (name) => Array.from(form.querySelectorAll('input[name="' + name + '"]:checked')).map((x) => x.value);
    const beschriftung = (name, v) => {
      const i = form.querySelector('input[name="' + name + '"][value="' + v + '"]');
      if (!i) return v;
      return i.dataset.text || i.closest('label').textContent.replace(/\s+/g, ' ').trim();
    };

    // „Noch offen“ schließt die anderen Interessen aus und umgekehrt
    form.addEventListener('change', (e) => {
      const t = e.target;
      if (t.name === 'interesse' && t.checked) {
        form.querySelectorAll('input[name="interesse"]').forEach((x) => {
          if (x !== t && (t.value === 'offen' || x.value === 'offen')) x.checked = false;
        });
      }
      if (t.name === 'branche') gastroHinweis();
      const gruppe = t.closest('[data-feld]');
      if (gruppe && gruppe.classList.contains('hat-fehler')) fehlerWeg(gruppe);
    });
    form.addEventListener('input', (e) => {
      const gruppe = e.target.closest && e.target.closest('[data-feld]');
      if (gruppe && gruppe.classList.contains('hat-fehler')) fehlerWeg(gruppe);
    });

    function gastroHinweis() {
      const g = wert('branche') === 'gastro';
      gastro.hidden = !g;
      if (g && !wert('zeit') && schritt === 1) { const n = form.querySelector('input[name="zeit"][value="nachmittag"]'); if (n) n.checked = true; }
    }

    function zeigen(n, fokus) {
      schritt = n;
      teile.forEach((t, i) => { t.hidden = i !== n; });
      fertig.hidden = true; fuss.hidden = false; anzeige.hidden = false;
      zaehler.textContent = String(n + 1);
      balken.style.setProperty('--anteil', String((n + 1) / teile.length));
      zurueck.hidden = n === 0;
      weiter.textContent = n === teile.length - 1 ? 'Anfrage senden' : 'Weiter';
      if (n === 1) gastroHinweis();
      if (n === 2) checkAnzeigen();
      inhalt.scrollTop = 0;
      if (fokus) { const h = teile[n].querySelector('.buchen-frage'); if (h) h.focus({ preventScroll: true }); }
    }

    function checkAnzeigen() {
      checkKasten.hidden = !checkErgebnis;
      if (checkErgebnis) checkText.textContent = 'Ergebnis Ihres Sichtbarkeits-Checks mitschicken (' + checkErgebnis.punkte + ' von 100)';
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
        branche: () => (wert('branche') ? '' : 'Bitte wählen Sie Ihre Branche.'),
        art: () => (wert('art') ? '' : 'Bitte wählen Sie, wie wir sprechen.'),
        tag: () => (wert('tag') ? '' : 'Bitte wählen Sie einen Wunschtag.'),
        zeit: () => (wert('zeit') ? '' : 'Bitte wählen Sie ein Zeitfenster.'),
        name: () => (wert('name') ? '' : 'Bitte nennen Sie Ihren Namen.'),
        betrieb: () => (wert('betrieb') ? '' : 'Bitte nennen Sie Ihren Betrieb.'),
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
      z.push('Guten Tag,', '', 'ich möchte ein Erstgespräch mit MAKE Studios vereinbaren.', '');
      z.push('Branche: ' + (BRANCHEN[wert('branche')] || '-'));
      const int = gewaehlt('interesse').map((v) => beschriftung('interesse', v));
      z.push('Interesse: ' + (int.length ? int.join(', ') : 'Noch offen'));
      z.push('Gespräch: ' + beschriftung('art', wert('art')));
      const d = tagAusSchluessel(wert('tag'));
      z.push('Wunschtermin: ' + TAG_LANG[d.getDay()] + ', ' + d.getDate() + '. ' + MONAT[d.getMonth()] + ' ' + d.getFullYear() + ', ' + beschriftung('zeit', wert('zeit')));
      z.push('');
      z.push('Name: ' + wert('name'));
      z.push('Betrieb: ' + wert('betrieb'));
      z.push('E-Mail: ' + wert('email'));
      if (wert('telefon')) z.push('Telefon: ' + wert('telefon'));
      if (wert('web')) z.push('Website oder Google-Profil: ' + wert('web'));
      if (wert('nachricht')) z.push('', 'Nachricht:', wert('nachricht'));
      if (checkErgebnis && form.elements.check_mit && form.elements.check_mit.checked) {
        z.push('', 'Sichtbarkeits-Check: ' + checkErgebnis.punkte + ' von 100 (' + checkErgebnis.stufe + ')');
        if (checkErgebnis.hebel.length) z.push('Größte Hebel: ' + checkErgebnis.hebel.join('; '));
      }
      z.push('', 'Viele Grüße', wert('name'));
      return z.join('\n');
    }

    function senden() {
      const betreff = 'Erstgespräch: ' + wert('betrieb');
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
      if (vorgabe && vorgabe.branche && BRANCHEN[vorgabe.branche]) {
        const r = form.querySelector('input[name="branche"][value="' + vorgabe.branche + '"]');
        if (r) r.checked = true;
      }
      if (vorgabe && /^[a-z]+$/.test(vorgabe.interesse || '')) {
        const i = form.querySelector('input[name="interesse"][value="' + vorgabe.interesse + '"]');
        const offen = form.querySelector('input[name="interesse"][value="offen"]');
        if (i) { i.checked = true; if (offen && offen !== i) offen.checked = false; }
      }
      if (vorgabe && vorgabe.check && form.elements.check_mit) form.elements.check_mit.checked = true;
      if (abgeschickt) { abgeschickt = false; schritt = 0; }
      H.classList.add('dialog-offen');
      if (!dlg.open) dlg.showModal();
      zeigen(schritt, true);
    };
  }

  // ═══ Sichtbarkeits-Check ═══
  const QUELLE = {
    google: ['Google, Hilfe zum Unternehmensprofil', 'https://support.google.com/business/answer/10515606?hl=de', 'Herstellerangabe'],
    brightlocal: ['BrightLocal, Local Consumer Review Survey 2026', 'https://www.brightlocal.com/research/local-consumer-review-survey/', 'USA'],
    bitkomGastro: ['Bitkom, Juni 2024', 'https://www.bitkom.org/Presse/Presseinformation/Restaurants-und-Cafes-Online-Bewertungen-entscheidend', 'Deutschland'],
    sixsense: ['6sense, Buyer Experience Report 2025', 'https://6sense.com/report/buyer-experience/', 'international'],
    gartner: ['Gartner, Juni 2025', 'https://www.gartner.com/en/newsroom/press-releases/2025-06-25-gartner-sales-survey-finds-61-percent-of-b2b-buyers-prefer-a-rep-free-buying-experience', 'international'],
    bitkomImmo: ['Bitkom, Oktober 2025', 'https://www.bitkom.org/Presse/Presseinformation/Zwischen-Klick-und-Klingel-neues-Zuhause-suchen', 'Deutschland'],
    bitkomImmoAlt: ['Bitkom, November 2021', 'https://www.bitkom.org/Presse/Presseinformation/70-Prozent-suchen-online-Immobilien', 'Deutschland · älter'],
    is24Video: ['ImmoScout24, April 2020', 'https://www.immobilienscout24.de/unternehmen/news-medien/news/default-title/gerade-in-zeiten-von-corona-video-besichtigung-fuer-60-prozent-der-deutschen-gute-alternative-bei-der-immobiliensuche/', 'Deutschland · älter'],
    is24Eigen: ['ImmoScout24, Mai 2024', 'https://www.scout24.com/fileadmin/user_upload/20240508_IS24_Eigentuemer_und_Makler.pdf', 'Deutschland']
  };
  const P = ' %';
  // Je Frage: Gewicht w, drei Antworten (2 · 1 · 0 Punkte), der Hebel dazu und, wo es eine gibt, die belegte Zahl von dieser Seite.
  const GEMEINSAM = [
    { id: 'profil', w: 3, kurz: 'Google-Profil', frage: 'Haben Sie ein Google-Unternehmensprofil?', a: ['Ja, und es ist gepflegt', 'Ja, aber kaum gepflegt', 'Nein, oder ich weiß es nicht'],
      hebel: 'Google-Profil anlegen und pflegen', tipp: 'Das Profil ist oft das Erste, was man von Ihnen sieht: in der Suche und auf der Karte.',
      beleg: { zahl: '2,7 ×', satz: 'höher ist die Wahrscheinlichkeit, dass Kundschaft ein Unternehmen mit vollständigem Profil für seriös hält.', q: 'google' } },
    { id: 'vollstaendig', w: 2, kurz: 'Profil vollständig', frage: 'Sind Öffnungszeiten, Fotos und Kontaktdaten dort vollständig?', a: ['Ja, alles aktuell', 'Teilweise', 'Nein, oder es gibt kein Profil'],
      hebel: 'Profil vervollständigen', tipp: 'Öffnungszeiten, Fotos, Telefon und Website eintragen und aktuell halten.',
      beleg: { zahl: '+70' + P, satz: 'höher ist die Wahrscheinlichkeit eines Besuchs, wenn das Profil vollständig ist.', q: 'google' } },
    { id: 'bewertungen', w: 2, kurz: 'Bewertungen', frage: 'Wie steht es um Ihre Bewertungen bei Google?', a: ['Viele, im Schnitt vier Sterne oder mehr', 'Wenige, oder unter vier Sternen', 'Kaum welche'],
      hebel: 'Mehr Bewertungen sammeln', tipp: 'Zufriedene Kundschaft darum bitten und jede Bewertung beantworten.',
      beleg: { zahl: '68' + P, satz: 'kommen nur für Unternehmen mit mindestens vier Sternen in Frage.', q: 'brightlocal' } },
    { id: 'handy', w: 3, kurz: 'Website am Handy', frage: 'Wie gut funktioniert Ihre Website auf dem Handy?', a: ['Gut: schnell und übersichtlich', 'Es geht, aber nicht gut', 'Schlecht, oder es gibt keine Website'],
      hebel: 'Website fürs Handy bauen', tipp: 'Schnell laden, das Wichtigste oben, Anruf und Anfrage mit einem Tippen.', beleg: null }
  ];
  const JE_BRANCHE = {
    gastro: [
      { id: 'speisekarte', w: 2, kurz: 'Speisekarte', frage: 'Steht Ihre Speisekarte als Text auf Ihrer Website?', a: ['Ja, als Text und aktuell', 'Nur als PDF oder Foto', 'Nein'],
        hebel: 'Speisekarte als Text zeigen', tipp: 'Gut lesbar am Handy, ohne PDF, und immer aktuell.',
        beleg: { zahl: '53' + P, satz: 'sehen sich die Speisekarte vor dem Besuch online an.', q: 'bitkomGastro' } },
      { id: 'reservieren', w: 1, kurz: 'Reservierung', frage: 'Kann man bei Ihnen online einen Tisch reservieren?', a: ['Ja, in wenigen Klicks', 'Nur per Telefon oder E-Mail', 'Nein, gar nicht'],
        hebel: 'Online-Reservierung anbieten', tipp: 'Ein Tisch in wenigen Klicks, auch außerhalb Ihrer Öffnungszeiten.',
        beleg: { zahl: '47' + P, satz: 'reservieren am liebsten online.', q: 'bitkomGastro' } },
      { id: 'bilder', w: 2, kurz: 'Fotos', frage: 'Zeigen aktuelle Fotos Ihre Gerichte und Ihren Gastraum?', a: ['Ja, gute und aktuelle', 'Ein paar, eher ältere', 'Kaum welche'],
        hebel: 'Aktuelle Fotos zeigen', tipp: 'Gerichte, Gastraum und Team, so wie es bei Ihnen aussieht.',
        beleg: { zahl: '69' + P, satz: 'erwarten Fotos, wenn sie sich ein Café oder Restaurant online ansehen.', q: 'bitkomGastro' } }
    ],
    agentur: [
      { id: 'faelle', w: 3, kurz: 'Fallbeispiele', frage: 'Zeigen Sie Fallbeispiele mit Ergebnis?', a: ['Ja, mehrere und aktuell', 'Ein paar, ohne Ergebnis', 'Keine'],
        hebel: 'Fallbeispiele mit Ergebnis zeigen', tipp: 'Aufgabe, Lösung, Ergebnis: kurz erzählt, mit Bildern aus dem Projekt.',
        beleg: { zahl: '94' + P, satz: 'der B2B-Einkäufer haben ihre Wunschanbieter gereiht, bevor sie zum ersten Mal mit einem sprechen.', q: 'sixsense' } },
      { id: 'klarheit', w: 2, kurz: 'Klarer Auftritt', frage: 'Versteht man auf Ihrer Seite, was Sie tun und wie die Zusammenarbeit läuft?', a: ['Ja, vollständig', 'Teilweise', 'Eher nicht'],
        hebel: 'Entscheidung ohne Anruf möglich machen', tipp: 'Leistungen, Ablauf und Ansprechpartner stehen auf Ihrer Seite.',
        beleg: { zahl: '61' + P, satz: 'der B2B-Einkäufer würden am liebsten ganz ohne Vertriebsgespräch entscheiden.', q: 'gartner' } },
      { id: 'einbild', w: 1, kurz: 'Ein Bild', frage: 'Passen Website, LinkedIn und Ihr Auftreten im Gespräch zusammen?', a: ['Ja, aus einem Guss', 'Teilweise', 'Eher nicht'],
        hebel: 'Ein Bild auf allen Kanälen', tipp: 'Website, LinkedIn und Gespräch erzählen dieselbe Geschichte.',
        beleg: { zahl: '69' + P, satz: 'bemerken Widersprüche zwischen dem, was die Website sagt, und dem, was der Vertrieb erzählt.', q: 'gartner' } }
    ],
    immobilien: [
      { id: 'objektfotos', w: 2, kurz: 'Objektfotos', frage: 'Haben Ihre Objekte professionelle Fotos?', a: ['Ja, alle', 'Manche', 'Eher nicht'],
        hebel: 'Professionelle Objektfotos', tipp: 'Helle, ruhige Bilder für jedes Objekt, vom Eingang bis zum Ausblick.',
        beleg: { zahl: '96' + P, satz: 'legen Wert auf aussagekräftige Fotos des Objekts.', q: 'bitkomImmoAlt' } },
      { id: 'video', w: 2, kurz: 'Video', frage: 'Gibt es zu Ihren Objekten ein Video oder einen Rundgang?', a: ['Ja, regelmäßig', 'Selten', 'Nie'],
        hebel: 'Video-Rundgang je Objekt', tipp: 'Ein kurzer Rundgang als erste Besichtigung, bevor jemand anruft.',
        beleg: { zahl: '+40' + P, satz: 'mehr Kontaktanfragen bei Angeboten mit Video-Besichtigung, laut ImmoScout24.', q: 'is24Video' } },
      { id: 'eigentuemer', w: 3, kurz: 'Eigentümer', frage: 'Gibt es auf Ihrer Seite einen eigenen Bereich für Eigentümer?', a: ['Ja, mit Anfrage zur Wertermittlung', 'Nur ein allgemeines Kontaktformular', 'Nein'],
        hebel: 'Seite für Eigentümer', tipp: 'Mit Anfrage zur Wertermittlung, damit Eigentümer bei Ihnen anfragen.',
        beleg: { zahl: '74' + P, satz: 'der Eigentümer wünschen sich eine kostenlose Bewertung, bevor sie einen Makler wählen.', q: 'is24Eigen' } }
    ],
    andere: [
      { id: 'kontakt', w: 2, kurz: 'Kontakt', frage: 'Kann man Sie auf Ihrer Website mit einem Tippen anrufen oder anfragen?', a: ['Ja, auf jeder Seite', 'Irgendwo schon', 'Nein'],
        hebel: 'Kontakt mit einem Tippen', tipp: 'Telefon und Anfrage gut sichtbar, auf jeder Seite.', beleg: null },
      { id: 'eigenebilder', w: 2, kurz: 'Eigene Bilder', frage: 'Zeigen eigene Fotos oder Videos, wie es bei Ihnen aussieht?', a: ['Ja, gute und aktuelle', 'Ein paar', 'Kaum welche'],
        hebel: 'Eigene Fotos und Videos', tipp: 'Zeigen, wie es bei Ihnen aussieht, statt Bilder aus dem Katalog.', beleg: null },
      { id: 'social', w: 1, kurz: 'Soziale Medien', frage: 'Zeigen Sie Ihre Arbeit regelmäßig in sozialen Medien?', a: ['Ja, regelmäßig', 'Ab und zu', 'Nein'],
        hebel: 'In sozialen Medien zeigen', tipp: 'Regelmäßig zeigen, woran Sie gerade arbeiten.', beleg: null }
    ]
  };
  const BRANCHEN_WAHL = [
    ['gastro', 'Café oder Restaurant'], ['agentur', 'Agentur'], ['immobilien', 'Immobilien: Makler oder Hausverwaltung'], ['andere', 'Etwas anderes']
  ];
  function stufeVon(p) {
    if (p >= 80) return ['Gut sichtbar', 'Sie sind gut aufgestellt. Jetzt geht es um die Feinheiten, die aus Besuchern Anfragen machen.'];
    if (p >= 50) return ['Ausbaufähig', 'Die Grundlage steht. Die Punkte unten bringen Ihnen am meisten.'];
    return ['Viel ungenutzt', 'Hier liegt noch viel brach. Fangen Sie mit den Punkten unten an.'];
  }

  const check = D.querySelector('[data-check]');
  if (check) checkAufbauen(check);

  function checkAufbauen(wurzel) {
    const statisch = wurzel.querySelector('.check-statisch');
    if (statisch) statisch.hidden = true;
    const geraet = el('div', { class: 'check-geraet' });
    wurzel.append(geraet);
    wurzel.classList.add('check-aktiv');
    let branche = null, fragen = [], antworten = [], pos = -1, sperre = false, letzter = 0;
    const gesamt = 1 + GEMEINSAM.length + 3;

    function kopf(nr, mitZurueck) {
      const oben = el('div', { class: 'check-oben' }, [
        el('p', { class: 'check-zaehler' }, ['Frage ', el('b', { text: String(nr) }), ' von ' + gesamt]),
        mitZurueck ? el('button', { type: 'button', class: 'check-zurueck', text: 'Zurück' }) : null
      ]);
      return [oben, balkenNeu((nr - 1) / gesamt)];
    }

    function balkenNeu(anteil) {
      const b = el('div', { class: 'check-balken', 'aria-hidden': 'true' }, [el('i')]);
      b.style.setProperty('--von', String(letzter));
      b.style.setProperty('--anteil', String(anteil));
      letzter = anteil;
      return b;
    }

    function antwortKnopf(buchstabe, text, gedrueckt, beiKlick) {
      const b = el('button', { type: 'button', class: 'check-antwort', 'aria-pressed': gedrueckt ? 'true' : 'false' }, [
        el('span', { class: 'check-buchstabe', 'aria-hidden': 'true', text: buchstabe }), el('span', { text: text })
      ]);
      b.addEventListener('click', () => {
        if (sperre) return;
        sperre = true;
        b.parentNode.querySelectorAll('.check-antwort').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        W.setTimeout(() => { sperre = false; beiKlick(); }, RUHIG ? 0 : 240);
      });
      return b;
    }

    function zeigen(fokus) {
      geraet.textContent = '';
      let titel;
      if (pos === -1) {
        const k = kopf(1, false);
        titel = el('h3', { class: 'check-frage', id: 'check-frage', tabindex: '-1', text: 'Was für einen Betrieb haben Sie?' });
        const liste = el('div', { class: 'check-antworten', role: 'group', 'aria-labelledby': 'check-frage' });
        BRANCHEN_WAHL.forEach(([id, text], i) => liste.append(antwortKnopf('ABCD'[i], text, branche === id, () => {
          if (branche !== id) { branche = id; fragen = GEMEINSAM.concat(JE_BRANCHE[id]); antworten = []; }
          pos = 0; zeigen(true);
        })));
        geraet.append(...k, titel, liste);
      } else if (pos < fragen.length) {
        const f = fragen[pos];
        const k = kopf(pos + 2, true);
        titel = el('h3', { class: 'check-frage', id: 'check-frage', tabindex: '-1', text: f.frage });
        const liste = el('div', { class: 'check-antworten', role: 'group', 'aria-labelledby': 'check-frage' });
        f.a.forEach((text, i) => liste.append(antwortKnopf('ABC'[i], text, antworten[pos] === 2 - i, () => {
          antworten[pos] = 2 - i; pos++; zeigen(true);
        })));
        geraet.append(...k, titel, liste);
      } else {
        titel = ergebnis();
      }
      const z = geraet.querySelector('.check-zurueck');
      if (z) z.addEventListener('click', () => { pos = pos === 0 ? -1 : pos - 1; zeigen(true); });
      if (fokus) {
        titel.focus({ preventScroll: true });
        const r = wurzel.getBoundingClientRect();
        if (r.top < 0 || r.top > W.innerHeight * .6) wurzel.scrollIntoView({ block: 'start', behavior: RUHIG ? 'auto' : 'smooth' });
      }
    }

    function ergebnis() {
      let ist = 0, max = 0;
      fragen.forEach((f, i) => { ist += f.w * antworten[i]; max += f.w * 2; });
      const punkte = Math.round((ist / max) * 100);
      const [stufe, satz] = stufeVon(punkte);
      const hebel = fragen.map((f, i) => ({ f, luecke: f.w * (2 - antworten[i]), i }))
        .filter((h) => h.luecke > 0)
        .sort((a, b) => b.luecke - a.luecke || b.f.w - a.f.w || a.i - b.i)
        .slice(0, 3);
      checkErgebnis = { branche, punkte, stufe, hebel: hebel.map((h) => h.f.hebel) };

      const titel = el('h3', { class: 'check-ergebnis-titel', tabindex: '-1' }, [
        el('span', { class: 'vh', text: 'Ihr Ergebnis: ' }),
        el('span', { class: 'check-zahl', text: String(punkte) }), el('span', { class: 'check-von', text: 'von 100' })
      ]);
      const ring = el('div', { class: 'check-wert' }, [titel]);
      ring.style.setProperty('--wert', String(punkte / 100));
      const urteil = el('div', { class: 'check-urteil' }, [
        el('p', { class: 'check-stufe stufe-' + (punkte >= 80 ? 'gut' : punkte >= 50 ? 'mittel' : 'offen'), text: stufe }),
        el('p', { class: 'check-satz', text: satz })
      ]);

      const teile = el('ul', { class: 'check-teile', 'aria-label': 'Ihre Antworten im Überblick' });
      fragen.forEach((f, i) => {
        const p = antworten[i];
        teile.append(el('li', null, [
          el('span', { class: 'check-teil-name', text: f.kurz }),
          el('span', { class: 'check-segmente', 'aria-hidden': 'true' }, [el('i', { class: p >= 1 ? 'an' : '' }), el('i', { class: p >= 2 ? 'an' : '' })]),
          el('span', { class: 'vh', text: p === 2 ? 'gut' : p === 1 ? 'teilweise' : 'offen' })
        ]));
      });

      const hebelListe = el('ol', { class: 'check-hebel' });
      hebel.forEach((h) => {
        const f = h.f;
        let beleg = null;
        if (f.beleg) {
          const q = QUELLE[f.beleg.q];
          beleg = el('p', { class: 'check-beleg' }, [
            el('b', { text: f.beleg.zahl }), ' ' + f.beleg.satz + ' ',
            el('span', { class: 'check-quelle' }, [el('a', { href: q[1], rel: 'noopener', target: '_blank', text: q[0] }), ' · ' + q[2]])
          ]);
        }
        hebelListe.append(el('li', null, [el('p', { class: 'check-hebel-titel', text: f.hebel }), el('p', { class: 'check-tipp', text: f.tipp }), beleg]));
      });

      const besprechen = el('a', { class: 'knopf', href: '#kontakt', 'data-buchen': branche, text: 'Ergebnis im Erstgespräch besprechen' });
      verbinden(besprechen);
      const neu = el('button', { type: 'button', class: 'check-neu', text: 'Neu starten' });
      neu.addEventListener('click', () => { branche = null; fragen = []; antworten = []; pos = -1; letzter = 0; zeigen(true); });

      geraet.append(
        el('div', { class: 'check-oben' }, [
          el('p', { class: 'check-zaehler', text: 'Ihr Ergebnis · ' + BRANCHEN_GRUPPE[branche] }),
          el('button', { type: 'button', class: 'check-zurueck', text: 'Zurück' })
        ]),
        balkenNeu(1),
        el('div', { class: 'check-ergebnis' }, [
          el('div', { class: 'check-ergebnis-kopf' }, [ring, urteil]),
          teile,
          hebel.length ? el('h4', { class: 'check-unter', text: hebel.length === 1 ? 'Ihr größter Hebel' : 'Ihre ' + (hebel.length === 2 ? 'zwei' : 'drei') + ' größten Hebel' }) : null,
          hebel.length ? hebelListe : null,
          el('p', { class: 'check-klein', text: 'Selbsteinschätzung nach Ihren Antworten, keine Prüfung Ihres Auftritts. Gespeichert oder gesendet wird nichts.' }),
          el('div', { class: 'check-aktionen' }, [besprechen, neu])
        ])
      );
      return titel;
    }

    zeigen(false);
  }
})();
