// ─── MAKE OS — Drei mitgelieferte Startvorlagen (Paket C3, 28.09. spät) ─────
// Erfunden, ohne echte Daten (keine Namen, keine Firmen, keine Beträge). Sie stehen nur im Code — nie im
// Bestand — und erscheinen im Vorlagen-Dialog neben den eigenen. Wer eine anpassen will, legt daraus an und
// speichert das Ergebnis als eigene Vorlage. Kennungen beginnen mit `start-` (lib/aufgaben/vorlagen.ts `vorlageFinden`).

import type { AufgabenVorlage } from '@/types/tasks';

export const STARTVORLAGEN: readonly AufgabenVorlage[] = [
  {
    id: 'start-monatsabschluss',
    art: 'liste',
    titel: 'Monatsabschluss Buchhaltung',
    inhalt: {
      aufgaben: [
        { titel: 'Belege sammeln', versatzTage: 2, unter: [{ titel: 'Eingangsrechnungen ablegen' }, { titel: 'Ausgangsrechnungen ablegen' }, { titel: 'Quittungen und Kassenbelege erfassen' }] },
        { titel: 'Kontoauszüge abrufen', versatzTage: 3 },
        { titel: 'Rechnungen prüfen', versatzTage: 5, unter: [{ titel: 'Offene Posten abgleichen' }, { titel: 'Zahlungseingänge zuordnen' }] },
        { titel: 'An Steuerberater übergeben', versatzTage: 8, prioritaet: 'high' },
      ],
    },
  },
  {
    id: 'start-mandats-onboarding',
    art: 'projekt',
    titel: 'Mandats-Onboarding',
    inhalt: {
      notiz: '## Ziel\nDas Mandat ist nach 30 Tagen startklar.\n\n- [ ] Kickoff gehalten\n- [ ] Vertrag abgelegt\n- [ ] Zugänge stehen\n- [ ] Erster Report übergeben',
      listen: [
        {
          titel: 'Start',
          aufgaben: [
            { titel: 'Kickoff', versatzTage: 3, prioritaet: 'high', unter: [{ titel: 'Agenda vorbereiten' }, { titel: 'Termin abstimmen' }, { titel: 'Protokoll festhalten' }] },
            { titel: 'Vertrag', versatzTage: 5, unter: [{ titel: 'Gegenzeichnung einholen' }, { titel: 'Vertrag ablegen' }] },
          ],
        },
        {
          titel: 'Einrichtung',
          aufgaben: [
            { titel: 'Zugänge', versatzTage: 10, unter: [{ titel: 'Datenraum einrichten' }, { titel: 'Lesezugang Buchhaltung' }, { titel: 'Kommunikationsweg festlegen' }] },
            { titel: 'Erster Report', versatzTage: 30, prioritaet: 'high', unter: [{ titel: 'Entwurf' }, { titel: 'Abstimmung' }, { titel: 'Übergabe' }] },
          ],
        },
      ],
    },
  },
  {
    id: 'start-launch',
    art: 'projekt',
    titel: 'Launch-Projekt',
    inhalt: {
      notiz: '## Launch\n- Zieltermin: …\n- Zielgruppe: …\n\n- [ ] Botschaft steht\n- [ ] Vertrieb vorbereitet\n- [ ] Betrieb bereit',
      felder: [
        { id: 'budget', name: 'Budget', typ: 'betrag' },
        { id: 'kanal', name: 'Kanal', typ: 'auswahl', optionen: ['Web', 'Messe', 'Netzwerk', 'Presse'] },
      ],
      gruppen: [{ titel: 'Marketing', farbe: '#E27FD0' }, { titel: 'Sales', farbe: '#6E7EF5' }, { titel: 'Operations', farbe: '#58D9CD' }],
      listen: [
        { titel: 'Botschaft & Kanäle', gruppe: 'Marketing', aufgaben: [{ titel: 'Positionierung schärfen', versatzTage: 7 }, { titel: 'Landingpage', versatzTage: 14, unter: [{ titel: 'Text' }, { titel: 'Bilder' }, { titel: 'Freigabe' }] }, { titel: 'Launch-Beitrag vorbereiten', versatzTage: 21 }] },
        { titel: 'Pipeline', gruppe: 'Sales', aufgaben: [{ titel: 'Zielkunden-Liste', versatzTage: 7 }, { titel: 'Angebot und Preisblatt', versatzTage: 14 }, { titel: 'Demo-Termine planen', versatzTage: 21 }] },
        { titel: 'Bereitschaft', gruppe: 'Operations', aufgaben: [{ titel: 'Zuständigkeiten klären', versatzTage: 5 }, { titel: 'Onboarding-Ablauf testen', versatzTage: 18 }, { titel: 'Launch-Checkliste abhaken', versatzTage: 25, prioritaet: 'high' }] },
      ],
    },
  },
];
