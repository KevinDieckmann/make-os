// ─── Prozesse · „Head fragen“ — der Server-Teil (22.10.; VORLAGEN_KUNDENGEWINNUNG.md 7, ANALYSE_100.md Punkte 52, 99) ──────────────────────────────────────
// Ein Head schlägt einen ganzen Prozess-Entwurf bzw. Bausteine für den offenen Prozess vor — IMMER als Vorschlag im ZOE-Stapel (Stapel-Art `prozess-entwurf`,
// Bezug `{ art: 'prozess-entwurf', id: <prozess> | 'neu' }`), nur die anfragende Person entscheidet. Übernommen wird per Klick über `werkstattAnwenden` (dieselben
// Prüfungen wie in der Werkstatt) — nie überschrieben: ein Entwurf wird ein NEUER Prozess, Bausteine kommen nur dazu (auf den aktuellen Stand des Entwurfs).
// Modell: nur über `askText` mit `ki: { lauf, person, kategorien: ['allgemein'] }` — im Prompt steht nur Struktur (lib/prozesse/kundengewinnung/head.ts), nie
// Kontaktdaten; Stufe des Heads („ausgewogen“, lib/ki/modelle.ts `STUFE_JE_ROLLE.head`); die Route prüft vorher `modellSchranke` und zeigt die Schätzung vor dem
// Klick. Ohne KI, ohne Guthaben, gesperrt oder unbrauchbare Antwort → der Vorschlag des Regelwerks (aus der passenden Vorlage) — mit Satz, warum.
// Nur Server (Stapel, Bestände, Modell) — die Oberfläche liest über /api/prozesse/head.

import type { StapelArtFreigabe, ArtErgebnis } from '@/lib/zoe/stapel-arten';
import type { Vorschlag } from '@/lib/zoe/stapel';
import type { KiKontext } from '@/lib/anthropic';
import type { ProzessDefinition, ProzessEintrag, ProzessForm, ProzessKnoten } from '../definition';
import type { ProzessRechte } from '../rollen';
import { headBausteineAus, headDiff, headProzessAus, headPrompt, headSchema, headZusammenfassung, regelwerkVorschlag, bausteineEinfuegen, HEAD_SYSTEM, type HeadAnfrage, type HeadDiff, type HeadVorschlag } from './head';

type K = ProzessKnoten<ProzessForm>;
type Fehler = { ok: false; status: 400 | 403 | 404 | 409 | 413; fehler: string };
const nein = (status: Fehler['status'], fehler: string): Fehler => ({ ok: false, status, fehler });

/** Werkzeug-Name der Head-Vorschläge im Stapel (kein ZOE-Werkzeug — Vorschläge mit Bezug laufen nie über `fuehreAus`). */
export const HEAD_WERKZEUG = 'prozess_head';
export const HEAD_STAPEL_ART = 'prozess-entwurf' as const;

/** Ist die KI für „Head fragen“ da — und was kostet ein Vorschlag ungefähr? (vor dem Klick) */
export async function headStand(): Promise<{ ki: boolean; grund?: 'schluessel' | 'guthaben'; modell: string; kosten: { cent: number; text: string } }> {
  const [{ hasAnthropicKey, guthabenLeer }, { MODEL_BY_TIER, modellStufenLaden }, { kostenSchaetzen }, { STUFE_JE_ROLLE }] = await Promise.all([
    import('@/lib/anthropic'), import('@/lib/agent-config'), import('@/lib/agenten/leistung'), import('@/lib/ki/modelle'),
  ]);
  await modellStufenLaden();
  const k = kostenSchaetzen({ stufe: STUFE_JE_ROLLE.head, art: 'lauf' });
  const modell = MODEL_BY_TIER[STUFE_JE_ROLLE.head];
  if (!hasAnthropicKey()) return { ki: false, grund: 'schluessel', modell, kosten: { cent: 0, text: 'ohne KI: kostenlos (Regelwerk)' } };
  if (guthabenLeer()) return { ki: false, grund: 'guthaben', modell, kosten: { cent: 0, text: 'ohne KI: kostenlos (Regelwerk)' } };
  return { ki: true, modell, kosten: { cent: k.cent, text: k.text } };
}

