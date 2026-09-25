// Das CRM heißt seit 25.09. Markttraktion — alte Links (Lesezeichen, Brain,
// Jarvis-Verlauf) landen hier und werden mit ihren Parametern umgeleitet.
import { redirect } from 'next/navigation';
import { markttraktion } from '@/lib/crm/adresse';

export default function CrmUmleitung({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  redirect(markttraktion(searchParams.s, searchParams.a, searchParams.k));
}
