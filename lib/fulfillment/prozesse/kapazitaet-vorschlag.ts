// ─── Fulfillment · Kapazität am Fall (18.10., Gesamtprüfung L1 B10) ─────────────────────────────────────────────────────────────────
// Vorher zwei Zahlen für dieselbe Last: das Fulfillment rechnete den Aufwand aus der Leistungstreppe („8,8 h je Woche“), Planung › Kapazität und die
// Säule Kapazität nur die von Hand eingetragenen Zuweisungen — ein neuer Fall tauchte in der Machbarkeit nie auf. Jetzt schlägt der Fall die Zuweisung
// vor (EIN Klick, über den vorhandenen Schreibweg PATCH /api/kapazitaet); nichts geschieht von selbst. Rein.

/** Der Vorschlag für einen Fall: wer (Kapazitäts-Kennung der Zuständigen), wie viele Stunden je Woche — oder null (schon eingetragen, kein Aufwand, niemand zuständig). */
export function kapaVorschlag(e: {
  mandatId: string; zustaendig: string | null | undefined; stundenWoche: number;
  zuweisungen: readonly { art: string; bezugId: string }[]; personen: readonly { id: string }[];
}): { person: string; stundenWoche: number } | null {
  if (!(e.stundenWoche > 0)) return null;
  if (e.zuweisungen.some(z => z.art === 'mandat' && z.bezugId === e.mandatId)) return null;
  const kennung = e.zustaendig && e.zustaendig !== 'beide' ? `konto-${e.zustaendig}` : null;
  const person = e.personen.find(p => p.id === kennung) ?? (e.zustaendig === 'beide' || !e.zustaendig ? e.personen[0] : undefined);
  if (!person) return null;
  return { person: person.id, stundenWoche: Math.round(e.stundenWoche * 10) / 10 };
}
