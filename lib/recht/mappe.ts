// ─── Head of Recht: Anwalts-Mappe — Aufbau (rein, client-sicher, 10.10.) ───────────────────────────────────────────────────────────────
// Kevin 10.10.: „Anwalts-Mappe auf Knopfdruck: zu einem Thema (Gesellschaft, Vertrag, Risiko) Dokumente, Verlauf, offene Fragen als PDF-Paket in
// der Ablage (nichts geht raus ohne Klick).“ research › 6 A18: Sachverhalt chronologisch, Beteiligte (Rollen), Dokumentenliste mit Daten, offene
// Fragen, Fristen, bisherige Schritte — nur auf Klick, verschlüsselt, OHNE Notizen (Notiz-Felder bleiben draußen; Risiko-Ursache, -Wirkung und
// Bewertungsgründe gehören zum Thema). Hier nur der Aufbau aus den Beständen (Register, Schild, Lage) — das PDF baut lib/recht/mappe-pdf.ts,
// abgelegt wird über die vorhandene, verschlüsselte Ablage (lib/recht/server.ts). Keine Namen, keine Firmen im Code: alles aus den Daten.

import {
  aktiveEintraege, anteile, anzeigeName, beschlussArtLabel, organLabel, rechtsformLabel, statusLabel, vertragArtLabel,
  type Bezug, type RegisterGesellschaft, VERTRAG_STATUS,
} from '@/lib/gesellschaften/modell';
import type { GesellschaftLage } from '@/lib/gesellschaften/schild/ampel';
import type { SchildGesellschaft } from '@/lib/gesellschaften/schild/typen';
import { RISIKO_KATEGORIEN, ROLLEN, BEHANDLUNGEN, VERSICHERUNG_ARTEN, REGEL_STAND } from '@/lib/gesellschaften/schild/typen';
import { DOKUMENT_KATALOG, DOK_ZUSTAND_TEXT } from '@/lib/gesellschaften/schild/dokumente';
import { ereignisDef } from '@/lib/gesellschaften/schild/pflichten';
import { tagText, tagePlus } from '@/lib/gesellschaften/schild/zeit';
import { tagVon } from '@/lib/zeit';
import { MAPPE_GRENZEN, MAPPE_HINWEIS, RECHT_HINWEIS, type MappeAbschnitt, type MappeDokument, type MappeThema } from './typen';

export interface AblageKurz { id: string; titel?: string; name?: string; hochgeladenAm: string }
export interface MappeQuellen {
  thema: MappeThema;
  g: RegisterGesellschaft;
  s: SchildGesellschaft | null | undefined;
  /** Lage der Gesellschaft (Pflichten, Punkte) — fehlt bei einer Gesellschaft, die das Schild nicht führt. */
  lage: GesellschaftLage | null | undefined;
  heute: string;
  /** Offene Fragen der Person (aus dem Knopf) — Freitext, je Frage höchstens `MAPPE_GRENZEN.frageZeichen`. */
  fragen: readonly string[];
  /** `art:id` → Anzeigename (Personen des Haushalts, eigene Gesellschaften, Kontakte/Firmen ohne Art.-18-Einschränkung). */
  namen: Readonly<Record<string, string>>;
  /** Unterlagen der Gesellschaft in der Ablage (Titel, Name, Tag). */
  ablage: readonly AblageKurz[];
}

const name = (b: Bezug, n: Readonly<Record<string, string>>): string => n[`${b.art}:${b.id}`] ?? (b.art === 'kontakt' ? 'Kontakt (nicht im CRM bzw. eingeschränkt)' : b.art === 'firma' ? 'Firma (nicht im CRM)' : b.art === 'person' ? 'Person des Haushalts' : 'Gesellschaft');
/** Tag zur Anzeige — ein Zeitstempel zählt als Berliner Tag (`tagVon`), ein Tag bleibt, wie er ist. */
const tagAus = (x: string) => (/^\d{4}-\d{2}-\d{2}$/.test(x) ? x : tagVon(x));
const t = (tag?: string) => (tag ? tagText(tagAus(tag)) : '—');
const nachTag = <T extends { am: string }>(l: T[]) => l.sort((a, b) => a.am.localeCompare(b.am));

