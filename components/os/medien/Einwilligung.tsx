'use client';

// ─── Fotos & Videos — Einwilligung am Handy festhalten (09.10., Paket 5) ─────────────────────────────────────────────────
// Kevin 09.10.: „Einwilligung per Unterschrift am Handy“ — Wortlaut aus der Vorlage des Servers (Verantwortlicher aus System › Datenschutz,
// nie ein Name im Code), Zwecke einzeln (Website, Social Media, Newsletter, Presse, Druck, KI-Bearbeitung extra), bei Minderjährigen die
// Sorgeberechtigten. Die Person liest den Text auf dem Gerät und unterschreibt mit dem Finger; gespeichert wird nur anhängend (Wortlaut,
// Fassung, Zeit, wer erfasst hat, Unterschrift verschlüsselt). Widerruf: in der Liste der Einwilligungen — sperrt sofort alle Medien.
// Hinweis, keine Rechtsberatung (Entwurf research/agenten/RECHT.md 6.4 — einmal anwaltlich gegenlesen).

import { useEffect, useMemo, useRef, useState } from 'react';
import { Knopf, Hinweis, MehrfachPillen, Feldzeile, Schalter, eingabe } from '../ui';
import { Fenster } from '../Fenster';
import { FARBE as C, TYP, LEUCHT } from '@/lib/make-one/design';
import { suchPasst } from '@/lib/text/such-norm';
import { ZWECKE, KANAL_NAME, type EinwilligungZweck } from '@/lib/medien/typen';
import { medienAktion } from './daten';

const ZWECK_NAME = (z: EinwilligungZweck) => (z === 'ki' ? 'KI-Bearbeitung' : KANAL_NAME[z]);

