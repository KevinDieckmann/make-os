// ─── MAKE OS — Unternehmen › Schild (/os/unternehmen, 10.10.) ───────────────────────────────────────────────────────
// Kevin 10.10.: „Welche Infos muss ich immer dokumentiert bei mir haben — rechtlich wie ein Schild aufstellen, das Risiko immer wieder
// mitbewerten.“ Pflichtdokumente, Pflichten-Kalender, Risiko-Register, Marken/Domains/Versicherungen, Entwürfe aus Vorlagen — je
// BUSINESS-Gesellschaft (eigener Business-Bestand `unternehmen-schild--<haushalt>`, nie gemischt mit Privat).
//
// GET                                   → { heute, eintraege: [{ id, stand, …Eintrag }] } — nur Business-Gesellschaften des Registers
// GET  ?lage=1                          → kompakte Lage (Ampel je Gesellschaft, „was fehlt“ mit Weg) — dieselbe Rechnung wie die Oberfläche
// GET  ?verlauf=1                       → Gesundheits-Verlauf (11.10.): je Tag Ton + vier Dimensionen der heutigen Business-Gesellschaften (nur Zahlen)
// PATCH { id, stand, profil }                              → Profil (Beschäftigte, Umsatz, Größenklasse …)
// PATCH { id, stand, liste, eintrag, eintragId? }          → Dokument · Ereignis · Risiko · Marke · Domain · Versicherung · Entwurf
//        (Ereignis neu: optional `ausBeschluss: 'bs-…'` — Ereignis-Assistent, 11.10.; nur ein Beschluss dieser Gesellschaft, sonst 404)
// PATCH { id, stand, liste, eintragId, aktion }            → loeschen (Papierkorb 30 Tage) · wiederherstellen · endgueltig
// PATCH { id, stand, vermerk: { regelId, periode, status } }→ Pflicht „erledigt am“ / „trifft nicht zu“ (status null = Vermerk weg)
// PATCH { id, stand, bewertung: { risikoId, eintritt, wirkung, art } } → neue Bewertung ANHÄNGEN (Verlauf, nie überschrieben)
// PATCH { id, stand, katalog: ['R1', …] }                  → Startkatalog-Risiken übernehmen (ohne Doppelte)
// PATCH { id, stand, vorlage: '<vorlage>' }                → Entwurf aus einer Vorlage (gefüllt aus dem Register) — verlässt nichts das System
// Zugang wie das Register: NUR der Haushalt des Inhabers mit Person am Konto (Testkunde, fremder Haushalt, Konto mit Finanzrecht „nur
// Business“ ohne Haushaltszugang, Dienstweg ohne Person → 403). Eine Privat-Einheit → 400 (gehört zu Privat). Schreibstelle:
// lib/gesellschaften/schild-server.ts. Hinweis, keine Rechtsberatung.

import { NextResponse } from 'next/server';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { bauPruefen } from '@/lib/bau/pruefen';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { haushaltVon } from '@/lib/finanzen/haushalt/zugriff';
import { ladeKonten } from '@/lib/zugang/konten';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { leseZugriff } from '@/lib/store/leseprotokoll';
import { neueKennung } from '@/lib/kennung';
import { localDay } from '@/lib/zeit';
import { ladeRegister } from '@/lib/gesellschaften/server';
import { aktiveEintraege } from '@/lib/gesellschaften/modell';
import { ladeSchild, ladeVerlauf, schildAendern, schildEintrag, schildStand, schildErinnerungen, type SchildErgebnis, type SchildAenderung } from '@/lib/gesellschaften/schild-server';
import { verlaufFuer } from '@/lib/gesellschaften/schild/verlauf';
import { schildGesellschaften, lageAus, AMPEL_TEXT } from '@/lib/gesellschaften/schild/ampel';
import { SCHILD_LISTEN, SCHILD_PRAEFIX, REGEL_STAND, SCHILD_HINWEIS, type SchildListe, type SchildGesellschaft } from '@/lib/gesellschaften/schild/typen';
import { eintragAnwenden, eintragHandeln, profilAnwenden, vermerkAnwenden, bewertungAnwenden, katalogUebernehmen, SCHILD_AKTIONEN, type SchildAktion, type Kontext } from '@/lib/gesellschaften/schild/saeubern';
import { vorlageVon, entwurfAus } from '@/lib/gesellschaften/schild/vorlagen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEIN_ZUGANG = { ok: false, fehler: 'Der Bereich Unternehmen gehört zum Haushalt des Inhabers — für dieses Konto nicht freigegeben.' };
const fehler = (text: string, status: number, extra: Record<string, unknown> = {}) => NextResponse.json({ ok: false, fehler: text, ...extra }, { status });
/** Entwürfe tragen bis 30.000 Zeichen — der Körper darf größer sein als im Register. */
const MAX_BODY = 256 * 1024;