/** Rechte einer Person ohne Anfrage (Freigabe aus dem Stapel) — dieselbe Regel wie das Tor der Routen (lib/prozesse/zugang.ts). */
async function rechteFuer(person: string): Promise<ProzessRechte> {
  const [{ kontoSicht }, { istInhaber }, { prozessRechte }] = await Promise.all([import('@/lib/zugang/konto-sicht-server'), import('@/lib/zugang/haushalt-inhaber'), import('../rollen')]);
  const k = await kontoSicht(person);
  return prozessRechte({ imHaushalt: !!k?.imHaushalt, vollesMitglied: !!k?.vollesMitglied, inhaber: await istInhaber(person), nurBusiness: !!k?.nurBusiness, dienst: false });
}

/** Den Vorschlag bauen: KI (wenn gewünscht und da), sonst bzw. bei unbrauchbarer Antwort das Regelwerk. Rein bis auf den Modellaufruf. */
export async function headVorschlagBauen(a: HeadAnfrage, o: { ki: KiKontext | null; offen?: ProzessDefinition | null }): Promise<{ ok: true; vorschlag: HeadVorschlag; kostenCent?: number } | Fehler> {
  const hinweise: string[] = [];
  if (o.ki) {
    const [{ askText, extractJson, kiSperrText }, { MODEL_BY_TIER, modellStufenLaden }, { STUFE_JE_ROLLE }] = await Promise.all([import('@/lib/anthropic'), import('@/lib/agent-config'), import('@/lib/ki/modelle')]);
    await modellStufenLaden();
    const p = headPrompt(a, o.offen);
    const r = await askText({
      system: p.system, systemStabil: HEAD_SYSTEM, cacheSystem: true, user: p.user, schema: headSchema(a.art), maxTokens: 4000, timeoutMs: 90_000, retries: 1,
      model: MODEL_BY_TIER[STUFE_JE_ROLLE.head], zweck: 'prozess-head', ki: o.ki,
    }).catch(() => null);
    if (r?.ok) {
      const json = extractJson<unknown>(r.text);
      if (a.art === 'prozess') {
        const b = headProzessAus(json, a);
        if (b.ok) return { ok: true, vorschlag: { art: 'prozess', quelle: 'ki', definition: b.definition, hinweise: b.hinweise } };
        hinweise.push(`Der Entwurf des Heads war nicht speicherbar (${b.grund}) — Vorschlag aus dem Regelwerk.`);
      } else if (o.offen && a.prozessId) {
        const b = headBausteineAus(json, o.offen, a.phaseId);
        if (b.ok) return { ok: true, vorschlag: { art: 'baustein', quelle: 'ki', prozessId: a.prozessId, phaseId: b.vorschlag.phaseId, knoten: b.vorschlag.knoten, hinweise: b.vorschlag.hinweise } };
        hinweise.push(`Der Vorschlag des Heads war nicht brauchbar (${b.grund}) — Vorschlag aus dem Regelwerk.`);
      }
    } else hinweise.push(r?.error?.startsWith('ki-gesperrt') ? `${kiSperrText(r)} — Vorschlag aus dem Regelwerk.` : 'Die KI hat gerade nicht geantwortet — Vorschlag aus dem Regelwerk.');
  }
  const rw = regelwerkVorschlag(a, o.offen);
  if (!rw) return nein(409, a.art === 'baustein' ? 'Der Head hat für diesen Prozess gerade nichts vorzuschlagen — es fehlt nichts aus der passenden Vorlage.' : 'Keine passende Vorlage gefunden.');
  return { ok: true, vorschlag: { ...rw, hinweise: [...hinweise, ...rw.hinweise] } };
}

