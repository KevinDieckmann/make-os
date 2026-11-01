// ─── Kampagnen — ein Ergebnis je Ziel festhalten (Server, M1 01.11.) ─────────────────────────────────────────────────────────────────
// EINE Stelle für „angesprochen · reagiert · Gespräch · Interesse → Lead · kein Interesse“ an einer Kampagne — für Personen (Verlauf der Akte +
// `ergebnisse`, wie bis 01.11. in app/api/crm/kampagnen/route.ts) UND für Betriebe ohne Person (`firmenErgebnisse`, Lead der Firma). Genutzt von
// POST /api/crm/kampagnen { aktion: 'ergebnis' } und „Als Lead übernehmen“ am Follow-up „Antwort bearbeiten“ (POST /api/crm/kampagnen/motor
// { aktion: 'als-lead' }). „Interesse → Lead“ ist noch kein Deal: der Lead der Firma (ohne Firma: der Person) geht in die Qualifizierung.

import { aendereKontakte } from './kartei-schreiben';
import { aendereCrm, ladeCrm } from './speicher';
import { leereKriterien } from './leads';
import { notizAnhaengen } from './notiz-anhaengen';
import { wendeAktivitaetAn, type AktivitaetArt, type Kontakt } from '@/lib/make-one/crm';
import { tagePlus } from '@/lib/zeit';
import type { Wer } from '@/lib/store/aenderungsprotokoll';
import type { KampagnenErgebnis, KampagnenZiel } from './typen';

export const KAMPAGNEN_ERGEBNISSE: readonly KampagnenErgebnis[] = ['angesprochen', 'reagiert', 'gespraech', 'chance', 'kein_interesse'];
const TEXT: Record<KampagnenErgebnis, string> = { angesprochen: 'angesprochen', reagiert: 'hat reagiert', gespraech: 'Gespräch', chance: 'Chance entstanden', kein_interesse: 'kein Interesse' };

export type ErgebnisAntwort = { status: 200 | 400 | 404 | 409; body: Record<string, unknown> };

