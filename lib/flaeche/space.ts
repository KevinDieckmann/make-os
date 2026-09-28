// ─── Flächen: Standard-Space je Fläche (rein, 28.09. abends) ────────────────
// Kevin: „Privates auf die privaten Flächen, Business auf die Business-Flächen.“ Ein Widget ohne eigene Einstellung
// (z. B. Aufgaben aus dem Katalog) nimmt den Space seiner Fläche: Privat-Übersicht, Gesundheit, Ernährung, Familie,
// Sport → privat; Business-Übersicht, Markttraktion → business; Home/Heute und alles andere → beide.

export function spaceAusFlaeche(seite: string | undefined | null): 'privat' | 'business' | 'alle' {
  if (!seite) return 'alle';
  if (/(^|-)privat$/.test(seite) || /^(gesundheit|ernaehrung|familie|sport)/.test(seite)) return 'privat';
  if (/(^|-)business$/.test(seite) || /^markttraktion/.test(seite)) return 'business';
  return 'alle';
}