/** Fragen säubern (rein): Text, ohne Steuerzeichen, leere weg; zu viele/zu lange → Fehler (nie still gekürzt). */
export function fragenPruefen(roh: unknown): { fragen: string[] } | { fehler: string } {
  if (roh === undefined || roh === null) return { fragen: [] };
  if (!Array.isArray(roh)) return { fehler: 'fragen: Liste von Texten.' };
  // eslint-disable-next-line no-control-regex -- Steuerzeichen bewusst entfernen
  const l = roh.map(x => (typeof x === 'string' ? x.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim() : '')).filter(Boolean);
  if (l.length > MAPPE_GRENZEN.fragen) return { fehler: `Höchstens ${MAPPE_GRENZEN.fragen} offene Fragen.` };
  if (l.some(x => x.length > MAPPE_GRENZEN.frageZeichen)) return { fehler: `Eine Frage ist länger als ${MAPPE_GRENZEN.frageZeichen} Zeichen.` };
  return { fragen: l };
}

/** Das Thema prüfen (rein): Form und Kennungen; ob es den Eintrag gibt, prüft `mappeBauen`. */
export function themaAus(roh: unknown): MappeThema | null {
  const o = (roh && typeof roh === 'object' ? roh : {}) as Record<string, unknown>;
  const gid = typeof o.gesellschaftId === 'string' ? o.gesellschaftId : '';
  if (!gid || gid.length > 80) return null;
  if (o.art === 'gesellschaft') return { art: 'gesellschaft', gesellschaftId: gid as MappeThema['gesellschaftId'] };
  if (o.art === 'vertrag' && typeof o.vertragId === 'string' && /^vt-[a-z0-9-]{4,62}$/.test(o.vertragId)) return { art: 'vertrag', gesellschaftId: gid as MappeThema['gesellschaftId'], vertragId: o.vertragId };
  if (o.art === 'risiko' && typeof o.risikoId === 'string' && /^rk-[a-z0-9-]{4,62}$/.test(o.risikoId)) return { art: 'risiko', gesellschaftId: gid as MappeThema['gesellschaftId'], risikoId: o.risikoId };
  return null;
}

