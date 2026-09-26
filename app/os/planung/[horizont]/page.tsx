import { HorizontView } from '@/components/os/HorizontView';
import { notFound } from 'next/navigation';

const GUELTIG = ['monat', 'quartal', 'jahr'] as const;

export default async function HorizontPage(props: { params: Promise<{ horizont: string }> }) {
  const params = await props.params;
  if (!(GUELTIG as readonly string[]).includes(params.horizont)) notFound();
  return <HorizontView horizont={params.horizont as typeof GUELTIG[number]} />;
}
