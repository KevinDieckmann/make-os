'use client';

// ─── Markttraktion › Website (31.10., Kevin: „bei Marketing noch einen Button mit Homepage und da unsere Sachen der Homepage alles sauber sammeln“) ──
// Reiter (Adresse `a`, lib/crm/adresse.ts WEBSITE_ANSICHTEN): Überblick (Zustand je öffentlichem Weg + Website-Zahlen 30 Tage) · Eingänge (aus den
// vorhandenen Beständen) · Checks (bis 31.10. Marketing › Innovations-Check) · Angebote & Preise · Bausteine & Vorlagen · Bilder (Medien-Ablage, Kanal
// „Website“) · Formulare & Termine (Kontaktformular, Newsletter-Anmeldung, Erstgespräch, Willkommens-Mails) · Inhalte & SEO · Recht.
// Die Website liest über GET /api/website/inhalt (Vertrag: WEBSITE_VERTRAG_INHALT.md) — hier wird nur gepflegt.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Knopf, Chip, Hinweis, Leer, Pillen, Raster, Zahl, Schalter, Feldzeile, feld, Punkt, LEUCHT } from '../../ui';
import { WEG } from '@/lib/wege';
import { neueWebKennung } from '@/lib/website/regeln';
import type { WebsiteAnsicht } from '@/lib/crm/adresse';
import type { CrmApi } from '../daten';
import { Checks } from '../marketing/Checks';
import { KontaktformularKarte } from '../marketing/KontaktformularKarte';
import { NewsletterWebsite } from '../marketing/NewsletterWebsite';
import { useWebsite, type WebsiteApi } from './daten';
import { AngeboteReiter, BausteineReiter, InhalteReiter } from './Pflege';
import { WillkommenKarte } from './Willkommen';

const REITER: { id: WebsiteAnsicht; label: string }[] = [
  { id: 'ueberblick', label: 'Überblick' }, { id: 'eingaenge', label: 'Eingänge' }, { id: 'checks', label: 'Checks' }, { id: 'angebote', label: 'Angebote & Preise' },
  { id: 'bausteine', label: 'Bausteine & Vorlagen' }, { id: 'bilder', label: 'Bilder' }, { id: 'formulare', label: 'Formulare & Termine' }, { id: 'inhalte', label: 'Inhalte & SEO' },
  { id: 'recht', label: 'Recht' },
];

const ZUSTAND: Record<string, { text: string; farbe: string }> = {
  an: { text: 'an', farbe: LEUCHT.gut }, aus: { text: 'aus', farbe: C.inkLeise }, unvollstaendig: { text: 'unvollständig', farbe: LEUCHT.achtung }, unklar: { text: 'nicht prüfbar', farbe: LEUCHT.kritisch },
};

interface WegLage { id: string; name: string; pfad: string; zustand: string; fehlt: string[]; weg: string }
interface Kpi { id: string; label: string; anzeige: string; ampel: string }
interface Eingang { art: string; tag: string; wer: string; herkunft: string; href: string }

function useTeil<T>(teil: string) {
  const [d, setD] = useState<T | null>(null);
  const laden = useCallback(async () => {
    const r = await fetch(`/api/website/intern?teil=${teil}`, { cache: 'no-store' }).catch(() => null);
    if (r?.ok) setD(await r.json() as T);
  }, [teil]);
  useEffect(() => { void laden(); }, [laden]);
  return d;
}