async function zugang(req: Request): Promise<{ person: string; haushalt: string } | null> {
  if (!(await imHaushaltDesInhabers(req))) return null;
  const h = await haushaltVon(req);
  return h ? { person: h.person, haushalt: h.haushalt } : null;
}

const mitStand = (s: SchildGesellschaft) => ({ ...s, stand: schildStand(s) });

export async function GET(req: Request) {
  const z = await zugang(req);
  if (!z) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  leseZugriff(req, 'gesellschaften'); // Lese-Protokoll (Gesellschafts-Register)
  const kopf = { headers: { 'Cache-Control': 'no-store' } };
  const heute = localDay();
  const [register, schild] = await Promise.all([ladeRegister(z.haushalt), ladeSchild(z.haushalt)]);
  if (new URL(req.url).searchParams.get('lage') === '1') {
    const l = lageAus(register, schild, heute);
    return NextResponse.json({
      ok: true, stand: REGEL_STAND, hinweis: SCHILD_HINWEIS, heute, gesamt: { ...l.gesamt, text: AMPEL_TEXT[l.gesamt.ampel] },
      gesellschaften: l.gesellschaften.map(g => ({ id: g.id, name: g.name, ampel: g.compliance.ampel, teile: g.compliance.teile })),
    }, kopf);
  }
  // Gesundheits-Verlauf (11.10.): nur die Business-Gesellschaften, die das Schild heute führt — gefiltert hier, vor der Auslieferung.
  if (new URL(req.url).searchParams.get('verlauf') === '1') {
    return NextResponse.json({ ok: true, heute, tage: verlaufFuer(await ladeVerlauf(z.haushalt), schildGesellschaften(register).map(g => g.id)) }, kopf);
  }
  // Nur Business-Gesellschaften — ein Eintrag einer Privat-Einheit (falls je einer im Bestand stünde) geht nie hinaus.
  const eintraege = schildGesellschaften(register).map(g => mitStand(schildEintrag(schild, g.id)));
  return NextResponse.json({ ok: true, heute, stand: REGEL_STAND, eintraege }, kopf);
}

async function antwort(r: SchildErgebnis) {
  if (r.konflikt) return fehler('Wurde inzwischen geändert — neu geladen, bitte noch einmal.', 409, { aktuell: mitStand(r.konflikt) });
  if (r.fehler?.length) return fehler(r.fehler.map(f => f.text).join(' · '), r.status ?? 400, { felder: r.fehler });
  return NextResponse.json({ ok: true, eintrag: mitStand(r.s!), ...(r.extra ?? {}) });
}

