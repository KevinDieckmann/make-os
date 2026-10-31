// Fokus Innovation · Kontaktformular nur zeigen, wenn es eingeschaltet ist (31.10.). Das Formular läuft in der App unter /anfrage und kommt
// ausgeschaltet; GET /api/anfrage sagt nur { ok, aktiv }. Bei aus, Fehler oder 429 bleibt der Link verborgen — die E-Mail-Adresse steht immer da.
// Speichert nichts, sendet nichts außer dieser einen Abfrage.
(() => {
  const ziele = document.querySelectorAll('[data-anfrage]');
  if (!ziele.length) return;
  fetch('/api/anfrage', { cache: 'no-store', headers: { Accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => { if (j && j.ok === true && j.aktiv === true) for (const el of ziele) el.hidden = false; })
    .catch(() => {});
})();
