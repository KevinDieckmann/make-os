// MAKE Innovation · Vertriebsrechner: Rückwärtsrechnung vom Umsatzziel bis zu den Erstkontakten, dazu offene Angebote, Vertriebszeit
// und der größte Hebel (31.10.). Dieselbe Rechnung steht in bauen.mjs (rueckwaerts) für die Seite ohne JavaScript — beide gleich halten.
// Rechnet nur im Browser, speichert und sendet nichts.
(() => {
  const VERKAUFSZEIT = 0.4; // Salesforce, State of Sales 2026: 40 % der Arbeitszeit wird verkauft
  const VOLLZEIT_STUNDEN = 40;
  const KI_AB_STUNDEN = 1.5; // ab hier der Weg zum Innovations-Check (wie in bauen.mjs)
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
      kiStunden: jeWoche(termine) * 0.5, // eine halbe Stunde weniger Vor- und Nachbereitung je Termin
    };
  };
  const PROZENT = ['kontaktquote', 'terminquote', 'angebotsquote'];
  for (const r of document.querySelectorAll('[data-rechner]')) {
    const felder = [...r.querySelectorAll('[data-feld]')];
    const aus = (n) => r.querySelectorAll(`[data-aus="${n}"]`);
    const setze = (n, text) => { for (const el of aus(n)) el.textContent = text; };
    const neu = () => {
      const w = Object.fromEntries(felder.map((f) => [f.dataset.feld, lesen(f.value)]));
      const gueltig = felder.every((f) => w[f.dataset.feld] != null) && PROZENT.every((n) => w[n] <= 100) && w.wochen <= 53;
      for (const f of felder) f.setAttribute('aria-invalid', String(w[f.dataset.feld] == null || (PROZENT.includes(f.dataset.feld) && w[f.dataset.feld] > 100)));
      if (!gueltig) {
        for (const el of r.querySelectorAll('[data-aus]')) el.textContent = '–';
        return;
      }
      const e = rechnen(w);
      setze('termineWoche', zahlDe(e.termineWoche, 1));
      setze('kontakteWoche', zahlDe(e.kontakteWoche, 1));
      setze('angeboteWoche', zahlDe(e.angeboteWoche, 1));
      setze('abschluesse', zahlDe(e.abschluesse));
      setze('umsatzMonat', `${zahlDe(e.umsatzMonat)}\u00a0€`);
      setze('kontakte', zahlDe(e.kontakte));
      setze('termine', zahlDe(e.termine));
      setze('angebote', zahlDe(e.angebote));
      setze('offen', zahlDe(e.offen));
      setze('pipeline', `${zahlDe(e.pipeline)}\u00a0€`);
      setze('stunden', zahlDe(e.stunden, 1));
      setze('vertriebler', zahlDe(e.vertriebler, 1));
      setze('quoteNeu', `${zahlDe(e.quoteNeu)}\u00a0%`);
      setze('quoteAlt', `${zahlDe(w.angebotsquote)}\u00a0%`);
      setze('hebelQuote', zahlDe(e.hebelQuote, 1));
      setze('hebelAuftrag', zahlDe(e.hebelAuftrag, 1));
      setze('kiStunden', zahlDe(e.kiStunden, 1));
      // Viel Zeit je Termin → der Weg zum Innovations-Check (KI bereitet Protokolle, Angebote und Nachfassen vor)
      const ki = r.querySelector('[data-ki-hinweis]');
      if (ki) ki.hidden = !(w.stunden > KI_AB_STUNDEN);
      // Trichter: Balken im Verhältnis zu den Erstkontakten (SVG-Attribute — keine Inline-Stile, CSP 'self')
      for (const [id, n] of [['kontakte', e.kontakte], ['termine', e.termine], ['angebote', e.angebote], ['abschluesse', e.abschluesse]]) {
        const balken = r.querySelector(`[data-balken="${id}"]`);
        if (balken) balken.setAttribute('width', String(Math.max(0.5, (100 * n) / e.kontakte).toFixed(2)));
      }
    };
    r.addEventListener('input', neu);
    // Beim Verlassen schön schreiben: „2200000“ → „2.200.000“
    r.addEventListener('focusout', (ev) => {
      const f = ev.target.closest?.('[data-feld]');
      const v = f && lesen(f.value);
      if (v != null) f.value = zahlDe(v, 1);
    });
    neu();
  }
})();
