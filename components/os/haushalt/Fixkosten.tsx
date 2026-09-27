'use client';

// Fixkosten & Budget — zwei Fragen, bewusst getrennt. FIXKOSTEN: Was kostet
// unser Leben jeden Monat, egal was passiert? BUDGET: Was wollen wir bei
// beeinflussbaren Ausgaben ausgeben — und was geben wir wirklich aus?
//
// 27.09. (Malins Rückmeldung): Fixkosten sind bearbeitbar. Jeder Posten (= die
// Ausgaben-Buchungen eines Empfängers) hat einen Stift: Name, Betrag, Rhythmus,
// Kategorie, Konto — und die Einstufung fix ↔ variabel. Umstufen gilt NUR für
// diesen Posten (Kevins Entscheidung); eine Regel für den Empfänger gibt es nur
// per Häkchen. „Rhythmus unklar“ ist ein Klick: Wahl aus fünf Rhythmen mit
// Vorschlag aus den Abständen. Alles über den Patch-Weg mit Stand (409).

import { useMemo, useState, type ReactNode } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import type { Buchung, Kategorie, Turnus } from '@/lib/finanzen/haushalt/typen';
import { eur, zuCent } from '@/lib/finanzen/haushalt/typen';
import type { KatName } from '@/lib/finanzen/haushalt/einordnung';
import { luft, wiederkehrend, rhythmusVorschlag, type Sockelposten } from '@/lib/finanzen/haushalt/fixkosten';
import { inMonaten } from '@/lib/finanzen/haushalt/kennzahlen';
import { TURNUS_REIHE, normal, turnusName } from '@/lib/finanzen/haushalt/regeln';
import { monatVon, monatName, vollMonate, heuteBerlin } from '@/lib/finanzen/haushalt/monat';
import { Karte, Ueberschrift, Leer, Knopf, Chip, feld, LEUCHT } from '../schlank';
import { Dialog, Feld, Haken, Hinweis, Kachel, Kacheln, KategorieOptionen, Leiste, auswahl, type HaushaltDaten, type Op } from './gemeinsam';

interface Props {
  h: HaushaltDaten; katName: KatName;
  patch: (teil: string, ops: Op[]) => Promise<boolean>;
  aktion: <T = Record<string, unknown>>(b: Record<string, unknown>) => Promise<(T & { ok: boolean; fehler?: string }) | null>;
  melde: (art: 'ok' | 'fehler' | 'info', titel: string, text?: string) => void;
  laden: () => Promise<void>;
}

