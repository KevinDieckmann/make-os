// MAKE Innovation · Inhalte aus unserer Anwendung (31.10.). Liest GET /api/website/inhalt
// (öffentlich, nur sichtbare Einträge) und ersetzt markierte Stellen — nur Text, nie HTML:
//   data-mk="preis:<angebot>"    → angebote[].preisText
//   data-mk="baustein:<id>"      → bausteine[].preisNetto (Cent) als „1.234 €“
//   data-mk="text:<schlüssel>"   → texte[schlüssel]
//   data-mk="events"             → Liste der kommenden Termine (sonst bleibt sie verborgen)
//   data-mk="termin-naechster"   → „Nächster Termin: …“
// Ohne Antwort, mit Fehler oder für Einträge, die fehlen, bleibt der gebaute Text stehen — nie etwas leer. Speichert nichts, sendet nichts.
(() => {
  const stellen = document.querySelectorAll('[data-mk]');
  if (!stellen.length) return;
  const text = (x, max) => (typeof x === 'string' && x.trim() && x.length <= max && !/[\u0000-\u0008\u000b-\u001f<>]/.test(x) ? x.trim() : null);
  const euro = (cent) => `${(cent / 100).toLocaleString('de-DE', { minimumFractionDigits: cent % 100 ? 2 : 0, maximumFractionDigits: 2 })} €`;
  const TAG = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/;
  const heute = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
  const datumText = (d, mitWochentag) => {
    const m = TAG.exec(d);
    const tag = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
    const t = tag.toLocaleDateString('de-DE', { timeZone: 'UTC', ...(mitWochentag ? { weekday: 'short' } : {}), day: 'numeric', month: 'long', year: 'numeric' });
    return m[4] ? `${t}, ${m[4]}:${m[5]} Uhr` : t;
  };
  const link = (x) => (typeof x === 'string' && (/^https:\/\/[^\s<>"]{3,300}$/.test(x) || /^\/[a-z0-9/_-]{1,120}$/.test(x)) ? x : null);

  fetch('/api/website/inhalt', { headers: { Accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      if (!j || j.ok !== true) return;
      const angebote = new Map((Array.isArray(j.angebote) ? j.angebote : []).filter((a) => a && typeof a.id === 'string').map((a) => [a.id, a]));
      const bausteine = new Map((Array.isArray(j.bausteine) ? j.bausteine : []).filter((b) => b && typeof b.id === 'string').map((b) => [b.id, b]));
      const texte = j.texte && typeof j.texte === 'object' ? j.texte : {};
      const events = (Array.isArray(j.events) ? j.events : [])
        .filter((ev) => ev && text(ev.titel, 160) && typeof ev.datum === 'string' && TAG.test(ev.datum) && ev.datum.slice(0, 10) >= heute)
        .sort((a, b) => (a.datum < b.datum ? -1 : 1))
        .slice(0, 6);

      for (const el of stellen) {
        const [art, ...rest] = el.dataset.mk.split(':');
        const id = rest.join(':');
        if (art === 'preis') {
          const neu = text(angebote.get(id)?.preisText, 60);
          if (neu) el.textContent = neu;
        } else if (art === 'baustein') {
          const cent = bausteine.get(id)?.preisNetto;
          if (Number.isInteger(cent) && cent > 0 && cent < 100000000) el.textContent = euro(cent);
        } else if (art === 'text') {
          const neu = text(texte[id], 2000);
          if (neu) el.textContent = neu;
        } else if (art === 'termin-naechster' && events.length) {
          el.textContent = `Nächster Termin: ${datumText(events[0].datum, false)}`;
          el.hidden = false;
        } else if (art === 'events' && events.length) {
          el.replaceChildren(...events.map((ev) => {
            const li = document.createElement('li');
            const zeit = document.createElement('time');
            zeit.dateTime = ev.datum.slice(0, 16);
            zeit.textContent = datumText(ev.datum, true);
            const titel = document.createElement('b');
            titel.textContent = text(ev.titel, 160);
            const mehr = [text(ev.format, 80), text(ev.ort, 120)].filter(Boolean).join(' · ');
            li.append(zeit, titel);
            if (mehr) { const sp = document.createElement('span'); sp.textContent = mehr; li.append(sp); }
            const ziel = link(ev.anmeldung);
            if (ziel) {
              const a = document.createElement('a');
              a.className = 'unterstrichen';
              a.href = ziel;
              a.textContent = 'Anmelden';
              if (ziel.startsWith('https://')) a.rel = 'noopener';
              li.append(a);
            }
            return li;
          }));
          el.hidden = false;
        }
      }
    })
    .catch(() => {});
})();
