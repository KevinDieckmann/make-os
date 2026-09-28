// ─── Zeit & Fokus — wessen Zeit zusammen ausgewertet wird (Server) ───────────
// Der Haushalt der anfragenden Person (alle Konten mit demselben Haushalt), sonst
// nur sie selbst. Genutzt von /api/state/zeit/einheiten und /api/state/zeit/mandate;
// der Schlüssel (`h:<haushalt>` bzw. `p:<person>`) gehört in den Memo-Schlüssel.

import { nameVon } from '@/lib/zoe/raum';
import { ladeKonten } from '@/lib/zugang/konten';
import { HAUSHALT_OK } from '@/lib/finanzen/haushalt/zugriff';

export async function zeitPersonenVon(person: string): Promise<{ schluessel: string; personen: { person: string; name: string }[] }> {
  const konten = (await ladeKonten()).konten;
  const ich = konten.find(k => k.speicher === person);
  const name = (k?: { name: string }, p = person) => k?.name?.split(/\s+/)[0] || nameVon(p);
  const h = ich?.haushalt && HAUSHALT_OK.test(ich.haushalt) ? ich.haushalt : null;
  if (!h) return { schluessel: `p:${person}`, personen: [{ person, name: name(ich) }] };
  const mit = konten.filter(k => k.haushalt === h).map(k => ({ person: k.speicher, name: name(k, k.speicher) }));
  return { schluessel: `h:${h}`, personen: mit.length ? mit : [{ person, name: name(ich) }] };
}
