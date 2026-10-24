'use client';

// ─── Markttraktion · Event-Vorlagen bearbeiten (Restpunkte 24.10.) ──────────────────────────────────────────────────────────────────────────────────────────
// Vorlagen eigener Abende (Make.One): Name, Beschreibung, Uhrzeit, Plätze, Soll-Mischung, Ablauf, Checkliste (Tage vorher, negativ = danach) und Budget-Posten.
// „Als eigene Vorlage kopieren“, „Zurück auf Standard“, eigene löschen (Rückfrage). Das Format und der Satz zum UWG bleiben fest. Kennungen der Checklisten-
// Punkte und Budget-Posten bleiben beim Bearbeiten (eine zweite Vorlage legt sonst Punkte doppelt an). Geschrieben nur über POST /api/crm/vorlagen.

import { useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Knopf, Hinweis, Chip, Liste, Zeile, Leer, Feldzeile, feld, useRueckfrage } from '../../ui';
import { Fenster } from '../../Fenster';
import type { Vorlage } from '@/lib/crm/eventplanung';
import { EVENT_RECHT, VORLAGEN_GRENZEN as G } from '@/lib/crm/vorlagen-regeln';
import { useVorlagen, vorlageAendern } from './daten';

interface Entwurf {
  label: string; beschreibung: string; uhrzeit: string; kapazitaet: string; zielkunden: string; kunden: string;
  ablauf: { zeit: string; punkt: string }[]; checkliste: { id?: string; text: string; tageVorher: string }[]; budget: { id?: string; posten: string }[];
}
const entwurfAus = (v: Vorlage): Entwurf => ({
  label: v.label, beschreibung: v.beschreibung, uhrzeit: v.uhrzeit, kapazitaet: String(v.kapazitaet), zielkunden: String(v.mixZiel.zielkunden), kunden: String(v.mixZiel.kunden),
  ablauf: v.ablauf.map(a => ({ ...a })), checkliste: v.checkliste.map(c => ({ id: c.id, text: c.text, tageVorher: String(c.tageVorher) })), budget: v.budget.map(b => ({ ...b })),
});
const klein = { fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 } as const;
const zahl = (t: string) => (/^-?\d+$/.test(t.trim()) ? Number(t.trim()) : NaN);

