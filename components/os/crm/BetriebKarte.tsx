'use client';

// ─── Markttraktion · Firma als Betrieb (01.11.2026, Welle A „Firmen als Ziel“) ─────────────────────────────────────────────────
// Anschrift, Bezirk, Handy, Öffnungszeiten, Instagram, Inhaber, Website-Bedarf, Niveau-Analyse, Quellen — und das Recht am Betrieb:
// Herkunft, Art.-14-Uhr, Kanal-Ampel der Firma, Werbesperre, „Stammdaten geprüft“. Die Recht-Felder stempelt der Server
// (lib/crm/betrieb.ts `betriebRechtStempeln`): die Karte schickt nur die Absicht.

import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Ueberschrift, Chip, Knopf, LEUCHT, useRueckfrage } from '../ui';
import { Feldzeile, Feld } from './teile';
import type { Firma } from '@/lib/crm/typen';
import { HERKUNFT } from '@/lib/make-one/crm';
import { art14Firma, adresseText, BETRIEB_QUELLEN } from '@/lib/crm/betrieb';
import { firmaAmpel } from '@/lib/crm/recht';
import { datum } from './daten';

const FARBE = { gruen: LEUCHT.gut, gelb: LEUCHT.achtung, rot: LEUCHT.kritisch } as const;
const KANAL = { telefon: 'Telefon', mail: 'Mail' } as Record<string, string>;