function Ueberblick({ zu }: { zu: (a: WebsiteAnsicht) => void }) {
  const d = useTeil<{ wege: WegLage[]; zahlen: Kpi[] }>('ueberblick');
  if (!d) return null;
  const ampel = (a: string) => (a === 'gruen' ? LEUCHT.gut : a === 'gelb' ? LEUCHT.achtung : a === 'rot' ? LEUCHT.kritisch : C.inkLeise);
  return (
    <>
      <Karte i={0}>
        <Ueberschrift>Website-Zahlen · 30 Tage</Ueberschrift>
        {d.zahlen.length ? <Raster min={180}>{d.zahlen.map(k => <Zahl key={k.id} wert={k.anzeige} label={k.label} farbe={ampel(k.ampel)} />)}</Raster>
          : <Leer>Noch keine Zahlen — sie kommen, sobald Check oder Kontaktformular eingeschaltet sind.</Leer>}
      </Karte>
      <Karte i={1}>
        <Ueberschrift>Öffentliche Wege</Ueberschrift>
        <Liste>
          {d.wege.map(w => {
            const z = ZUSTAND[w.zustand] ?? ZUSTAND.unklar;
            return <Zeile key={w.id} links={<Punkt farbe={z.farbe} />} titel={w.name} unter={w.fehlt.length ? `Fehlt: ${w.fehlt.join(' · ')}` : w.pfad} umbrechen
              rechts={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Chip farbe={z.farbe}>{z.text}</Chip><Link href={w.weg} style={{ color: C.aktiv, fontSize: TYP.bedien }}>{w.zustand === 'an' ? 'Ansehen' : 'Beheben'}</Link></span>} />;
          })}
        </Liste>
      </Karte>
      <Karte i={2}>
        <Ueberschrift>Was die Website liest</Ueberschrift>
        <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Preise der Angebote und Bausteine, Texte und kommende Events holt die Website aus MAKE OS — gepflegt unter <Knopf leise onClick={() => zu('angebote')}>Angebote & Preise</Knopf> und <Knopf leise onClick={() => zu('inhalte')}>Inhalte & SEO</Knopf>.</span>
      </Karte>
    </>
  );
}

const ART_NAME: Record<string, string> = { anfrage: 'Anfrage', termin: 'Termin', bestellung: 'Bestellung', newsletter: 'Newsletter' };
function Eingaenge() {
  const d = useTeil<{ eingaenge: Eingang[] }>('eingaenge');
  const [filter, setFilter] = useState<string>('alle');
  if (!d) return null;
  const liste = d.eingaenge.filter(e => filter === 'alle' || e.art === filter);
  return (
    <Karte i={0}>
      <Ueberschrift>Eingänge über die Website · 90 Tage</Ueberschrift>
      <Pillen einzeilig liste={[{ id: 'alle', label: `Alle ${d.eingaenge.length}` }, ...Object.entries(ART_NAME).map(([id, label]) => ({ id, label: `${label} ${d.eingaenge.filter(e => e.art === id).length}` }))]} aktiv={filter} onWahl={setFilter} />
      {!liste.length ? <Leer>Noch keine Eingänge.</Leer> : (
        <Liste>{liste.map((e, i) => <Zeile key={`${e.href}-${e.tag}-${i}`} titel={e.wer} unter={`${e.tag.slice(8, 10)}.${e.tag.slice(5, 7)}. · ${ART_NAME[e.art] ?? e.art} · ${e.herkunft}`} rechts={<Link href={e.href} style={{ color: C.aktiv, fontSize: TYP.bedien }}>Öffnen</Link>} umbrechen />)}</Liste>
      )}
    </Karte>
  );
}

