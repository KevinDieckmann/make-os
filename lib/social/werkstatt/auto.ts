// ─── MAKE OS — Social: Auto-Reel — aus Rohclips ohne Klick zum fertigen Beitrag (Server) — 28.10.2026, Malin-Paket ─────────────────────
// Kevin 28.10.: „Bau ihr das Beste, das sie maximal automatisieren kann.“ Malin legt Clips in ein Album (am Handy aufgenommen, Ton bewusst
// „an“), schaltet am Kanal „Auto-Reels“ ein — der Rest läuft im Takt:
//   1. Scan (alle 30 Min.): neue Videos im Album `plan.rohAlbum` der Business-Ablage (≤ 14 Tage alt, Ton nicht gesperrt, noch in keinem Auftrag)
//      → Werkstatt-Auftrag als die Person der Marke (sonst der Inhaber), höchstens `SCAN_MAX` je Lauf.
//   2. Untertitel (whisper.cpp, lokal) — ohne Ton/Modell übersprungen.
//   3. Schnitt: KI-Vorschlag (Hintergrund-KI, Not-Aus/Budget des Head of Marketing) wird DIREKT übernommen — ohne KI der ganze Clip (≤ 60 s).
//   4. Rendern. 5. Beitrag: im nächsten freien Termin des Redaktionsplans als ENTWURF mit dem Reel, Hook, Beschriftung; EINE Glocke.
// Rausgehen darf es erst, wenn ein Mensch das Reel in der Ablage für „Social Media“ freigibt UND den Beitrag freigibt (bzw. Stufe 2 + Format
// freigegeben). Nichts verlässt den Server ohne diese Freigabe — die Kette baut nur vor.

import { wandzeit } from '@/lib/kalender/zeit';
import { melde } from '@/lib/meldungen/melden';
import { WEG } from '@/lib/wege';
import { inhaberSpeicher } from '@/lib/zugang/haushalt-inhaber';
import { ladeSocial, socialSystemSchreiben } from '../server';
import { planLuecken, planVon } from '../plan';
import type { SocialKanal } from '../typen';
import { ladeWerkstatt, werkstattSchreiben, auftragServer, quellenLesen, werkstattBereit } from './server';
import { untertitelZeilen, gesamtDauer, type WerkstattAuftrag } from './regeln';

export const SCAN_MAX = 2;
export const ROH_TAGE = 14;
/** Ohne KI: so viel vom Anfang des Clips (ein Reel ohne Schnitt soll kurz bleiben). */
export const OHNE_KI_SEK = 60;

const personVon = async (k: SocialKanal): Promise<string | null> => (k.art === 'person' && k.person) || (k.sichtbarkeit === 'person' && k.person) || await inhaberSpeicher().catch(() => null);

/** Neue Rohclips der Kanäle mit Auto-Reel als Aufträge anlegen. */
export async function autoReelScan(jetzt = new Date()): Promise<{ neu: number }> {
  const d = await ladeSocial();
  const kanaele = d.kanaele.filter(k => !k.archiviertAm && k.status === 'aktiv' && planVon(k).autoReel && planVon(k).rohAlbum);
  if (!kanaele.length) return { neu: 0 };
  const { karteiHaushalt } = await import('@/lib/crm/sperrliste');
  const { katalogName, ladeKatalog } = await import('@/lib/medien/server');
  const kat = await ladeKatalog(katalogName('business', await karteiHaushalt()));
  const auftraege = await ladeWerkstatt();
  const benutzt = new Set(auftraege.flatMap(a => a.clips.map(c => c.mediumId)));
  const grenze = new Date(jetzt.getTime() - ROH_TAGE * 86_400_000).toISOString();
  const bereit = await werkstattBereit();
  let neu = 0;
  for (const k of kanaele) {
    const person = await personVon(k);
    if (!person) continue;
    const roh = kat.medien.filter(m => m.album === planVon(k).rohAlbum && m.art === 'video' && !m.geloeschtAm && m.ton !== 'nicht-freigegeben' && m.hochgeladen >= grenze && !benutzt.has(m.id) && !m.abgeleitetVon)
      .sort((a, b) => a.hochgeladen.localeCompare(b.hochgeladen));
    for (const m of roh) {
      if (neu >= SCAN_MAX) return { neu };
      const titel = m.name ? `Reel: ${m.name.slice(0, 80)}` : `Reel vom ${m.hochgeladen.slice(8, 10)}.${m.hochgeladen.slice(5, 7)}.`;
      const r = await werkstattSchreiben(person, { op: 'anlegen', kanalId: k.id, ziel: 'reel', format: '9:16', titel, medien: [m.id] }, jetzt);
      if (!r.ok || !r.auftrag) continue;
      benutzt.add(m.id);
      const mitUntertitel = bereit.untertitel && m.ton === 'an';
      await auftragServer(r.auftrag.id, () => ({
        auto: { schritt: mitUntertitel ? 'transkript' : 'schnitt' },
        ...(mitUntertitel ? { status: 'arbeitet' as const, arbeit: { art: 'transkript' as const, seit: jetzt.toISOString(), versuche: 0 } } : {}),
      }));
      neu++;
    }
  }
  return { neu };
}

