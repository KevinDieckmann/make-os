// ─── Head of Marketing: die neuen Teile im Datenpaket (rein, getestet — 02.11., Marketing-Projekt M2 K2) ─────────────────────────────
// Bis 01.11. plante der Head an Social, Website, Homepage-Funden und dem Kampagnen-Motor vorbei — er kannte sie nicht. Hier werden sie zu
// ZAHLEN und KENNUNGEN verdichtet (nie Texte Dritter: keine Kommentare, DMs, Mail-Texte, Namen von Absendern, Adressen):
//   social       je sichtbarem Kanal: Folgen je Status, diese Woche geplant, freie Plätze im Plan (7 Tage), offene Kommentare/DMs
//   website      Kennzahlen 30 Tage, Eingänge 30 Tage je Art (Anfragen, davon Checks, Termine, Bestellungen, Newsletter), Wege, die aus sind
//   funde        Homepage-Funde je Status (der Stapel, der wartet)
//   mail_stapel  Kampagnen-Mails: wartet auf Freigabe, freigegeben, Fehler/unklar, gesendet 7 Tage, offene Antworten — gesamt und je Kampagne
// Eingesammelt wird in lib/heads/marketing-lage-server.ts (jede Quelle für sich, scheitert eine, steht sie als null da); hier nur gerechnet.

import type { FolgeStatus, SocialDatei } from '@/lib/social/typen';
import type { PlanLuecke } from '@/lib/social/plan';
import type { Kampagne, FollowUp } from '@/lib/crm/typen';

export interface SocialKanalLage {
  id: string; name: string; plattformen: string[]; aktiv: boolean; agent: boolean;
  folgen: Partial<Record<FolgeStatus, number>>;
  /** Geplante bzw. freigegebene Folgen mit Termin heute … heute + 6. */
  geplant_7_tage: number;
  /** Freie Plätze des Redaktionsplans in den nächsten 7 Tagen (plan.ts `planLuecken`). */
  luecken_7_tage: number;
  /** Fertig, aber noch nicht freigegeben (Status „entwurf“) — wartet auf einen Menschen. */
  wartet_freigabe: number;
  offene_kommentare: number; offene_dms: number;
}
export interface SocialLageHead { kanaele: SocialKanalLage[] }

export interface FadenKurz { kanalId: string; art: 'kommentar' | 'dm'; offen: boolean }

/** Social je Kanal (rein). `luecken` je Kanal-Kennung, schon für das Fenster heute … heute + 6 berechnet (plan.ts). */
export function socialLage(d: SocialDatei, faeden: readonly FadenKurz[], luecken: Record<string, readonly PlanLuecke[]>, heute: string, bis: string): SocialLageHead {
  return {
    kanaele: d.kanaele.filter(k => !k.archiviertAm).map(k => {
      const folgen = d.folgen.filter(f => f.kanalId === k.id);
      const je: Partial<Record<FolgeStatus, number>> = {};
      for (const f of folgen) je[f.status] = (je[f.status] ?? 0) + 1;
      const offen = faeden.filter(f => f.kanalId === k.id && f.offen);
      return {
        id: k.id, name: k.name, plattformen: [...k.plattformen], aktiv: k.status === 'aktiv', agent: !!k.plan?.agent,
        folgen: je,
        geplant_7_tage: folgen.filter(f => (f.status === 'geplant' || f.status === 'freigegeben') && !!f.geplantAm && f.geplantAm.slice(0, 10) >= heute && f.geplantAm.slice(0, 10) <= bis).length,
        luecken_7_tage: (luecken[k.id] ?? []).filter(l => l.platz.slice(0, 10) >= heute && l.platz.slice(0, 10) <= bis).length,
        wartet_freigabe: je.entwurf ?? 0,
        offene_kommentare: offen.filter(f => f.art === 'kommentar').length, offene_dms: offen.filter(f => f.art === 'dm').length,
      };
    }),
  };
}

