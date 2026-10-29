// Fokus Innovation · Vertriebsrechner: Rückwärtsrechnung vom Umsatzziel zu Abschlüssen, Angeboten und Terminen je Woche.
// Dieselbe Rechnung steht in bauen.mjs (rueckwaerts) für die Seite ohne JavaScript. Rechnet nur im Browser, speichert und sendet nichts.
(() => {
  for (const r of document.querySelectorAll('[data-rechner]')) {
    const feld = (n) => r.querySelector(`[data-feld="${n}"]`);
    const aus = (n) => r.querySelector(`[data-aus="${n}"]`);
    const wert = (n) => { const v = Number(String(feld(n).value).replace(',', '.')); return Number.isFinite(v) && v > 0 ? v : null; };
    const zeigen = (werte) => { for (const [n, v] of Object.entries(werte)) aus(n).textContent = v; };
    const rechnen = () => {
      const ziel = wert('ziel'), auftrag = wert('auftrag'), angebotsquote = wert('angebotsquote'), terminquote = wert('terminquote'), wochen = wert('wochen');
      if (!ziel || !auftrag || !angebotsquote || !terminquote || !wochen || angebotsquote > 100 || terminquote > 100) {
        zeigen({ abschluesse: '–', angebote: '–', termine: '–', woche: '–' });
        return;
      }
      const abschluesse = Math.ceil(ziel / auftrag);
      const angebote = Math.ceil(abschluesse / (angebotsquote / 100));
      const termine = Math.ceil(angebote / (terminquote / 100));
      zeigen({
        abschluesse: abschluesse.toLocaleString('de-DE'),
        angebote: angebote.toLocaleString('de-DE'),
        termine: termine.toLocaleString('de-DE'),
        woche: (termine / wochen).toLocaleString('de-DE', { maximumFractionDigits: 1 }),
      });
    };
    r.addEventListener('input', rechnen);
    rechnen();
  }
})();