/** „Head fragen“: Vorschlag bauen und in den Stapel legen (nur für die anfragende Person). Nichts am Prozess ändert sich. */
export async function headFragen(a: HeadAnfrage, o: { person: string; haushalt: string; ki: KiKontext | null }): Promise<{ ok: true; vorschlag: Vorschlag; diff: HeadDiff; quelle: 'ki' | 'regelwerk' } | Fehler> {
  const { prozesseLesen } = await import('../werkstatt-server');
  let offen: ProzessEintrag | undefined;
  if (a.art === 'baustein') {
    offen = (await prozesseLesen(o.haushalt)).prozesse.find(p => p.id === a.prozessId);
    if (!offen) return nein(404, 'Diesen Prozess gibt es nicht (mehr).');
    if (offen.status === 'archiviert') return nein(409, 'Ein archivierter Prozess wird nicht geändert — erst zurückholen.');
    if (a.phaseId && !offen.entwurf.knoten.some(k => k.id === a.phaseId)) return nein(409, 'Diese Phase gibt es im Entwurf nicht (mehr).');
  }
  const b = await headVorschlagBauen(offen ? { ...a, bereich: offen.entwurf.bereich ?? a.bereich, fallArt: offen.entwurf.fallArt ?? a.fallArt } : a, { ki: o.ki, offen: offen?.entwurf ?? null });
  if (!b.ok) return b;
  const v = b.vorschlag;
  const diff = headDiff(v, offen?.entwurf ?? null);
  const { lege } = await import('@/lib/zoe/stapel');
  const titel = v.art === 'prozess' ? `Head: Prozess-Entwurf „${v.definition.titel}“` : `Head: ${v.knoten.length} Schritt${v.knoten.length === 1 ? '' : 'e'} für „${offen!.entwurf.titel}“`;
  const gelegt = await lege({
    werkzeug: HEAD_WERKZEUG, gruppe: 'business', titel: titel.slice(0, 200), nachher: headZusammenfassung(v, diff),
    eingabe: { _vorschlag: v as unknown as Record<string, unknown>, ...(v.art === 'baustein' ? { _prozess: v.prozessId } : {}) },
    person: o.person, quelle: 'gespraech', anlass: a.ziel ? `Du hast gefragt: ${a.ziel.slice(0, 300)}` : 'Head fragen in der Werkstatt',
    bezug: { art: HEAD_STAPEL_ART, id: v.art === 'baustein' ? v.prozessId : 'neu' },
  });
  return { ok: true, vorschlag: gelegt, diff, quelle: v.quelle };
}

/** Den gespeicherten Vorschlag lesen (Server-geschrieben, trotzdem gesäubert: Knoten über den Säuberer des Bestands). */
async function vorschlagAus(v: Vorschlag): Promise<HeadVorschlag | null> {
  const roh = v.eingabe._vorschlag as Record<string, unknown> | undefined;
  if (!roh || typeof roh !== 'object') return null;
  const { definitionAus, knotenAus } = await import('../bestand');
  const hinweise = Array.isArray(roh.hinweise) ? (roh.hinweise as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, 30) : [];
  const quelle = roh.quelle === 'ki' ? 'ki' : 'regelwerk';
  const vorlage = typeof roh.vorlage === 'string' ? roh.vorlage : undefined;
  if (roh.art === 'prozess') {
    const d = definitionAus(roh.definition as Record<string, unknown>);
    return d ? { art: 'prozess', quelle, ...(vorlage ? { vorlage } : {}), definition: d, hinweise } : null;
  }
  if (roh.art === 'baustein' && typeof roh.prozessId === 'string' && typeof roh.phaseId === 'string' && Array.isArray(roh.knoten)) {
    const knoten = (roh.knoten as unknown[]).map(k => (k && typeof k === 'object' ? knotenAus(k as Record<string, unknown>) : null));
    if (knoten.some(k => !k)) return null;
    return { art: 'baustein', quelle, ...(vorlage ? { vorlage } : {}), prozessId: roh.prozessId, phaseId: roh.phaseId, knoten: knoten as K[], hinweise };
  }
  return null;
}