export function EinwilligungFenster({ albumId, anlass, kontakte, onZu, onFertig }: { albumId?: string; anlass?: string; kontakte: readonly { id: string; name: string }[]; onZu: () => void; onFertig: (id: string) => void }) {
  const [suche, setSuche] = useState('');
  const [kontakt, setKontakt] = useState<{ id: string; name: string } | null>(null);
  const [name, setName] = useState('');
  const [zwecke, setZwecke] = useState<EinwilligungZweck[]>(['website', 'social']);
  const [kind, setKind] = useState(false);
  const [sorge, setSorge] = useState('');
  const [vorlage, setVorlage] = useState<{ wortlaut: string; fassung: string; verantwortlicherFehlt: boolean } | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [unterschrieben, setUnterschrieben] = useState(false);
  const leinwand = useRef<HTMLCanvasElement>(null);
  const treffer = useMemo(() => (suche.trim().length >= 2 ? kontakte.filter(k => suchPasst([k.name], suche)).slice(0, 6) : []), [suche, kontakte]);

  useEffect(() => {
    const q = new URLSearchParams({ vorlage: 'einwilligung', zwecke: zwecke.join(','), ...(kind ? { sorge: '1' } : {}), ...(anlass ? { anlass } : {}) });
    void fetch(`/api/medien?${q}`, { cache: 'no-store' }).then(r => r.json()).then(d => { if (d?.ok) setVorlage(d); }).catch(() => setFehler('Der Text der Einwilligung lädt nicht — kein Netz?'));
  }, [zwecke, kind, anlass]);

  // Unterschrift: Zeigerereignisse (Finger, Stift, Maus) — ohne Scrollen auf der Fläche.
  useEffect(() => {
    const c = leinwand.current;
    if (!c) return;
    const g = c.getContext('2d');
    if (!g) return;
    g.lineWidth = 2.5; g.lineCap = 'round'; g.strokeStyle = '#111';
    let zeichnet = false;
    const punkt = (e: PointerEvent) => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * (c.width / r.width), (e.clientY - r.top) * (c.height / r.height)] as const; };
    const ab = (e: PointerEvent) => { zeichnet = true; c.setPointerCapture(e.pointerId); const [x, y] = punkt(e); g.beginPath(); g.moveTo(x, y); };
    const zug = (e: PointerEvent) => { if (!zeichnet) return; const [x, y] = punkt(e); g.lineTo(x, y); g.stroke(); setUnterschrieben(true); };
    const auf = () => { zeichnet = false; };
    c.addEventListener('pointerdown', ab); c.addEventListener('pointermove', zug); c.addEventListener('pointerup', auf); c.addEventListener('pointercancel', auf);
    return () => { c.removeEventListener('pointerdown', ab); c.removeEventListener('pointermove', zug); c.removeEventListener('pointerup', auf); c.removeEventListener('pointercancel', auf); };
  }, []);
  const loeschen = () => { const c = leinwand.current; const g = c?.getContext('2d'); if (c && g) { g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); } setUnterschrieben(false); };
  useEffect(loeschen, []);

  const speichern = async () => {
    setFehler(null);
    if (!vorlage) return;
    const unterschrift = leinwand.current?.toDataURL('image/png') ?? '';
    const r = await medienAktion({
      aktion: 'einwilligung-anlegen', person: kontakt ? { kontaktId: kontakt.id } : { name }, zwecke, ...(albumId ? { album: albumId } : {}), ...(anlass ? { anlass } : {}),
      ...(kind ? { sorgeberechtigt: sorge } : {}), fassung: vorlage.fassung, unterschrift,
    });
    if (!r.ok || !r.einwilligung) { setFehler(r.fehler ?? 'Nicht gespeichert.'); return; }
    onFertig(r.einwilligung.id);
  };

  const bereit = !!vorlage && !vorlage.verantwortlicherFehlt && unterschrieben && (kontakt || name.trim()) && zwecke.length > 0 && (!kind || sorge.trim());
  return (
    <Fenster titel="Einwilligung festhalten" onZu={onZu} breit={620}>
      <div style={{ display: 'grid', gap: 12 }}>
        <Feldzeile label="Wer willigt ein?">
          {kontakt
            ? <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span style={{ fontSize: TYP.body, flex: 1 }}>{kontakt.name}</span><Knopf leise onClick={() => setKontakt(null)}>ändern</Knopf></div>
            : <input value={suche || name} onChange={e => { setSuche(e.target.value); setName(e.target.value); }} placeholder="Kontakt suchen oder Namen eintragen" style={eingabe} />}
        </Feldzeile>
        {!kontakt && treffer.map(k => <Knopf key={k.id} leise onClick={() => { setKontakt(k); setSuche(''); }}>{k.name}</Knopf>)}
        <Feldzeile label="Wofür?"><MehrfachPillen liste={ZWECKE.map(z => ({ id: z, label: ZWECK_NAME(z) }))} aktiv={zwecke} onWahl={setZwecke} /></Feldzeile>
        <Schalter an={kind} onChange={setKind} karte beschreibung="Bei Kindern und Jugendlichen willigen die Sorgeberechtigten ein — ohne sie wird nie freigegeben.">Minderjährige Person</Schalter>
        {kind && <Feldzeile label="Name der sorgeberechtigten Person"><input value={sorge} onChange={e => setSorge(e.target.value)} maxLength={120} style={eingabe} /></Feldzeile>}
        {vorlage?.verantwortlicherFehlt && <Hinweis art="achtung">Verantwortlicher fehlt — erst unter System › Datenschutz eintragen. Ohne ihn ist die Einwilligung nicht informiert.</Hinweis>}
        {vorlage && <div style={{ fontSize: TYP.body, lineHeight: 1.55, color: C.ink, background: 'rgba(255,255,255,.05)', borderRadius: 14, padding: '12px 14px' }}>{vorlage.wortlaut}</div>}
        <div>
          <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginBottom: 6 }}>Unterschrift (mit dem Finger)</div>
          <canvas ref={leinwand} width={600} height={180} style={{ width: '100%', height: 150, borderRadius: 12, background: '#fff', touchAction: 'none', display: 'block' }} aria-label="Unterschriftsfeld" />
          <div style={{ marginTop: 6 }}><Knopf leise onClick={loeschen}>Neu unterschreiben</Knopf></div>
        </div>
        {fehler && <Hinweis art="achtung" rolle="alert">{fehler}</Hinweis>}
        <Knopf haupt voll farbe={LEUCHT.gut} aus={!bereit} onClick={speichern}>Einwilligung speichern</Knopf>
        <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Hinweis, keine Rechtsberatung. Die Einwilligung ist freiwillig und jederzeit widerrufbar.</span>
      </div>
    </Fenster>
  );
}
