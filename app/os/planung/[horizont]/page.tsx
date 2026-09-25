import { HorizontView } from '@/components/os/HorizontView';
import { notFound } from 'next/navigation';

const GUELTIG = ['monat', 'quartal', 'jahr'] as const;

export default function HorizontPage({ params }: { params: { horizont: string } }) {
  if (!(GUELTIG as readonly string[]).includes(params.horizont)) notFound();
  return <HorizontView horizont={params.horizont as typeof GUELTIG[number]} />;
}
