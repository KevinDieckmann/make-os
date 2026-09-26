// Das CRM heißt seit 25.09. Markttraktion — alte Links (Lesezeichen, Brain,
// Jarvis-Verlauf) landen hier und werden mit ihren Parametern umgeleitet.
import { redirect } from 'next/navigation';
import { markttraktion } from '@/lib/crm/adresse';

export default async function CrmUmleitung(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams;
  redirect(markttraktion(searchParams.s, searchParams.a, searchParams.k));
}