const stift = { background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', fontSize: 12.5, padding: '4px 6px', whiteSpace: 'nowrap' } as const;
const chipKnopf = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit' } as const;

/** Alle privaten Ausgaben-Buchungen eines Empfängers (der „Posten“) — über alle Monate, nicht nur das Rechenfenster. */
function postenBuchungen(h: HaushaltDaten, name: string): Buchung[] {
  const k = normal(name);
  return h.buchungen.filter(b => b.einheit === 'privat' && b.betrag < 0 && !b.ist_umbuchung && normal(b.empfaenger || b.beschreibung) === k);
}

export function Fixkosten({ h, katName, patch, aktion, melde, laden }: Props) {
  const heute = heuteBerlin();
  const privat = useMemo(() => h.buchungen.filter(b => b.einheit === 'privat'), [h.buchungen]);
  const schulden = h.schulden.filter(s => s.einheit === 'privat');
  const l = useMemo(() => luft(privat, schulden, katName, heute), [privat, schulden, katName, heute]);
  const w = useMemo(() => wiederkehrend(privat, katName, heute), [privat, katName, heute]);
  const [budget, setBudget] = useState<Kategorie | null>(null);
  const [posten, setPosten] = useState<{ name: string; fix: boolean } | null>(null);
  const [rhythmus, setRhythmus] = useState<{ name: string; ids: string[]; aktuell: Turnus } | null>(null);
  const s = l.sockel;
  const kandidaten = w.filter(x => !x.bereitsMarkiert);
  const unklar = s.posten.filter(p => p.unsicher).length + kandidaten.filter(x => x.unsicher).length;

  const laufend = monatVon(heute);
  // Budget = beeinflussbare Ausgaben: Fixkosten zählen hier nicht mit (27.09.) — ein auf „variabel“ umgestufter Posten erscheint sofort.
  const istJe = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of privat) if (monatVon(b.datum) === laufend && b.betrag < 0 && !b.ist_umbuchung && !b.ist_fixkosten && b.kategorie_id) m.set(b.kategorie_id, (m.get(b.kategorie_id) ?? 0) + Math.abs(b.betrag));
    return m;
  }, [privat, laufend]);
  const kats = h.stamm.kategorien.filter(k => k.typ === 'ausgabe').sort((a, b) => (istJe.get(b.id) ?? 0) - (istJe.get(a.id) ?? 0));
  const mitBudget = kats.filter(k => k.monatsbudget);
  const budgetSumme = mitBudget.reduce((x, k) => x + (k.monatsbudget ?? 0), 0);
  const istSumme = mitBudget.reduce((x, k) => x + (istJe.get(k.id) ?? 0), 0);
  const konto = (id: string | null) => h.stamm.konten.find(k => k.id === id)?.name ?? '';

  const rhythmusChip = (name: string, ids: string[], turnus: Turnus, unsicher: boolean) => (
    <button style={chipKnopf} onClick={() => setRhythmus({ name, ids, aktuell: turnus })} title="Rhythmus ändern" aria-label={`Rhythmus von ${name}: ${unsicher ? 'unklar' : turnusName(turnus)} — ändern`}>
      <Chip farbe={unsicher ? LEUCHT.kritisch : C.inkDim}>{unsicher ? 'Rhythmus unklar ?' : turnusName(turnus)}</Chip>
    </button>
  );

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
        <Hinweis>Gerechnet über die letzten zwölf vollen Monate. Vierteljährliche, halbjährliche und jährliche Zahlungen werden über ihren Rhythmus auf den Monat gerechnet, unregelmäßige mit ihrer Summe durch zwölf. Einkommen ohne Kredite und ohne zurückgeflossenes Geld.{unklar ? <> <strong style={{ color: LEUCHT.kritisch }}>{unklar} Rhythmus{unklar === 1 ? '' : 'en'} unklar</strong> — ein Klick auf den Chip klärt ihn.</> : null}</Hinweis>
      </Karte>

      <Karte i={2}>
        <Ueberschrift farbe={LEUCHT.schlaf} rechts={s.posten.length ? `${s.posten.length} Posten` : undefined}>Eure Fixkosten</Ueberschrift>
        {!s.posten.length ? <Leer>Noch nichts als Fixkosten markiert. Unten stehen die Zahlungen, die regelmäßig kommen — von dort aus markieren.</Leer> : (
          <>
            <div style={{ fontSize: 13, color: C.inkDim, marginBottom: 8 }}>Was jeden Monat fest rausgeht. Der Stift ändert Name, Betrag, Rhythmus, Kategorie, Konto — oder stuft den Posten auf „variabel“ um, dann zählt er im Budget unten.</div>
            {s.posten.map(p => <PostenZeile key={p.name} p={p} katName={katName} konto={konto} rhythmusChip={rhythmusChip} onStift={() => setPosten({ name: p.name, fix: true })} />)}
            {s.raten > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 2px', fontSize: 13, color: C.inkDim }}>
                <span>+ Kreditraten {s.ratenBuchungen > s.ratenSchulden ? '(laut Tilgungs-Buchungen)' : '(aus den Schulden)'}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>= {eur(s.raten)} / Monat</span>
              </div>
            )}
          </>
        )}
      </Karte>

      <Karte i={3}>
        <Ueberschrift rechts={kandidaten.length ? `${kandidaten.length} noch nicht markiert` : w.length ? 'alle markiert' : undefined}>Wiederkehrende Zahlungen</Ueberschrift>
        {!w.length ? <Leer>Noch zu wenig Daten. Sobald ein paar Monate eingelesen sind, erscheint hier, was regelmäßig abgeht.</Leer>
          : !kandidaten.length ? <Leer>Alles, was regelmäßig kommt, ist oben als Fixkosten markiert.</Leer> : (
          <>
            <div style={{ fontSize: 13, color: C.inkDim, marginBottom: 8 }}>Diese Empfänger kommen regelmäßig mit fast gleichem Betrag, zählen aber noch als variabel. Den Rhythmus schätze ich aus den Abständen — ein Klick auf den Chip korrigiert ihn.</div>
            {kandidaten.map(x => (
              <div key={x.name} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: '6px 12px', padding: '10px 2px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{x.name}</div>
                  <div style={{ fontSize: 12, color: C.inkLeise }}>{x.kategorie || 'keine Kategorie'} · {x.monate}× in 12 Monaten · Ø {eur(x.mittel)} {x.schwankung < 0.02 ? '(immer gleich)' : `(±${Math.round(x.schwankung * 100)} %)`}{x.teilweiseMarkiert ? ' · teilweise als Fixkosten markiert' : ''}</div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 13.5, fontVariantNumeric: 'tabular-nums' }}>= {eur(x.proMonat)} / Monat</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>{rhythmusChip(x.name, x.ids, x.turnus, x.unsicher)}</div>
                <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center' }}>
                  <button style={stift} onClick={() => setPosten({ name: x.name, fix: false })} aria-label={`${x.name} bearbeiten`}>✎ Bearbeiten</button>
                  <Knopf farbe={LEUCHT.schlaf} onClick={async () => { const d = await aktion<{ anzahl: number }>({ aktion: 'fixkosten', name: x.name, an: true, turnus: x.turnus }); if (d?.ok) { melde('ok', 'Als Fixkosten markiert', `${x.name} — ${d.anzahl} Buchungen. Künftige Importe erkennen das automatisch.`); await laden(); } }}>Als Fixkosten</Knopf>
                </div>
              </div>
            ))}
          </>
        )}
      </Karte>

      <Karte i={4}>
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
        <Hinweis>Ein Budget gilt für jeden Monat, nicht nur für diesen. Einmal setzen genügt. Gezählt werden nur variable Ausgaben — Fixkosten stehen oben. Kategorien ohne variable Ausgaben und ohne Budget sind ausgeblendet.</Hinweis>
      </Karte>
      {budget && <BudgetDialog k={budget} h={h} patch={patch} melde={melde} onZu={() => setBudget(null)} />}
      {posten && <PostenDialog name={posten.name} h={h} patch={patch} aktion={aktion} melde={melde} onZu={() => setPosten(null)} />}
      {rhythmus && <RhythmusDialog name={rhythmus.name} ids={rhythmus.ids} aktuell={rhythmus.aktuell} h={h} patch={patch} aktion={aktion} melde={melde} laden={laden} onZu={() => setRhythmus(null)} />}
    </>
  );
}

