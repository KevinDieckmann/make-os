import { SaeuleView, SAEULEN_META } from '@/components/os/SaeuleView';
import { notFound, redirect } from 'next/navigation';

export default function SaeulePage({ params }: { params: { key: string } }) {
  // Die Business-Säule IST der Business-Index (25.09., „eine Wahrheit“).
  if (params.key === 'business') redirect('/os/finanzen?s=business');
  // Familie & Partnerschaft lebt auf /os/familie (Pflege-Rhythmus), Agenten auf /os/agenten (26.09.).
  if (params.key === 'social') redirect('/os/familie');
  if (params.key === 'agents') redirect('/os/agenten');
  if (!SAEULEN_META[params.key]) notFound();
  return <SaeuleView keyName={params.key} />;
}
