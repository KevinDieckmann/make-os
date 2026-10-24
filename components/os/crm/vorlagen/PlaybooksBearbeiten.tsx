'use client';

// ─── Markttraktion · Playbooks bearbeiten (Restpunkte 24.10.) ───────────────────────────────────────────────────────────────────────────────────────────────
// Kevin 22.10.: „alles muss anpassbar sein und es muss auch immer mal wieder zu bearbeiten sein.“ Je Playbook: Texte, Kanal, Segment-Vorschlag und die
// Nachfass-Schritte; „Als eigene Vorlage kopieren“, „Zurück auf Standard“, eigene löschen (Rückfrage). Fest bleiben Rechtshinweis, Zielgruppen-Filter und
// Zuständigkeit (aus dem Code) — sie stehen hier nur zum Lesen. Die Ampel-Prüfung läuft auch über eigene Texte (werbliche Wörter → UWG-Hinweis, live).
// Geschrieben nur über POST /api/crm/vorlagen (Stand/409); geöffnet aus Marketing › Kampagnen bzw. über den Link der Stellschraube (`vorlagen=1`).

import { useEffect, useMemo, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Knopf, Hinweis, Chip, Liste, Zeile, Leer, Feldzeile, feld, auswahl, useRueckfrage } from '../../ui';
import { Fenster } from '../../Fenster';
import type { Playbook } from '@/lib/crm/kampagnen';
import { PLAYBOOK_KANAELE, KANAL_FEST, NICHT_KOPIERBAR, VORLAGEN_GRENZEN as G, playbookHinweise, type PlaybookKanal } from '@/lib/crm/vorlagen-regeln';
import { useVorlagen, vorlageAendern } from './daten';

interface Entwurf { name: string; kurz: string; warum: string; kennzahl: string; kanal: PlaybookKanal; segmentId: string; schritte: { text: string; tag: string }[] }
const entwurfAus = (p: Playbook): Entwurf => ({
  name: p.name, kurz: p.kurz, warum: p.warum, kennzahl: p.kennzahl, kanal: p.kanal as PlaybookKanal, segmentId: p.segmentId ?? '',
  schritte: p.schritte.map(s => ({ text: s.text, tag: String(s.tag) })),
});
const klein = { fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 } as const;