function PostenZeile({ p, katName, konto, rhythmusChip, onStift }: { p: Sockelposten; katName: KatName; konto: (id: string | null) => string; rhythmusChip: (name: string, ids: string[], turnus: Turnus, unsicher: boolean) => ReactNode; onStift: () => void }) {
  const kat = katName(p.kategorie_id), kto = konto(p.konto_id);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: '6px 12px', padding: '10px 2px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{p.name}</div>
        <div style={{ fontSize: 12, color: C.inkLeise }}>{kat || 'keine Kategorie'}{kto ? ` · ${kto}` : ''} · {p.anzahl}× in 12 Monaten · Ø {eur(p.mittel)}</div>
      </div>
      <div style={{ textAlign: 'right', fontSize: 13.5, fontVariantNumeric: 'tabular-nums' }}>= {eur(p.proMonat)} / Monat</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>{rhythmusChip(p.name, p.ids, p.turnus, p.unsicher)}</div>
      <div style={{ textAlign: 'right' }}><button style={stift} onClick={onStift} aria-label={`${p.name} bearbeiten`}>✎ Bearbeiten</button></div>
    </div>
  );
}

/**
 * Ein Posten = alle Ausgaben-Buchungen eines Empfängers. Änderungen gehen als EIN Patch mit
 * dem Stand jeder Zeile — alles oder nichts. Umstufen fix ↔ variabel gilt nur für diese Buchungen;
 * die Regel für den Empfänger (künftige Importe) nur mit Häkchen.
 */
