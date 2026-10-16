'use client';

// ─── Fulfillment · Analyse — Personenteil (C3, 10.10.; FULFILLMENT_KONZEPT.md 4.5) ─────────────────────────────────────────────────────────────
// Nur sichtbar, wenn der Server den Personenteil liefert (Inhaber oder Mitglied ohne „nur Business“ — sonst 403, die Seite zeigt den Reiter gar nicht).
// Je Karte: Funktion, Name, Identität, Angaben mit Quelle (einzeln entfernbar), Art.-14-Uhr mit fertigem Hinweistext zum Kopieren und dem Vermerk
// „gegeben am · wie“, Verknüpfung mit einem CRM-Kontakt der Firma (dann gilt dessen Art.-14-Weg), „geprüft“, Löschen. Nichts geht hinaus.

import { useCallback, useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import type { PersonenKarte } from '@/lib/fulfillment/typen';
import { personenDerFirma } from '@/lib/crm/stationen';
import { Karte, Ueberschrift, Knopf, Chip, Hinweis, Leer, Feldzeile, Pillen, eingabe, auswahl, LEUCHT, useRueckfrage } from '../../ui';
import { useCrm } from '../../crm/daten';
import { senden, fehlerVon } from './daten';
import { tagLang } from '../prozesse/daten';

type Rueck = ReturnType<typeof useRueckfrage>;
type KarteAntwort = PersonenKarte & { stand: string; art14Stand: { stufe: string; faelligAm: string }; maengel: string[]; art14Text: string; kontakt?: { vorhanden: boolean; art14?: { informiertAm?: string; stufe?: string } } };
const klein = { fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 } as const;
const STUFE_FARBE: Record<string, string> = { gegeben: LEUCHT.gut, offen: C.inkLeise, bald: LEUCHT.achtung, ueberfaellig: LEUCHT.kritisch };
const LISTEN = [['werdegang', 'Werdegang'], ['themen', 'Themen'], ['auftritte', 'Auftritte'], ['aufhaenger', 'Gesprächsaufhänger']] as const;

export function Personen({ mandatId, firmaId, rueck }: { mandatId: string; firmaId?: string; rueck: Rueck }) {
  const crm = useCrm();
  const kandidaten = firmaId && crm.kontakte ? personenDerFirma(crm.kontakte, firmaId, { nurAktiv: true }) : [];
  const [karten, setKarten] = useState<KarteAntwort[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const laden = useCallback(async () => {
    const r = await fetch(`/api/fulfillment/personen?m=${encodeURIComponent(mandatId)}`, { cache: 'no-store' }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok || j.ok === false) { setFehler(String(j.fehler ?? 'Der Personenteil ließ sich nicht laden.')); return; }
    setKarten(j.karten as KarteAntwort[]); setHinweis(String(j.rechtHinweis ?? '')); setFehler(null);
  }, [mandatId]);
  useEffect(() => { void laden(); }, [laden]);
  const schritt = async (k: KarteAntwort, body: Record<string, unknown>) => {
    const r = await senden('/api/fulfillment/personen', { mandatId, id: k.id, stand: k.stand, ...body });
    setFehler(fehlerVon(r));
    if (Array.isArray(r.j.karten)) setKarten(r.j.karten as KarteAntwort[]); else await laden();
  };
  if (fehler && !karten) return <Hinweis art="kritisch">{fehler}</Hinweis>;
  if (!karten) return <Leer>Personenteil wird geladen …</Leer>;
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <Ueberschrift erklaerung="fulfillment.personenteil">Personenteil — nur beruflich</Ueberschrift>
      <div style={klein}>{hinweis}</div>
      <Ueberschrift erklaerung="fulfillment.loeschfristPersonen">Löschfrist und Art. 14</Ueberschrift>
      {fehler && <Hinweis art="achtung">{fehler}</Hinweis>}
      {!karten.length && <Leer>Noch keine Karten. Sie entstehen nur aus einem bestätigten Personen-Lauf („Personen, nur beruflich“, A4) zu einer Funktion aus dem festgelegten Umfang.</Leer>}
      {karten.map(k => <KarteAnsicht key={k.id} k={k} kandidaten={kandidaten} schritt={b => schritt(k, b)} rueck={rueck} />)}
    </div>
  );
}

function KarteAnsicht({ k, kandidaten, schritt, rueck }: { k: KarteAntwort; kandidaten: readonly { id: string; vorname?: string; nachname?: string }[]; schritt: (b: Record<string, unknown>) => Promise<void>; rueck: Rueck }) {
  const [gegebenAm, setGegebenAm] = useState('');
  const [wie, setWie] = useState<'kickoff' | 'mail' | 'erster-kontakt'>('kickoff');
  const [kontakt, setKontakt] = useState(k.kontaktId ?? '');
  const quellen = new Map(k.quellen.map(q => [q.id, q]));
  return (
    <Karte>
      <Ueberschrift rechts={<span style={{ display: 'flex', gap: 6 }}>
        <Chip farbe={k.status === 'geprueft' ? LEUCHT.gut : LEUCHT.achtung}>{k.status === 'geprueft' ? 'geprüft' : 'Entwurf'}</Chip>
        <Chip farbe={k.identitaet === 'hoch' ? LEUCHT.gut : k.identitaet === 'mittel' ? LEUCHT.achtung : LEUCHT.kritisch}>Identität {k.identitaet}</Chip>
      </span>}>{k.funktion}: {k.name}</Ueberschrift>
      <div style={klein}>{k.rolleSeit ? `Rolle seit ${k.rolleSeit} · ` : ''}erfasst {k.erfasstAm}{k.loeschAm ? ` · wird gelöscht am ${k.loeschAm}` : ' · Löschtag folgt aus dem Mandatsende'}{k.ausgelassen.length ? ` · ausgelassen laut Negativliste: ${k.ausgelassen.join(', ')}` : ''}</div>
      {LISTEN.map(([f, label]) => k[f].length > 0 && (
        <div key={f} style={{ display: 'grid', gap: 4, marginTop: 8 }}>
          <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{label}</div>
          {k[f].map(a => (
            <div key={a.id} style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span style={{ fontSize: TYP.body, color: C.ink }}>{a.text}</span>
              <span style={klein}>{a.quellen.map(q => quellen.get(q)?.domain ?? (quellen.get(q)?.unterlageId ? 'Unterlage' : '')).filter(Boolean).join(', ')}</span>
              <Knopf leise onClick={() => schritt({ aktion: 'angabe-entfernen', angabeId: a.id })}>Entfernen</Knopf>
            </div>
          ))}
        </div>
      ))}
      {k.maengel.length > 0 && <Hinweis art="achtung">{k.maengel.join(' ')}</Hinweis>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        <Knopf aus={k.status === 'geprueft' || k.maengel.length > 0} onClick={() => schritt({ aktion: 'pruefen' })}>Karte geprüft</Knopf>
        <Knopf leise onClick={async () => { if (await rueck.bestaetigen({ titel: 'Karte löschen?', text: 'Die Karte verschwindet aus dem Personenteil.', ja: 'Löschen', gefahr: true })) await schritt({ aktion: 'loeschen' }); }}>Karte löschen</Knopf>
      </div>
      <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: TYP.body, color: C.ink }}>Art. 14</span>
          <Chip farbe={STUFE_FARBE[k.art14Stand.stufe] ?? C.inkLeise}>{k.art14Stand.stufe === 'gegeben' ? `gegeben ${k.art14.gegebenAm}` : `fällig ${k.art14Stand.faelligAm}`}</Chip>
          {k.kontakt && <span style={klein}>{k.kontakt.vorhanden ? `Verknüpfter Kontakt: Hinweis über die Kontaktakte${k.kontakt.art14?.informiertAm ? ` (informiert ${tagLang(k.kontakt.art14.informiertAm)})` : ''}.` : 'Verknüpfter Kontakt existiert nicht mehr.'}</span>}
        </div>
        <textarea readOnly style={{ ...eingabe, minHeight: 120, fontSize: TYP.bedien }} value={k.art14Text} aria-label="Text des Art.-14-Hinweises" />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Knopf leise onClick={() => { void navigator.clipboard?.writeText(k.art14Text); }}>Text kopieren</Knopf>
        </div>
        {!k.art14.gegebenAm && (
          <form onSubmit={e => { e.preventDefault(); void schritt({ aktion: 'art14', gegebenAm, wie }); }} style={{ display: 'grid', gap: 8 }}>
            <Feldzeile label="Hinweis gegeben am"><input type="date" style={eingabe} value={gegebenAm} onChange={e => setGegebenAm(e.target.value)} required /></Feldzeile>
            <Pillen liste={[{ id: 'kickoff', label: 'im Kick-off' }, { id: 'mail', label: 'per Mail' }, { id: 'erster-kontakt', label: 'beim ersten Kontakt' }]} aktiv={wie} onWahl={x => setWie(x as typeof wie)} />
            <div><Knopf typ="submit">Vermerken</Knopf></div>
          </form>
        )}
        {kandidaten.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select style={auswahl} value={kontakt} onChange={e => setKontakt(e.target.value)} aria-label="CRM-Kontakt verknüpfen">
              <option value="">— kein Kontakt —</option>
              {kandidaten.map(x => <option key={x.id} value={x.id}>{[x.vorname, x.nachname].filter(Boolean).join(' ')}</option>)}
            </select>
            <Knopf leise aus={kontakt === (k.kontaktId ?? '')} onClick={() => schritt({ aktion: 'verknuepfen', kontaktId: kontakt || null })}>Verknüpfen</Knopf>
          </div>
        )}
      </div>
    </Karte>
  );
}
