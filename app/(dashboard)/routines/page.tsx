import { StubModule } from '@/components/shared/StubModule';
import { CheckSquare } from 'lucide-react';

export default function RoutinesPage() {
  return (
    <StubModule
      title="Routinen & Gewohnheiten"
      description="Morgen- und Abendroutinen als Checklisten, Habit-Tracker integriert mit Wellness-Zielen."
      icon={CheckSquare}
    />
  );
}
