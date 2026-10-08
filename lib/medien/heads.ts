// ─── Medien ↔ Heads — Schnittstelle für Paket 1 (Kern) und Stapel-Art `medien` (09.10., Paket 5) ─────────────────────────────
// Kevin 09.10.: „Heads sehen nur Medien, die ausdrücklich ‚an Head gegeben‘ sind (mit Auftrag), nur Business“ · „Heads dürfen (Vorschlag):
// beste Bilder auswählen + begründen · Zuschnitte vorschlagen (Browser schneidet nach Klick) · Alt-Text, Bildunterschrift, Post-Entwurf.“
//   medienFuerHead(person, headId, auftragId)   die EINE Lesefunktion: nur diese Medien, Vorschaubild ≤ 1568 px auf Abruf (nie Originale);
//                                               `mitPersonen` sagt dem KI-Tor (Paket 1/6a), ob der Schalter „Bilder mit Personen an KI“ greift
//   medienVorschlagAblegen(…)                   ein Head legt einen Vorschlag ab — NUR über den Stapel (Art `medien`), geprüft gegen dieselbe
//                                               Sicht; nichts ändert sich ohne Klick eines Menschen (Regel 3)
//   MEDIEN_STAPEL_ART.freigeben                 Klick: Texte (Herkunft „ki“) und Zuschnitt-Rechtecke ans Medium; zuschneiden tut danach der
//                                               Browser (neues Medium „abgeleitet von“, das Original bleibt)
// Die KI-Aufrufe selbst baut Paket 1/6a — hier nichts mit Modellen.

import { medienBestand, GRENZEN, HEAD_AUFTRAEGE, type MediumFuerHead, type Zuschnitt, type HeadAuftragArt } from './typen';
import { medienFuerHeadRein, rechteckOk, text, type Fehler } from './regeln';
import { betrachterFuer, ladeKatalog, lageFuer, katalogAendern } from './server';
import { variantenBytes } from './upload-server';

/**
 * Die Medien eines Head-Auftrags — für die AUSLÖSENDE Person (sie muss im Haushalt sein; Regel 5: nie ein Rückfall). Nur Business, nur mit
 * genau diesem Auftrag, nichts Gesperrtes, keine Minderjährigen, kein Video mit nicht freigegebenem Ton. Leere Liste, wenn nichts passt.
 */
export async function medienFuerHead(person: string, headId: string, auftragId: string): Promise<MediumFuerHead[]> {
  const b = await betrachterFuer(person);
  if (!b) return [];
  const business = await ladeKatalog(medienBestand(b.haushalt));
  const lage = await lageFuer(business);
  return medienFuerHeadRein(business, headId, auftragId, lage).map(({ medium: m, zugang, mitPersonen }) => {
    const album = m.album ? business.alben.find(a => a.id === m.album) : undefined;
    const variante = m.varianten.ansicht ? 'ansicht' : m.varianten.poster ? 'poster' : 'raster';
    return {
      id: m.id, art: m.art, typ: m.typ, ...(m.name ? { name: m.name } : {}), ...(m.aufgenommen ? { aufgenommen: m.aufgenommen } : {}),
      ...(album ? { albumTitel: album.titel } : {}), auftrag: zugang.auftrag, ...(zugang.notiz ? { notiz: zugang.notiz } : {}), mitPersonen,
      freigabe: m.marketing.status, ...(m.marketing.kanaele ? { kanaele: m.marketing.kanaele } : {}), ...(m.texte ? { texte: m.texte } : {}),
      vorschauLaden: async () => {
        const v = m.varianten[variante];
        const bytes = await variantenBytes(m, variante, v).catch(() => null);
        return bytes && v ? { bytes, typ: v.typ } : null;
      },
    };
  });
}

/** Was ein Head vorschlagen kann (je Medium). */
export interface MedienVorschlagEingabe {
  person: string;
  headId: string;
  auftragId: string;
  titel: string;
  begruendung?: string;
  /** Beste Auswahl mit Begründung. */
  auswahl?: { mediumId: string; begruendung: string }[];
  zuschnitte?: { mediumId: string; format: string; rechteck: Zuschnitt['rechteck']; begruendung?: string }[];
  texte?: { mediumId: string; alt?: string; bildunterschrift?: string; post?: string }[];
}

