'use client';

// ─── Finanzplanung jetzt — eine Planzeile bearbeiten ─────────────────────────
// Name, Gruppe, Art (fix · Jahreskosten-Topf · flexibel · sparen), Tag im
// Monat, Betrag bzw. Jahresbetrag mit Fälligkeitsmonaten, ab/bis, Kündigung,
// Notiz. Dazu: alle Monatswerte dieser Zeile zurücksetzen, Zeile entfernen
// (Buchungen darauf werden „nicht zugeordnet“).

import { useState } from 'react';
import { FARBE as C } from '@/lib/make-one/design';
import { Knopf, LEUCHT } from '../schlank';
import type { Zeile } from '@/lib/finanzen/rechenkern';
import type { Operation } from '@/lib/finanzen/plan/operationen';
import { KAL, TYP_LABEL, TYP_GRUPPE, EINHEIT_LABEL, eur, monatLabel, neueKennung } from '@/lib/finanzen/plan/hilfen';
import { usePlan } from './daten';
import { Dialog, Feld, Formular, ZahlFeld, TextFeld, Auswahl, MonatWahl, KnopfKlein, Etikett, Hinweis } from './teile';
import type { ZeilenListe } from './Blatt';

const PRAEFIX: Record<ZeilenListe, string> = { sachkosten: 'ug.s.', privatBudget: 'p.b.', privatEinnahmen: 'p.e.', privatSchulden: 'p.d.' };
const EINHEIT: Record<ZeilenListe, Zeile['einheit']> = { sachkosten: 'ug', privatBudget: 'privat', privatEinnahmen: 'privat', privatSchulden: 'privat' };

export function findeZeile(d: { sachkosten: Zeile[]; privatBudget: Zeile[]; privatEinnahmen: Zeile[]; privatSchulden: Zeile[] }, id: string): { liste: ZeilenListe; zeile: Zeile } | null {
  for (const liste of ['sachkosten', 'privatBudget', 'privatEinnahmen', 'privatSchulden'] as ZeilenListe[]) { const z = d[liste].find(x => x.id === id); if (z) return { liste, zeile: z }; }
  return null;
}

/** Neue Zeile anlegen — liefert die Kennung, damit der Aufrufer den Dialog öffnet. */
export function neueZeileOp(liste: ZeilenListe, gruppe?: string, einheit?: Zeile['einheit']): { op: Operation; id: string } {
  const typ = gruppe ? (Object.entries(TYP_GRUPPE).find(([, g]) => g === gruppe)?.[0] as Zeile['typ'] | undefined) : undefined;
  const id = neueKennung(PRAEFIX[liste]);
  const z: Zeile = { id, name: 'Neue Zeile', einheit: einheit ?? EINHEIT[liste], gruppe: gruppe ?? (liste === 'privatSchulden' ? 'Schulden' : liste === 'privatEinnahmen' ? 'Einnahmen' : 'Weitere'), soll: 0, ab: liste === 'sachkosten' ? 2 : 1 };
  if (liste === 'privatBudget') z.typ = typ ?? 'flex';
  if (z.typ === 'jahr') { z.jahresbetrag = 0; z.faellig = []; }
  return { op: { pfad: `/${liste}/-`, neu: z, feld: `Zeile angelegt (${EINHEIT_LABEL[z.einheit]})` }, id };
}

