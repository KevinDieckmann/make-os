// Fokus Innovation · Wege der App nur zeigen, wenn sie eingeschaltet sind (31.10.). Kontaktformular (/anfrage) und Newsletter (/newsletter)
// laufen in der App und kommen ausgeschaltet; ohne diesen Blick endete ein Link auf „Diese Seite gibt es gerade nicht“.
//   [data-anfrage]           → GET /api/anfrage liefert nur { ok, aktiv }
//   [data-wenn-seite="/pfad"] → HEAD auf die Seite der App: 200 = an (404 = aus)
// Bei aus, Fehler oder 429 bleibt alles verborgen. Speichert nichts, sendet keine persönlichen Angaben.
(() => {
  const zeigen = (liste) => { for (const el of liste) el.hidden = false; };
  const anfrage = document.querySelectorAll('[data-anfrage]');
  if (anfrage.length) {
    fetch('/api/anfrage', { cache: 'no-store', headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j && j.ok === true && j.aktiv === true) zeigen(anfrage); })
      .catch(() => {});
  }
  const jePfad = new Map();
  for (const el of document.querySelectorAll('[data-wenn-seite]')) {
    const pfad = el.dataset.wennSeite;
    if (!/^\/[a-z0-9-]+$/.test(pfad)) continue;
    jePfad.set(pfad, [...(jePfad.get(pfad) ?? []), el]);
  }
  for (const [pfad, liste] of jePfad) {
    fetch(pfad, { method: 'HEAD', cache: 'no-store', redirect: 'error' })
      .then((r) => { if (r.ok) zeigen(liste); })
      .catch(() => {});
  }
})();
