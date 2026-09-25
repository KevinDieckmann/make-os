'use client';

// ─── Event · Abend — Einlass-Modus fürs Tablet ──────────────────────────────
// Große Flächen, ein Tipp je Gast: da oder nicht gekommen. Dazu je Gast die
// Notiz vom Abend — worüber gesprochen, was zugesagt, wen vorstellen. Genau
// diese Notiz steht beim Nachfassen wieder da (48 Stunden). Fotos nur mit
// Freigabe; eine Visitenkarte ist keine Einwilligung.
// Zwei Geräte gleichzeitig (Kevin und Malin am Einlass): jeder Tipp ändert
// nur diesen einen Gast und nur dieses Feld (api.teil), nie das Event. Der
// Stand kommt hier alle 8 Sekunden neu, an jedem Gast steht, wer ihn zuletzt
// geändert hat (eingecheckt von …), und wessen Gast er ist (lädt ein).
// Spontan und noch nicht in der Kartei (25.09.): Visitenkarte fotografieren →
// neue Person (Herkunft „Veranstaltung“, keine Einwilligung), gleich „da“.

import { useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Ueberschrift, Fortschritt, Leer, Chip, LEUCHT } from '../../schlank';
import { anzeigename, type Kontakt } from '@/lib/make-one/crm';
import { einlader } from '@/lib/crm/eventplanung';
import { TEAM, nameVon } from '@/lib/crm/team';
import type { Teilnahme, TeilnahmeStatus } from '@/lib/crm/typen';
import { neueId } from '../daten';
import { Pillen, Feld } from '../teile';
import { Person } from '../team';
import { Notizfeld, KarteiSuche, JePerson, gastSetzen, type ReiterProps } from './gemeinsam';
import { VisitenkarteKnopf } from '../Visitenkarte';
import { neueFirma } from '../Firmen';
import { kartenDubletten, firmaZurKarte, kontaktAusKarte, emailNormal, type VisitenkartenDaten } from '@/lib/crm/visitenkarte';
import { domainVon } from '@/lib/crm/firmen';

function GrossKnopf({ an, farbe, onClick, children }: { an: boolean; farbe: string; onClick: () => void; children: string }) {
  return (
    <button onClick={onClick} className="fassbar" style={{
      flex: 1, minWidth: 120, minHeight: 48, padding: '12px 18px', borderRadius: 12, cursor: 'pointer', fontSize: TYP.body, fontWeight: 700,
      border: `1px solid ${an ? farbe : 'rgba(255,255,255,.12)'}`, background: an ? `${farbe}26` : 'rgba(255,255,255,.04)', color: an ? farbe : C.ink,
      boxShadow: an ? `0 0 18px -6px ${farbe}40` : undefined,
    }}>{children}</button>
  );
}

type Sicht = 'alle' | 'erwartet' | 'da';

