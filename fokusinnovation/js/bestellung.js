// Fokus Innovation · Baustein auf Rechnung bestellen (31.10.). Spricht mit der App über die Website-Adresse:
// GET /api/bestellung?id= (an/aus, Formular-Stempel, Bestellbedingungen der Instanz, Bruttopreis), POST /api/bestellung (legt die Bestellung an;
// Rechnung und Download-Link kommen erst nach Freigabe). Speichert nichts im Browser. Ohne Antwort der App bleibt der Weg per E-Mail.
(() => {
  const EMAIL_OK = /^[^\s@<>"',;:]{1,64}@[a-z0-9.-]{1,190}\.[a-z]{2,24}$/i;
  const euro = (cent) => `${(cent / 100).toLocaleString('de-DE', { minimumFractionDigits: cent % 100 ? 2 : 0, maximumFractionDigits: 2 })} €`;
  for (const form of document.querySelectorAll('form[data-baustein]')) {
    const id = form.dataset.baustein;
    const huelle = form.parentElement;
    const ersatz = huelle.querySelector('[data-ersatz]');
    const fertig = huelle.querySelector('[data-fertig]');
    const meldung = form.querySelector('[data-meldung]');
    const bed = form.querySelector('[data-bedingungen]');
    const knopf = form.querySelector('button[type="submit"]');
    let stempel = null, fassung = null;
    const zeigeErsatz = () => { form.hidden = true; ersatz.hidden = false; };
    const sage = (text) => { meldung.textContent = text; };

    fetch(`/api/bestellung?id=${encodeURIComponent(id)}`, { cache: 'no-store', headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j || !j.ok || !j.aktiv || !j.stempel) return zeigeErsatz();
        stempel = j.stempel;
        if (j.bedingungen && Array.isArray(j.bedingungen.zeilen)) {
          fassung = j.bedingungen.fassung;
          const liste = document.createElement('ul');
          for (const z of j.bedingungen.zeilen) { const li = document.createElement('li'); li.textContent = z; liste.append(li); }
          const titel = document.createElement('p'); titel.className = 'etikett'; titel.textContent = 'Bestellbedingungen';
          bed.replaceChildren(titel, liste);
          bed.hidden = false;
        }
        // Vertragspartner: die App nennt die Firmierung der Gesellschaft, die wirklich berechnet — sie ersetzt die Vorgabe der Seite.
        const vp = huelle.querySelector('[data-verkaeufer]');
        const vpZeile = j.hinweis && Array.isArray(j.hinweis.zeilen) ? j.hinweis.zeilen.find((z) => typeof z === 'string' && z.startsWith('Vertragspartner und Rechnungssteller:')) : null;
        if (vp && vpZeile) { vp.replaceChildren(document.createTextNode(`${vpZeile} `), ...[...vp.querySelectorAll('a')]); vp.hidden = false; }
        // Steuersatz und Brutto kommen aus der App (Kleinunternehmer: 0 %), die Seite zeigt sonst die Vorgabe mit 19 %.
        const zeile = form.querySelector('[data-summe]');
        if (zeile && Number.isInteger(j.preis) && Number.isInteger(j.brutto) && Number.isInteger(j.ust)) {
          zeile.textContent = j.ust ? `${euro(j.preis)} netto + ${j.ust} % USt = ${euro(j.brutto)}` : `${euro(j.preis)} (ohne Umsatzsteuer)`;
        }
        form.hidden = false;
      })
      .catch(zeigeErsatz);

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const feld = (n) => form.elements.namedItem(n);
      const wert = (n) => (feld(n) ? feld(n).value.trim() : '');
      for (const el of form.querySelectorAll('[aria-invalid]')) el.removeAttribute('aria-invalid');
      const pflicht = [['vorname', 'Bitte Ihren Vornamen angeben.'], ['nachname', 'Bitte Ihren Nachnamen angeben.'], ['firma', 'Bitte die Firma angeben.'], ['email', 'Bitte eine gültige E-Mail-Adresse angeben.'], ['strasse', 'Bitte Straße und Hausnummer angeben.'], ['plz', 'Bitte die Postleitzahl angeben.'], ['ort', 'Bitte den Ort angeben.'], ['land', 'Bitte das Land angeben.']];
      for (const [n, text] of pflicht) {
        if (!wert(n) || (n === 'email' && !EMAIL_OK.test(wert(n)))) { feld(n).setAttribute('aria-invalid', 'true'); feld(n).focus(); return sage(text); }
      }
      if (!feld('unternehmer').checked) return sage('Bausteine gibt es nur für Unternehmen. Bitte bestätigen Sie, dass Sie für Ihr Unternehmen bestellen.');
      if (!feld('bedingungen').checked) return sage('Bitte stimmen Sie den Bestellbedingungen zu.');
      knopf.disabled = true;
      knopf.setAttribute('aria-busy', 'true');
      sage('Einen Moment …');
      try {
        const koerper = { id, stempel, webseite: wert('webseite'), unternehmer: true, bedingungen: true, ...(fassung ? { bedingungenFassung: fassung } : {}) };
        for (const n of ['vorname', 'nachname', 'firma', 'email', 'strasse', 'plz', 'ort', 'land', 'ustid', 'telefon']) if (wert(n)) koerper[n] = wert(n);
        const r = await fetch('/api/bestellung', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(koerper) });
        const j = await r.json().catch(() => null);
        if (r.ok && j && j.ok) {
          form.hidden = true;
          fertig.querySelector('[data-fertig-text]').textContent = j.text || 'Danke! Ihre Bestellung ist eingegangen. Rechnung und Download-Link schicken wir Ihnen nach kurzer Prüfung per E-Mail.';
          fertig.hidden = false;
          fertig.focus();
          return;
        }
        if (r.status === 404 && !(j && j.fehler)) return zeigeErsatz();
        sage((j && j.fehler) || 'Das hat leider nicht geklappt. Bitte versuchen Sie es gleich noch einmal.');
      } catch {
        sage('Keine Verbindung. Bitte prüfen Sie Ihr Netz und versuchen Sie es noch einmal.');
      } finally {
        knopf.disabled = false;
        knopf.removeAttribute('aria-busy');
      }
    });
  }
})();