export const MEDIEN_WERKZEUG = 'medien_vorschlag';
export const MEDIEN_GRUPPE = 'medien';

/** Einen Vorschlag in den Stapel legen (Art `medien`, Bezug = Auftrag). Prüft: nur Medien dieses Auftrags, nur passende Aufträge. */
export async function medienVorschlagAblegen(e: MedienVorschlagEingabe): Promise<{ ok: true; vorschlagId: string } | Fehler> {
  const erlaubt = await medienFuerHead(e.person, e.headId, e.auftragId);
  if (!erlaubt.length) return { ok: false, status: 404, fehler: 'Unter diesem Auftrag gibt es keine Medien.' };
  const nach = new Map(erlaubt.map(m => [m.id, m]));
  const darf = (id: string, a: HeadAuftragArt) => !!nach.get(id)?.auftrag.includes(a);
  const titel = text(e.titel, 160);
  if (!titel) return { ok: false, status: 400, fehler: 'Titel fehlt.' };
  const auswahl = (e.auswahl ?? []).filter(x => darf(x.mediumId, 'auswahl')).map(x => ({ mediumId: x.mediumId, begruendung: text(x.begruendung, GRENZEN.grund) || '' }));
  const zuschnitte = (e.zuschnitte ?? []).filter(x => darf(x.mediumId, 'zuschnitt') && nach.get(x.mediumId)?.art === 'bild' && rechteckOk(x.rechteck))
    .map(x => ({ mediumId: x.mediumId, format: (text(x.format, 20) || 'frei'), rechteck: x.rechteck, ...(text(x.begruendung, GRENZEN.grund) ? { begruendung: text(x.begruendung, GRENZEN.grund)! } : {}) }));
  const texte = (e.texte ?? []).filter(x => darf(x.mediumId, 'text')).map(x => ({
    mediumId: x.mediumId, ...(text(x.alt, GRENZEN.altText) ? { alt: text(x.alt, GRENZEN.altText)! } : {}),
    ...(text(x.bildunterschrift, GRENZEN.bildunterschrift) ? { bildunterschrift: text(x.bildunterschrift, GRENZEN.bildunterschrift)! } : {}),
    ...(text(x.post, GRENZEN.post) ? { post: text(x.post, GRENZEN.post)! } : {}),
  }));
  if (!auswahl.length && !zuschnitte.length && !texte.length) return { ok: false, status: 400, fehler: 'Der Vorschlag enthält nichts, was der Auftrag erlaubt.' };
  if (auswahl.length + zuschnitte.length + texte.length > GRENZEN.ops) return { ok: false, status: 413, fehler: `Höchstens ${GRENZEN.ops} Punkte je Vorschlag.` };
  const { lege } = await import('@/lib/zoe/stapel');
  const v = await lege({
    werkzeug: MEDIEN_WERKZEUG, gruppe: MEDIEN_GRUPPE, titel,
    nachher: [auswahl.length && `${auswahl.length} ausgewählt`, zuschnitte.length && `${zuschnitte.length} Zuschnitt(e)`, texte.length && `${texte.length} Text(e)`].filter(Boolean).join(' · '),
    eingabe: { head: e.headId, auftragId: e.auftragId, auswahl, zuschnitte, texte, ...(e.begruendung ? { begruendung: text(e.begruendung, GRENZEN.notiz) || '' } : {}) },
    person: e.person, quelle: 'lauf', bezug: { art: 'medien', id: e.auftragId },
  });
  return { ok: true, vorschlagId: v.id };
}

type Eingabe = { head?: unknown; auftragId?: unknown; auswahl?: unknown; zuschnitte?: unknown; texte?: unknown; begruendung?: unknown };