export function Abend({ e, api, zuKontakt }: ReiterProps) {
  const crm = api.crm!;
  const [weitereOffen, setWeitereOffen] = useState(false);
  const [sicht, setSicht] = useState<Sicht>('alle');
  // Am Einlass zählt jede Sekunde: öfter abgleichen als sonst (20 s), solange dieser Reiter offen ist.
  const { laden } = api;
  useEffect(() => { const t = setInterval(() => void laden(), 8_000); return () => clearInterval(t); }, [laden]);

  const nachId = new Map((api.kontakte ?? []).map(k => [k.id, k]));
  const gaeste = crm.stand.teilnahmen.filter(t => t.eventId === e.id)
    .map(t => ({ t, k: nachId.get(t.kontaktId) }))
    .filter((x): x is { t: Teilnahme; k: Kontakt } => !!x.k)
    .sort((a, b) => anzeigename(a.k).localeCompare(anzeigename(b.k), 'de'));
  const erwartet = gaeste.filter(x => x.t.status === 'zugesagt' || x.t.status === 'da' || x.t.status === 'no_show');
  const weitere = gaeste.filter(x => x.t.status === 'eingeladen' || x.t.status === 'vorgemerkt');
  const da = gaeste.filter(x => x.t.status === 'da');
  const nochNicht = erwartet.filter(x => x.t.status === 'zugesagt').length;
  const eingechecktVon: Record<string, number> = {};
  const checker = (t: Teilnahme) => { const v = t.eingechecktVon ?? t.geaendertVon; return v && TEAM.some(m => m.id === v) ? v : null; };
  for (const { t } of da) { const v = checker(t); if (v) eingechecktVon[v] = (eingechecktVon[v] ?? 0) + 1; }
  const zeigen = erwartet.filter(x => sicht === 'alle' || (sicht === 'erwartet' ? x.t.status === 'zugesagt' : x.t.status === 'da'));
  // Nur den Status schicken — „nochmal tippen“ nimmt ihn zurück auf „zugesagt“.
  // Wer eincheckt, steht am Gast (eingechecktVon) — nicht nur „zuletzt geändert“, das eine spätere Notiz überschreiben würde.
  const setzeStatus = (t: Teilnahme, status: TeilnahmeStatus) => gastSetzen(api, t, { status: t.status === status ? 'zugesagt' : status, eingechecktVon: t.status === status ? undefined : api.ich ?? undefined });

  const karte = ({ t, k }: { t: Teilnahme; k: Kontakt }, spontan?: boolean) => {
    const gastVon = einlader(t, k, e);
    const von = checker(t);
    return (
      <div key={t.id} style={{ padding: 14, borderRadius: 14, background: t.status === 'da' ? `${LEUCHT.gut}0D` : 'rgba(255,255,255,.03)', border: `1px solid ${t.status === 'da' ? `${LEUCHT.gut}40` : 'rgba(255,255,255,.06)'}`, display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <button onClick={() => zuKontakt(k.id)} style={{ background: 'none', border: 'none', color: C.ink, cursor: 'pointer', fontSize: TYP.body, fontWeight: 700, padding: 0 }}>{anzeigename(k)}</button>
          {k.firma && <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>{k.firma}</span>}
          {t.rolle && t.rolle !== 'gast' && <Chip farbe={LEUCHT.agenten}>{t.rolle === 'co_host' ? 'Co-Host' : 'Speaker'}</Chip>}
          <span title={`Lädt ein und fasst nach: ${nameVon(gastVon)}`} style={{ display: 'inline-flex', gap: 5, alignItems: 'center', fontSize: 12, color: C.inkLeise }}><Person id={gastVon} groesse={16} />Gast von {nameVon(gastVon)}</span>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: t.fotofreigabe ? LEUCHT.gut : C.inkLeise }}>
            <button onClick={() => gastSetzen(api, t, { fotofreigabe: !t.fotofreigabe })} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 12.5, padding: 0 }}>
              {t.fotofreigabe ? '✓ Fotos freigegeben' : 'Fotos: nicht freigegeben'}
            </button>
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {spontan
            ? <GrossKnopf an={false} farbe={LEUCHT.gut} onClick={() => gastSetzen(api, t, { status: 'da', eingechecktVon: api.ich ?? undefined })}>Ist doch da</GrossKnopf>
            : <>
              <GrossKnopf an={t.status === 'da'} farbe={LEUCHT.gut} onClick={() => setzeStatus(t, 'da')}>{t.status === 'da' ? '✓ Da' : 'Da'}</GrossKnopf>
              <GrossKnopf an={t.status === 'no_show'} farbe={LEUCHT.kritisch} onClick={() => setzeStatus(t, 'no_show')}>Nicht gekommen</GrossKnopf>
            </>}
        </div>
        {!spontan && (t.status === 'da' || t.status === 'no_show') && von && (
          <div title="zuletzt geändert von" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12, color: C.inkLeise }}>
            <Person id={von} groesse={16} />{t.status === 'da' ? 'eingecheckt' : 'als nicht gekommen markiert'} von {von === api.ich ? 'dir' : nameVon(von)}
          </div>
        )}
        {!spontan && <Notizfeld gross zeilen={2} wert={t.notiz} platzhalter="Notiz vom Abend — worüber gesprochen, was zugesagt, wen vorstellen" onFertig={notiz => gastSetzen(api, t, { notiz: notiz || undefined })} />}
      </div>
    );
  };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div>
        <Ueberschrift rechts={<span style={{ fontSize: TYP.body, color: C.ink, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{da.length} / {erwartet.length} da</span>}>Einlass</Ueberschrift>
        <Fortschritt anteil={erwartet.length ? da.length / erwartet.length : 0} farbe={LEUCHT.gut} />
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 8, fontSize: 12.5, color: C.inkLeise }}>
          {erwartet.length > 0 && <span>{nochNicht ? `${nochNicht} noch erwartet` : 'Alle Zugesagten sind da oder abgehakt.'}</span>}
          {da.length > 0 && Object.keys(eingechecktVon).length > 0 && <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>eingecheckt von <JePerson zahlen={eingechecktVon} /></span>}
        </div>
        <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 6 }}>Zwei Geräte gleichzeitig gehen: jeder Tipp ändert nur diesen Gast, der Stand kommt alle 8 Sekunden neu.</div>
      </div>
      {erwartet.length > 0 && (
        <Pillen liste={[{ id: 'alle', label: `Alle ${erwartet.length}` }, { id: 'erwartet', label: `Noch erwartet ${nochNicht}` }, { id: 'da', label: `Da ${da.length}` }]} aktiv={sicht} onWahl={setSicht} farbe={LEUCHT.gut} />
      )}
      {zeigen.map(x => karte(x))}
      {!erwartet.length && <Leer>Noch keine Zusagen. Wer zugesagt hat, steht hier am Abend mit großem „Da“-Knopf und Notizfeld.</Leer>}
      {erwartet.length > 0 && !zeigen.length && <Leer>{sicht === 'erwartet' ? 'Niemand mehr erwartet — jetzt Notizen vom Abend festhalten.' : 'Noch niemand eingecheckt.'}</Leer>}

      {weitere.length > 0 && (
        <div>
          <button onClick={() => setWeitereOffen(!weitereOffen)} style={{ background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', fontSize: TYP.bedien, padding: '6px 0' }}>
            {weitereOffen ? '▾' : '▸'} Ohne Zusage, aber doch gekommen? ({weitere.length})
          </button>
          {weitereOffen && <div style={{ display: 'grid', gap: 10, marginTop: 6 }}>{weitere.map(x => karte(x, true))}</div>}
        </div>
      )}
      <div>
        <div style={{ fontSize: 12, color: C.inkLeise, marginBottom: 6 }}>Spontan dabei — aus der Kartei, direkt als „da“:</div>
        <KarteiSuche api={api} e={e} platzhalter="Name suchen …" onWahl={kontaktId => api.setze('teilnahmen', { id: neueId('t'), eventId: e.id, kontaktId, status: 'da', rolle: 'gast' })} />
      </div>
      <div>
        <div style={{ fontSize: 12, color: C.inkLeise, marginBottom: 6 }}>Noch nicht in der Kartei? Visitenkarte fotografieren — neue Person, direkt als „da“:</div>
        <SpontanPerKarte e={e} api={api} zuKontakt={zuKontakt} />
      </div>
    </div>
  );
}