function Bilder({ w }: { w: WebsiteApi }) {
  const d = w.d;
  const [alt, setAlt] = useState<Record<string, string>>({});
  if (!d) return null;
  return (
    <Karte i={0}>
      <Ueberschrift rechts={<Link href={WEG.medien()} style={{ color: C.aktiv, fontSize: TYP.bedien }}>Medien öffnen</Link>}>Bilder der Website</Ueberschrift>
      <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Hier stehen Bilder aus den Medien, die für den Kanal „Website“ freigegeben sind (am besten im Album „Website“). Gezeigt wird ein Bild nur mit Alt-Text und Haken.</span>
      {!d.hilfen.medien.length && !d.inhalt.bilder.length ? <Leer>Noch kein Bild für die Website freigegeben.</Leer> : (
        <Liste>
          {[...d.hilfen.medien.map(m => m.id), ...d.inhalt.bilder.map(b => b.medium).filter(m => !d.hilfen.medien.some(x => x.id === m))].map(medium => {
            const m = d.hilfen.medien.find(x => x.id === medium);
            const b = d.inhalt.bilder.find(x => x.medium === medium);
            const text = alt[medium] ?? b?.alt ?? '';
            const setze = (sichtbar: boolean) => w.senden([{ liste: 'bilder', art: 'setze', id: b?.id ?? neueWebKennung('bilder'), ...(b ? { stand: b.stand } : {}), eintrag: { medium, alt: text.trim(), sichtbar, rang: b?.rang ?? 0 } }]);
            return (
              <div key={medium} style={{ display: 'grid', gap: 6, padding: '6px 0' }}>
                <Zeile titel={m?.name ?? 'Bild'} unter={m ? (m.breite ? `${m.breite} × ${m.hoehe} px` : 'freigegeben') : 'nicht mehr für die Website freigegeben — wird nicht ausgeliefert'} umbrechen
                  rechts={<Schalter erklaerung="website.bild" an={!!b?.sichtbar} aus={!m} onChange={v => void setze(v)} ariaLabel="Auf der Website zeigen" />} />
                <form onSubmit={e => { e.preventDefault(); void setze(!!b?.sichtbar); }} style={{ display: 'flex', gap: 8 }}>
                  <input style={feld} aria-label="Alt-Text" placeholder="Alt-Text: was ist zu sehen?" value={text} onChange={e => setAlt(a => ({ ...a, [medium]: e.target.value }))} />
                  <Knopf leise typ="submit">Speichern</Knopf>
                </form>
              </div>
            );
          })}
        </Liste>
      )}
    </Karte>
  );
}

function Formulare({ w }: { w: WebsiteApi }) {
  const d = w.d;
  return (
    <>
      {d && (
        <Karte i={0}>
          <Ueberschrift>Erstgespräch buchen</Ueberschrift>
          <div style={{ display: 'grid', gap: 8 }}>
            <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Alle Knöpfe der Website zeigen auf die feste Adresse /erstgespraech — sie leitet auf die Buchungsseite hier. Ohne Wahl gilt die einzige aktive Buchungsseite, deren Adresse mit „erstgespraech-“ beginnt.</span>
            <Feldzeile label="Buchungsseite">
              <select style={feld} value={d.inhalt.einstellungen.erstgespraechSlug ?? ''} onChange={e => void w.senden([{ liste: 'einstellungen', art: 'setze', stand: d.inhalt.einstellungenStand, eintrag: { ...d.inhalt.einstellungen, erstgespraechSlug: e.target.value || undefined } }])}>
                <option value="">— automatisch —</option>
                {d.hilfen.buchungsseiten.map(s => <option key={s.slug} value={s.slug}>{s.titel}</option>)}
              </select>
            </Feldzeile>
            {!d.hilfen.buchungsseiten.length && <Hinweis art="achtung">Noch keine aktive Buchungsseite — im Kalender anlegen.</Hinweis>}
            <span><Link href={WEG.kalender()} style={{ color: C.aktiv, fontSize: TYP.bedien }}>Buchungsseiten im Kalender</Link></span>
          </div>
        </Karte>
      )}
      <KontaktformularKarte />
      <NewsletterWebsite />
      {/* M1 (01.11.): eigene Karte — Schalter, bearbeitbare Texte, wer welche Stufe bekam (bis dahin versteckt im Kampagnen-Detail). */}
      <WillkommenKarte i={3} />
    </>
  );
}