export function PlaybooksBearbeiten({ segmente, onZu, onGeaendert, start }: {
  segmente: readonly { id: string; name: string }[]; onZu: () => void; onGeaendert: () => void; start?: string;
}) {
  const { daten, fehler: ladeFehler } = useVorlagen<Playbook>('playbook');
  const [id, setId] = useState<string | null>(start ?? null);
  const liste = daten?.vorlagen ?? [];
  const p = liste.find(x => x.id === id) ?? null;
  const [e, setE] = useState<Entwurf | null>(null);
  const [meldung, setMeldung] = useState<{ art: 'gut' | 'kritisch' | 'achtung'; text: string } | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const frage = useRueckfrage();
  // Neue Auswahl bzw. neuer Stand vom Server: der Entwurf folgt (die Meldung bleibt stehen).
  const schluessel = p ? JSON.stringify(p) : '';
  // eslint-disable-next-line react-hooks/exhaustive-deps -- nur, wenn sich die Vorlage ändert
  useEffect(() => { setE(p ? entwurfAus(p) : null); }, [schluessel]);
  const geaendert = !!(p && e && JSON.stringify(entwurfAus(p)) !== JSON.stringify(e));
  const hinweise = useMemo(() => (e ? playbookHinweise({ ...e, schritte: e.schritte }) : []), [e]);

  const schicken = async (a: Parameters<typeof vorlageAendern>[2], gut: string) => {
    if (!daten) return;
    setLaeuft(true); setMeldung(null);
    const r = await vorlageAendern<Playbook>('playbook', daten.stand, a);
    setLaeuft(false);
    if (!r.ok) { setMeldung({ art: r.konflikt ? 'achtung' : 'kritisch', text: r.fehler }); return; }
    setId(r.id); setMeldung({ art: 'gut', text: gut }); onGeaendert();
  };
  const speichern = () => {
    if (!p || !e) return;
    const schritte = e.schritte.map(s => ({ text: s.text.trim(), tag: Number(s.tag) }));
    if (schritte.some(s => !s.text || !Number.isInteger(s.tag) || s.tag < 0 || s.tag > G.schrittTag)) { setMeldung({ art: 'kritisch', text: `Jeder Schritt braucht einen Text und einen Tag 0–${G.schrittTag}.` }); return; }
    void schicken({ op: 'speichern', id: p.id, vorlage: { name: e.name, kurz: e.kurz, warum: e.warum, kennzahl: e.kennzahl, kanal: e.kanal, segmentId: e.segmentId || null, schritte } }, 'Gespeichert — neue Kampagnen aus diesem Playbook nehmen die Änderung.');
  };
  const loeschen = async () => {
    if (!p) return;
    if (!(await frage.bestaetigen({ titel: `„${p.name}“ löschen?`, text: 'Die eigene Vorlage ist danach weg. Kampagnen, die schon daraus geplant sind, bleiben, wie sie sind.', ja: 'Löschen', gefahr: true }))) return;
    await schicken({ op: 'loeschen', id: p.id }, 'Gelöscht.');
    setId(null);
  };
  const setzeSchritt = (i: number, t: Partial<Entwurf['schritte'][number]>) => setE(x => (x ? { ...x, schritte: x.schritte.map((s, j) => (j === i ? { ...s, ...t } : s)) } : x));

  return (
    <Fenster titel="Playbooks bearbeiten" onZu={onZu} breit={960}>
      <p style={{ ...klein, margin: 0 }}>Texte, Kanal, Segment-Vorschlag und Nachfass-Schritte je Playbook. Gespeichert wird nur, was von der Vorgabe abweicht — „Zurück auf Standard“ nimmt es wieder heraus. Rechtshinweise bleiben fest.</p>
      {ladeFehler && !daten && <Hinweis art="kritisch">{ladeFehler}</Hinweis>}
      {!daten && !ladeFehler && <Leer>Lädt …</Leer>}
      {daten && !p && (
        <Liste>
          {liste.map(x => (
            <Zeile key={x.id} onClick={() => { setId(x.id); setMeldung(null); }} titel={x.name} unter={x.kurz}
              rechts={x.eigen ? <Chip farbe={C.aktiv}>eigen</Chip> : x.angepasst ? <Chip farbe={C.aktiv}>angepasst</Chip> : <span style={klein}>bearbeiten ›</span>} />
          ))}
        </Liste>
      )}
      {daten && p && e && (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Knopf leise onClick={() => { setId(null); setMeldung(null); }}>‹ Alle Playbooks</Knopf>
            {p.eigen ? <Chip farbe={C.aktiv}>eigene Vorlage</Chip> : p.angepasst ? <Chip farbe={C.aktiv}>angepasst</Chip> : <Chip farbe={C.inkDim}>wie im System</Chip>}
          </div>
          <Feldzeile label="Name"><input value={e.name} maxLength={G.name} onChange={x => setE({ ...e, name: x.target.value })} style={feld} aria-label="Name" /></Feldzeile>
          <Feldzeile label="Kurz"><input value={e.kurz} maxLength={G.kurz} onChange={x => setE({ ...e, kurz: x.target.value })} style={feld} aria-label="Kurzbeschreibung" /></Feldzeile>
          <Feldzeile label="Warum es wirkt"><textarea value={e.warum} maxLength={G.warum} rows={3} onChange={x => setE({ ...e, warum: x.target.value })} style={{ ...feld, resize: 'vertical' }} aria-label="Warum es wirkt" /></Feldzeile>
          <Feldzeile label="Messgröße"><input value={e.kennzahl} maxLength={G.kennzahl} onChange={x => setE({ ...e, kennzahl: x.target.value })} style={feld} aria-label="Messgröße" /></Feldzeile>
          <Feldzeile label="Kanal">
            <select value={e.kanal} disabled={KANAL_FEST.has(p.basis ?? p.id)} onChange={x => setE({ ...e, kanal: x.target.value as PlaybookKanal })} style={auswahl} aria-label="Kanal">
              {PLAYBOOK_KANAELE.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
            </select>
          </Feldzeile>
          <Feldzeile label="Segment-Vorschlag">
            <select value={e.segmentId} onChange={x => setE({ ...e, segmentId: x.target.value })} style={auswahl} aria-label="Segment-Vorschlag">
              <option value="">Zielgruppe der Vorgabe</option>
              {segmente.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              {e.segmentId && !segmente.some(s => s.id === e.segmentId) && <option value={e.segmentId}>Segment fehlt (gelöscht)</option>}
            </select>
          </Feldzeile>
          <Feldzeile label="Nachfass-Schritte">
            <div style={{ display: 'grid', gap: 8 }}>
              {e.schritte.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input value={s.tag} inputMode="numeric" onChange={x => setzeSchritt(i, { tag: x.target.value })} style={{ ...feld, width: 80 }} aria-label={`Schritt ${i + 1}: Tag`} />
                  <input value={s.text} maxLength={G.schrittText} onChange={x => setzeSchritt(i, { text: x.target.value })} style={{ ...feld, flex: 1, minWidth: 0 }} aria-label={`Schritt ${i + 1}: Text`} />
                  <Knopf leise aus={e.schritte.length <= 1} onClick={() => setE({ ...e, schritte: e.schritte.filter((_, j) => j !== i) })} titel="Schritt entfernen">×</Knopf>
                </div>
              ))}
              <div><Knopf leise aus={e.schritte.length >= G.schritte} onClick={() => setE({ ...e, schritte: [...e.schritte, { text: '', tag: String(Number(e.schritte.at(-1)?.tag ?? 0) + 3) }] })}>+ Schritt</Knopf></div>
              <span style={klein}>Tag = Tage nach dem Start der Kampagne.</span>
            </div>
          </Feldzeile>
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><Chip farbe={C.inkDim}>fest (Gesetz)</Chip><span style={klein}>⚖ {p.recht}</span></div>
            <span style={{ ...klein, color: C.inkLeise }}>Zielgruppen-Filter und Zuständigkeit ({p.fuer.map(f => (f === 'head-sales' ? 'Sales' : 'Marketing')).join(' & ')}) kommen aus dem System.</span>
          </div>
          {hinweise.map(h => <Hinweis key={h} art="achtung">{h}</Hinweis>)}
          {meldung && <Hinweis art={meldung.art} rolle={meldung.art === 'gut' ? 'status' : 'alert'}>{meldung.text}</Hinweis>}
          {!daten.aendern && <Hinweis art="info">Dieses Konto liest hier nur — ändern dürfen Inhaber und volle Mitglieder.</Hinweis>}
          {daten.aendern && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Knopf haupt aus={!geaendert || laeuft} onClick={speichern}>{laeuft ? 'Speichert …' : 'Speichern'}</Knopf>
            {!NICHT_KOPIERBAR.has(p.basis ?? p.id) && <Knopf leise aus={laeuft} onClick={() => void schicken({ op: 'kopieren', id: p.id }, 'Als eigene Vorlage kopiert — jetzt bearbeiten.')}>Als eigene Vorlage kopieren</Knopf>}
            {p.angepasst && <Knopf leise aus={laeuft} onClick={() => void schicken({ op: 'standard', id: p.id }, 'Zurück auf Standard.')}>Zurück auf Standard</Knopf>}
            {p.eigen && <Knopf leise aus={laeuft} onClick={() => void loeschen()}>Löschen</Knopf>}
          </div>}
        </div>
      )}
      {frage.dialog}
    </Fenster>
  );
}