/** Die Mappe aufbauen (rein). Fehler, wenn es den Vertrag bzw. das Risiko nicht (mehr) gibt. */
export function mappeBauen(q: MappeQuellen): { dok: MappeDokument } | { fehler: string; status: 404 } {
  const { thema, g, s, lage, heute, namen } = q;
  const gName = anzeigeName(g);
  const ablage = new Map(q.ablage.map(a => [a.id, a]));
  const anlageVon = (id: string) => { const a = ablage.get(id); return a ? { dateiId: id, titel: a.titel || a.name || 'Unterlage', datum: tagAus(a.hochgeladenAm) } : null; };
  const abschnitte: MappeAbschnitt[] = [];
  const chronik: { am: string; text: string }[] = [];
  const beteiligte: string[] = [];
  const dokumente: string[] = [];
  const fristen: string[] = [];
  const schritte: string[] = [];
  const offen: string[] = [...q.fragen];
  let anlagen: string[] = [];
  let titel = '';
  const worum: string[] = [`Gesellschaft: ${gName}${g.rechtsform ? ` (${rechtsformLabel(g.rechtsform)})` : ''} · Status: ${statusLabel(g.status)}`];
  if (g.gegruendetAm) chronik.push({ am: g.gegruendetAm, text: 'Gründung' });
  if (g.eingetragenAm) chronik.push({ am: g.eingetragenAm, text: 'Eintragung ins Handelsregister' });

  if (thema.art === 'vertrag') {
    const v = aktiveEintraege(g.vertraege).find(x => x.id === thema.vertragId);
    if (!v) return { fehler: 'Diesen Vertrag gibt es nicht (mehr).', status: 404 };
    const vn = v.titel || vertragArtLabel(v.art);
    titel = `Vertrag: ${vn}`;
    worum.push(`Vertrag: ${vn} · Art: ${vertragArtLabel(v.art)} · Status: ${VERTRAG_STATUS.find(x => x.id === v.status)?.label ?? v.status}`);
    if (v.kuendigungsfrist) worum.push(`Kündigungsfrist laut Register: ${v.kuendigungsfrist}`);
    if (v.beginn) chronik.push({ am: v.beginn, text: `Vertragsbeginn: ${vn}` });
    if (v.ende) chronik.push({ am: v.ende, text: `Vertragsende: ${vn}` });
    for (const p of v.parteien) beteiligte.push(`Vertragspartei: ${name(p, namen)}`);
    beteiligte.push(`Eigene Gesellschaft: ${gName}`);
    for (const id of v.dateiIds ?? []) { const a = anlageVon(id); if (a) { dokumente.push(`${a.titel} — abgelegt ${t(a.datum)}`); chronik.push({ am: a.datum!, text: `Unterlage abgelegt: ${a.titel}` }); } }
    if (v.kuendigenBis) fristen.push(`${t(v.kuendigenBis)} — kündigen bis`);
    if (v.ende) fristen.push(`${t(v.ende)} — Vertragsende`);
    for (const f of v.fristen ?? []) fristen.push(`${t(f.datum)} — ${f.text}`);
    schritte.push(`Stand im Register: ${VERTRAG_STATUS.find(x => x.id === v.status)?.label ?? v.status}`);
    anlagen = v.dateiIds ?? [];
  } else if (thema.art === 'risiko') {
    const r = aktiveEintraege(s?.risiken).find(x => x.id === thema.risikoId);
    if (!r) return { fehler: 'Dieses Risiko gibt es nicht (mehr).', status: 404 };
    titel = `Risiko: ${r.titel}`;
    worum.push(`Risiko: ${r.titel} · Kategorie: ${RISIKO_KATEGORIEN.find(x => x.id === r.kategorie)?.label ?? r.kategorie} · Status: ${r.status}${r.behandlung ? ` · Behandlung: ${BEHANDLUNGEN.find(x => x.id === r.behandlung)?.label ?? r.behandlung}` : ''}`);
    for (const [k, v] of [['Ursache', r.ursache], ['Ereignis', r.ereignis], ['Wirkung', r.wirkungText], ['Frühwarn-Indikator', r.indikator]] as const) if (v) worum.push(`${k}: ${v}`);
    if (r.angelegt) chronik.push({ am: tagAus(r.angelegt), text: 'Risiko erfasst' });
    for (const b of r.bewertungen ?? []) {
      chronik.push({ am: tagAus(b.am), text: `Bewertung (${b.art}): Eintritt ${b.eintritt} × Wirkung ${b.wirkung}${b.grund ? ` — ${b.grund}` : ''}` });
      schritte.push(`${t(b.am)} bewertet (${b.art}): ${b.eintritt} × ${b.wirkung}`);
    }
    for (const m of r.massnahmen ?? []) {
      (m.erledigt ? schritte : fristen).push(m.erledigt ? `Maßnahme erledigt: ${m.text}` : `${m.frist ? t(m.frist) : 'ohne Frist'} — Maßnahme: ${m.text}`);
    }
    if (r.rolle) beteiligte.push(`Verantwortlich (Rolle): ${ROLLEN.find(x => x.id === r.rolle)?.label ?? r.rolle}`);
    if (r.verantwortlich) beteiligte.push(`Verantwortlich: ${name({ art: 'person', id: r.verantwortlich }, namen)}`);
    const zeile = lage?.risiken.find(z => z.r.id === r.id);
    if (zeile?.naechste) fristen.push(`${t(zeile.naechste)} — nächste Prüfung`);
    if (zeile?.ohneMassnahme) offen.push('Für dieses Risiko ist keine offene Maßnahme hinterlegt — welche Maßnahme ist angemessen?');
    const policen = aktiveEintraege(s?.versicherungen).filter(p => (r.versicherungIds ?? []).includes(p.id));
    for (const p of policen) {
      dokumente.push(`Versicherung: ${VERSICHERUNG_ARTEN.find(x => x.id === p.art)?.label ?? p.art}${p.ablauf ? ` · Ablauf ${t(p.ablauf)}` : ''}`);
      anlagen.push(...(p.dateiIds ?? []));
    }
  } else {
    titel = `Gesellschaft: ${gName}`;
    for (const e of aktiveEintraege(s?.ereignisse)) chronik.push({ am: e.datum, text: `Ereignis: ${ereignisDef(e.art)?.label ?? e.art}` });
    for (const b of aktiveEintraege(g.beschluesse)) chronik.push({ am: b.datum, text: `${beschlussArtLabel(b.art)}: ${b.titel} (${b.status})` });
    for (const v of aktiveEintraege(g.vertraege).filter(x => x.status !== 'beendet')) if (v.beginn) chronik.push({ am: v.beginn, text: `Vertragsbeginn: ${v.titel || vertragArtLabel(v.art)}` });
    for (const o of aktiveEintraege(g.organe).filter(x => !x.bis || x.bis > heute)) beteiligte.push(`${organLabel(o.funktion)}: ${name(o.wer, namen)}${o.seit ? ` (seit ${t(o.seit)})` : ''}`);
    for (const z of anteile(g).zeilen) beteiligte.push(`Gesellschafter: ${name(z.g.wer, namen)}${z.prozent ? ` — ${z.prozent.toLocaleString('de-DE')} %` : ''}`);
    for (const d of lage?.dokumente ?? []) {
      if (!d.katalog.soll && !d.dok) continue;
      dokumente.push(`${d.katalog.titel}: ${DOK_ZUSTAND_TEXT[d.zustand]}${d.dok?.fassungVom ? ` · Fassung vom ${t(d.dok.fassungVom)}` : ''}${d.dok?.gueltigBis ? ` · gültig bis ${t(d.dok.gueltigBis)}` : ''}`);
    }
    for (const d of aktiveEintraege(s?.dokumente)) if (!DOKUMENT_KATALOG.some(k => k.art === d.art)) dokumente.push(`${d.titel ?? d.art}: ${d.status}${d.fassungVom ? ` · Fassung vom ${t(d.fassungVom)}` : ''}`);
    for (const p of lage?.pflichten ?? []) {
      if (p.status === 'erledigt' && p.vermerk) { schritte.push(`${t(p.vermerk.am)} erledigt: ${p.titel} (${p.periodeLabel})`); chronik.push({ am: p.vermerk.am, text: `Pflicht erledigt: ${p.titel} (${p.periodeLabel})` }); continue; }
      if (p.status === 'nicht-zutreffend') continue;
      if (p.frist <= tagePlus(heute, 90) && p.inTagen >= -180) fristen.push(`${t(p.frist)} — ${p.titel} (${p.periodeLabel}, ${p.norm})${p.status === 'ueberfaellig' ? ' · überfällig' : ''}`);
    }
    for (const x of [...(lage?.compliance.teile.pflichten.punkte ?? []), ...(lage?.compliance.teile.dokumente.punkte ?? [])].sort((a, b) => (a.schwere === b.schwere ? 0 : a.schwere === 'rot' ? -1 : 1)).slice(0, 10)) offen.push(`Offen laut Schild: ${x.text}`);
    anlagen = [
      ...aktiveEintraege(s?.dokumente).filter(d => d.status === 'vorhanden').flatMap(d => d.dateiIds ?? []),
      ...aktiveEintraege(g.beschluesse).filter(b => b.status !== 'aufgehoben').flatMap(b => b.dateiIds ?? []),
    ];
  }

  abschnitte.push({ titel: 'Worum es geht', zeilen: worum });
  abschnitte.push({ titel: 'Sachverhalt (chronologisch)', zeilen: chronik.length ? nachTag(chronik).map(c => `${t(c.am)} — ${c.text}`) : ['Keine datierten Einträge im System.'] });
  abschnitte.push({ titel: 'Beteiligte (Rollen)', zeilen: beteiligte.length ? beteiligte : ['Keine Beteiligten im Register eingetragen.'] });
  abschnitte.push({ titel: 'Dokumente', zeilen: dokumente.length ? dokumente : ['Keine Dokumente im System.'] });
  abschnitte.push({ titel: 'Fristen', zeilen: fristen.length ? fristen : ['Keine offenen Fristen im System.'] });
  abschnitte.push({ titel: 'Bisherige Schritte', zeilen: schritte.length ? schritte : ['Noch keine Schritte vermerkt.'] });
  abschnitte.push({ titel: 'Offene Fragen', zeilen: offen.length ? offen : ['Keine Fragen eingetragen — im Gespräch klären.'] });
  const eindeutig = Array.from(new Set(anlagen)).map(anlageVon).filter((x): x is NonNullable<ReturnType<typeof anlageVon>> => !!x);
  return {
    dok: {
      titel: `Anwalts-Mappe — ${titel}`, untertitel: gName, stand: heute,
      hinweis: `${MAPPE_HINWEIS} Stand der Regeln: ${tagText(REGEL_STAND)}. ${RECHT_HINWEIS}`,
      abschnitte, anlagen: eindeutig,
    },
  };
}

/** Dateiname der Mappe (ohne Namen von Personen — nur Thema und Tag). */
export function mappeDateiname(d: Pick<MappeDokument, 'titel' | 'stand'>): string {
  const t = d.titel.replace(/^Anwalts-Mappe — /, '').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'Thema';
  return `Anwalts-Mappe-${t}-${d.stand}.pdf`;
}
