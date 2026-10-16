// ─── MAKE OS — Gemerkte Geräte: Schreibwege (16.10.) ────────────────────────
// Regeln und Hash in lib/zugang/geraete.ts. Hier nur, was den Kontenbestand schreibt — IMMER über `aendereKonten`
// (Sperre, Änderungsprotokoll nur mit Feldnamen). Nie das Token oder den Hash in einer Antwort, einem Log oder Protokoll.

import { aendereKonten, type Konto } from './konten';
import { kontoStand } from './sitzung';
import {
  cookieAusAnfrage, geraetBeschreibung, geraetDazu, geraetFinden, geraeteBereinigen, geraeteOeffentlich, neuesGeraet, MAX_COOKIE_EINTRAEGE,
  type CookieEintrag, type GemerktesGeraet, type GeraetOeffentlich,
} from './geraete';

/** Gültiges gemerktes Gerät dieses Kontos in der Anfrage? Ohne zweiten Faktor oder ohne Cookie: null (still). */
export async function geraetBeiAnmeldung(konto: Konto, req: Request, jetzt: number = Date.now()): Promise<GemerktesGeraet | null> {
  if (!konto.zweiterFaktor) return null;
  const eintraege = cookieAusAnfrage(req);
  if (!eintraege.length) return null;
  return geraetFinden(konto, eintraege, await kontoStand(konto.salz), jetzt);
}

/**
 * Dieses Gerät merken (nach Passwort + Code): neues Token, Hash ans Konto, Cookie-Einträge für die Antwort. Ein früherer Eintrag
 * DIESES Kontos im selben Browser wird ersetzt (kein Doppel), Einträge anderer Konten bleiben im Cookie (geteiltes Gerät).
 * Null, wenn sich Passwort oder zweiter Faktor inzwischen geändert haben (dann wird nichts gemerkt).
 */
export async function geraetMerken(konto: Konto, req: Request, jetzt: number = Date.now()): Promise<{ geraet: GeraetOeffentlich; cookie: CookieEintrag[] } | null> {
  const zf = konto.zweiterFaktor;
  if (!zf) return null;
  const stand = await kontoStand(konto.salz);
  const { geraet, token } = neuesGeraet({ kontoId: konto.id, stand, faktorSeit: zf.seit, beschreibung: geraetBeschreibung(req.headers.get('user-agent')), jetzt });
  const imBrowser = cookieAusAnfrage(req);
  let gesetzt = false;
  let ersetzt: string[] = [];
  await aendereKonten(s => ({ ...s, konten: s.konten.map(k => {
    if (k.speicher !== konto.speicher || k.id !== konto.id || k.salz !== konto.salz || !k.zweiterFaktor || k.zweiterFaktor.seit !== zf.seit) return k;
    const eigene = new Set((Array.isArray(k.zweiterFaktor.geraete) ? k.zweiterFaktor.geraete : []).map(g => g?.id));
    ersetzt = imBrowser.filter(e => eigene.has(e.id)).map(e => e.id);
    gesetzt = true;
    return { ...k, zweiterFaktor: { ...k.zweiterFaktor, geraete: geraetDazu(k.zweiterFaktor.geraete, geraet, { stand, jetzt, ersetzt }) } };
  }) }));
  if (!gesetzt) return null;
  const andere = imBrowser.filter(e => !ersetzt.includes(e.id)).slice(-(MAX_COOKIE_EINTRAEGE - 1));
  const { hash: _h, stand: _s, ...sicht } = geraet;
  return { geraet: sicht, cookie: [...andere, { id: geraet.id, token }] };
}

/** Anmeldung über ein gemerktes Gerät: „zuletzt benutzt“ nachtragen, Abgelaufenes/Ungültiges fällt dabei heraus. Wirft nie. */
export async function geraetBenutzt(konto: Konto, id: string, jetzt: number = Date.now()): Promise<void> {
  try {
    const stand = await kontoStand(konto.salz);
    const iso = new Date(jetzt).toISOString();
    await aendereKonten(s => ({ ...s, konten: s.konten.map(k => k.speicher === konto.speicher && k.zweiterFaktor
      ? { ...k, zweiterFaktor: { ...k.zweiterFaktor, geraete: geraeteBereinigen(k.zweiterFaktor.geraete, stand, jetzt).map(g => (g.id === id ? { ...g, zuletzt: iso } : g)) } }
      : k) }));
  } catch (e) {
    console.error('[geraete] „zuletzt benutzt“ nicht nachgetragen:', e instanceof Error ? e.message : e);
  }
}

/** Die gültigen Geräte eines Kontos für die Anzeige (ohne Hash). */
export async function geraeteFuer(konto: Konto, jetzt: number = Date.now()): Promise<GeraetOeffentlich[]> {
  if (!konto.zweiterFaktor) return [];
  return geraeteOeffentlich(geraeteBereinigen(konto.zweiterFaktor.geraete, await kontoStand(konto.salz), jetzt), jetzt);
}

/** Ein Gerät (`id`) oder alle (`'alle'`) vergessen. Liefert die vergessenen Kennungen (leer = es gab nichts). */
export async function geraeteVergessen(speicher: string, was: string | 'alle'): Promise<string[]> {
  let weg: string[] = [];
  await aendereKonten(s => ({ ...s, konten: s.konten.map(k => {
    if (k.speicher !== speicher || !k.zweiterFaktor || !Array.isArray(k.zweiterFaktor.geraete)) return k;
    const liste = k.zweiterFaktor.geraete;
    weg = liste.filter(g => was === 'alle' || g?.id === was).map(g => String(g?.id));
    if (!weg.length) return k;
    const rest = was === 'alle' ? [] : liste.filter(g => g?.id !== was);
    const { geraete: _g, ...zf } = k.zweiterFaktor;
    return { ...k, zweiterFaktor: rest.length ? { ...zf, geraete: rest } : zf };
  }) }));
  return weg;
}
