'use client';

// ─── Agenten-Seite: die Kopfleiste (09.10., Paket 2) ───────────────────────────────────────────────────────────────────
// Fragerunde 6: „+ Neu ▾ (Auftrag, an mehrere Heads, Hintergrundaufgabe, Mitarbeiter, Skill) · Freigaben (Zahl) ·
// Geplant · Budget-Balken · Not-Aus · Modell & Aufwand in den Einstellungen je Head · Leitplanken unter ⋯.“
// Budget in Euro (nie Credits), erster Monat nur messen. Not-Aus mit Rückfrage. Unter „⋯“: Leitplanken und die bisherige
// Agenten-Übersicht (AgentenView). Am Handy schrumpft die Leiste auf „+“, die Freigaben-Zahl und „⋯“.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MoreHorizontal, Plus, Power } from 'lucide-react';
import { FARBE as C, ABSTAND, ECKE, FLAECHE_STIL, LEUCHT, RAND, SCHRIFT, TIEF, TYP, ZIEL } from '@/lib/make-one/design';
import { Chip, Knopf, SymbolKnopf } from '../ui';
import { useAgenten, type DialogArt } from './kontext';
import { euro, kostenImMonat } from './regeln';
import { WEG } from '@/lib/wege';

/** Ein Menü unter einem Knopf: Esc und Klick daneben schließen; die Einträge sind ganze Knöpfe (≥ 44 px). */
function Menue({ knopf, eintraege, ariaLabel, rechts }: { knopf: (offen: boolean, umschalten: () => void) => ReactNode; eintraege: { label: string; satz?: string; tun: () => void }[]; ariaLabel: string; rechts?: boolean }) {
  const [offen, setOffen] = useState(false);
  const wurzel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!offen) return;
    const zu = (e: MouseEvent) => { if (!wurzel.current?.contains(e.target as Node)) setOffen(false); };
    const taste = (e: KeyboardEvent) => { if (e.key === 'Escape') setOffen(false); };
    window.addEventListener('mousedown', zu);
    window.addEventListener('keydown', taste);
    return () => { window.removeEventListener('mousedown', zu); window.removeEventListener('keydown', taste); };
  }, [offen]);
  return (
    <div ref={wurzel} style={{ position: 'relative' }}>
      {knopf(offen, () => setOffen(o => !o))}
      {offen && (
        <div role="menu" aria-label={ariaLabel} style={{ position: 'absolute', top: `calc(100% + ${ABSTAND.s}px)`, [rechts ? 'right' : 'left']: 0, zIndex: 30, minWidth: 260,
          ...FLAECHE_STIL.gehoben, border: `1px solid ${RAND.stark}`, borderRadius: ECKE.flach, padding: ABSTAND.s, display: 'grid', gap: 2 }}>
          {eintraege.map(e => (
            <button key={e.label} type="button" role="menuitem" onClick={() => { setOffen(false); e.tun(); }} className="fassbar"
              style={{ display: 'grid', gap: 2, minHeight: ZIEL.handy, padding: `${ABSTAND.s}px ${ABSTAND.m}px`, borderRadius: ECKE.eingabe, border: 'none', background: 'transparent', color: C.ink, textAlign: 'left', cursor: 'pointer', fontFamily: SCHRIFT.text }}>
              <span style={{ fontSize: TYP.body, fontWeight: 600 }}>{e.label}</span>
              {e.satz && <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>{e.satz}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const NEU: { label: string; satz: string; art: DialogArt }[] = [
  { label: 'Auftrag', satz: 'Jetzt an ZOE, einen Head oder einen Mitarbeiter', art: { art: 'auftrag' } },
  { label: 'An mehrere Heads', satz: 'Ein Auftrag, je Head ein Thread', art: { art: 'mehrere' } },
  { label: 'Hintergrundaufgabe', satz: 'Jetzt, einmal geplant oder wiederkehrend', art: { art: 'hintergrund' } },
  { label: 'Mitarbeiter', satz: 'Aus Vorlage oder beschreiben', art: { art: 'mitarbeiter' } },
  { label: 'Skill', satz: 'Anleitung mit Beispielen, Werkzeugen und Tests', art: { art: 'skill' } },
];

/** Budget-Balken in Euro: diesen Monat gemessen; ohne Grenze nur die Zahl (Fragerunde 16: „erster Monat nur messen“). */
export function BudgetBalken({ grenzeCent }: { grenzeCent?: number }) {
  const { laeufe, dialog, jetzt } = useAgenten();
  const cent = laeufe.zustand === 'da' ? kostenImMonat(laeufe.daten.laeufe, jetzt) : null;
  const anteil = cent != null && grenzeCent ? Math.min(1, cent / grenzeCent) : null;
  const farbe = anteil == null ? C.aktiv : anteil >= 0.95 ? LEUCHT.kritisch : anteil >= 0.8 ? LEUCHT.achtung : LEUCHT.gut;
  return (
    <button type="button" onClick={() => dialog({ art: 'budget' })} className="fassbar" aria-label={`Kosten diesen Monat: ${cent == null ? 'noch nicht gemessen' : euro(cent)}${grenzeCent ? ` von ${euro(grenzeCent)}` : ' — nur gemessen'}`}
      style={{ display: 'grid', gap: ABSTAND.xs, minHeight: ZIEL.rechner, minWidth: 120, padding: `${ABSTAND.xs}px ${ABSTAND.m}px`, borderRadius: ECKE.eingabe, border: `1px solid ${RAND.flaeche}`, background: FLAECHE_STIL.flach.background, color: C.ink, cursor: 'pointer', fontFamily: SCHRIFT.text, textAlign: 'left' }}>
      <span style={{ fontSize: TYP.bedien, fontVariantNumeric: 'tabular-nums' }}>{cent == null ? '— €' : euro(cent)}{grenzeCent ? ` / ${euro(grenzeCent)}` : ' · gemessen'}</span>
      <span aria-hidden style={{ height: 4, borderRadius: ECKE.eingabe, background: RAND.haar, overflow: 'hidden' }}>
        <span style={{ display: 'block', height: '100%', width: `${Math.round((anteil ?? (cent ? 1 : 0)) * 100)}%`, background: anteil == null ? TIEF.rand(farbe) : TIEF.verlauf(farbe) }} />
      </span>
    </button>
  );
}

export function Kopfleiste() {
  const { form, stapel, laeufe, dialog, bestaetigen, melde, agenten } = useAgenten();
  const handy = form === 'handy';
  const freigaben = stapel.zustand === 'da' ? stapel.daten.offen : agenten.zustand === 'da' ? agenten.daten.ueberblick.freigaben.anzahl : 0;
  const geplant = laeufe.zustand === 'da' ? laeufe.daten.plan.length : 0;
  const notAus = agenten.zustand === 'da' && agenten.daten.notAus;
  const notAusFragen = async () => {
    const ja = await bestaetigen({
      titel: notAus ? 'Not-Aus lösen?' : 'Not-Aus: alle Agenten anhalten?',
      text: notAus ? 'Hintergrundläufe und Zeitpläne laufen danach wieder.' : 'Alle Hintergrundläufe halten an, Zeitpläne pausieren. Chats bleiben möglich.\n\nDer Schalter wird mit dem nächsten Paket scharf geschaltet; bis dahin lassen sich einzelne Agenten unter „⋯ › Bisherige Übersicht“ abschalten.',
      ja: notAus ? 'Lösen' : 'Übersicht öffnen', gefahr: !notAus,
    });
    if (ja) { if (notAus) melde('Den Not-Aus lösen kommt mit dem nächsten Paket.', 'info'); else dialog({ art: 'uebersicht' }); }
  };
  const mehr = [
    { label: 'Leitplanken', satz: 'Was Agenten dürfen — und was nie', tun: () => dialog({ art: 'leitplanken' }) },
    { label: 'Geplant', satz: 'Wiederkehrende und geplante Aufgaben', tun: () => dialog({ art: 'geplant' }) },
    { label: 'Bisherige Übersicht', satz: 'Alle Agenten mit Schaltern, Modell und Autonomie', tun: () => dialog({ art: 'uebersicht' }) },
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: ABSTAND.s, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      <Menue ariaLabel="Neu anlegen" eintraege={NEU.map(n => ({ label: n.label, satz: n.satz, tun: () => dialog(n.art) }))}
        knopf={(offen, um) => handy
          ? <SymbolKnopf ariaLabel="Neu anlegen" onClick={um}><Plus size={20} /></SymbolKnopf>
          : <Knopf onClick={um} ariaLabel={offen ? 'Menü „Neu“ schließen' : 'Neu anlegen'}><Plus size={16} aria-hidden /> Neu ▾</Knopf>} />
      <Knopf leise href={WEG.freigaben()} ariaLabel={`Freigaben: ${freigaben} offen`}>
        {handy ? '⚑' : 'Freigaben'} {freigaben > 0 ? <span className="krit-puls"><Chip farbe={LEUCHT.achtung}>{freigaben}</Chip></span> : <Chip farbe={C.inkDim}>0</Chip>}
      </Knopf>
      {!handy && <Knopf leise onClick={() => dialog({ art: 'geplant' })}>Geplant {geplant > 0 && <Chip farbe={C.aktiv}>{geplant}</Chip>}</Knopf>}
      {!handy && <BudgetBalken />}
      {!handy && (
        <Knopf leise onClick={notAusFragen} farbe={LEUCHT.kritisch} ariaLabel={notAus ? 'Not-Aus ist an — lösen' : 'Not-Aus'}>
          <Power size={16} aria-hidden color={notAus ? LEUCHT.kritisch : undefined} /> {notAus ? 'Not-Aus an' : 'Not-Aus'}
        </Knopf>
      )}
      <Menue ariaLabel="Mehr" rechts eintraege={handy ? [...mehr, { label: 'Not-Aus', satz: 'Alle Hintergrundläufe anhalten', tun: () => { void notAusFragen(); } }] : mehr}
        knopf={(_o, um) => <SymbolKnopf ariaLabel="Mehr: Leitplanken, Geplant, bisherige Übersicht" onClick={um}><MoreHorizontal size={20} /></SymbolKnopf>} />
    </div>
  );
}
