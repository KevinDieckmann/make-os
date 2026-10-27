// ─── MAKE OS — Social: Verbindungen je Kanal und Plattform (Server) — 27.10.2026 ─────────────────────────────────────────────────────
// Bestand `social-verbindungen--<haushalt>` (verschlüsselt wie jeder Bestand): je Kanal und Plattform höchstens EINE Verbindung mit Anbieter,
// Zustand und dem Geheimteil (Token). Der Geheimteil verlässt den Server nie: an den Browser geht nur `verbindungSicht` (ohne `geheim`).
// Wer verbindet: bei einer Personenmarke nur die Person selbst (sie meldet sich mit IHREM Konto an), sonst jede Person des Haushalts, die
// den Kanal sieht. Trennen darf jede Person, die den Kanal sieht (Not-Aus-Gedanke: eine Verbindung lösen geht immer).

import { loadJson, updateJson } from '@/lib/store/local-db';
import { neueKennung } from '@/lib/kennung';
import { HAUSHALT_OK } from '@/lib/finanzen/haushalt/zugriff';
import { haushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import type { SocialPlattform } from './typen';
import type { AnbieterId, VerbindungGeheim } from './anbieter/typen';

export interface SocialVerbindung {
  id: string;
  kanalId: string;
  plattform: SocialPlattform;
  anbieter: AnbieterId;
  zustand: 'aktiv' | 'getrennt';
  /** Anzeige-Name des Kontos bei der Plattform (z. B. Profilname) — keine Adresse, kein Token. */
  konto?: string;
  verbundenVon: string;
  verbundenAm: string;
  getrenntAm?: string;
  getrenntGrund?: string;
  /** Für welchen Token-Ablauf die Glocke „bald neu verbinden“ schon kam (einmal je Token). */
  erinnertAblauf?: number;
  geheim?: VerbindungGeheim;
}
export interface VerbindungenDatei { eintraege: SocialVerbindung[] }
export type VerbindungSicht = Omit<SocialVerbindung, 'geheim'> & { tokenAblauf?: number };

export const verbindungenSpeicherFuer = (h: string | null | undefined) => (h && HAUSHALT_OK.test(h) ? `social-verbindungen--${h}` : 'social-verbindungen--inhaber');
export async function verbindungenSpeicher(): Promise<string> { return verbindungenSpeicherFuer(await haushaltDesInhabers()); }

const ok = (v: unknown): v is SocialVerbindung => !!v && typeof v === 'object' && typeof (v as SocialVerbindung).id === 'string' && typeof (v as SocialVerbindung).kanalId === 'string';
export async function ladeVerbindungen(): Promise<SocialVerbindung[]> {
  const d = await loadJson<VerbindungenDatei>(await verbindungenSpeicher());
  return (d?.eintraege ?? []).filter(ok);
}

/** Für den Browser: ohne Geheimteil. Rein. */
export const verbindungSicht = (v: SocialVerbindung): VerbindungSicht => {
  const { geheim, ...rest } = v;
  return { ...rest, ...(geheim?.ablauf ? { tokenAblauf: geheim.ablauf } : {}) };
};

/** Die aktive Verbindung eines Kanals für eine Plattform. Rein. */
export const aktiveVerbindung = (l: readonly SocialVerbindung[], kanalId: string, plattform: SocialPlattform): SocialVerbindung | null =>
  l.find(v => v.kanalId === kanalId && v.plattform === plattform && v.zustand === 'aktiv') ?? null;

/** Verbindung anlegen bzw. ersetzen (eine je Kanal + Plattform). */
export async function verbindungSetzen(e: Omit<SocialVerbindung, 'id' | 'zustand' | 'verbundenAm'> & { jetzt?: string }): Promise<SocialVerbindung> {
  const neu: SocialVerbindung = { id: neueKennung('sw'), kanalId: e.kanalId, plattform: e.plattform, anbieter: e.anbieter, zustand: 'aktiv', konto: e.konto, verbundenVon: e.verbundenVon, verbundenAm: e.jetzt ?? new Date().toISOString(), geheim: e.geheim };
  await updateJson<VerbindungenDatei>(await verbindungenSpeicher(), cur => ({ eintraege: [...(cur?.eintraege ?? []).filter(ok).filter(v => !(v.kanalId === e.kanalId && v.plattform === e.plattform)), neu] }));
  return neu;
}

/** Trennen: der Geheimteil wird gelöscht, der Eintrag bleibt als „getrennt“ (wann, warum). */
export async function verbindungTrennen(id: string, grund: string, jetzt = new Date().toISOString()): Promise<boolean> {
  let gefunden = false;
  await updateJson<VerbindungenDatei>(await verbindungenSpeicher(), cur => ({
    eintraege: (cur?.eintraege ?? []).filter(ok).map(v => {
      if (v.id !== id) return v;
      gefunden = true;
      const { geheim: _g, ...rest } = v; void _g;
      return { ...rest, zustand: 'getrennt' as const, getrenntAm: jetzt, getrenntGrund: grund.slice(0, 300) };
    }),
  }));
  return gefunden;
}

/** Verbindungen eines entfernten Kanals bzw. einer gelöschten Person weg (Konto löschen). */
export async function verbindungenOhne(pred: (v: SocialVerbindung) => boolean): Promise<number> {
  let n = 0;
  await updateJson<VerbindungenDatei>(await verbindungenSpeicher(), cur => {
    if (!cur) return cur as unknown as VerbindungenDatei;
    const rest = (cur.eintraege ?? []).filter(ok).filter(v => { const weg = pred(v); if (weg) n++; return !weg; });
    return n ? { eintraege: rest } : cur;
  });
  return n;
}

/** Ein Feld an einer Verbindung vermerken (Erinnerung) — nie den Geheimteil. */
export async function verbindungVermerken(id: string, teil: Pick<SocialVerbindung, 'erinnertAblauf'>): Promise<void> {
  await updateJson<VerbindungenDatei>(await verbindungenSpeicher(), cur => ({ eintraege: (cur?.eintraege ?? []).filter(ok).map(v => (v.id === id ? { ...v, ...teil } : v)) }));
}
