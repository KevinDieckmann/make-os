import { SaeuleView, SAEULEN_META } from '@/components/os/SaeuleView';
import { notFound } from 'next/navigation';

export default function SaeulePage({ params }: { params: { key: string } }) {
  if (!SAEULEN_META[params.key]) notFound();
  return <SaeuleView keyName={params.key} />;
}
