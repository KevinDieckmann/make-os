(() => {
  const zeigen = (liste) => { for (const el of liste) el.hidden = false; };
  const anfrage = document.querySelectorAll('[data-anfrage]');
  const zurMail = () => {
    for (const a of document.querySelectorAll('a[data-anfrage-mail]')) if (a.dataset.anfrageMail.startsWith('mailto:')) a.href = a.dataset.anfrageMail;
  };
  if (anfrage.length || document.querySelector('a[data-anfrage-mail]')) {
    fetch('/api/anfrage', { cache: 'no-store', headers: { Accept: 'application/json' } })
      .then((r) => (r.status === 429 ? 'gedrosselt' : r.ok ? r.json() : null))
      .then((j) => {
        if (j === 'gedrosselt') return;
        if (j && j.ok === true && j.aktiv === true) zeigen(anfrage);
        else zurMail();
      })
      .catch(zurMail);
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
