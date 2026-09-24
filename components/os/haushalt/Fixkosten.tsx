'use client';

// Fixkosten & Budget — zwei Fragen, bewusst getrennt. FIXKOSTEN: Was kostet
// unser Leben jeden Monat, egal was passiert? BUDGET: Was wollen wir bei
// beeinflussbaren Ausgaben ausgeben — und was geben wir wirklich aus?

import { useMemo, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import type { Kategorie, Turnus } from '@/lib/finanzen/haushalt/typen';
import { eur, zuCent } from '@/lib/finanzen/haushalt/typen';
import type { KatName } from '@/lib/finanzen/haushalt/einordnung';
import { luft, wiederkehrend } from '@/lib/finanzen/haushalt/fixkosten';
import { inMonaten } from '@/lib/finanzen/haushalt/kennzahlen';
import { proMonat, turnusName } from '@/lib/finanzen/haushalt/regeln';
import { monatVon, monatName, vollMonate, heuteBerlin } from '@/lib/finanzen/haushalt/monat';
import { Karte, Ueberschrift, Leer, Knopf, Chip, feld, LEUCHT } from '../schlank';
import { Dialog, Feld, Hinweis, Kachel, Kacheln, Leiste, auswahl, type HaushaltDaten, type Op } from './gemeinsam';

interface Props {
  h: HaushaltDaten; katName: KatName;
  patch: (teil: string, ops: Op[]) => Promise<boolean>;
  aktion: <T = Record<string, unknown>>(b: Record<string, unknown>) => Promise<(T & { ok: boolean; fehler?: string }) | null>;
  melde: (art: 'ok' | 'fehler' | 'info', titel: string, text?: string) => void;
  laden: () => Promise<void>;
}

export function Fixkosten({ h, katName, patch, aktion, melde, laden }: Props) {
  const heute = heuteBerlin();
  const privat = useMemo(() => h.buchungen.filter(b => b.einheit === 'privat'), [h.buchungen]);
  const schulden = h.schulden.filter(s => s.einheit === 'privat');
  const l = useMemo(() => luft(privat, schulden, katName, heute), [privat, schulden, katName, heute]);
  const w = useMemo(() => wiederkehrend(privat, katName, heute), [privat, katName, heute]);
  const [budget, setBudget] = useState<Kategorie | null>(null);
  const s = l.sockel;
  const offen = w.filter(x => !x.bereitsMarkiert).length;

  const laufend = monatVon(heute);
  const istJe = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of privat) if (monatVon(b.datum) === laufend && b.betrag < 0 && !b.ist_umbuchung && b.kategorie_id) m.set(b.kategorie_id, (m.get(b.kategorie_id) ?? 0) + Math.abs(b.betrag));
    return m;
  }, [privat, laufend]);
  const kats = h.stamm.kategorien.filter(k => k.typ === 'ausgabe').sort((a, b) => (istJe.get(b.id) ?? 0) - (istJe.get(a.id) ?? 0));
  const mitBudget = kats.filter(k => k.monatsbudget);
  const budgetSumme = mitBudget.reduce((x, k) => x + (k.monatsbudget ?? 0), 0);
  const istSumme = mitBudget.reduce((x, k) => x + (istJe.get(k.id) ?? 0), 0);

  return (
    <>
      <Karte i={1} akzent={l.luft >= 0 ? LEUCHT.gut : LEUCHT.kritisch}>
        <Ueberschrift farbe={LEUCHT.schlaf}>Was euer Leben im Monat kostet</Ueberschrift>
        <Kacheln>
          <Kachel titel="Monatlicher Sockel" wert={eur(s.gesamt)} zusatz="Fixkosten + Kreditraten" />
          <Kachel titel="davon Fixkosten" wert={eur(s.ausBuchungen)} zusatz={`${s.posten.length} Posten · ${s.anzahl} Zahlungen`} />
          <Kachel titel="davon Kreditraten" wert={eur(s.raten)} zusatz={s.ratenBuchungen > s.ratenSchulden ? 'laut Tilgungs-Buchungen' : `${schulden.length} Verbindlichkeiten`} />
          <Kachel titel="Luft pro Monat" wert={eur(l.luft)} farbe={l.luft >= 0 ? LEUCHT.gut : LEUCHT.kritisch} zusatz={l.luft >= 0 ? 'bleibt übrig' : 'fehlt jeden Monat'} />
        </Kacheln>
        <div style={{ marginTop: 14, fontSize: TYP.body, lineHeight: 1.6 }}>
          Jeden Monat gehen unabhängig von eurem Verhalten <strong>{eur(s.gesamt)}</strong> raus. Bei durchschnittlich <strong>{eur(l.einnahmenSchnitt)}</strong> Einkommen der letzten drei vollen Monate {l.luft >= 0 ? <>bleiben <strong style={{ color: LEUCHT.gut }}>{eur(l.luft)}</strong> für alles andere — Lebensmittel, Essen auswärts, Sparen.</> : <>fehlen <strong style={{ color: LEUCHT.kritisch }}>{eur(Math.abs(l.luft))}</strong>, bevor ihr überhaupt etwas gekauft habt.</>}
        </div>
        <Hinweis>Gerechnet über die letzten zwölf vollen Monate. Quartals- und Jahreszahlungen werden über ihren Turnus auf den Monat gerechnet. Einkommen ohne Kredite und ohne zurückgeflossenes Geld. Je mehr wiederkehrende Zahlungen unten markiert sind, desto genauer wird die Zahl.</Hinweis>
      </Karte>

      <Karte i={2}>
        <Ueberschrift rechts={w.length ? (offen ? `${offen} noch nicht markiert` : 'alle markiert') : undefined}>Wiederkehrende Zahlungen</Ueberschrift>
        {!w.length ? <Leer>Noch zu wenig Daten. Sobald ein paar Monate eingelesen sind, erscheint hier, was regelmäßig abgeht.</Leer> : (
          <>
            <div style={{ fontSize: 13, color: C.inkDim, marginBottom: 8 }}>Diese Empfänger kommen regelmäßig mit fast gleichem Betrag. Den Rhythmus schätze ich aus den Abständen — prüf ihn und korrigier ihn, wo er danebenliegt.</div>
            {w.map(x => (
              <div key={x.name} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: '6px 12px', padding: '10px 2px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{x.name}</div>
                  <div style={{ fontSize: 12, color: C.inkLeise }}>{x.kategorie || 'keine Kategorie'} · {x.monate}× in 12 Monaten{x.unsicher && <span style={{ color: LEUCHT.kritisch }}> · Rhythmus unklar</span>} · Ø {eur(x.mittel)} {x.schwankung < 0.02 ? '(immer gleich)' : `(±${Math.round(x.schwankung * 100)} %)`}</div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 13.5, fontVariantNumeric: 'tabular-nums' }}>= {eur(proMonat(x.mittel, x.turnus))} / Monat</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <select aria-label="Turnus" value={x.turnus} onChange={async e => { const d = await aktion({ aktion: 'turnus', name: x.name, turnus: e.target.value }); if (d?.ok) { melde('ok', 'Turnus gesetzt', `${x.name} läuft ${turnusName(e.target.value)} — das sind ${eur(proMonat(x.mittel, e.target.value))} im Monat.`); await laden(); } }} style={{ ...auswahl, width: 'auto', padding: '5px 8px', fontSize: 12.5 }}>
                    <option value="monatlich">monatlich</option><option value="quartal">quartalsweise</option><option value="jahr">jährlich</option>
                  </select>
                  {x.bereitsMarkiert && <Chip farbe={LEUCHT.schlaf}>Fixkosten</Chip>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  {x.bereitsMarkiert
                    ? <Knopf leise onClick={async () => { const d = await aktion<{ anzahl: number }>({ aktion: 'fixkosten', name: x.name, an: false, turnus: x.turnus }); if (d?.ok) { melde('ok', 'Markierung entfernt', x.name); await laden(); } }}>Doch nicht</Knopf>
                    : <Knopf farbe={LEUCHT.schlaf} onClick={async () => { const d = await aktion<{ anzahl: number }>({ aktion: 'fixkosten', name: x.name, an: true, turnus: x.turnus as Turnus }); if (d?.ok) { melde('ok', 'Als Fixkosten markiert', `${x.name} — ${d.anzahl} Buchungen. Künftige Importe erkennen das automatisch.`); await laden(); } }}>Als Fixkosten</Knopf>}
                </div>
              </div>
            ))}
          </>
        )}
      </Karte>

      <Karte i={3}>
        <Ueberschrift farbe={LEUCHT.achtung} rechts={monatName(laufend)}>Budget je Kategorie</Ueberschrift>
        <div style={{ fontSize: TYP.body, marginBottom: 10 }}>
          {budgetSumme ? <>Von <strong>{eur(budgetSumme)}</strong> geplantem Budget sind diesen Monat <strong>{eur(istSumme)}</strong> ausgegeben — {istSumme > budgetSumme ? <span style={{ color: LEUCHT.kritisch }}>{eur(istSumme - budgetSumme)} über Plan.</span> : <span style={{ color: LEUCHT.gut }}>{eur(budgetSumme - istSumme)} noch frei.</span>}</> : <span style={{ color: C.inkDim }}>Noch kein Budget gesetzt. Fang mit den drei größten Posten an — das bringt am meisten.</span>}
        </div>
        {kats.map(k => {
          const ist = istJe.get(k.id) ?? 0;
          const soll = k.monatsbudget;
          const farbe = soll === null ? C.inkLeise : ist > soll ? LEUCHT.kritisch : ist > soll * 0.85 ? LEUCHT.achtung : LEUCHT.gut;
          if (!ist && !soll) return null;
          return (
            <div key={k.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto', gap: 12, alignItems: 'center', padding: '8px 2px', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
              <div style={{ minWidth: 0 }}>
                <span style={{ fontSize: TYP.body }}>{k.name}</span>
                {soll ? <Leiste anteil={Math.min(100, ist / soll * 100)} farbe={farbe} /> : null}
              </div>
              <div style={{ textAlign: 'right', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                <div>{eur(ist)}</div>
                <div style={{ color: soll === null ? C.inkLeise : farbe, fontSize: 12 }}>{soll === null ? 'kein Budget' : ist > soll ? `${eur(ist - soll)} drüber` : `${eur(soll - ist)} übrig`}</div>
              </div>
              <button onClick={() => setBudget(k)} style={{ background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', fontSize: 12.5 }}>{soll ? 'Ändern' : 'Budget setzen'}</button>
            </div>
          );
        })}
        <Hinweis>Ein Budget gilt für jeden Monat, nicht nur für diesen. Einmal setzen genügt. Kategorien ohne Ausgaben und ohne Budget sind ausgeblendet.</Hinweis>
      </Karte>
      {budget && <BudgetDialog k={budget} h={h} patch={patch} melde={melde} onZu={() => setBudget(null)} />}
    </>
  );
}

function BudgetDialog({ k, h, patch, melde, onZu }: { k: Kategorie; h: HaushaltDaten; patch: Props['patch']; melde: Props['melde']; onZu: () => void }) {
  const monate = vollMonate(3);
  const schnitt = inMonaten(h.buchungen, monate).filter(b => b.kategorie_id === k.id && b.betrag < 0 && !b.ist_umbuchung).reduce((s, b) => s + Math.abs(b.betrag), 0) / 3;
  const [wert, setWert] = useState(k.monatsbudget ? String(k.monatsbudget / 100) : schnitt ? String(Math.round(schnitt / 1000) * 10) : '');
  return (
    <Dialog titel={`Budget für „${k.name}“`} onZu={onZu} aktionen={<Knopf farbe={LEUCHT.achtung} onClick={async () => {
      const roh = wert.trim();
      const cent = roh === '' ? null : zuCent(roh);
      if (roh !== '' && cent === null) { melde('fehler', 'Keine gültige Zahl'); return; }
      const ok = await patch('kategorien', [{ op: 'upsert', stand: k.stand, eintrag: { ...k, monatsbudget: cent } }]);
      if (ok) { melde('ok', cent === null ? 'Budget entfernt' : 'Budget gesetzt', k.name); onZu(); }
    }}>Speichern</Knopf>}>
      <div>{schnitt > 0 ? <>In den letzten drei Monaten habt ihr hier durchschnittlich <strong>{eur(schnitt)}</strong> im Monat ausgegeben.</> : <span style={{ color: C.inkDim }}>Für diese Kategorie gibt es noch keine Vergangenheitswerte.</span>}</div>
      <Feld label="Monatliches Budget in Euro"><input inputMode="decimal" value={wert} onChange={e => setWert(e.target.value)} style={feld} /></Feld>
      <div style={{ fontSize: 12.5, color: C.inkLeise }}>Leer lassen und speichern entfernt das Budget wieder.</div>
    </Dialog>
  );
}