/** Offene Vorschläge des Heads für eine Person (je Prozess bzw. „neu“) mit dem Unterschied zum AKTUELLEN Entwurf. */
export async function headVorschlaege(person: string, haushalt: string, prozessId?: string): Promise<{ id: string; titel: string; art: 'prozess' | 'baustein'; quelle: 'ki' | 'regelwerk'; zeit: string; diff: HeadDiff; hinweise: string[] }[]> {
  const [{ lies }, { prozesseLesen }] = await Promise.all([import('@/lib/zoe/stapel'), import('../werkstatt-server')]);
  const ziel = prozessId ?? 'neu';
  const offen = (await lies('offen')).filter(v => v.bezug?.art === HEAD_STAPEL_ART && v.person === person && v.bezug.id === ziel);
  if (!offen.length) return [];
  const d = await prozesseLesen(haushalt);
  const raus = [];
  for (const v of offen) {
    const hv = await vorschlagAus(v);
    if (!hv) continue;
    const e = hv.art === 'baustein' ? d.prozesse.find(p => p.id === hv.prozessId) : undefined;
    raus.push({ id: v.id, titel: v.titel, art: hv.art, quelle: hv.quelle, zeit: v.zeit, diff: headDiff(hv, e?.entwurf ?? null), hinweise: hv.hinweise });
  }
  return raus;
}

/** Übernehmen (rein bis aufs Lesen): EINE Sperre, nur über `werkstattAnwenden`. Ergebnis: die Kennung des Prozesses. */
async function uebernehmen(hv: HeadVorschlag, person: string, rechte: ProzessRechte): Promise<{ ok: true; prozessId: string; text: string } | Fehler> {
  const [{ prozesseAendern, prozesseHaushalt, prozesseLesen, pruefKontextFuer, standVon }, { werkstattAnwenden }, { neueKennung }, { mitNeuenKennungen, prozessAusVorlage }] = await Promise.all([
    import('../werkstatt-server'), import('../bestand'), import('@/lib/kennung'), import('./uebernehmen'),
  ]);
  const h = await prozesseHaushalt();
  const pruef = await pruefKontextFuer(h, person, await prozesseLesen(h));
  const jetzt = new Date().toISOString();
  const kx = { person, jetzt, rechte, standVon, neueKennung: (p: 'pz' | 'fk') => neueKennung(p), pruef };
  let raus: { ok: true; prozessId: string; text: string } | Fehler = nein(409, 'Nichts übernommen.');
  const wer = { art: 'person' as const, person };
  type Mut = Parameters<typeof prozesseAendern>[0];
  const mut: Mut = datei => {
    if (hv.art === 'prozess') {
      const d = hv.definition;
      const r1 = werkstattAnwenden(datei, { aktion: 'anlegen', titel: d.titel, bereich: d.bereich ?? 'sales', fallArt: d.fallArt ?? 'keiner', ...(d.beschreibung ? { beschreibung: d.beschreibung } : {}) }, kx);
      if (!r1.ok) { raus = nein(r1.status, r1.fehler); return { ok: false }; }
      const neu = mitNeuenKennungen(d, { id: r1.eintrag.id, neu: () => neueKennung('fk'), teil: {}, uebergabe: z => prozessAusVorlage(datei, z)?.id ?? null, person, jetzt, vorlage: hv.vorlage ?? 'head' });
      const r2 = werkstattAnwenden(r1.datei, { aktion: 'entwurf', id: r1.eintrag.id, stand: standVon(r1.eintrag), knoten: neu.definition.knoten, zettel: neu.definition.zettel ?? null }, kx);
      if (!r2.ok) { raus = nein(r2.status, `${r2.fehler} Nichts übernommen.`); return { ok: false }; }
      const felder: Record<string, unknown> = {};
      if (d.startKriterium) felder.startKriterium = d.startKriterium;
      if (d.endKriterium) felder.endKriterium = d.endKriterium;
      const r3 = Object.keys(felder).length ? werkstattAnwenden(r2.datei, { aktion: 'steckbrief', id: r1.eintrag.id, stand: standVon(r2.eintrag), felder }, kx) : r2;
      if (!r3.ok) { raus = nein(r3.status, `${r3.fehler} Nichts übernommen.`); return { ok: false }; }
      // Herkunft: ein Entwurf des Heads (bzw. des Regelwerks aus einer Vorlage) — nie „Muster“ (sonst zählte er in der Galerie als übernommen).
      const herkunft = { art: 'hand' as const, quelleIds: [hv.vorlage ?? 'head'], am: jetzt };
      const fertig = { ...r3.datei, prozesse: r3.datei.prozesse.map(p => (p.id === r1.eintrag.id ? { ...p, entwurf: { ...p.entwurf, herkunft } } : p)) };
      raus = { ok: true, prozessId: r1.eintrag.id, text: `Neuer Prozess „${d.titel}“ als Entwurf angelegt — in der Werkstatt prüfen, dann veröffentlichen.` };
      return { ok: true, datei: fertig };
    }
    const alt = datei.prozesse.find(p => p.id === hv.prozessId);
    if (!alt) { raus = nein(404, 'Diesen Prozess gibt es nicht (mehr). Nichts übernommen.'); return { ok: false }; }
    if (alt.status === 'archiviert') { raus = nein(409, 'Ein archivierter Prozess wird nicht geändert — erst zurückholen. Nichts übernommen.'); return { ok: false }; }
    // Auf den AKTUELLEN Entwurf (nie der Stand von damals): bestehende Schritte bleiben, die neuen kommen dazu.
    const ins = bausteineEinfuegen(alt.entwurf, hv, () => neueKennung('fk'));
    if (!ins.ok) { raus = nein(409, ins.grund); return { ok: false }; }
    const r = werkstattAnwenden(datei, { aktion: 'entwurf', id: alt.id, stand: standVon(alt), knoten: ins.knoten }, kx);
    if (!r.ok) { raus = nein(r.status, `${r.fehler} Nichts übernommen.`); return { ok: false }; }
    raus = { ok: true, prozessId: alt.id, text: `${hv.knoten.length} Schritt${hv.knoten.length === 1 ? '' : 'e'} ${ins.wo} übernommen — bestehende Schritte unverändert.` };
    return { ok: true, datei: r.datei };
  };
  await prozesseAendern(mut, wer, h);
  return raus;
}