export function EventVorlagenBearbeiten({ onZu, start }: { onZu: () => void; start?: string }) {
  const { daten, fehler: ladeFehler } = useVorlagen<Vorlage>('event');
  const [id, setId] = useState<string | null>(start ?? null);
  const liste = daten?.vorlagen ?? [];
  const v = liste.find(x => x.id === id) ?? null;
  const [e, setE] = useState<Entwurf | null>(null);
  const [meldung, setMeldung] = useState<{ art: 'gut' | 'kritisch' | 'achtung'; text: string } | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const frage = useRueckfrage();
  const schluessel = v ? JSON.stringify(v) : '';
  // eslint-disable-next-line react-hooks/exhaustive-deps -- nur, wenn sich die Vorlage ändert
  useEffect(() => { setE(v ? entwurfAus(v) : null); }, [schluessel]);
  const geaendert = !!(v && e && JSON.stringify(entwurfAus(v)) !== JSON.stringify(e));

  const schicken = async (a: Parameters<typeof vorlageAendern>[2], gut: string) => {
    if (!daten) return;
    setLaeuft(true); setMeldung(null);
    const r = await vorlageAendern<Vorlage>('event', daten.stand, a);
    setLaeuft(false);
    if (!r.ok) { setMeldung({ art: r.konflikt ? 'achtung' : 'kritisch', text: r.fehler }); return; }
    setId(r.id); setMeldung({ art: 'gut', text: gut });
  };
  const speichern = () => {
    if (!v || !e) return;
    // Zahlen prüft der Server (400 mit Satz) — hier nur, was sich nicht als Zahl lesen lässt.
    const vorlage = {
      label: e.label, beschreibung: e.beschreibung, uhrzeit: e.uhrzeit, kapazitaet: zahl(e.kapazitaet), mixZiel: { zielkunden: zahl(e.zielkunden), kunden: zahl(e.kunden) },
      ablauf: e.ablauf.filter(a => a.punkt.trim()).map(a => ({ zeit: a.zeit, punkt: a.punkt.trim() })),
      checkliste: e.checkliste.filter(c => c.text.trim()).map(c => ({ ...(c.id ? { id: c.id } : {}), text: c.text.trim(), tageVorher: zahl(c.tageVorher) })),
      budget: e.budget.filter(b => b.posten.trim()).map(b => ({ ...(b.id ? { id: b.id } : {}), posten: b.posten.trim() })),
    };
    void schicken({ op: 'speichern', id: v.id, vorlage }, 'Gespeichert — neue Events aus dieser Vorlage nehmen die Änderung.');
  };
  const loeschen = async () => {
    if (!v) return;
    if (!(await frage.bestaetigen({ titel: `„${v.label}“ löschen?`, text: 'Die eigene Vorlage ist danach weg. Events, die schon damit angelegt sind, bleiben, wie sie sind.', ja: 'Löschen', gefahr: true }))) return;
    await schicken({ op: 'loeschen', id: v.id }, 'Gelöscht.');
    setId(null);
  };
  const liste2 = <K extends 'ablauf' | 'checkliste' | 'budget'>(k: K, i: number, t: Partial<Entwurf[K][number]>) =>
    setE(x => (x ? { ...x, [k]: (x[k] as Entwurf[K][number][]).map((a, j) => (j === i ? { ...a, ...t } : a)) } : x));
  const weg = (k: 'ablauf' | 'checkliste' | 'budget', i: number) => setE(x => (x ? { ...x, [k]: (x[k] as unknown[]).filter((_, j) => j !== i) } : x));

  return (
    <Fenster titel="Event-Vorlagen bearbeiten" onZu={onZu} breit={960}>
      <p style={{ ...klein, margin: 0 }}>Ablauf, Checkliste mit Vorlauf und Budget-Posten je Vorlage. Gespeichert wird nur, was von der Vorgabe abweicht — „Zurück auf Standard“ nimmt es wieder heraus.</p>
      {ladeFehler && !daten && <Hinweis art="kritisch">{ladeFehler}</Hinweis>}
      {!daten && !ladeFehler && <Leer>Lädt …</Leer>}
      {daten && !v && (
        <Liste>
          {liste.map(x => (
            <Zeile key={x.id} onClick={() => { setId(x.id); setMeldung(null); }} titel={x.label} unter={`${x.beschreibung} ${x.checkliste.length} Punkte · ${x.kapazitaet} Plätze`}
              rechts={x.eigen ? <Chip farbe={C.aktiv}>eigen</Chip> : x.angepasst ? <Chip farbe={C.aktiv}>angepasst</Chip> : <span style={klein}>bearbeiten ›</span>} />
          ))}
        </Liste>
      )}
      {daten && v && e && (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Knopf leise onClick={() => { setId(null); setMeldung(null); }}>‹ Alle Vorlagen</Knopf>
            {v.eigen ? <Chip farbe={C.aktiv}>eigene Vorlage</Chip> : v.angepasst ? <Chip farbe={C.aktiv}>angepasst</Chip> : <Chip farbe={C.inkDim}>wie im System</Chip>}
          </div>
          <Feldzeile label="Name"><input value={e.label} maxLength={G.label} onChange={x => setE({ ...e, label: x.target.value })} style={feld} aria-label="Name" /></Feldzeile>
          <Feldzeile label="Beschreibung"><textarea value={e.beschreibung} maxLength={G.beschreibung} rows={2} onChange={x => setE({ ...e, beschreibung: x.target.value })} style={{ ...feld, resize: 'vertical' }} aria-label="Beschreibung" /></Feldzeile>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Feldzeile label="Uhrzeit"><input type="time" value={e.uhrzeit} onChange={x => setE({ ...e, uhrzeit: x.target.value })} style={{ ...feld, width: 130 }} aria-label="Uhrzeit" /></Feldzeile>
            <Feldzeile label="Plätze"><input value={e.kapazitaet} inputMode="numeric" onChange={x => setE({ ...e, kapazitaet: x.target.value })} style={{ ...feld, width: 100 }} aria-label="Plätze" /></Feldzeile>
            <Feldzeile label="Soll Zielkunden %"><input value={e.zielkunden} inputMode="numeric" onChange={x => setE({ ...e, zielkunden: x.target.value })} style={{ ...feld, width: 100 }} aria-label="Soll Zielkunden in Prozent" /></Feldzeile>
            <Feldzeile label="Soll Kunden %"><input value={e.kunden} inputMode="numeric" onChange={x => setE({ ...e, kunden: x.target.value })} style={{ ...feld, width: 100 }} aria-label="Soll Kunden in Prozent" /></Feldzeile>
          </div>
          <Feldzeile label="Ablauf">
            <div style={{ display: 'grid', gap: 8 }}>
              {e.ablauf.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="time" value={a.zeit} onChange={x => liste2('ablauf', i, { zeit: x.target.value })} style={{ ...feld, width: 130 }} aria-label={`Ablauf ${i + 1}: Uhrzeit`} />
                  <input value={a.punkt} maxLength={G.ablaufPunkt} onChange={x => liste2('ablauf', i, { punkt: x.target.value })} style={{ ...feld, flex: 1, minWidth: 0 }} aria-label={`Ablauf ${i + 1}: Punkt`} />
                  <Knopf leise onClick={() => weg('ablauf', i)} titel="Punkt entfernen">×</Knopf>
                </div>
              ))}
              <div><Knopf leise aus={e.ablauf.length >= G.ablauf} onClick={() => setE({ ...e, ablauf: [...e.ablauf, { zeit: e.ablauf.at(-1)?.zeit ?? e.uhrzeit, punkt: '' }] })}>+ Ablauf-Punkt</Knopf></div>
            </div>
          </Feldzeile>
          <Feldzeile label="Checkliste">
            <div style={{ display: 'grid', gap: 8 }}>
              {e.checkliste.map((c, i) => (
                <div key={c.id ?? `neu-${i}`} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input value={c.tageVorher} inputMode="numeric" onChange={x => liste2('checkliste', i, { tageVorher: x.target.value })} style={{ ...feld, width: 90 }} aria-label={`Checkliste ${i + 1}: Tage vorher`} />
                  <input value={c.text} maxLength={G.checklistenText} onChange={x => liste2('checkliste', i, { text: x.target.value })} style={{ ...feld, flex: 1, minWidth: 0 }} aria-label={`Checkliste ${i + 1}: Text`} />
                  <Knopf leise onClick={() => weg('checkliste', i)} titel="Punkt entfernen">×</Knopf>
                </div>
              ))}
              <div><Knopf leise aus={e.checkliste.length >= G.checkliste} onClick={() => setE({ ...e, checkliste: [...e.checkliste, { text: '', tageVorher: '7' }] })}>+ Checklisten-Punkt</Knopf></div>
              <span style={klein}>Zahl = Tage vor dem Event (negativ = danach, z. B. −1 fürs Nachfassen).</span>
            </div>
          </Feldzeile>
          <Feldzeile label="Budget-Posten">
            <div style={{ display: 'grid', gap: 8 }}>
              {e.budget.map((b, i) => (
                <div key={b.id ?? `neu-${i}`} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input value={b.posten} maxLength={G.posten} onChange={x => liste2('budget', i, { posten: x.target.value })} style={{ ...feld, flex: 1, minWidth: 0 }} aria-label={`Budget-Posten ${i + 1}`} />
                  <Knopf leise onClick={() => weg('budget', i)} titel="Posten entfernen">×</Knopf>
                </div>
              ))}
              <div><Knopf leise aus={e.budget.length >= G.budget} onClick={() => setE({ ...e, budget: [...e.budget, { posten: '' }] })}>+ Budget-Posten</Knopf></div>
              <span style={klein}>Nur die Posten — die Beträge trägt jedes Event selbst.</span>
            </div>
          </Feldzeile>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><Chip farbe={C.inkDim}>fest (Gesetz)</Chip><span style={klein}>⚖ {daten.recht ?? EVENT_RECHT}</span></div>
          {meldung && <Hinweis art={meldung.art} rolle={meldung.art === 'gut' ? 'status' : 'alert'}>{meldung.text}</Hinweis>}
          {!daten.aendern && <Hinweis art="info">Dieses Konto liest hier nur — ändern dürfen Inhaber und volle Mitglieder.</Hinweis>}
          {daten.aendern && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Knopf haupt aus={!geaendert || laeuft} onClick={speichern}>{laeuft ? 'Speichert …' : 'Speichern'}</Knopf>
            <Knopf leise aus={laeuft} onClick={() => void schicken({ op: 'kopieren', id: v.id }, 'Als eigene Vorlage kopiert — jetzt bearbeiten.')}>Als eigene Vorlage kopieren</Knopf>
            {v.angepasst && <Knopf leise aus={laeuft} onClick={() => void schicken({ op: 'standard', id: v.id }, 'Zurück auf Standard.')}>Zurück auf Standard</Knopf>}
            {v.eigen && <Knopf leise aus={laeuft} onClick={() => void loeschen()}>Löschen</Knopf>}
          </div>}
        </div>
      )}
      {frage.dialog}
    </Fenster>
  );
}