/**
 * Spontaner Gast, der noch nicht in der Kartei steht: Visitenkarte
 * fotografieren → Felder prüfen → als neue Person anlegen (Herkunft
 * „Veranstaltung“ — keine Art.-14-Pflicht, aber KEINE Einwilligung) und gleich
 * als „da“ eintragen. Steht die Mail schon in der Kartei, wird nicht doppelt
 * angelegt, sondern die bestehende Person eingecheckt; bei gleichem Namen
 * (ohne Titel) fragt die Karte nach.
 */
function SpontanPerKarte({ e, api, zuKontakt }: ReiterProps) {
  const crm = api.crm!;
  const [karte, setKarte] = useState<VisitenkartenDaten | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [erledigt, setErledigt] = useState<{ id: string; name: string; neu: boolean } | null>(null);
  // Nach dem Anlegen/Verwerfen startet der Knopf frisch (ohne Vorschau der letzten Karte).
  const [runde, setRunde] = useState(0);
  const dubl: { mail?: Kontakt; name?: Kontakt } = karte ? kartenDubletten(karte, api.kontakte ?? []) : {};
  const emailOk = !karte?.email || !!emailNormal(karte.email);
  const ok = !!karte?.nachname?.trim() && !dubl.mail && emailOk && !laeuft;
  const setze = (teil: Partial<VisitenkartenDaten>) => setKarte(k => (k ? { ...k, ...teil } : k));
  const fertig = (x: { id: string; name: string; neu: boolean }) => { setErledigt(x); setKarte(null); setRunde(r => r + 1); };

  /** Als „da“ eintragen — steht die Person schon auf der Liste (z. B. eingeladen), nur ihren Status ändern. */
  const eintragen = async (kontaktId: string) => {
    const t = crm.stand.teilnahmen.find(x => x.eventId === e.id && x.kontaktId === kontaktId);
    if (t) await gastSetzen(api, t, { status: 'da', eingechecktVon: api.ich ?? undefined });
    else await api.setze('teilnahmen', { id: neueId('t'), eventId: e.id, kontaktId, status: 'da', rolle: 'gast', ...(api.ich ? { eingechecktVon: api.ich } : {}) });
  };
  const bestehend = async (k: Kontakt) => {
    if (laeuft) return;
    setLaeuft(true);
    try { await eintragen(k.id); fertig({ id: k.id, name: anzeigename(k), neu: false }); } finally { setLaeuft(false); }
  };
  const anlegen = async () => {
    if (!karte || !ok) return;
    setLaeuft(true);
    try {
      const d: VisitenkartenDaten = { ...karte, email: karte.email ? emailNormal(karte.email) : undefined };
      let firma = firmaZurKarte(d, crm.stand.firmen);
      if (!firma && d.firma?.trim()) {
        const domain = domainVon({ email: d.email, firmaWebseite: d.webseite });
        firma = { ...neueFirma(d.firma), ...(d.webseite ? { webseite: d.webseite } : {}), ...(domain ? { domain } : {}) };
        await api.setze('firmen', firma as unknown as { id: string } & Record<string, unknown>);
      }
      const id = `c-neu-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
      const k = kontaktAusKarte(d, { id, heute: crm.heute, jetzt: new Date().toISOString(), von: api.ich, herkunft: 'veranstaltung', firma, anlass: `Per Visitenkarte am Einlass angelegt — ${e.titel}` });
      await api.kontaktSetzen(k);
      await eintragen(id);
      fertig({ id, name: anzeigename(k), neu: true });
    } finally { setLaeuft(false); }
  };

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <VisitenkarteKnopf key={runde} gross onErkannt={d => { setErledigt(null); setKarte(d); }} />
      {erledigt && !karte && (
        <div style={{ fontSize: TYP.bedien, color: LEUCHT.gut }}>
          ✓ {erledigt.name} {erledigt.neu ? 'angelegt und ' : ''}als da eingetragen ·{' '}
          <button onClick={() => zuKontakt(erledigt.id)} style={{ background: 'none', border: 'none', color: C.aktiv, cursor: 'pointer', fontSize: TYP.bedien, padding: 0 }}>Zur Person</button>
        </div>
      )}
      {karte && (
        <div style={{ display: 'grid', gap: 10, padding: 14, borderRadius: 14, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))', gap: 8 }}>
            <Feld wert={karte.vorname ?? ''} platzhalter="Vorname" onFertig={v => setze({ vorname: v.trim() || undefined })} />
            <Feld wert={karte.nachname ?? ''} platzhalter="Nachname *" onFertig={v => setze({ nachname: v.trim() || undefined })} />
            <Feld wert={karte.firma ?? ''} platzhalter="Firma" onFertig={v => setze({ firma: v.trim() || undefined })} />
            <Feld wert={karte.position ?? ''} platzhalter="Position" onFertig={v => setze({ position: v.trim() || undefined })} />
            <Feld wert={karte.email ?? ''} platzhalter="E-Mail (Dublettenschlüssel)" onFertig={v => setze({ email: v.trim().toLowerCase() || undefined })} />
            <Feld wert={karte.telefon ?? ''} platzhalter="Telefon" onFertig={v => setze({ telefon: v.trim() || undefined })} />
          </div>
          {dubl.mail && (
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ fontSize: 12.5, color: LEUCHT.kritisch }}>Diese Mail gehört schon zu {anzeigename(dubl.mail)}{dubl.mail.firma ? ` (${dubl.mail.firma})` : ''} — nicht doppelt anlegen.</div>
              <GrossKnopf an farbe={LEUCHT.gut} onClick={() => void bestehend(dubl.mail!)}>{`${anzeigename(dubl.mail)} als da eintragen`}</GrossKnopf>
            </div>
          )}
          {!dubl.mail && dubl.name && (
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ fontSize: 12.5, color: LEUCHT.achtung }}>Achtung: {anzeigename(dubl.name)}{dubl.name.firma ? ` (${dubl.name.firma})` : ''} gibt es schon — gleiche Person?</div>
              <GrossKnopf an={false} farbe={LEUCHT.gut} onClick={() => void bestehend(dubl.name!)}>{`Ja — ${anzeigename(dubl.name)} als da eintragen`}</GrossKnopf>
            </div>
          )}
          {!emailOk && <div style={{ fontSize: 12.5, color: LEUCHT.achtung }}>Die E-Mail sieht unvollständig aus — bitte prüfen oder leeren.</div>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {!dubl.mail && (
              <GrossKnopf an={ok} farbe={LEUCHT.gut} onClick={() => void anlegen()}>
                {laeuft ? 'legt an …' : dubl.name ? 'Nein — neu anlegen und als da eintragen' : 'Anlegen und als da eintragen'}
              </GrossKnopf>
            )}
            <GrossKnopf an={false} farbe={C.inkDim} onClick={() => { setKarte(null); setRunde(r => r + 1); }}>Verwerfen</GrossKnopf>
          </div>
          <div style={{ fontSize: 12, color: C.inkLeise }}>
            {karte.nachname?.trim() ? 'Herkunft: Veranstaltung · keine Einwilligung — Einladungen per Mail erst nach Double-Opt-in.' : 'Nachname fehlt — bitte eintragen, dann anlegen.'}
          </div>
        </div>
      )}
    </div>
  );
}
