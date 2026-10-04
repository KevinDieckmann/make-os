// ─── MAKE OS — Papierkorb der Produkte im Morgenlauf (Server, 04.10.) ───────
// Schritt „Produkte-Papierkorb“ in /api/tagesstart: Produkte, die länger als 30 Tage im Papierkorb liegen und an denen
// nichts mehr hängt (Mandat, Deal, Angebots-Position), endgültig entfernen — in EINER Sperre auf „crm“, Protokoll „System“.
// Liest erst ohne Sperre und schreibt nur, wenn etwas fällig ist. Regel rein: lib/crm/produkte.ts `produkteAbgelaufen`.

import { ladeCrm, ladeCrmMitPapierkorb, aendereCrm, wendeCrmAn } from './speicher';
import { produkteAbgelaufen } from './produkte';
import { crmAbgelaufen, angeboteAbgelaufen, type PapierkorbListe } from './ablage';
import { loeschKaskade, type VerweisKontext } from './crm-stand';
import { loadJson } from '@/lib/store/local-db';
import { haushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { ablageName } from '@/lib/dateien/ablage';
import type { DateiEintrag } from '@/lib/dateien/regeln';
import type { Kontakt } from '@/lib/make-one/crm';
import type { ListenOp } from '@/lib/sync';

export async function produktePapierkorbAufraeumen(jetzt = new Date()): Promise<{ produkte: number }> {
  const iso = jetzt.toISOString();
  if (!produkteAbgelaufen(await ladeCrm(), iso).length) return { produkte: 0 };
  let weg = 0;
  await aendereCrm(b => {
    const ids = new Set(produkteAbgelaufen(b, iso));
    weg = ids.size;
    return ids.size ? { ...b, leistungen: b.leistungen.filter(l => !ids.has(l.id)) } : b;
  }, { art: 'system' });
  return { produkte: weg };
}

/**
 * Papierkorb der übrigen CRM-Listen im Morgenlauf (04.10., lib/crm/ablage.ts): Firmen, Mandate, Events, Segmente, Beiträge,
 * Ausgaben und Kampagnen, die länger als 30 Tage drin liegen, endgültig entfernen — Eintrag für Eintrag durch denselben Weg
 * wie von Hand (`wendeCrmAn`: Verweis-Sperren, Event-Kaskade). Was noch Verweise hat, bleibt liegen. Events mit Kalender-
 * Termin oder Übergabe-Protokoll löscht nur eine Person von Hand (Termin in Apple entfernen, Nachweis ins Journal).
 */
export async function crmPapierkorbAufraeumen(jetzt = new Date()): Promise<{ eintraege: number; bleiben: number }> {
  const iso = jetzt.toISOString();
  const kandidaten = (b: Awaited<ReturnType<typeof ladeCrmMitPapierkorb>>) => crmAbgelaufen(b, iso).filter(k => {
    if (k.liste !== 'events') return true;
    const e = b.events.find(x => x.id === k.id);
    return !!e && !e.kalenderUid && !e.uebergaben?.length;
  });
  const vorher = await ladeCrmMitPapierkorb();
  if (!kandidaten(vorher).length && !angeboteAbgelaufen(vorher, iso).length) return { eintraege: 0, bleiben: 0 };
  const haushalt = await haushaltDesInhabers();
  const kontext: VerweisKontext = {
    kontakte: (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [],
    rechnungen: (await loadJson<{ rechnungen?: VerweisKontext['rechnungen'] }>('finanzplan'))?.rechnungen ?? [],
    dateien: haushalt ? ((await loadJson<{ eintraege?: DateiEintrag[] }>(ablageName(haushalt)))?.eintraege ?? []) : [],
  };
  let weg = 0, bleiben = 0;
  await aendereCrm(b0 => {
    let b = b0;
    weg = 0; bleiben = 0;
    for (const k of kandidaten(b0)) {
      const ops: ListenOp[] = [{ liste: k.liste as PapierkorbListe, op: 'delete', id: k.id }];
      const alle = [...ops, ...loeschKaskade(b, ops, iso)];
      const r = wendeCrmAn(b, alle, iso, 'system', kontext);
      if (r.sperren.length || r.konflikte.length || r.grenze.length || r.abgelehnt?.length) { bleiben++; continue; }
      b = r.bestand;
      weg++;
    }
    // Angebots-Entwürfe im Papierkorb (04.10.): nach der Frist endgültig — gestellte kommen nie hinein.
    const angebote = new Set(angeboteAbgelaufen(b, iso));
    if (angebote.size) { b = { ...b, angebote: b.angebote.filter(a => !angebote.has(a.id)) }; weg += angebote.size; }
    return weg ? b : b0;
  }, { art: 'system' });
  return { eintraege: weg, bleiben };
}