/** Jeden Auto-Auftrag einen Schritt weiter (aufgerufen am Ende jedes Werkstatt-Laufs). */
export async function autoWeiter(jetzt = new Date()): Promise<void> {
  const liste = (await ladeWerkstatt()).filter(a => a.auto && a.auto.schritt !== 'fertig' && a.status !== 'arbeitet');
  for (const a of liste) {
    if (a.status === 'fehler') { await auftragServer(a.id, x => ({ auto: { ...x.auto!, schritt: 'fertig' } })); await glocke(a, `Auto-Reel „${a.titel}“ ist hängen geblieben — in der Werkstatt ansehen.`); continue; }
    if (a.auto!.schritt === 'transkript') { await auftragServer(a.id, x => ({ auto: { ...x.auto!, schritt: 'schnitt' } })); await schnitt({ ...a, auto: { ...a.auto!, schritt: 'schnitt' } }, jetzt); continue; }
    if (a.auto!.schritt === 'schnitt') { await schnitt(a, jetzt); continue; }
    if (a.auto!.schritt === 'render' && a.status === 'fertig' && a.ergebnis) await beitrag(a, jetzt);
  }
}

/** Schnitt: KI-Vorschlag übernehmen (Hintergrund), sonst der Anfang des Clips — dann Rendern einreihen. */
async function schnitt(a: WerkstattAuftrag, jetzt: Date): Promise<void> {
  const d = await ladeSocial();
  const k = d.kanaele.find(x => x.id === a.kanalId) ?? null;
  const quellen = await quellenLesen(a.von, a.clips.map(c => c.mediumId));
  let teil: Partial<WerkstattAuftrag> = {};
  const { laufSperre } = await import('@/lib/agenten/einstellung');
  const sperre = await laufSperre(null, 'marketing', jetzt).catch(() => ({ text: 'gesperrt' }));
  if (!sperre) {
    const { schnittVorschlagen } = await import('./vorschlag');
    const v = await schnittVorschlagen(a, quellen, k, null, a.von, 'hintergrund').catch(() => null);
    if (v?.ok) {
      teil = {
        clips: v.vorschlag.clips.map((c, i) => ({ ...c, id: `wc-auto-${i}-${a.id.slice(3, 11)}` })),
        einblendungen: v.vorschlag.einblendungen.map((e, i) => ({ ...e, id: `we-auto-${i}-${a.id.slice(3, 11)}` })),
        auto: { schritt: 'render', ...(v.vorschlag.titel ? { titel: v.vorschlag.titel } : {}), ...(v.vorschlag.beschriftung ? { beschriftung: v.vorschlag.beschriftung } : {}), ...(v.vorschlag.einblendungen[0] ? { hook: v.vorschlag.einblendungen[0].text } : {}) },
      };
    }
  }
  if (!teil.clips) {
    // Ohne KI: der Anfang des Clips, ohne Hook — die Person schreibt den Hook im Beitrag.
    teil = { clips: a.clips.map(c => ({ ...c, bis: Math.min(c.bis, c.von + OHNE_KI_SEK) })), auto: { schritt: 'render' } };
  }
  const bereit = await werkstattBereit();
  if (!bereit.rendern) { await auftragServer(a.id, () => ({ ...teil, auto: { ...teil.auto!, schritt: 'fertig' }, fehler: 'Rendern ist auf dieser Instanz aus — Auto-Reel wartet hier.' })); return; }
  await auftragServer(a.id, () => ({ ...teil, status: 'arbeitet', arbeit: { art: 'render', seit: jetzt.toISOString(), versuche: 0 } }));
}

/** Beitrag im nächsten freien Termin anlegen (Entwurf) — mit Reel, Hook, Beschriftung, Skript = Gesagtes. */
async function beitrag(a: WerkstattAuftrag, jetzt: Date): Promise<void> {
  const d = await ladeSocial();
  const k = d.kanaele.find(x => x.id === a.kanalId);
  await auftragServer(a.id, x => ({ auto: { ...x.auto!, schritt: 'fertig' } }));
  if (!k) return;
  const luecken = planLuecken(k, d.formate, d.folgen, wandzeit(jetzt).slice(0, 16));
  const video = d.formate.find(f => f.kanalId === k.id && (f.art ?? 'video') === 'video' && f.freigegebenAm) ?? d.formate.find(f => f.kanalId === k.id && (f.art ?? 'video') === 'video');
  const platz = luecken.find(l => !l.formatId || l.formatId === video?.id) ?? luecken[0];
  const gesagt = untertitelZeilen(a).map(z => z.text).join(' ').trim();
  const hook = a.auto?.hook ?? a.einblendungen.find(e => e.lage === 'oben')?.text ?? a.titel;
  const titel = a.auto?.titel ?? a.titel;
  if (!platz) { await glocke(a, `Reel „${titel}“ ist fertig — kein freier Termin im Plan, bitte im Kalender einplanen.`); return; }
  const r = await socialSystemSchreiben([{ op: 'entwurf', kanalId: k.id, platz: platz.platz, eintrag: {
    titel, skript: gesagt || `Reel (${Math.round(gesamtDauer(a.clips))} s) aus eigenem Clip.`, hooks: [{ text: hook }], cta: k.marke.cta,
    ...(a.auto?.beschriftung ? { beschriftung: a.auto.beschriftung } : {}), ...(video ? { formatId: video.id } : {}), ...(platz.saeule ? { saeule: platz.saeule } : {}),
    medien: [a.ergebnis!], kiInhalt: false, quellen: [], status: 'entwurf',
  } }], jetzt);
  const folgeId = r.ok ? r.geaendert[0] : undefined;
  if (folgeId) await auftragServer(a.id, () => ({ folgeId }));
  await glocke(a, folgeId
    ? `Auto-Reel „${titel}“ ist fertig und für ${platz.platz.slice(8, 10)}.${platz.platz.slice(5, 7)}. eingeplant — ansehen und freigeben`
    : `Reel „${titel}“ ist fertig — der Termin war inzwischen belegt, bitte im Kalender einplanen.`);
}

async function glocke(a: WerkstattAuftrag, titel: string): Promise<void> {
  await melde({ an: a.von, art: 'medien', titel, link: WEG.marketing('social'), von: 'zoe' }).catch(() => {});
}