/** Ein Ergebnis festhalten. `von` = wer angesprochen hat (Team-Kürzel), `person` = wer klickt. */
export async function ergebnisFesthalten(e: { kampagneId: string; ziel: KampagnenZiel; ergebnis: KampagnenErgebnis; von: string; person: string; wer: Wer; heute: string }): Promise<ErgebnisAntwort> {
  const crm = await ladeCrm();
  const k = crm.kampagnen.find(x => x.id === e.kampagneId);
  if (!k) return { status: 404, body: { ok: false, fehler: 'Kampagne nicht gefunden.' } };
  const jetzt = new Date().toISOString();
  const vermerk = `Interesse aus Kampagne „${k.name}“ (${e.heute})`;
  let hinweis: string | undefined;
  const status = (s: typeof k.status) => (s === 'entwurf' ? 'aktiv' as const : s);

  if (e.ziel.art === 'firma') {
    const fid = e.ziel.id;
    const f = crm.firmen.find(x => x.id === fid && !x.geloeschtAm);
    if (!f) return { status: 404, body: { ok: false, fehler: 'Betrieb nicht gefunden.' } };
    if (!(k.firmaIds ?? []).includes(fid)) return { status: 409, body: { ok: false, fehler: 'Dieser Betrieb ist kein Ziel der Kampagne.' } };
    await aendereCrm(c => ({
      ...c,
      kampagnen: c.kampagnen.map(x => (x.id === k.id ? { ...x, firmenErgebnisse: [...(x.firmenErgebnisse ?? []), { firmaId: fid, ergebnis: e.ergebnis, am: e.heute, von: e.von }], status: status(x.status), geaendert: jetzt, geaendertVon: e.person } : x)),
      ...(e.ergebnis === 'chance' ? { firmen: c.firmen.map(y => {
        if (y.id !== fid || ['sql', 'kunde'].includes(y.lead?.status ?? '')) return y;
        const n = notizAnhaengen(y.lead?.notiz, vermerk);
        if (!n.ok) hinweis = n.hinweis;
        return { ...y, lead: { ...(y.lead ?? { kriterien: leereKriterien() }), status: 'qualifizierung' as const, ...(n.notiz ? { notiz: n.notiz } : {}), geaendert: jetzt, geaendertVon: e.person } };
      }) } : {}),
    }), e.wer);
    return { status: 200, body: { ok: true, ...(hinweis ? { hinweis } : {}) } };
  }

  // Person — unverändert gegenüber dem Weg bis 01.11. (Verlauf der Akte, Ergebnis, Lead der Firma bzw. der Person).
  const kanalArt: AktivitaetArt = k.kanal === 'telefon' ? 'anruf' : k.kanal === 'mail' ? 'mail' : k.kanal === 'linkedin' ? 'linkedin' : k.kanal === 'event' ? 'event' : 'notiz';
  const erg = e.ergebnis;
  const art: AktivitaetArt = erg === 'angesprochen' ? kanalArt : erg === 'reagiert' ? 'antwort' : erg === 'gespraech' || erg === 'chance' ? 'gespraech' : 'notiz';
  const text = `Kampagne „${k.name}“: ${TEXT[erg]}`;
  let kontakt: Kontakt | null = null;
  let eingeschraenkt = false;
  await aendereKontakte<{ kontakte: Kontakt[] }>(cur => {
    const f = cur ?? { kontakte: [] };
    const i = f.kontakte.findIndex(x => x.id === e.ziel.id);
    if (i < 0) return f;
    // Art. 18 (U2): an einer eingeschränkten Person wird nichts festgehalten.
    if (f.kontakte[i].eingeschraenkt) { eingeschraenkt = true; return f; }
    kontakt = wendeAktivitaetAn(f.kontakte[i], { art, text, von: e.von, bezug: k.id }, e.heute, new Date().toISOString(), tagePlus);
    f.kontakte[i] = kontakt;
    return f;
  }, e.wer);
  const kt = kontakt as Kontakt | null;
  if (eingeschraenkt) return { status: 409, body: { ok: false, fehler: 'Verarbeitung der Person ist eingeschränkt (Art. 18) — kein Ergebnis festgehalten.' } };
  if (!kt) return { status: 404, body: { ok: false, fehler: 'Person nicht gefunden.' } };
  // Lead-Notiz nie still kürzen (28.09.): passt der Vermerk nicht mehr hinein, bleibt die Notiz, wie sie ist — mit Hinweis.
  await aendereCrm(c => {
    const neu = { ...c, kampagnen: c.kampagnen.map(x => (x.id === k.id ? { ...x, ergebnisse: [...x.ergebnisse, { kontaktId: kt.id, ergebnis: erg, am: e.heute, von: e.von }], status: status(x.status), geaendert: jetzt, geaendertVon: e.person } : x)) };
    // Ebene 1 (25.09.): „Interesse“ aus einer Kampagne ist noch kein Deal — der Lead der Firma geht in die Qualifizierung.
    if (erg === 'chance' && kt.firmaId) neu.firmen = c.firmen.map(f => {
      if (f.id !== kt.firmaId || ['sql', 'kunde'].includes(f.lead?.status ?? '')) return f;
      const n = notizAnhaengen(f.lead?.notiz, vermerk);
      if (!n.ok) hinweis = n.hinweis;
      return { ...f, lead: { ...(f.lead ?? { kriterien: leereKriterien() }), status: 'qualifizierung' as const, ...(n.notiz ? { notiz: n.notiz } : {}), geaendert: jetzt, geaendertVon: e.person } };
    });
    return neu;
  });
  // Ohne Firma liegt der Lead an der Person — die vorhandene Notiz bleibt (vorher wurde sie ersetzt).
  if (erg === 'chance' && !kt.firmaId && !['sql', 'kunde'].includes(kt.lead?.status ?? '')) {
    await aendereKontakte<{ kontakte: Kontakt[] }>(cur => ({ ...(cur ?? { kontakte: [] }), kontakte: (cur?.kontakte ?? []).map(x => {
      if (x.id !== kt.id || x.eingeschraenkt) return x;
      const n = notizAnhaengen(x.lead?.notiz, vermerk);
      if (!n.ok) hinweis = n.hinweis;
      return { ...x, lead: { ...(x.lead ?? { kriterien: leereKriterien() }), status: 'qualifizierung' as const, ...(n.notiz ? { notiz: n.notiz } : {}), geaendert: jetzt, geaendertVon: e.person } };
    }) }), e.wer);
  }
  return { status: 200, body: { ok: true, ...(hinweis ? { hinweis } : {}) } };
}
