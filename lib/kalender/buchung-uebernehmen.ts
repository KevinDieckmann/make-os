// ─── Kalender — verfallene Terminanfrage „Als Anfrage übernehmen“ (Server, 02.11., Prüfung R2-1 Fund 1) ─────────────────────────────────────
// Kevin: „Im Thema Kundengewinnung soll nichts dem Zufall überlassen werden.“ Eine Terminanfrage, die niemand rechtzeitig freigab, verfiel bisher als
// Sackgasse: die Glocke führte ins Panel, dort stand sie nicht, ins CRM kam die Person nie, nach der Löschfrist war sie weg. Jetzt zeigt das Panel sie
// (`verfalleneOffen`) mit „Neuen Termin vorschlagen“ (Mail-ENTWURF im Browser, `neuerTerminMail` — MAKE OS versendet nichts) und „Als Anfrage
// übernehmen“ (hier): über den EINEN Anfrage-Weg (`anfrageAnlegen`, lib/crm/anfrage-anlegen.ts) mit `oeffentlich: true` — die Adresse hat der Gast
// selbst eingetippt; trifft sie eine VORHANDENE Person, hängt die Anfrage nur als „Adresse unbestätigt“ an. Art. 18 → nichts (die Antwort sagt es),
// Werbesperre → festgehalten ohne Werbung (Regel des Anfrage-Wegs). Feste Kennung des Follow-ups `fu-<buchung>` → ein zweiter Klick legt nichts doppelt
// an. Danach trägt die Buchung `kontaktId` + `followUpId` und fällt aus der Liste der verfallenen (`verfalleneOffen`) — weiter geht es im CRM. Grundlage: Art. 6 Abs. 1 lit. b — die
// Anfrage kam vom Gast; der Datenschutz-Hinweis der Seite nennt diesen Weg seit Fassung 5 (lib/kalender/buchung.ts `datenschutzHinweis`).

import type { Wer } from '@/lib/store/aenderungsprotokoll';
import { neueKontaktKennung } from '@/lib/kennung';
import { localDay } from '@/lib/zeit';
import { aendereBuchungBestand, buchungProtokoll, ladeBuchungBestand } from './buchung-speicher';
import { nameTeilen, type Buchung } from './buchung';

/** Feste Kennung des Follow-ups „Anfrage beantworten“ einer übernommenen Buchung (idempotent). */
export const uebernahmeFollowupId = (buchungId: string) => `fu-${buchungId}`.slice(0, 64);

export type UebernahmeErgebnis = { ok: true; kontaktId: string; schon?: true; hinweis?: string } | { ok: false; status: number; fehler: string };

const wannText = (b: Pick<Buchung, 'start'>) => `${b.start.slice(8, 10)}.${b.start.slice(5, 7)}.${b.start.slice(0, 4)}, ${b.start.slice(11, 16)} Uhr`;

/** „Als Anfrage übernehmen“ — siehe Kopf. `person` = wer klickt (Sitzung). Nur verfallene Anfragen ohne Kontakt. */
export async function anfrageUebernehmen(buchungId: string, person: string, wer: Wer): Promise<UebernahmeErgebnis> {
  const bestand = await ladeBuchungBestand();
  const b = bestand.buchungen.find(x => x.id === buchungId);
  if (!b) return { ok: false, status: 404, fehler: 'Buchung nicht gefunden.' };
  if (b.kontaktId) return { ok: true, kontaktId: b.kontaktId, schon: true };
  if (!(b.status === 'abgelaufen' && b.verfallen)) return { ok: false, status: 409, fehler: 'Übernehmen geht nur für eine verfallene Terminanfrage — offene bitte freigeben oder ablehnen.' };
  const s = bestand.seiten.find(x => x.id === b.seiteId);
  const { vorname, nachname } = nameTeilen(b.name);
  const tag = localDay(new Date(b.angefragtAm ?? b.angelegt));
  const text = [`Terminanfrage über die Buchungsseite „${s?.titel ?? 'Termin'}“ — Wunschtermin ${wannText(b)} verstrichen, ohne Antwort.`, b.anliegen ? `Anliegen: ${b.anliegen}` : ''].filter(Boolean).join(' ');
  const { anfrageAnlegen } = await import('@/lib/crm/anfrage-anlegen');
  // Wer die Anfrage aufnimmt: die Person der Seite (sie hält die Beziehung, sie bekommt das Follow-up) — fehlt die Seite, wer klickt.
  const fuer = s?.person || person;
  const r = await anfrageAnlegen({ neu: { vorname, nachname, email: b.email, ...(b.firma ? { firma: b.firma } : {}) }, kanal: 'website', text, datum: tag },
    { person: fuer, wer, oeffentlich: true, ids: { kontakt: neueKontaktKennung(), followUp: uebernahmeFollowupId(b.id) } });
  if (!r.ok) return { ok: false, status: r.eingeschraenkt ? 409 : 400, fehler: r.fehler };
  const kontaktId = r.bau.kontakt.id;
  await aendereBuchungBestand(bs => ({ ...bs, buchungen: bs.buchungen.map(x => (x.id === b.id && !x.kontaktId ? { ...x, kontaktId, followUpId: r.bau.followUp.id } : x)) }));
  await buchungProtokoll([{ liste: 'buchungen', op: 'geaendert', id: b.id, felder: ['kontaktId', 'followUpId'] }], wer);
  return { ok: true, kontaktId, ...(r.schon ? { schon: true as const } : {}), ...(r.bau.hinweis ? { hinweis: r.bau.hinweis } : {}) };
}