export function ZeileDialog({ id, onZu }: { id: string; onZu: () => void }) {
  const { d, aendere } = usePlan();
  const treffer = findeZeile(d, id);
  const [z, setZ] = useState<Zeile | null>(treffer?.zeile ?? null);
  const [loeschen, setLoeschen] = useState(false);
  if (!treffer || !z) return null;
  const { liste, zeile: alt } = treffer;
  const budget = liste === 'privatBudget';
  const jahr = budget && z.typ === 'jahr';
  const ueberschrieben = Object.keys(d.plan).filter(k => k.startsWith(`${id}:`));
  const pfad = `/${liste}/id=${id}`;

  const speichern = async () => {
    const neu: Zeile = { ...z, name: z.name.trim() || alt.name, gruppe: z.gruppe.trim() || alt.gruppe };
    if (jahr) { neu.jahresbetrag = z.jahresbetrag ?? 0; neu.soll = (z.jahresbetrag ?? 0) / 12; neu.faellig = z.faellig ?? []; }
    else { delete neu.jahresbetrag; delete neu.faellig; }
    if (!neu.tag) delete neu.tag;
    if (!neu.bis) delete neu.bis;
    if (!neu.kuendigung?.trim()) delete neu.kuendigung; if (!neu.notiz?.trim()) delete neu.notiz;
    if (budget && neu.typ !== alt.typ && neu.typ && Object.values(TYP_GRUPPE).includes(alt.gruppe)) neu.gruppe = TYP_GRUPPE[neu.typ];
    const ok = await aendere([{ pfad, alt: `${eur(alt.soll, 2)} ab ${monatLabel(d, alt.ab ?? 1)}`, neu, feld: `Zeile ${alt.name}` }], `Zeile ${neu.name}`);
    if (ok) onZu();
  };
  const monatswerteZurueck = async () => {
    const ops: Operation[] = ueberschrieben.map(k => ({ pfad: `/plan/${k}`, alt: d.plan[k] }));
    if (await aendere(ops, `${alt.name}: ${ops.length} Monatswerte zurückgesetzt`)) onZu();
  };
  const entfernen = async () => {
    const betroffen = d.buchungen.filter(b => b.z === id);
    if (betroffen.length > 400) { onZu(); return; }
    const ops: Operation[] = [{ pfad, alt: alt.name, feld: `Zeile entfernt: ${alt.name}` }, ...betroffen.map(b => ({ pfad: `/buchungen/id=${b.id}/z`, alt: id, neu: 'x.offen', feld: `Buchung ${b.n} → nicht zugeordnet` })), ...ueberschrieben.map(k => ({ pfad: `/plan/${k}`, alt: d.plan[k] }))];
    if (await aendere(ops, `Zeile entfernt: ${alt.name}`)) onZu();
  };

  return (
    <Dialog titel={alt.name} onZu={onZu} breit aktionen={<>
      <KnopfKlein onClick={onZu} farbe={C.inkDim}>Abbrechen</KnopfKlein>
      <KnopfKlein onClick={monatswerteZurueck} aus={!ueberschrieben.length} titel="Alle einzeln überschriebenen Monatswerte dieser Zeile löschen">Monatswerte zurücksetzen ({ueberschrieben.length})</KnopfKlein>
      {loeschen ? <KnopfKlein onClick={entfernen} farbe={LEUCHT.kritisch}>Wirklich entfernen</KnopfKlein> : <KnopfKlein onClick={() => setLoeschen(true)} farbe={LEUCHT.kritisch}>Entfernen</KnopfKlein>}
      <Knopf onClick={speichern}>Speichern</Knopf>
    </>}>
      <div><Etikett einheit={z.einheit} /></div>
      <Formular>
        <Feld label="Name"><TextFeld wert={z.name} onFertig={t => setZ({ ...z, name: t })} titel="Name" /></Feld>
        <Feld label="Gruppe"><TextFeld wert={z.gruppe} onFertig={t => setZ({ ...z, gruppe: t })} titel="Gruppe" /></Feld>
        {budget && <Feld label="Art"><Auswahl wert={z.typ ?? 'flex'} onWahl={t => setZ({ ...z, typ: t })} optionen={(Object.keys(TYP_LABEL) as NonNullable<Zeile['typ']>[]).map(k => ({ id: k, label: TYP_LABEL[k] }))} titel="Art" /></Feld>}
        <Feld label="Tag im Monat"><ZahlFeld wert={z.tag ?? null} dezimal={0} leer rechts={false} onFertig={v => setZ({ ...z, tag: v ? Math.max(1, Math.min(31, Math.round(v))) : undefined })} platzhalter="—" breite={90} titel="Tag im Monat" /></Feld>
        {jahr ? <>
          <Feld label="Jahresbetrag"><ZahlFeld wert={z.jahresbetrag ?? z.soll * 12} onFertig={v => setZ({ ...z, jahresbetrag: v ?? 0 })} titel="Jahresbetrag" /></Feld>
          <Feld label="Fällig in" breit>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {KAL.map((k, j) => { const an = (z.faellig ?? []).includes(j + 1); return <button key={k} type="button" aria-pressed={an} onClick={() => setZ({ ...z, faellig: an ? (z.faellig ?? []).filter(x => x !== j + 1) : [...(z.faellig ?? []), j + 1].sort((a, b) => a - b) })} style={{ fontSize: 12, fontWeight: 600, padding: '5px 9px', borderRadius: 999, cursor: 'pointer', border: `1px solid ${an ? C.aktiv : 'rgba(255,255,255,.1)'}`, background: an ? `${C.aktiv}22` : 'transparent', color: an ? C.aktiv : C.inkDim }}>{k}</button>; })}
            </div>
          </Feld>
        </> : <Feld label="Betrag je Monat"><ZahlFeld wert={z.soll} onFertig={v => setZ({ ...z, soll: v ?? 0 })} titel="Betrag je Monat" /></Feld>}
        <Feld label="ab"><MonatWahl wert={z.ab ?? 1} onWahl={m => setZ({ ...z, ab: m })} monate={d.monate} /></Feld>
        <Feld label="bis"><MonatWahl wert={z.bis} onWahl={m => setZ({ ...z, bis: m || undefined })} monate={d.monate} leer="offen" /></Feld>
        <Feld label="Kündigung"><TextFeld wert={z.kuendigung ?? ''} onFertig={t => setZ({ ...z, kuendigung: t })} platzhalter="z. B. 3 Monate zum Jahresende" titel="Kündigung" /></Feld>
        <Feld label="Notiz" breit><TextFeld wert={z.notiz ?? ''} onFertig={t => setZ({ ...z, notiz: t })} titel="Notiz" /></Feld>
      </Formular>
      <Hinweis>{ueberschrieben.length} einzelne Monatswerte überschrieben. Der Betrag hier ist der Sollwert ab/bis — einzelne Monate änderst du im Blatt.</Hinweis>
    </Dialog>
  );
}
