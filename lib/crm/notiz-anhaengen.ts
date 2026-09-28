// ─── Einen Vermerk an eine Lead-Notiz hängen — nie still kürzen (rein, 28.09.) ─
// Integritätsprüfung 28.09.: Kampagnen hängten „Interesse aus Kampagne …“ an die
// Lead-Notiz; die Säuberung (lib/crm/lead-form.ts, 2.000 Zeichen) schnitt danach
// still das Ende ab — oder, bei Personen ohne Firma, ersetzte der Vermerk die
// ganze Notiz. Jetzt: anhängen, solange es passt; sonst bleibt die Notiz, wie sie
// ist, und der Aufrufer bekommt einen Hinweis für die Oberfläche.

/** Höchstlänge der Lead-Notiz — dieselbe Grenze wie `leadSaeubern` (lib/crm/lead-form.ts). */
export const LEAD_NOTIZ_MAX = 2000;

export type NotizErgebnis = { ok: true; notiz: string } | { ok: false; notiz: string | undefined; hinweis: string };

export function notizAnhaengen(alt: string | undefined, vermerk: string, max = LEAD_NOTIZ_MAX): NotizErgebnis {
  const a = (alt ?? '').trim();
  const v = vermerk.trim();
  if (!v) return { ok: true, notiz: a };
  if (a.split('\n').includes(v)) return { ok: true, notiz: a };
  const neu = a ? `${a}\n${v}` : v;
  if (neu.length <= max) return { ok: true, notiz: neu };
  return { ok: false, notiz: alt, hinweis: `Die Lead-Notiz ist voll (${a.length} von ${max} Zeichen) — der Vermerk „${v.slice(0, 80)}“ wurde NICHT angehängt, die Notiz ist unverändert. Bitte die Notiz kürzen.` };
}