export function BetriebKarte({ f, heute, setze, hatMandat, hatChance }: { f: Firma; heute: string; setze: (teil: Partial<Firma>) => void; hatMandat: boolean; hatChance: boolean }) {
  const { bestaetigen, dialog } = useRueckfrage();
  const a = f.adresse ?? {};
  const adr = (feld: keyof NonNullable<Firma['adresse']>) => (v: string) => {
    const neu = { ...a, [feld]: v.trim() || undefined };
    for (const k of Object.keys(neu) as (keyof typeof neu)[]) if (!neu[k]) delete neu[k];
    setze({ adresse: Object.keys(neu).length ? neu : undefined });
  };
  const uhr = art14Firma(f, heute);
  const ampel = firmaAmpel(f, { hatMandat, hatChance });
  const herkunft = HERKUNFT.find(h => h.id === f.herkunft)?.label;
  return (
    <div>
      {dialog}
      <Ueberschrift rechts={f.osmId ? 'OpenStreetMap' : undefined}>Betrieb</Ueberschrift>
      <Feldzeile label="Straße"><Feld wert={a.strasse} onFertig={adr('strasse')} /></Feldzeile>
      <Feldzeile label="Hausnummer"><Feld wert={a.hausnummer} onFertig={adr('hausnummer')} /></Feldzeile>
      <Feldzeile label="PLZ"><Feld wert={a.plz} onFertig={adr('plz')} /></Feldzeile>
      <Feldzeile label="Ort"><Feld wert={a.ort} onFertig={adr('ort')} /></Feldzeile>
      <Feldzeile label="Bezirk"><Feld wert={f.bezirk} onFertig={v => setze({ bezirk: v.trim() || undefined })} /></Feldzeile>
      <Feldzeile label="Handy"><Feld wert={f.mobil} onFertig={v => setze({ mobil: v.trim() || undefined })} /></Feldzeile>
      <Feldzeile label="Öffnungszeiten"><Feld wert={f.oeffnungszeiten} onFertig={v => setze({ oeffnungszeiten: v.trim() || undefined })} /></Feldzeile>
      {f.instagram && <Feldzeile label="Instagram"><span style={{ fontSize: TYP.bedien }}>@{f.instagram} <span style={{ color: C.inkLeise }}>(nur ansehen — Nachrichten dort sind elektronische Post)</span></span></Feldzeile>}
      {f.inhaber && <Feldzeile label="Inhaber"><span style={{ fontSize: TYP.bedien }}>{f.inhaber}{f.inhaberArt === 'firma' ? <span style={{ color: C.inkLeise }}> (Betreiberfirma)</span> : null}</span></Feldzeile>}
      {f.bewertung && (
        <Feldzeile label="Website-Bedarf">
          <span style={{ fontSize: TYP.bedien }}><Chip farbe={f.bewertung.punkte >= 70 ? LEUCHT.achtung : C.inkDim}>{f.bewertung.punkte} / 100</Chip>{' '}
            <span style={{ color: C.inkLeise }}>{f.bewertung.gruende.join(' · ')}</span></span>
        </Feldzeile>
      )}
      {f.analyse && (
        <Feldzeile label="Website-Niveau">
          <span style={{ fontSize: TYP.bedien, display: 'grid', gap: 4 }}>
            <span><Chip farbe={f.analyse.unterNiveau ? LEUCHT.achtung : C.inkDim}>{f.analyse.niveau} / 100</Chip> <span style={{ color: C.inkLeise }}>gemessen {datum(f.analyse.gemessenAm.slice(0, 10), heute)}</span></span>
            {f.analyse.aufhaenger.slice(0, 3).map(x => <span key={x} style={{ color: C.inkDim }}>• {x}</span>)}
          </span>
        </Feldzeile>
      )}
      {f.quellen && (
        <Feldzeile label="Quellen">
          <span style={{ display: 'grid', gap: 2, fontSize: TYP.bedien }}>
            {Object.entries(f.quellen).map(([k, v]) => <a key={k} href={v} target="_blank" rel="noopener noreferrer nofollow" style={{ color: C.aktiv, overflowWrap: 'anywhere' }}>{k} ›</a>)}
          </span>
        </Feldzeile>
      )}
      {f.anreicherung && <Feldzeile label="Angereichert"><span style={{ fontSize: TYP.bedien, color: C.inkDim }}>{datum(f.anreicherung.am.slice(0, 10), heute)} · {BETRIEB_QUELLEN.find(q => q.id === f.anreicherung!.quelle)?.label}</span></Feldzeile>}

      <Ueberschrift>Recht am Betrieb</Ueberschrift>
      <Feldzeile label="Herkunft"><span style={{ fontSize: TYP.bedien, color: herkunft ? C.ink : C.inkLeise }}>{herkunft ?? 'nicht angegeben'}</span></Feldzeile>
      {uhr && (
        <Feldzeile label="Art. 14">
          <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: TYP.bedien }}>
            <Chip farbe={uhr.faellig ? LEUCHT.kritisch : LEUCHT.achtung}>{uhr.faellig ? `fällig (Tag ${uhr.tage})` : `Tag ${uhr.tage} von 30`}</Chip>
            <Knopf leise onClick={() => setze({ art14InformiertAm: heute })}>Heute informiert</Knopf>
          </span>
        </Feldzeile>
      )}
      {f.art14InformiertAm && <Feldzeile label="Art. 14"><span style={{ fontSize: TYP.bedien, color: C.inkDim }}>informiert am {datum(f.art14InformiertAm, heute)}</span></Feldzeile>}
      <Feldzeile label="Kanäle">
        <span style={{ display: 'grid', gap: 3, fontSize: TYP.bedien }}>
          {ampel.length ? ampel.map(s => <span key={s.kanal} title={s.grund}><Chip farbe={FARBE[s.farbe]}>{KANAL[s.kanal] ?? s.kanal}</Chip> <span style={{ color: C.inkLeise }}>{s.grund}</span></span>) : <span style={{ color: C.inkLeise }}>keine Adresse</span>}
          <span style={{ color: C.inkLeise }}>Brief an {adresseText(f.adresse) || 'die Anschrift'} und Besuch vor Ort sind die zulässigen Wege ohne Einwilligung.</span>
        </span>
      </Feldzeile>
      <Feldzeile label="Werbesperre">
        {f.werbesperre
          ? <span style={{ fontSize: TYP.bedien }}><Chip farbe={LEUCHT.kritisch}>seit {datum(f.werbesperre.seit, heute)}</Chip> <span style={{ color: C.inkLeise }}>{f.werbesperre.grund}</span></span>
          : <Knopf leise onClick={async () => { if (await bestaetigen({ titel: `Werbesperre für „${f.name}“ setzen?`, text: 'Der Betrieb kommt auf die Sperrliste und wird nie wieder als Fund angelegt.', ja: 'Werbesperre setzen' })) setze({ werbesperre: { seit: heute, grund: 'Werbewiderspruch (Art. 21)' } }); }}>Werbesperre setzen</Knopf>}
      </Feldzeile>
      <Feldzeile label="Geprüft">
        <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: TYP.bedien, color: C.inkDim }}>
          {f.geprueftAm ? `${datum(f.geprueftAm, heute)}${f.geprueftVon ? ` · ${f.geprueftVon}` : ''}` : 'noch nie'}
          <Knopf leise onClick={() => setze({ geprueftAm: heute })}>Stammdaten geprüft</Knopf>
        </span>
      </Feldzeile>
    </div>
  );
}
