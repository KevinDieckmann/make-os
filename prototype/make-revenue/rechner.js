// MAKE Revenue · Vertriebsrechner: Rückwärtsrechnung vom Umsatzziel bis zu den Erstkontakten, dazu offene Angebote,
// Vertriebszeit und der größte Hebel. Die Rechnung ist die des Vertriebsrechners von MAKE Innovation (js/rechner.js),
// unverändert übernommen; dieselbe Rechnung steht in bauen.mjs (rueckwaerts) für die Seite ohne JavaScript: beide gleich halten.
// Rechnet nur im Browser, speichert und sendet nichts. Balken über SVG-Attribute: keine Inline-Stile.
(() => {
  const VERKAUFSZEIT = 0.4; // Salesforce, State of Sales Report 2026: 40 % der Arbeitszeit wird verkauft
  const VOLLZEIT_STUNDEN = 40;
  const LEER = '·';
  const zahlDe = (n, stellen = 0) => Number(n).toLocaleString('de-DE', { maximumFractionDigits: stellen, minimumFractionDigits: 0 });
  // „2.200.000“, „2200000“, „33,5“ → Zahl; leer oder Unsinn → null
  const lesen = (text) => {
    const t = String(text).trim().replace(/\s/g, '').replace(/€|%/g, '');
    if (!t) return null;
    const ohnePunkte = /,/.test(t) ? t.replace(/\./g, '').replace(',', '.') : /^\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, '') : t;
    const v = Number(ohnePunkte);
    return Number.isFinite(v) && v > 0 ? v : null;
  };
  const rechnen = (w) => {
    const abschluesse = Math.ceil(w.ziel / w.auftrag);
    const angebote = Math.ceil(abschluesse / (w.angebotsquote / 100));
    const termine = Math.ceil(angebote / (w.terminquote / 100));
    const kontakte = Math.ceil(termine / (w.kontaktquote / 100));
    const jeWoche = (n) => n / w.wochen;
    const termineMit = (aq, auftrag) => Math.ceil(Math.ceil(Math.ceil(w.ziel / auftrag) / (aq / 100)) / (w.terminquote / 100)) / w.wochen;
    const offen = Math.round(jeWoche(angebote) * w.offen);
    const stunden = jeWoche(termine) * w.stunden;
    return {
      abschluesse, angebote, termine, kontakte,
      kontakteWoche: jeWoche(kontakte), termineWoche: jeWoche(termine), angeboteWoche: jeWoche(angebote), umsatzMonat: w.ziel / 12,
      offen, pipeline: offen * w.auftrag, stunden, vertriebler: stunden / (VOLLZEIT_STUNDEN * VERKAUFSZEIT),
      hebelQuote: Math.max(0, jeWoche(termine) - termineMit(Math.min(100, w.angebotsquote + 7), w.auftrag)), quoteNeu: Math.min(100, w.angebotsquote + 7),
      hebelAuftrag: Math.max(0, jeWoche(termine) - termineMit(w.angebotsquote, w.auftrag * 1.25)),
    };
  };
  const PROZENT = ['kontaktquote', 'terminquote', 'angebotsquote'];
  for (const r of document.querySelectorAll('[data-rechner]')) {
    const felder = [...r.querySelectorAll('[data-feld]')];
    const setze = (n, text) => { for (const el of r.querySelectorAll(`[data-aus="${n}"]`)) el.textContent = text; };
    let selbst = false;
    const neu = () => {
      const w = Object.fromEntries(felder.map((f) => [f.dataset.feld, lesen(f.value)]));
      const gueltig = felder.every((f) => w[f.dataset.feld] != null) && PROZENT.every((n) => w[n] <= 100) && w.wochen <= 53;
      for (const f of felder) f.setAttribute('aria-invalid', String(w[f.dataset.feld] == null || (PROZENT.includes(f.dataset.feld) && w[f.dataset.feld] > 100) || (f.dataset.feld === 'wochen' && w.wochen > 53)));
      if (!gueltig) {
        for (const el of r.querySelectorAll('[data-aus]')) el.textContent = LEER;
        return;
      }
      const e = rechnen(w);
      setze('termineWoche', zahlDe(e.termineWoche, 1));
      setze('kontakteWoche', zahlDe(e.kontakteWoche, 1));
      setze('angeboteWoche', zahlDe(e.angeboteWoche, 1));
      setze('abschluesse', zahlDe(e.abschluesse));
      setze('umsatzMonat', `${zahlDe(e.umsatzMonat)} €`);
      setze('kontakte', zahlDe(e.kontakte));
      setze('termine', zahlDe(e.termine));
      setze('angebote', zahlDe(e.angebote));
      setze('offen', zahlDe(e.offen));
      setze('pipeline', `${zahlDe(e.pipeline)} €`);
      setze('stunden', zahlDe(e.stunden, 1));
      setze('vertriebler', zahlDe(e.vertriebler, 1));
      setze('quoteNeu', `${zahlDe(e.quoteNeu)} %`);
      setze('quoteAlt', `${zahlDe(w.angebotsquote)} %`);
      setze('hebelQuote', zahlDe(e.hebelQuote, 1));
      setze('hebelAuftrag', zahlDe(e.hebelAuftrag, 1));
      // Wochenziele für den Wochenreport (anfassen.js): nur, wenn hier wirklich jemand eigene Werte eingetragen hat.
      // Bleibt im Browser (sessionStorage, damit die Ziele auch auf der Seite „Systemvertrieb“ stehen); gesendet wird nichts.
      if (selbst) {
        const ziele = { kontakte: e.kontakteWoche, termine: e.termineWoche, angebote: e.angeboteWoche, abschluesse: e.abschluesse / w.wochen };
        try { sessionStorage.setItem('make-revenue-ziele', JSON.stringify(ziele)); } catch (_) { /* ohne Speicher gilt nur diese Seite */ }
        document.dispatchEvent(new CustomEvent('revenue:ziele', { detail: ziele }));
      }
      // Trichter: Balken im Verhältnis zu den Erstkontakten
      for (const [id, n] of [['kontakte', e.kontakte], ['termine', e.termine], ['angebote', e.angebote], ['abschluesse', e.abschluesse]]) {
        const balken = r.querySelector(`[data-balken="${id}"]`);
        if (!balken) continue;
        // mittig wie der Trichter im Zeichen
        const breite = Math.max(1, (100 * n) / e.kontakte);
        balken.setAttribute('width', breite.toFixed(2));
        balken.setAttribute('x', (50 - breite / 2).toFixed(2));
      }
    };
    r.addEventListener('input', () => { selbst = true; neu(); });
    // Beim Verlassen schön schreiben: „2200000“ → „2.200.000“
    r.addEventListener('focusout', (ev) => {
      const f = ev.target.closest?.('[data-feld]');
      const v = f && lesen(f.value);
      if (v != null) f.value = zahlDe(v, 1);
    });
    neu();
  }
})();