interface Gesellschaft { id: string; firmierung?: string; strasse?: string; plz?: string; ort?: string; email?: string; geschaeftsfuehrung?: string; register?: string; ustId?: string }
function Recht() {
  const [v, setV] = useState<{ wirksam: { v: { name: string } | null; luecken: string[] } } | null>(null);
  const [g, setG] = useState<Gesellschaft[] | null>(null);
  useEffect(() => {
    void fetch('/api/datenschutz/einrichtung', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(setV).catch(() => {});
    void fetch('/api/crm/gesellschaften', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(j => setG(Array.isArray(j?.gesellschaften) ? j.gesellschaften : [])).catch(() => setG([]));
  }, []);
  const impressumFehlt = (x: Gesellschaft) => [
    !x.firmierung && 'Firmierung', !(x.strasse && x.plz && x.ort) && 'Anschrift', !x.email && 'E-Mail', !x.geschaeftsfuehrung && 'Vertretung', !x.register && 'Register', !x.ustId && 'USt-IdNr.',
  ].filter(Boolean) as string[];
  return (
    <>
      <Karte i={0}>
        <Ueberschrift rechts={<Link href={WEG.datenschutz('verantwortlicher')} style={{ color: C.aktiv, fontSize: TYP.bedien }}>Bearbeiten</Link>}>Verantwortlicher</Ueberschrift>
        {!v ? null : v.wirksam.v ? <Zeile titel={v.wirksam.v.name} unter="steht in jedem Datenschutzhinweis der öffentlichen Wege" />
          : <Hinweis art="kritisch" titel="Verantwortlicher fehlt">Ohne Verantwortlichen bleiben Check, Kontaktformular, Newsletter und Bestellungen aus.</Hinweis>}
      </Karte>
      <Karte i={1}>
        <Ueberschrift rechts={<Link href={WEG.unternehmen()} style={{ color: C.aktiv, fontSize: TYP.bedien }}>Unternehmen</Link>}>Impressum-Angaben</Ueberschrift>
        {!g ? null : !g.length ? <Leer>Keine Gesellschaft als Absender eingetragen.</Leer> : (
          <Liste>{g.map(x => { const f = impressumFehlt(x); return <Zeile key={x.id} titel={x.firmierung ?? x.id} unter={f.length ? `Fehlt: ${f.join(', ')}` : 'vollständig'} rechts={<Chip farbe={f.length ? LEUCHT.achtung : LEUCHT.gut}>{f.length ? 'unvollständig' : 'ok'}</Chip>} umbrechen />; })}</Liste>
        )}
      </Karte>
      <Karte i={2}>
        <Ueberschrift>Hinweise je öffentlichem Weg</Ueberschrift>
        <Liste>
          <Zeile titel="Checks · Kontaktformular · Newsletter · Unterlagen · Bestellung" unter="Jeder Weg zeigt den Datenschutzhinweis mit dem Verantwortlichen und kommt ausgeschaltet; Werbung nur mit Einwilligung (Double-Opt-in)." umbrechen />
          <Zeile titel="Erstgespräch" unter="Die Buchungsseite trägt ihren eigenen Hinweis (Art. 6 Abs. 1 lit. b)." umbrechen />
          <Zeile titel="Inhalte und Bilder" unter="Öffentlich nur, was hier sichtbar ist — Bilder nur mit Freigabe für den Kanal Website (Einwilligungen der abgebildeten Personen)." umbrechen />
        </Liste>
        <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Hinweis, keine Rechtsberatung.</span>
      </Karte>
    </>
  );
}

export function Website({ api, zuKontakt, ansicht, onAnsicht }: { api: CrmApi; zuKontakt: (id: string) => void; ansicht: WebsiteAnsicht; onAnsicht: (a: WebsiteAnsicht) => void }) {
  const w = useWebsite();
  const pflege = ansicht === 'angebote' || ansicht === 'bausteine' || ansicht === 'bilder' || ansicht === 'inhalte' || ansicht === 'formulare';
  return (
    <>
      <div style={{ overflowX: 'auto', scrollbarWidth: 'none' }}><Pillen einzeilig liste={REITER} aktiv={ansicht} onWahl={onAnsicht} /></div>
      {pflege && w.fehler && <Hinweis art="kritisch">{w.fehler}</Hinweis>}
      {ansicht === 'ueberblick' && <Ueberblick zu={onAnsicht} />}
      {ansicht === 'eingaenge' && <Eingaenge />}
      {ansicht === 'checks' && <Checks zuKontakt={zuKontakt} />}
      {ansicht === 'angebote' && <AngeboteReiter w={w} api={api} />}
      {ansicht === 'bausteine' && <BausteineReiter w={w} />}
      {ansicht === 'bilder' && <Bilder w={w} />}
      {ansicht === 'formulare' && <Formulare w={w} />}
      {ansicht === 'inhalte' && <InhalteReiter w={w} />}
      {ansicht === 'recht' && <Recht />}
    </>
  );
}