/** Freigabe der Stapel-Art `medien` (lib/zoe/stapel-arten.ts). Erneut gegen die Sicht geprüft — ein inzwischen gesperrtes Medium fällt heraus. */
export const MEDIEN_STAPEL_ART: import('@/lib/zoe/stapel-arten').StapelArtFreigabe = {
  freigeben: async (vIn, person) => {
    const { beanspruche, entscheide, loslassen } = await import('@/lib/zoe/stapel');
    const b = await betrachterFuer(person);
    if (!b) return { ok: false, status: 403, fehler: 'Nur im Haushalt des Inhabers.' };
    const a = await beanspruche(vIn.id, person, v => {
      if (v.bezug?.art !== 'medien' || v.werkzeug !== MEDIEN_WERKZEUG) return { status: 404, fehler: 'Vorschlag nicht gefunden.' };
      if (v.person && v.person !== person) return { status: 403, fehler: 'Nur die Person, für die der Head ihn vorbereitet hat, gibt ihn frei.' };
      return null;
    });
    if (!a.ok) return { ok: false, status: a.status, fehler: a.fehler };
    const v = a.v;
    const e = v.eingabe as Eingabe;
    const head = String(e.head ?? ''), auftragId = String(e.auftragId ?? '');
    try {
      const erlaubt = new Map((await medienFuerHead(person, head, auftragId)).map(m => [m.id, m]));
      const jetzt = new Date().toISOString();
      const zuschnitte = (Array.isArray(e.zuschnitte) ? e.zuschnitte : []) as { mediumId: string; format: string; rechteck: Zuschnitt['rechteck']; begruendung?: string }[];
      const texte = (Array.isArray(e.texte) ? e.texte : []) as { mediumId: string; alt?: string; bildunterschrift?: string; post?: string }[];
      const auswahl = (Array.isArray(e.auswahl) ? e.auswahl : []) as { mediumId: string; begruendung: string }[];
      let n = 0;
      const r = await katalogAendern(medienBestand(b.haushalt), kat => {
        const medien = kat.medien.map(m => {
          if (!erlaubt.has(m.id)) return m;
          const z = zuschnitte.filter(x => x.mediumId === m.id && rechteckOk(x.rechteck) && erlaubt.get(m.id)!.auftrag.includes('zuschnitt'));
          const t = texte.find(x => x.mediumId === m.id && erlaubt.get(m.id)!.auftrag.includes('text'));
          const w = auswahl.find(x => x.mediumId === m.id && erlaubt.get(m.id)!.auftrag.includes('auswahl'));
          if (!z.length && !t && !w) return m;
          n++;
          const vorschlaege = [...(m.vorschlaege ?? []).filter(x => x.vorschlagId !== v.id), {
            vorschlagId: v.id, head, auftragId, ...(w?.begruendung ? { begruendung: w.begruendung } : {}),
            zuschnitte: z.map(x => ({ format: x.format, rechteck: x.rechteck, ...(x.begruendung ? { begruendung: x.begruendung } : {}) })), freigegebenVon: person, am: jetzt,
          }];
          return {
            ...m, vorschlaege,
            ...(t ? { texte: { ...(t.alt ? { alt: t.alt } : {}), ...(t.bildunterschrift ? { bildunterschrift: t.bildunterschrift } : {}), ...(t.post ? { post: t.post } : {}), herkunft: 'ki' as const, head, am: jetzt, von: person } } : {}),
            geaendert: jetzt, geaendertVon: person,
          };
        });
        return { ok: true as const, katalog: { ...kat, medien } };
      });
      if (!r.ok) { await loslassen(v.id); return { ok: false, status: r.status, fehler: r.fehler }; }
      const text2 = n ? `${n} ${n === 1 ? 'Medium' : 'Medien'} übernommen — Zuschnitte führt ein Klick am Medium aus.` : 'Nichts mehr übernehmbar (Medien inzwischen gesperrt oder entzogen).';
      await entscheide(v.id, 'freigegeben', { ergebnis: text2, von: person, ausArbeit: true });
      return { ok: true, text: text2 };
    } catch (err) { await loslassen(v.id); throw err; }
  },
};

export { HEAD_AUFTRAEGE };