export interface WebsiteLageHead {
  kennzahlen: { label: string; wert: string; ampel: string }[];
  eingaenge_30_tage: { anfragen: number; davon_checks: number; termine: number; bestellungen: number; newsletter: number };
  wege_aus: string[];
}
/** Website (rein) aus den Eingängen (lib/website/lage-server.ts `websiteEingaenge`), Kennzahlen und Wegen — nur Arten und Zahlen, nie „wer“. */
export function websiteLage(eingaenge: readonly { art: string; herkunft: string }[], kennzahlen: readonly { label: string; anzeige?: string; ampel?: string }[], wege: readonly { name: string; zustand: string }[]): WebsiteLageHead {
  const n = (art: string) => eingaenge.filter(e => e.art === art).length;
  return {
    kennzahlen: kennzahlen.map(k => ({ label: k.label, wert: k.anzeige ?? '—', ampel: k.ampel ?? 'grau' })),
    eingaenge_30_tage: { anfragen: n('anfrage'), davon_checks: eingaenge.filter(e => e.art === 'anfrage' && /check/i.test(e.herkunft)).length, termine: n('termin'), bestellungen: n('bestellung'), newsletter: n('newsletter') },
    wege_aus: wege.filter(w => w.zustand === 'aus' || w.zustand === 'unvollstaendig').map(w => `${w.name}: ${w.zustand === 'aus' ? 'aus' : 'unvollständig'}`),
  };
}

export interface FundeLageHead { neu: number; vorbereitet: number; uebernommen: number; gesendet: number }
export function fundeLage(funde: readonly { status: string }[]): FundeLageHead {
  const n = (s: string) => funde.filter(f => f.status === s).length;
  return { neu: n('neu'), vorbereitet: n('vorbereitet'), uebernommen: n('uebernommen'), gesendet: n('gesendet') };
}

export interface StapelZahlen { wartet_freigabe: number; freigegeben: number; fehler: number; gesendet_7_tage: number; antworten_offen: number }
export interface MailStapelLageHead extends StapelZahlen { je_kampagne: ({ kampagne_id: string; name: string } & StapelZahlen)[] }
export interface PostKurz { id: string; kampagneId: string; kanal: string; status: string; gesendet?: { am: string }; rueckfluss?: { art: string } }

/**
 * Mail-Stapel des Kampagnen-Motors (rein). „Antworten offen“ = Rückfluss „Antwort“, deren Follow-up („Antwort bearbeiten“) noch offen ist —
 * `antwortFollowup` liefert dessen Kennung (lib/crm/kampagnen-post.ts `antwortFollowupId`, hereingereicht, damit hier keine Kennungsform steht).
 */
export function mailStapelLage(post: readonly PostKurz[], followups: readonly Pick<FollowUp, 'id' | 'status'>[], kampagnen: readonly Pick<Kampagne, 'id' | 'name'>[], heute: string, ab7: string, antwortFollowup: (postId: string) => string): MailStapelLageHead {
  const offeneFu = new Set(followups.filter(f => f.status === 'offen').map(f => f.id));
  const zahlen = (l: readonly PostKurz[]): StapelZahlen => ({
    wartet_freigabe: l.filter(p => p.kanal === 'mail' && p.status === 'entwurf').length,
    freigegeben: l.filter(p => p.status === 'freigegeben' || p.status === 'sendet').length,
    fehler: l.filter(p => p.status === 'fehler' || p.status === 'unklar').length,
    gesendet_7_tage: l.filter(p => p.gesendet && p.gesendet.am.slice(0, 10) >= ab7 && p.gesendet.am.slice(0, 10) <= heute).length,
    antworten_offen: l.filter(p => p.rueckfluss?.art === 'antwort' && offeneFu.has(antwortFollowup(p.id))).length,
  });
  const gesamt = zahlen(post);
  const name = new Map(kampagnen.map(k => [k.id, k.name]));
  const ids = Array.from(new Set(post.map(p => p.kampagneId)));
  const je_kampagne = ids.map(id => ({ kampagne_id: id, name: name.get(id) ?? 'Kampagne', ...zahlen(post.filter(p => p.kampagneId === id)) }))
    .filter(k => k.wartet_freigabe || k.freigegeben || k.fehler || k.antworten_offen);
  return { ...gesamt, je_kampagne };
}

/** Was der Server einsammelt — jedes Teil für sich (null = Quelle nicht lesbar oder nicht eingerichtet). */
export interface MarketingLage { social: SocialLageHead | null; website: WebsiteLageHead | null; funde: FundeLageHead | null; mail_stapel: MailStapelLageHead | null }