export async function PATCH(req: Request) {
  const z = await zugang(req);
  if (!z) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  const alterBau = bauPruefen(req);
  if (alterBau) return alterBau;
  let b: Record<string, unknown>;
  try {
    const roh = await jsonBegrenzt(req, MAX_BODY);
    if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return fehler('Kein gültiges JSON.', 400);
    b = roh as Record<string, unknown>;
  } catch (e) { return jsonZuGross(e) ?? fehler('Kein gültiges JSON.', 400); }

  const jetzt = new Date().toISOString();
  const personen = (await ladeKonten()).konten.filter(k => k.haushalt === z.haushalt).map(k => k.speicher);
  const k: Kontext = { person: z.person, jetzt, heute: localDay(), personen };
  let mut: SchildAenderung;

  if (b.liste !== undefined) {
    if (!SCHILD_LISTEN.includes(b.liste as SchildListe)) return fehler(`liste: ${SCHILD_LISTEN.join(', ')}.`, 400);
    const l = b.liste as SchildListe;
    const eintragId = typeof b.eintragId === 'string' ? b.eintragId : undefined;
    if (b.aktion !== undefined) {
      if (!SCHILD_AKTIONEN.includes(b.aktion as SchildAktion)) return fehler('aktion: loeschen, wiederherstellen oder endgueltig.', 400);
      if (!eintragId) return fehler('eintragId fehlt.', 400);
      mut = alt => eintragHandeln(alt, l, eintragId, b.aktion as SchildAktion, jetzt);
    } else {
      if (!b.eintrag || typeof b.eintrag !== 'object') return fehler('eintrag fehlt.', 400);
      const neueId = neueKennung(SCHILD_PRAEFIX[l]);
      // Ereignis-Assistent (11.10.): ein NEUES Ereignis darf auf den Beschluss zeigen, der im selben Zug als Entwurf angelegt wurde — nur, wenn er
      // im Register DIESER Gesellschaft steht (sonst 404). Dann schlägt das Beschluss-Buch dasselbe Ereignis später nicht noch einmal vor.
      const ausBeschluss = l === 'ereignisse' && !eintragId && b.ausBeschluss !== undefined ? b.ausBeschluss : undefined;
      if (ausBeschluss !== undefined && (typeof ausBeschluss !== 'string' || !/^bs-[a-z0-9][a-z0-9-]{3,62}$/.test(ausBeschluss))) return fehler('ausBeschluss: Kennung eines Beschlusses.', 400);
      mut = (alt, g) => {
        if (typeof ausBeschluss === 'string' && !aktiveEintraege(g.beschluesse).some(x => x.id === ausBeschluss)) return { fehler: [{ feld: 'ausBeschluss', text: 'Beschluss nicht gefunden.' }], status: 404 };
        const r = eintragAnwenden(alt, l, b.eintrag, k, { ...(eintragId ? { eintragId } : { neueId }) });
        if (!r.s || typeof ausBeschluss !== 'string') return r;
        return { ...r, s: { ...r.s, ereignisse: (r.s.ereignisse ?? []).map(e => (e.id === neueId ? { ...e, beschlussId: ausBeschluss } : e)) } };
      };
    }
  } else if (b.profil !== undefined) {
    mut = alt => profilAnwenden(alt, b.profil, k);
  } else if (b.vermerk !== undefined) {
    const neueId = neueKennung('vm');
    mut = alt => vermerkAnwenden(alt, b.vermerk, k, neueId);
  } else if (b.bewertung !== undefined) {
    mut = alt => bewertungAnwenden(alt, b.bewertung, k);
  } else if (b.katalog !== undefined) {
    mut = alt => { const r = katalogUebernehmen(alt, b.katalog, k, () => neueKennung('rk')); return { ...r, extra: { neu: r.neu } }; };
  } else if (b.vorlage !== undefined) {
    const v = typeof b.vorlage === 'string' ? vorlageVon(b.vorlage) : undefined;
    if (!v) return fehler('Unbekannte Vorlage.', 400);
    const id = neueKennung('ew');
    mut = (alt, g) => {
      if (v.nurKapital && g.rechtsform !== 'gmbh' && g.rechtsform !== 'ug') return { fehler: [{ feld: 'vorlage', text: 'Diese Vorlage gilt für GmbH und UG (Gesellschafterversammlung).' }] };
      const l = alt.entwuerfe ?? [];
      if (l.length >= 60) return { fehler: [{ feld: 'entwuerfe', text: 'Höchstens 60 Entwürfe je Gesellschaft.' }], status: 413 };
      const e = entwurfAus(v, g, k.heute);
      return { s: { ...alt, entwuerfe: [...l, { id, vorlage: v.id, titel: e.titel, text: e.text, am: jetzt, von: z.person }] }, extra: { entwurfId: id } };
    };
  } else return fehler('Was soll geändert werden? (profil, liste, vermerk, bewertung, katalog oder vorlage)', 400);

  const r = await schildAendern(z.haushalt, z.person, b.id, b.stand, werAus(req), mut);
  // Erinnerungen (Aufgabe + Glocke) sofort nachziehen — idempotent; eine vermerkte Pflicht schließt ihre offene Aufgabe.
  if (r.s) await schildErinnerungen(z.haushalt);
  return antwort(r);
}
