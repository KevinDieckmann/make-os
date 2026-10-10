'use client';

// ─── Fulfillment › Kreislauf — heutiger Sales-Kreislauf und gezeichnete Abläufe (Paket C1, 10.10.; FULFILLMENT_KONZEPT.md 2.6) ──────────
// Der heutige Kreislauf aus Markttraktion › Planung GILT (Entscheidung 22:30); die früheren Vertriebsabläufe sind Wissen — klickbar und gezeichnet
// (Trichter, Fluss mit Weichen, Zeitachse), Ergänzungen gestrichelt, Rückwege als Bögen. Ein Klick auf eine Stufe öffnet ihren Steckbrief,
// „heute“ springt in den heutigen Kreislauf. „Als Paket-Vorlage übernehmen“ kopiert einen Ablauf in eine Paket-Vorlage.

import { useState } from 'react';
import Link from 'next/link';
import { FARBE as C, TYP, MIKRO } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Hinweis, Leerzustand, Pillen, Chip, LEUCHT, Liste, Zeile } from '../../ui';
import { WEG } from '@/lib/wege';
import { kinderVon } from '@/lib/fulfillment/regeln';
import type { KreislaufId } from '@/lib/crm/planung';
import { useUebersicht, vorlagenOps, fehlerText } from './daten';
import { AblaufBild, AblaufLegende } from './Zeichnung';
import { klein, Leiste, Meldung } from './teile';

const ART_TEXT: Record<string, string> = { einstieg: 'Einstieg', stufe: 'Stufe', ausstieg: 'Ausstieg', routine: 'Routine' };
const KREIS_TEXT: Record<KreislaufId, string> = { kanaele: 'Kanäle', leads: 'Leads', deals: 'Deals', followup: 'Abschluss & Follow-up', fulfillment: 'Fulfillment', nachher: 'Nach der Leistung', wiederkauf: 'Wiederkauf' };

export function Kreislauf() {
  const { daten, fehler } = useUebersicht();
  const [wahl, setWahl] = useState<string | null>(null);
  const [stufe, setStufe] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ text: string; art: 'gut' | 'kritisch' } | null>(null);
  if (!daten) return fehler ? <Hinweis art="kritisch">{fehler}</Hinweis> : <div style={klein}>Lädt …</div>;
  const ablaeufe = daten.prozesse.filter(p => p.art === 'ablauf');
  const aktiv = ablaeufe.find(a => a.id === wahl) ?? ablaeufe[0];
  const st = aktiv && stufe ? aktiv.knoten.find(k => k.id === stufe) : undefined;
  const landkarte = daten.prozesse.find(p => p.art === 'landkarte');
  const etagen = landkarte ? kinderVon(landkarte.knoten.find(k => !k.elternId)?.id, landkarte.knoten).filter(k => (k.zone ?? 'etage') === 'etage') : [];
  const alsPaket = async () => {
    if (!aktiv) return;
    const a = await vorlagenOps([{ op: 'kopie', id: aktiv.id }]);
    setMeldung(a.ok ? { text: `„${aktiv.titel}“ als Paket-Vorlage angelegt — unter Prozesse bearbeiten und einem Produkt zuordnen.`, art: 'gut' } : { text: fehlerText(a), art: 'kritisch' });
  };
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Karte i={1} akzent={LEUCHT.business}>
        <Ueberschrift farbe={LEUCHT.business} rechts={<Link href={WEG.vertriebsplanung()} style={{ color: C.aktiv, fontSize: TYP.bedien }}>öffnen ›</Link>}>Der heutige Kreislauf</Ueberschrift>
        <div style={klein}>Es gilt der Kreislauf aus Markttraktion › Planung (Kanäle → Leads → Deals → Abschluss → Fulfillment → nach der Leistung → Wiederkauf). Die Abläufe unten sind Wissen aus früheren Prozessen — keine zweite Wahrheit.</div>
        {etagen.length > 0 && (
          <Liste>
            {etagen.map(e => <Zeile key={e.id} titel={e.titel} unter={(e.kreislauf ?? []).map(k => KREIS_TEXT[k]).join(' · ') || 'keiner Kreislauf-Stufe zugeordnet'} />)}
          </Liste>
        )}
      </Karte>
      <Meldung text={meldung?.text ?? null} art={meldung?.art} />
      {!ablaeufe.length ? (
        <Leerzustand symbol="⟲" titel="Noch keine Abläufe">Abläufe kommen per Import unter Bausteine (Datei mit „stufen“ und „uebergaenge“) — sie werden als Trichter, Fluss oder Zeitachse gezeichnet.</Leerzustand>
      ) : (
        <Karte i={2}>
          <Ueberschrift erklaerung="fulfillment.ablaufErgaenzung" rechts={<Knopf leise onClick={alsPaket}>Als Paket-Vorlage übernehmen</Knopf>}>Abläufe</Ueberschrift>
          {ablaeufe.length > 1 && <Pillen<string> liste={ablaeufe.map(a => ({ id: a.id, label: a.titel }))} aktiv={aktiv?.id} onWahl={id => { setWahl(id); setStufe(null); }} />}
          {aktiv && (
            <>
              <AblaufBild vorlage={aktiv} aktiv={stufe ?? undefined} onStufe={setStufe} />
              <AblaufLegende />
              {aktiv.vorbehalt && <Hinweis art="achtung" titel="Vorbehalt">{aktiv.vorbehalt}</Hinweis>}
              {(aktiv.quelleHinweis || aktiv.zeichenhinweise?.length) && <div style={klein}>{[aktiv.quelleHinweis, ...(aktiv.zeichenhinweise ?? [])].filter(Boolean).join(' · ')}</div>}
            </>
          )}
          {st && (
            <div style={{ display: 'grid', gap: 8, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <b style={{ color: C.ink, fontSize: TYP.body }}>{st.titel}</b>
                {st.art && <Chip farbe={LEUCHT.planung}>{ART_TEXT[st.art]}</Chip>}
                {st.beleg === 'ergaenzung' && <Chip farbe={C.inkLeise}>ergänzt (nicht aus der Quelle)</Chip>}
                {st.optional && <Chip farbe={C.inkLeise}>optional</Chip>}
              </div>
              {[['Zweck', st.ziel], ['Rolle', st.rolle], ['Kennzahl', st.kennzahl], ['Ausgang', st.ausgang], ['Begriff der Quelle', st.original], ['Phase', st.dokumentation]].filter(([, w]) => !!w).map(([k, w]) => (
                <div key={k} style={{ display: 'grid', gap: 2 }}><span style={MIKRO}>{k}</span><span style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>{w}</span></div>
              ))}
              {st.heute && <Leiste><Link href={WEG.vertriebsplanung()} style={{ color: C.aktiv, fontSize: TYP.bedien }}>Heute: {st.heute} — im Kreislauf öffnen ›</Link></Leiste>}
            </div>
          )}
        </Karte>
      )}
    </div>
  );
}
