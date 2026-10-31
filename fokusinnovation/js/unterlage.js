// Fokus Innovation · lange Vorlage per E-Mail anfordern (31.10., Kevin: „die größeren brauchen eine E-Mail, damit wir denen das Ganze
// zuschicken können“). Spricht mit der App über die Website-Adresse: GET /api/unterlage?id= (ist die Anforderung an, Wortlaut des
// Newsletter-Hakens), POST /api/unterlage (schickt den Link per E-Mail). Speichert nichts im Browser. Ohne Antwort der App bleibt der
// Weg per E-Mail stehen (data-ersatz). Keine Inline-Stile, kein eval (CSP 'self').
(() => {
  const EMAIL_OK = /^[^\s@<>"',;:]{1,64}@[a-z0-9.-]{1,190}\.[a-z]{2,24}$/i;
  for (const form of document.querySelectorAll('form[data-unterlage]')) {
    const id = form.dataset.unterlage;
    const huelle = form.parentElement;
    const ersatz = huelle.querySelector('[data-ersatz]');
    const fertig = huelle.querySelector('[data-fertig]');
    const meldung = form.querySelector('[data-meldung]');
    const haken = form.querySelector('[data-newsletter]');
    const knopf = form.querySelector('button[type="submit"]');
    let fassung = null;
    const zeigeErsatz = () => { form.hidden = true; ersatz.hidden = false; };
    const sage = (text) => { meldung.textContent = text; };

    fetch(`/api/unterlage?id=${encodeURIComponent(id)}`, { cache: 'no-store', headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j || !j.ok || !j.aktiv) return zeigeErsatz();
        if (j.newsletter && j.newsletter.wortlaut) {
          haken.querySelector('span').textContent = `${j.newsletter.wortlaut} Der Newsletter kommt erst, wenn Sie die Anmeldung über den Link in unserer E-Mail bestätigen.`;
          fassung = j.newsletter.fassung;
          haken.hidden = false;
        }
        form.hidden = false;
      })
      .catch(zeigeErsatz);

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const feld = (n) => form.elements.namedItem(n);
      const vorname = feld('vorname').value.trim();
      const email = feld('email').value.trim();
      const firma = feld('firma').value.trim();
      for (const n of ['vorname', 'email']) feld(n).removeAttribute('aria-invalid');
      if (!vorname) { feld('vorname').setAttribute('aria-invalid', 'true'); feld('vorname').focus(); return sage('Bitte Ihren Vornamen angeben.'); }
      if (!EMAIL_OK.test(email)) { feld('email').setAttribute('aria-invalid', 'true'); feld('email').focus(); return sage('Bitte eine gültige E-Mail-Adresse angeben.'); }
      const newsletter = !haken.hidden && feld('newsletter').checked;
      knopf.disabled = true;
      knopf.setAttribute('aria-busy', 'true');
      sage('Einen Moment …');
      try {
        const r = await fetch('/api/unterlage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ id, vorname, email, ...(firma ? { firma } : {}), ...(newsletter ? { newsletter: true, newsletterFassung: fassung } : {}), webseite: feld('webseite').value }),
        });
        const j = await r.json().catch(() => null);
        if (r.ok && j && j.ok) {
          form.hidden = true;
          fertig.querySelector('[data-fertig-text]').textContent = j.text || 'Schauen Sie in Ihr Postfach: Der Link zum Herunterladen ist unterwegs. Er gilt 7 Tage.';
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
