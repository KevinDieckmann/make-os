import { HorizontView } from '@/components/os/HorizontView';
import { PlanungAutomationen } from '@/components/os/planung/PlanungAutomationen';
import { notFound } from 'next/navigation';

const GUELTIG = ['monat', 'quartal', 'jahr'] as const;

export default async function HorizontPage(props: { params: Promise<{ horizont: string }>; searchParams?: Promise<{ s?: string }> }) {
  const params = await props.params;
  if (!(GUELTIG as readonly string[]).includes(params.horizont)) notFound();
  // Werkzeug Planung (22.10. abends): „Automationen & Head“ ist ein Parameter an der Seite des Jahres (`/os/planung/jahr?s=automationen`) — keine eigene Seite.
  const s = (await props.searchParams)?.s;
  if (params.horizont === 'jahr' && s === 'automationen') return <PlanungAutomationen />;
  return <HorizontView horizont={params.horizont as typeof GUELTIG[number]} />;
}
