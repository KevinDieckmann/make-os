// ─── MAKE OS — CORE TYPE SYSTEM ───────────────────────────────────────────

export type CircadianPhase =
  | 'PHASE_1_FOCUS'       // 05:00–12:00 — high cortisol, executive, deep work
  | 'PHASE_2_CONNECTION'  // 12:00–17:00 — serotonin peak, creative, collaborative
  | 'PHASE_3_RESET';      // 17:00–05:00 — melatonin onset, decompression

export type TaskProject = 'Holding' | 'Private' | 'make OS' | 'CapOS' | 'Connect';
export type TaskAssignee = 'Malin' | 'Kevin' | 'Both';
export type TaskPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type TaskStatus = 'OFFEN' | 'IN_ARBEIT' | 'BLOCKIERT' | 'ERLEDIGT';

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

export interface ProjectTask {
  id: string;
  title: string;
  project: TaskProject;
  assignedTo: TaskAssignee;
  priority: TaskPriority;
  status: TaskStatus;
  subtasks: SubTask[];
  blockedByTaskId?: string;    // if set → renders lock + warning
  hubermanPhase: 1 | 2;       // Huberman circadian block assignment
  dueDate?: string;            // ISO date string
  notes?: string;
}

// ─── EBA (Emotional Bank Account) — Gottman Dynamic System ────────────────

export type InteractionCategory =
  | 'POSITIVE_FULL_FOCUS'       // c_i = 1.0
  | 'POSITIVE_MULTITASKING'     // c_i = 0.2
  | 'NEGATIVE_TURNING_AWAY'     // m_j = 20.0 — highest cost
  | 'NEGATIVE_VERBAL_CRITICISM' // m_j = 5.0
  | 'NEGATIVE_CONTEMPT'         // m_j = 15.0
  | 'POSITIVE_APPRECIATION'     // c_i = 1.0, baseWeight = 8
  | 'POSITIVE_REUNION'          // c_i = 1.0, baseWeight = 5
  | 'POSITIVE_PARTING'          // c_i = 0.8, baseWeight = 4
  | 'POSITIVE_TOUCH'            // c_i = 0.9, baseWeight = 6
  | 'POSITIVE_LISTENING';       // c_i = 0.8, baseWeight = 5

export interface EbaInteraction {
  id: string;
  timestamp: string;          // ISO datetime
  category: InteractionCategory;
  baseWeight: number;         // raw impact magnitude
  multiplier: number;         // c_i (positive) or m_j (negative)
  netValue: number;           // baseWeight * multiplier (signed)
  description?: string;
  initiatedBy: TaskAssignee;
}

export interface EbaState {
  currentScore: number;       // E_t ∈ [0, 100]
  dailyDrift: number;         // λ = 0.05 per cycle
  netTransferToday: number;   // sum of all Delta_E_t today
  interactionHistory: EbaInteraction[];
  lastCalculatedAt: string;   // ISO datetime
  streakDays: number;         // consecutive days above threshold (60)
}

// ─── EBA FORMULA ──────────────────────────────────────────────────────────
// E_t = max(0, min(100, E_{t-1} * (1 - λ) + ΔE_t))
// Positive: ΔE = baseWeight * c_i
// Negative: ΔE = -baseWeight * m_j
// λ (decay) = 0.05 per day

export const EBA_CONSTANTS = {
  LAMBDA: 0.05,
  THRESHOLD_HEALTHY: 60,
  THRESHOLD_WARNING: 40,
  THRESHOLD_CRITICAL: 20,
  MULTIPLIERS: {
    POSITIVE_FULL_FOCUS:       1.0,
    POSITIVE_MULTITASKING:     0.2,
    POSITIVE_APPRECIATION:     1.0,
    POSITIVE_REUNION:          1.0,
    POSITIVE_PARTING:          0.8,
    POSITIVE_TOUCH:            0.9,
    POSITIVE_LISTENING:        0.8,
    NEGATIVE_TURNING_AWAY:     20.0,
    NEGATIVE_VERBAL_CRITICISM:  5.0,
    NEGATIVE_CONTEMPT:         15.0,
  } as Record<InteractionCategory, number>,
  BASE_WEIGHTS: {
    POSITIVE_FULL_FOCUS:       5,
    POSITIVE_MULTITASKING:     5,
    POSITIVE_APPRECIATION:     8,
    POSITIVE_REUNION:          5,
    POSITIVE_PARTING:          4,
    POSITIVE_TOUCH:            6,
    POSITIVE_LISTENING:        5,
    NEGATIVE_TURNING_AWAY:     1,
    NEGATIVE_VERBAL_CRITICISM:  1,
    NEGATIVE_CONTEMPT:         1,
  } as Record<InteractionCategory, number>,
} as const;

// ─── CIRCADIAN UTILITY ─────────────────────────────────────────────────────

export function getCurrentPhase(): CircadianPhase {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12)  return 'PHASE_1_FOCUS';
  if (hour >= 12 && hour < 17) return 'PHASE_2_CONNECTION';
  return 'PHASE_3_RESET';
}

export function applyEbaDecay(state: EbaState): number {
  return Math.max(0, Math.min(100, state.currentScore * (1 - state.dailyDrift)));
}

export function computeEbaStep(prevScore: number, delta: number): number {
  return Math.max(0, Math.min(100, prevScore * (1 - EBA_CONSTANTS.LAMBDA) + delta));
}

// ─── COMMAND PALETTE ───────────────────────────────────────────────────────

export interface CommandEntry {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  action: () => void;
}

// ─── GROCERY ───────────────────────────────────────────────────────────────

export type GroceryCategory = 'GEMÜSE' | 'PROTEINE' | 'TROCKENWAREN' | 'MILCHPRODUKTE' | 'GETRÄNKE' | 'SONSTIGES';

export interface GroceryItem {
  id: string;
  name: string;
  category: GroceryCategory;
  quantity?: string;
  checked: boolean;
}

// ─── LOVE MAP ──────────────────────────────────────────────────────────────

export interface LoveMapQuestion {
  id: string;
  question: string;
  targetPartner: TaskAssignee;
  lastAnsweredAt?: string;
}

export interface LoveMapSync {
  weekNumber: number;
  completedAt?: string;
  answers: Record<string, string>;
  unlockedAt?: string;
}
