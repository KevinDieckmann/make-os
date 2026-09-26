// ─── MAKE OS — Ernährung: Modell (client-sicher) ────────────────────────────
// Seit 26.09. lebt das Modell in lib/ernaehrung/modell.ts (Profile, Stammliste,
// Vorrat, Gerichte, Warenkorb). Diese Datei bleibt als Einstieg für die
// bestehenden Importe (Gesundheits-Index, Ansichten).

export type { Tag, Mahlzeiten, Mahlzeit, EinkaufPosten, ErnaehrungFile, Profil, Lebensmittel, VorratPosten, Gericht, Zutat, Kategorie, PlanGerichte } from '@/lib/ernaehrung/modell';
export { TAGE, TAG_LABEL, MAHLZEITEN, KATEGORIEN, KATEGORIE_LABEL } from '@/lib/ernaehrung/modell';