function PostenDialog({ name, h, patch, aktion, melde, onZu }: { name: string; h: HaushaltDaten; patch: Props['patch']; aktion: Props['aktion']; melde: Props['melde']; onZu: () => void }) {
  const zeilen = useMemo(() => postenBuchungen(h, name).sort((a, b) => b.datum.localeCompare(a.datum)), [h, name]); // jüngste zuerst
  const juengste = zeilen[0];
  const einheitlich = zeilen.length > 0 && zeilen.every(b => Math.abs(b.betrag) === Math.abs(zeilen[0].betrag));
  const warFix = zeilen.length > 0 && zeilen.every(b => b.ist_fixkosten);
  const vorschlag = rhythmusVorschlag(zeilen.map(b => monatVon(b.datum)));
  const [e, setE] = useState({
    name, betrag: einheitlich ? String(Math.abs(zeilen[0].betrag) / 100).replace('.', ',') : '',
    turnus: (juengste?.turnus ?? 'monatlich') as Turnus, kategorie_id: juengste?.kategorie_id ?? '', konto_id: juengste?.konto_id ?? '', fix: warFix, regel: false,
  });
  const regelDa = h.stamm.regeln.find(r => normal(r.muster) === normal(name));
  const [laeuft, setLaeuft] = useState(false);
  if (!zeilen.length) return <Dialog titel="Posten bearbeiten" onZu={onZu}><Hinweis>Zu „{name}“ gibt es keine privaten Ausgaben-Buchungen mehr.</Hinweis></Dialog>;
  if (zeilen.length > 200) return <Dialog titel="Posten bearbeiten" onZu={onZu}><Hinweis>„{name}“ hat {zeilen.length} Buchungen — mehr als 200 auf einmal ändert der Patch-Weg nicht. Bitte unter Buchungen filtern und in Teilen ändern.</Hinweis></Dialog>;

  async function speichern() {
    const n = e.name.trim();
    if (!n) { melde('fehler', 'Name fehlt'); return; }
    const roh = e.betrag.trim();
    const cent = roh === '' ? null : zuCent(roh);
    if (roh !== '' && (cent === null || cent <= 0)) { melde('fehler', 'Betrag ist keine Zahl', 'Bitte den Betrag ohne Vorzeichen eingeben, z. B. 89,90.'); return; }
    const betragNeu = cent !== null && (!einheitlich || cent !== Math.abs(zeilen[0].betrag));
    if (!h.stamm.konten.some(k => k.id === e.konto_id)) { melde('fehler', 'Kein gültiges Konto gewählt'); return; }
    setLaeuft(true);
    const ops: Op[] = zeilen.map(b => ({
      op: 'upsert', stand: b.stand,
      eintrag: { ...b, empfaenger: n, beschreibung: b.beschreibung === b.empfaenger ? n : b.beschreibung, ...(betragNeu ? { betrag: -cent! } : {}), turnus: e.turnus, turnus_geklaert: true, kategorie_id: e.kategorie_id || null, konto_id: e.konto_id, ist_fixkosten: e.fix },
    }));
    const ok = await patch('buchungen', ops);
    if (ok && e.regel && e.fix !== warFix) {
      // Empfänger-Regel nur auf Wunsch: markiert künftige Importe gleich (oder nimmt die Markierung aus der Regel).
      const d = await aktion<{ anzahl: number }>({ aktion: 'fixkosten', name: n, an: e.fix, turnus: e.turnus });
      if (!d?.ok) melde('info', 'Posten geändert, Regel nicht', 'Die Buchungen sind gespeichert; die Empfänger-Regel konnte nicht angepasst werden.');
    }
    setLaeuft(false);
    if (ok) {
      melde('ok', e.fix !== warFix ? (e.fix ? 'Als Fixkosten eingestuft' : 'Auf variabel umgestuft') : 'Posten gespeichert', e.fix !== warFix ? `${n} — ${zeilen.length} Buchungen. ${e.fix ? 'Zählt jetzt im Sockel.' : 'Zählt jetzt im Budget und unter Ist gegen Soll als variabel.'}` : `${n} — ${zeilen.length} Buchungen geändert.`);
      onZu();
    }
  }

  return (
    <Dialog titel={`„${name}“ bearbeiten`} onZu={onZu} aktionen={<Knopf farbe={LEUCHT.schlaf} aus={laeuft} onClick={() => void speichern()}>{laeuft ? 'Speichert …' : 'Speichern'}</Knopf>}>
      <div style={{ fontSize: 12.5, color: C.inkDim }}>Gilt für alle <strong>{zeilen.length}</strong> Ausgaben-Buchungen dieses Empfängers ({zeilen.length === 1 ? datumDeKurz(zeilen[0].datum) : `${datumDeKurz(zeilen[zeilen.length - 1].datum)} bis ${datumDeKurz(juengste.datum)}`}). Jede Zeile wird mit ihrem Stand gespeichert — hat jemand inzwischen geändert, kommt eine Rückfrage statt Überschreiben.</div>
      <Feld label="Name / Empfänger-Anzeige"><input value={e.name} onChange={x => setE({ ...e, name: x.target.value })} style={feld} /></Feld>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Feld label={einheitlich ? 'Betrag je Zahlung' : 'Betrag je Zahlung (Beträge unterschiedlich)'}>
          <input inputMode="decimal" value={e.betrag} onChange={x => setE({ ...e, betrag: x.target.value })} placeholder={einheitlich ? '' : `Ø ${eur(zeilen.reduce((s, b) => s + Math.abs(b.betrag), 0) / zeilen.length)} — leer lassen = Beträge bleiben`} style={feld} />
        </Feld>
        <Feld label="Rhythmus"><select value={e.turnus} onChange={x => setE({ ...e, turnus: x.target.value as Turnus })} style={auswahl}>{TURNUS_REIHE.map(t => <option key={t} value={t}>{turnusName(t)}{t === vorschlag.turnus && vorschlag.sicher ? ' (aus den Abständen)' : ''}</option>)}</select></Feld>
      </div>
      {!einheitlich && e.betrag.trim() !== '' && <Hinweis farbe={LEUCHT.achtung}>Achtung: die Beträge dieser Buchungen sind unterschiedlich. Ein Betrag hier setzt ALLE {zeilen.length} auf denselben Wert. Leer lassen, wenn die Kontoauszüge stimmen.</Hinweis>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Feld label="Kategorie"><select value={e.kategorie_id} onChange={x => setE({ ...e, kategorie_id: x.target.value })} style={auswahl}><option value="">— offen —</option><KategorieOptionen kategorien={h.stamm.kategorien} nur={['ausgabe']} /></select></Feld>
        <Feld label="Konto"><select value={e.konto_id} onChange={x => setE({ ...e, konto_id: x.target.value })} style={auswahl}>{h.stamm.konten.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}</select></Feld>
      </div>
      <Feld label="Einstufung">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {([[true, 'Fixkosten — zählt im Sockel'], [false, 'Variabel — zählt im Budget']] as [boolean, string][]).map(([fix, text]) => (
            <button key={String(fix)} type="button" onClick={() => setE({ ...e, fix })} aria-pressed={e.fix === fix} style={{ ...auswahl, width: 'auto', cursor: 'pointer', borderColor: e.fix === fix ? LEUCHT.schlaf : 'rgba(255,255,255,.06)', color: e.fix === fix ? C.ink : C.inkDim, background: e.fix === fix ? `${LEUCHT.schlaf}22` : 'rgba(255,255,255,.05)' }}>{text}</button>
          ))}
        </div>
      </Feld>
      {e.fix !== warFix && (
        <>
          <Haken an={e.regel} onChange={v => setE({ ...e, regel: v })}>Auch künftige Buchungen dieses Empfängers so einordnen (Regel merken)</Haken>
          {!e.regel && !e.fix && regelDa?.ist_fixkosten && <Hinweis farbe={LEUCHT.achtung}>Eine Regel markiert neue Buchungen von „{regelDa.muster}“ weiter als Fixkosten. Häkchen setzen, wenn das auch aufhören soll.</Hinweis>}
          {!e.regel && <Hinweis>Ohne Häkchen ändert sich nur dieser Posten — die {zeilen.length} vorhandenen Buchungen. Rückwirkend sichtbar in Ist gegen Soll, Analyse und im Budget.</Hinweis>}
        </>
      )}
    </Dialog>
  );
}

/** Rhythmus klären: fünf Antworten, Vorschlag aus den Abständen. Speichert am Posten (alle Buchungen des Empfängers) und in seiner Regel. */
function RhythmusDialog({ name, ids, aktuell, h, patch, aktion, melde, laden, onZu }: { name: string; ids: string[]; aktuell: Turnus; h: HaushaltDaten; patch: Props['patch']; aktion: Props['aktion']; melde: Props['melde']; laden: () => Promise<void>; onZu: () => void }) {
  const zeilen = useMemo(() => { const drin = new Set(ids); return h.buchungen.filter(b => drin.has(b.id)); }, [h.buchungen, ids]);
  const v = useMemo(() => rhythmusVorschlag(zeilen.map(b => monatVon(b.datum))), [zeilen]);
  const [wahl, setWahl] = useState<Turnus>(v.sicher ? v.turnus : aktuell);
  const [laeuft, setLaeuft] = useState(false);
  const monateText = zeilen.map(b => monatVon(b.datum)).filter((m, i, a) => a.indexOf(m) === i).sort().map(m => monatName(m, false).slice(0, 3) + ' ' + m.slice(2, 4)).join(' · ');

  async function speichern() {
    setLaeuft(true);
    // Erst über den Empfänger (setzt Buchungen + Regel, markiert „geklärt“); trifft der keine Zeile (Empfänger leer), direkt die Zeilen.
    const d = await aktion<{ anzahl: number }>({ aktion: 'turnus', name, turnus: wahl });
    let ok = !!d?.ok && (d?.anzahl ?? 0) > 0;
    if (!ok && d?.ok) {
      const alle = postenBuchungen(h, name);
      ok = await patch('buchungen', alle.slice(0, 200).map(b => ({ op: 'upsert', stand: b.stand, eintrag: { ...b, turnus: wahl, turnus_geklaert: true } })));
    } else if (ok) await laden();
    setLaeuft(false);
    if (ok) { melde('ok', 'Rhythmus gesetzt', `${name} läuft ${turnusName(wahl)}.`); onZu(); }
  }

  return (
    <Dialog titel={`Rhythmus von „${name}“`} onZu={onZu} aktionen={<Knopf farbe={LEUCHT.schlaf} aus={laeuft} onClick={() => void speichern()}>{laeuft ? 'Speichert …' : 'So ist es'}</Knopf>}>
      <div style={{ fontSize: 13, color: C.inkDim, lineHeight: 1.5 }}>
        Gezahlt in: <span style={{ color: C.ink }}>{monateText || '–'}</span><br />
        {v.text}. {v.sicher ? <>Das sieht nach <strong style={{ color: C.ink }}>{turnusName(v.turnus)}</strong> aus.</> : <>Ein klares Muster erkenne ich nicht — wenn du es weißt, wähl es; sonst „unregelmäßig“ (dann rechne ich mit der Summe durch zwölf).</>}
      </div>
      <div role="radiogroup" aria-label="Rhythmus" style={{ display: 'grid', gap: 6 }}>
        {TURNUS_REIHE.map(t => (
          <label key={t} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 10px', borderRadius: 10, cursor: 'pointer', background: wahl === t ? `${LEUCHT.schlaf}22` : 'rgba(255,255,255,.04)', border: `1px solid ${wahl === t ? LEUCHT.schlaf : 'transparent'}` }}>
            <input type="radio" name="rhythmus" value={t} checked={wahl === t} onChange={() => setWahl(t)} style={{ accentColor: LEUCHT.schlaf }} />
            <span style={{ flex: 1 }}>{turnusName(t)}</span>
            {t === v.turnus && v.sicher && <Chip farbe={LEUCHT.schlaf}>Vorschlag</Chip>}
            {t === aktuell && t !== v.turnus && <span style={{ fontSize: 12, color: C.inkLeise }}>bisher</span>}
          </label>
        ))}
      </div>
      <Hinweis>Der Rhythmus gilt für alle Buchungen dieses Empfängers und seine Regel; der Chip „Rhythmus unklar“ verschwindet. Der Monatswert im Sockel rechnet ab sofort damit.</Hinweis>
    </Dialog>
  );
}

const datumDeKurz = (tag: string) => `${tag.slice(8, 10)}.${tag.slice(5, 7)}.${tag.slice(0, 4)}`;

function BudgetDialog({ k, h, patch, melde, onZu }: { k: Kategorie; h: HaushaltDaten; patch: Props['patch']; melde: Props['melde']; onZu: () => void }) {
  const monate = vollMonate(3);
  const schnitt = inMonaten(h.buchungen, monate).filter(b => b.kategorie_id === k.id && b.betrag < 0 && !b.ist_umbuchung && !b.ist_fixkosten).reduce((s, b) => s + Math.abs(b.betrag), 0) / 3;
  const [wert, setWert] = useState(k.monatsbudget ? String(k.monatsbudget / 100) : schnitt ? String(Math.round(schnitt / 1000) * 10) : '');
  return (
    <Dialog titel={`Budget für „${k.name}“`} onZu={onZu} aktionen={<Knopf farbe={LEUCHT.achtung} onClick={async () => {
      const roh = wert.trim();
      const cent = roh === '' ? null : zuCent(roh);
      if (roh !== '' && cent === null) { melde('fehler', 'Keine gültige Zahl'); return; }
      const ok = await patch('kategorien', [{ op: 'upsert', stand: k.stand, eintrag: { ...k, monatsbudget: cent } }]);
      if (ok) { melde('ok', cent === null ? 'Budget entfernt' : 'Budget gesetzt', k.name); onZu(); }
    }}>Speichern</Knopf>}>
      <div>{schnitt > 0 ? <>In den letzten drei Monaten habt ihr hier durchschnittlich <strong>{eur(schnitt)}</strong> im Monat variabel ausgegeben (ohne Fixkosten).</> : <span style={{ color: C.inkDim }}>Für diese Kategorie gibt es noch keine variablen Vergangenheitswerte.</span>}</div>
      <Feld label="Monatliches Budget in Euro"><input inputMode="decimal" value={wert} onChange={e => setWert(e.target.value)} style={feld} /></Feld>
      <div style={{ fontSize: 12.5, color: C.inkLeise }}>Leer lassen und speichern entfernt das Budget wieder.</div>
    </Dialog>
  );
}
