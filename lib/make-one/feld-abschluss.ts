// ─── Kleines Eingabefeld: was beim Abschließen (Enter oder Verlassen) passiert — rein, client-sicher (19.10., Rundgang A6) ─────────────────────
// Fund: Im Lieferumfang eines Produkts blieb der Text nach Enter im Feld stehen (`Feld` aus components/os/crm/teile.tsx speichert beim Verlassen und
// kennt kein „neu“) — ein Klick daneben legte den Punkt ein zweites Mal an. EINE Regel für zwei Arten von Feldern:
//   · Bearbeiten (ein Wert ist da): speichern, wenn sich der Text geändert hat — der Text bleibt stehen (er IST der Wert).
//   · Anlegen (`leeren`, ein Feld für einen neuen Listen-Eintrag): speichern, wenn etwas drinsteht (getrimmt), und danach das Feld leeren — ein leeres
//     Verlassen speichert nichts. Ohne `wert` ist ein Feld ein Anlege-Feld (es gibt nichts zu bearbeiten).

export interface FeldAbschluss { speichern: string | null; leeren: boolean }

/** Ist das Feld ein Anlege-Feld? Ausdrücklich `leeren`, sonst: ohne `wert` (nichts zu bearbeiten). */
export const anlegeFeld = (wertGegeben: boolean, leeren?: boolean): boolean => leeren ?? !wertGegeben;

/** Was beim Abschließen passiert: zu speichernder Text (oder null) und ob das Feld danach leer wird. */
export function feldAbschluss(text: string, wert: string, anlegen: boolean): FeldAbschluss {
  if (anlegen) {
    const x = text.trim();
    return x ? { speichern: x, leeren: true } : { speichern: null, leeren: false };
  }
  return { speichern: text !== wert ? text : null, leeren: false };
}
