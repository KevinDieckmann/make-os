// ─── MAKE OS — Verlauf an die Kontakte ──────────────────────────────────────
// Bei 731 Kontakten kann niemand von Hand pflegen, wann er zuletzt mit wem
// gesprochen hat. Diese Route gleicht das Netzwerk gegen Postfach und
// Kalender ab und setzt „zuletzt gesprochen" aus echten Belegen.
//
// GET  → nur rechnen und zeigen, was sich ändern würde.
// POST → die Änderungen wirklich schreiben.
//
// Bewusst konservativ: nur eindeutige Treffer. Eine E-Mail-Adresse ist
// eindeutig, ein Name im Termintitel nur, wenn Vor- UND Nachname vorkommen.

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import type { Kontakt, Chance } from '@/lib/make-one/netzwerk-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface NetzFile { kontakte: Kontakt[]; chancen: Chance[] }
interface MsMail { senderName?: string; senderEmail?: string; subject?: string; receivedAt?: string }
interface CalEvent { title?: string; startDate?: string; start?: string }

interface Treffer { id: string; name: string; datum: string; woher: string; beleg: string }

const tag = (iso?: string) => (iso && iso.length >= 10 ? iso.slice(0, 10) : null);

async function rechne() {
  const [netz, ms, cal, kem] = await Promise.all([
    loadJson<NetzFile>('netzwerk'),
    loadJson<{ emails: MsMail[] }>('microsoft-inbox'),
    loadJson<{ events: CalEvent[] }>('calendar-cache'),
    loadJson<{ events: CalEvent[] }>('kemaris-calendar'),
  ]);
  const kontakte = netz?.kontakte ?? [];
  const treffer = new Map<string, Treffer>();

  /** Nur übernehmen, wenn der Beleg jünger ist als der bisherige Stand. */
  const merke = (k: Kontakt, datum: string | null, woher: string, beleg: string) => {
    if (!datum) return;
    if (k.letzterKontakt && k.letzterKontakt >= datum) return;
    const alt = treffer.get(k.id);
    if (alt && alt.datum >= datum) return;
    treffer.set(k.id, { id: k.id, name: k.name, datum, woher, beleg: beleg.slice(0, 120) });
  };

  // ── Postfach: E-Mail-Adresse ist eindeutig ──
  const perMail = new Map<string, Kontakt>();
  kontakte.forEach(k => { if (k.email) perMail.set(k.email.toLowerCase().trim(), k); });
  for (const m of ms?.emails ?? []) {
    const k = perMail.get((m.senderEmail ?? '').toLowerCase().trim());
    if (k) merke(k, tag(m.receivedAt), 'Postfach', m.subject ?? 'E-Mail');
  }

  // ── Kalender: Name im Titel, aber nur bei Vor- UND Nachname ──
  const mitNachname = kontakte
    .map(k => ({ k, teile: k.name.trim().split(/\s+/).filter(t => t.length > 2) }))
    .filter(x => x.teile.length >= 2);
  const termine = [...(cal?.events ?? []), ...(kem?.events ?? [])];
  for (const e of termine) {
    const titel = (e.title ?? '').toLowerCase();
    if (!titel) continue;
    const datum = tag(e.startDate ?? e.start);
    // Nur Vergangenes zählt als „gesprochen".
    if (!datum || datum > new Date().toISOString().slice(0, 10)) continue;
    for (const { k, teile } of mitNachname) {
      if (teile.every(t => titel.includes(t.toLowerCase()))) merke(k, datum, 'Kalender', e.title ?? 'Termin');
    }
  }

  return { kontakte, chancen: netz?.chancen ?? [], treffer: Array.from(treffer.values()).sort((a, b) => b.datum.localeCompare(a.datum)) };
}

export async function GET() {
  const { treffer, kontakte } = await rechne();
  return NextResponse.json({
    treffer,
    anzahl: treffer.length,
    geprueft: kontakte.length,
    ohneDatum: kontakte.filter(k => !k.letzterKontakt).length,
  });
}

export async function POST() {
  const { treffer } = await rechne();
  if (!treffer.length) return NextResponse.json({ ok: true, gesetzt: 0, hinweis: 'Nichts Neues gefunden.' });

  const map = new Map(treffer.map(t => [t.id, t]));
  const next = await updateJson<NetzFile>('netzwerk', current => ({
    kontakte: (current?.kontakte ?? []).map(k => {
      const t = map.get(k.id);
      if (!t) return k;
      // Beleg an die Notizen anhängen — nachvollziehbar, woher das Datum kommt.
      const zeile = `[${t.datum}] ${t.woher}: ${t.beleg}`;
      const notizen = k.notizen?.includes(zeile) ? k.notizen : `${zeile}${k.notizen ? `\n${k.notizen}` : ''}`;
      return { ...k, letzterKontakt: t.datum, notizen: notizen.slice(0, 4000) };
    }),
    chancen: current?.chancen ?? [],
  }));

  return NextResponse.json({ ok: true, gesetzt: treffer.length, kontakte: next.kontakte.length });
}
