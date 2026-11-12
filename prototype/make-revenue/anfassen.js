/* ─── MAKE Revenue · Vertrieb zum Anfassen ───────────────────────────────────────────────────────────────
   Drei Stücke zum Ausprobieren: das Brett im CRM, der Wochenreport, der Gesprächsleitfaden. Alles sind Beispiele.
   Ohne dieses Skript stehen sie als ruhige Ansicht im HTML. Hier kommt nur die Bedienung dazu: mit echten Knöpfen und
   Feldern (Tastatur geht von selbst), Meldungen für Vorleseprogramme über role="status".
   Nichts wird gesendet. Der Wochenreport liest die Wochenziele aus dem Vertriebsrechner (rechner.js), wenn dort jemand
   eigene Werte eingetragen hat: als Ereignis auf derselben Seite und aus dem sessionStorage auf der Seite „Systemvertrieb“.
   Stile nur über Klassen und Attribute, kein Inline-Stil. */
(() => {
  'use strict';
  const D = document;
  const zahlDe = (n, stellen = 0) => Number(n).toLocaleString('de-DE', { maximumFractionDigits: stellen, minimumFractionDigits: 0 });

  // ═══ Das Brett im CRM ═══
  // Die Regel je Stufe: nächste Aktion und nach wie vielen Werktagen sie fällig ist (dieselbe Tabelle steht in bauen.mjs).
  const STUFEN = ['Anfrage', 'Gespräch', 'Angebot', 'Abschluss'];
  const AKTION = [['Erstgespräch vereinbaren', 1], ['Angebot senden, in 24 Stunden', 1], ['Nachfassen, drei Werktage nach dem Angebot', 3], ['Übergabe an die Umsetzung', 1]];
  const STAND = ['', 'Erstgespräch geführt', 'Angebot ist raus', 'Auftrag erteilt']; // was auf der Karte steht, sobald sie in der Stufe ankommt
  const TAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const HEUTE = new Date(2026, 2, 16); // der Montag der Beispielwoche (Kalenderwoche 12)
  const zwei = (n) => (n < 10 ? '0' : '') + n;
  const werktag = (plus) => {
    const d = new Date(HEUTE);
    for (let i = 0; i < plus;) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) i++; }
    return `${TAGE[d.getDay()]} ${zwei(d.getDate())}.${zwei(d.getMonth() + 1)}.`;
  };
  for (const brett of D.querySelectorAll('[data-brett]')) {
    const spalten = Array.from(brett.querySelectorAll('[data-spalte]'));
    const karten = Array.from(brett.querySelectorAll('[data-karte]'));
    const meldung = brett.querySelector('[data-brett-meldung]'), zurueck = brett.querySelector('[data-brett-zurueck]');
    if (spalten.length !== 4 || !karten.length || !meldung) continue;
    const anfang = brett.querySelector('.brett-spalten').innerHTML, anfangsText = meldung.textContent;
    const stufeVon = (k) => spalten.indexOf(k.closest('[data-spalte]'));
    const knopfText = (k) => (k.hasAttribute('data-ohne') ? 'Nächste Aktion setzen' : stufeVon(k) < 3 ? 'Eine Stufe weiter' : 'Gewonnen');
    function zaehlen() {
      const alle = Array.from(brett.querySelectorAll('[data-karte]'));
      const ohne = alle.filter((k) => k.hasAttribute('data-ohne')).length;
      const aus = (n, w) => { const el = brett.querySelector(`[data-brett-aus="${n}"]`); if (el) el.textContent = String(w); };
      aus('offen', alle.filter((k) => stufeVon(k) < 3).length);
      aus('ohne', ohne);
      aus('gewonnen', alle.filter((k) => stufeVon(k) === 3).length);
      const kasten = brett.querySelector('.brett-zaehler-ohne'); if (kasten) kasten.classList.toggle('null', ohne === 0);
      spalten.forEach((s) => { const z = s.querySelector('[data-brett-zahl]'); if (z) z.textContent = String(s.querySelectorAll('[data-karte]').length); });
      for (const k of alle) {
        const knopf = k.querySelector('[data-schieben]'), stufe = stufeVon(k), firma = k.getAttribute('data-firma');
        if (!knopf) continue;
        knopf.textContent = knopfText(k);
        knopf.disabled = stufe === 3 && !k.hasAttribute('data-ohne');
        knopf.setAttribute('aria-label', k.hasAttribute('data-ohne') ? `${firma}: nächste Aktion setzen` : stufe < 3 ? `${firma} eine Stufe weiter, von ${STUFEN[stufe]} nach ${STUFEN[stufe + 1]}` : `${firma}: gewonnen`);
      }
    }
    function aktionSetzen(k, stufe) {
      const [text, tage] = AKTION[stufe], tag = werktag(tage);
      k.querySelector('[data-aktion]').textContent = text;
      k.querySelector('[data-tag]').textContent = 'bis ' + tag;
      k.removeAttribute('data-ohne'); k.classList.remove('brett-karte-offen');
      return `Nächste Aktion: ${text}, bis ${tag}`;
    }
    brett.addEventListener('click', (ev) => {
      const knopf = ev.target.closest && ev.target.closest('[data-schieben]');
      if (!knopf || knopf.disabled) return;
      const k = knopf.closest('[data-karte]'), firma = k.getAttribute('data-firma');
      let stufe = stufeVon(k), text;
      if (k.hasAttribute('data-ohne')) {
        text = `${firma} hat jetzt einen nächsten Schritt. ${aktionSetzen(k, stufe)}`;
      } else {
        stufe += 1;
        spalten[stufe].querySelector('.brett-karten').appendChild(k);
        const stand = k.querySelector('[data-stand]'); if (stand) stand.textContent = `${k.getAttribute('data-kontakt')} · ${STAND[stufe]}`;
        text = `${firma} steht jetzt in „${STUFEN[stufe]}“. ${aktionSetzen(k, stufe)}`;
      }
      zaehlen();
      const ohne = brett.querySelectorAll('[data-ohne]').length;
      meldung.textContent = text + (ohne ? '' : ' Keine Anfrage ist ohne nächste Aktion.');
      if (zurueck) zurueck.hidden = false;
      // Der Knopf ist mit der Karte gewandert: Fokus bleibt auf ihm, oder geht auf die Karte, wenn er jetzt ruht
      if (knopf.disabled) { k.tabIndex = -1; k.focus({ preventScroll: true }); } else knopf.focus({ preventScroll: true });
    });
    if (zurueck) zurueck.addEventListener('click', () => {
      brett.querySelector('.brett-spalten').innerHTML = anfang;
      spalten.splice(0, 4, ...brett.querySelectorAll('[data-spalte]'));
      meldung.textContent = anfangsText;
      zurueck.hidden = true;
      zaehlen();
      const erster = brett.querySelector('[data-schieben]'); if (erster) erster.focus({ preventScroll: true });
    });
    zaehlen();
  }

  // ═══ Der Wochenreport ═══
  const lesen = (text) => { const t = String(text).trim().replace(/\s|\./g, '').replace(',', '.'); if (!t) return null; const v = Number(t); return Number.isFinite(v) && v >= 0 ? v : null; };
  const zieleLesen = () => { try { const z = JSON.parse(sessionStorage.getItem('make-revenue-ziele') || 'null'); return z && typeof z === 'object' ? z : null; } catch (_) { return null; } };
  for (const report of D.querySelectorAll('[data-report]')) {
    const zeilen = Array.from(report.querySelectorAll('[data-zeile]')).map((tr) => ({
      tr, id: tr.getAttribute('data-zeile'), name: tr.getAttribute('data-name'), zielEl: tr.querySelector('[data-ziel]'), balken: tr.querySelector('[data-balken]'), stand: tr.querySelector('[data-stand]'),
      beispielZiel: lesen(tr.querySelector('[data-ziel]').textContent), ist: null, ziel: null, feld: null,
    }));
    const luecke = report.querySelector('[data-report-luecke]'), marke = report.querySelector('[data-report-marke]'), hinweis = report.querySelector('[data-report-hinweis]'), zurueck = report.querySelector('[data-report-zurueck]');
    if (!zeilen.length || !luecke) continue;
    const markeText = marke ? marke.textContent : '', hinweisHtml = hinweis ? hinweis.innerHTML : '';
    // Aus dem festen Ist-Wert wird ein Feld zum Eintragen
    for (const z of zeilen) {
      const b = z.tr.querySelector('[data-ist]');
      const feld = D.createElement('input');
      feld.type = 'text'; feld.inputMode = 'decimal'; feld.autocomplete = 'off'; feld.value = b.textContent; feld.setAttribute('aria-label', `${z.name}: Ist diese Woche`);
      b.replaceWith(feld);
      z.feld = feld; z.ziel = z.beispielZiel;
    }
    function neu() {
      let groesste = null, alleDa = true;
      for (const z of zeilen) {
        z.ist = lesen(z.feld.value);
        z.feld.setAttribute('aria-invalid', String(z.ist == null));
        if (z.ist == null || !z.ziel) { alleDa = false; z.stand.textContent = '·'; z.balken.setAttribute('width', '0'); z.tr.classList.remove('unter'); continue; }
        const fehlt = z.ziel - z.ist, anteil = z.ist / z.ziel;
        z.balken.setAttribute('width', String(Math.max(0, Math.min(100, anteil * 100)).toFixed(1)));
        z.tr.classList.toggle('unter', fehlt > 0.049);
        z.stand.textContent = fehlt > 0.049 ? `${zahlDe(fehlt, 1)} unter Ziel` : fehlt < -0.049 ? `${zahlDe(-fehlt, 1)} über Ziel` : 'Ziel erreicht';
        if (fehlt > 0.049 && (!groesste || anteil < groesste.anteil)) groesste = { z, fehlt, anteil };
      }
      luecke.textContent = !alleDa ? 'Bitte in jede Zeile eine Zahl eintragen.' : groesste ? `Größte Lücke: ${groesste.z.name}, ${zahlDe(groesste.fehlt, 1)} unter Ziel.` : 'Alle vier Wochenziele sind erreicht.';
    }
    function zieleSetzen(ziele) {
      const eigen = !!ziele;
      for (const z of zeilen) {
        z.ziel = eigen && Number.isFinite(ziele[z.id]) && ziele[z.id] > 0 ? ziele[z.id] : z.beispielZiel;
        z.zielEl.textContent = zahlDe(z.ziel, 1);
      }
      if (marke) marke.textContent = eigen ? 'Ihre Wochenziele' : markeText;
      if (hinweis) { if (eigen) hinweis.textContent = 'Die Ziele stammen aus Ihren Werten im Vertriebsrechner. Die Ist-Zahlen sind noch das Beispiel.'; else hinweis.innerHTML = hinweisHtml; }
      if (zurueck) zurueck.hidden = !eigen;
      neu();
    }
    report.addEventListener('input', neu);
    D.addEventListener('revenue:ziele', (ev) => zieleSetzen(ev.detail));
    if (zurueck) zurueck.addEventListener('click', () => { try { sessionStorage.removeItem('make-revenue-ziele'); } catch (_) { /* nichts gespeichert */ } zieleSetzen(null); });
    zieleSetzen(zieleLesen());
  }

  // ═══ Der Gesprächsleitfaden ═══
  for (const lf of D.querySelectorAll('[data-leitfaden]')) {
    const tafeln = Array.from(lf.querySelectorAll('[data-tafel]')), knoepfe = Array.from(lf.querySelectorAll('[data-lf]'));
    const wahl = lf.querySelector('.lf-wahl'), fuss = lf.querySelector('.lf-fuss'), stand = lf.querySelector('[data-lf-stand]');
    const vor = lf.querySelector('[data-lf-weiter]'), rueck = lf.querySelector('[data-lf-zurueck]');
    if (tafeln.length < 2 || knoepfe.length !== tafeln.length || !wahl || !fuss || !vor || !rueck) continue;
    let jetzt = 0;
    function gehe(i, fokus) {
      jetzt = Math.max(0, Math.min(tafeln.length - 1, i));
      tafeln.forEach((t, n) => { t.hidden = n !== jetzt; });
      knoepfe.forEach((k, n) => { if (n === jetzt) k.setAttribute('aria-current', 'step'); else k.removeAttribute('aria-current'); });
      rueck.disabled = jetzt === 0;
      vor.textContent = jetzt === tafeln.length - 1 ? 'Von vorn' : 'Weiter';
      if (stand) stand.textContent = `Schritt ${jetzt + 1} von ${tafeln.length}`;
      if (fokus) { const h = tafeln[jetzt].querySelector('.lf-titel'); if (h) h.focus({ preventScroll: true }); }
    }
    knoepfe.forEach((k, n) => k.addEventListener('click', () => gehe(n, false)));
    vor.addEventListener('click', () => gehe(jetzt === tafeln.length - 1 ? 0 : jetzt + 1, true));
    rueck.addEventListener('click', () => gehe(jetzt - 1, true));
    lf.classList.add('lebt');
    wahl.hidden = false; fuss.hidden = false;
    gehe(0, false);
  }
})();