/** Die Stapel-Art `prozess-entwurf`: nur die anfragende Person, nur aus der eigenen Sitzung, nur mit dem Recht „Entwürfe bauen“. */
export const PROZESS_ENTWURF_STAPEL_ART: StapelArtFreigabe = {
  freigeben: async (vIn, person, opt): Promise<ArtErgebnis> => {
    const [{ personImHaushaltDesInhabers }, { beanspruche, loslassen, entscheide }] = await Promise.all([import('@/lib/zugang/haushalt-inhaber'), import('@/lib/zoe/stapel')]);
    if (!person || !(await personImHaushaltDesInhabers(person))) return nein(403, 'Nur im Haushalt des Inhabers.');
    // Prozesse ändert nur eine angemeldete Person — der Dienstweg (ZOE, Takt, Skripte) übernimmt nie einen Entwurf.
    if (!opt.sitzung) return nein(403, 'Prozesse ändert nur eine angemeldete Person.');
    const a = await beanspruche(vIn.id, person, v => {
      if (v.bezug?.art !== HEAD_STAPEL_ART) return { status: 404, fehler: 'Vorschlag nicht gefunden.' };
      if (v.person !== person) return { status: 403, fehler: 'Nur wer den Head gefragt hat, übernimmt seinen Vorschlag.' };
      return null;
    });
    if (!a.ok) return nein(a.status, a.fehler);
    try {
      const rechte = await rechteFuer(person);
      if (!rechte.entwurf) { await loslassen(a.v.id); return nein(403, 'Prozesse bauen nur Personen im Haushalt.'); }
      const hv = await vorschlagAus(a.v);
      if (!hv) { await loslassen(a.v.id); return nein(409, 'Der Vorschlag ist nicht mehr lesbar — bitte ablehnen und neu fragen.'); }
      const r = await uebernehmen(hv, person, rechte);
      if (!r.ok) { await loslassen(a.v.id); return r; }
      await entscheide(a.v.id, 'freigegeben', { ergebnis: r.text, eingabe: { ...a.v.eingabe, _angelegt: r.prozessId }, von: person, ausArbeit: true });
      return { ok: true, text: r.text };
    } catch (e) {
      await loslassen(a.v.id);
      throw e;
    }
  },
};
