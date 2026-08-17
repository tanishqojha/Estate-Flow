import type { AssignmentMode } from "@/lib/types/database";
import type { AssignableAgent, LeadAssignmentService } from "@/lib/services/types";

/**
 * leadAssignmentService — pure selection logic (PRD §5 assignment modes).
 * No external I/O, so prod and dry-run are the same implementation.
 * The db layer supplies candidate agents (active sales agents with lead
 * counts); this service only decides who's next.
 */

function byRoundRobin(a: AssignableAgent, b: AssignableAgent): number {
  // Never-assigned agents first, then least recently assigned.
  if (a.lastAssignedAt === null && b.lastAssignedAt === null) return 0;
  if (a.lastAssignedAt === null) return -1;
  if (b.lastAssignedAt === null) return 1;
  return a.lastAssignedAt.localeCompare(b.lastAssignedAt);
}

function byLeastBusy(a: AssignableAgent, b: AssignableAgent): number {
  if (a.activeLeadCount !== b.activeLeadCount) {
    return a.activeLeadCount - b.activeLeadCount;
  }
  return byRoundRobin(a, b);
}

export const leadAssignmentService: LeadAssignmentService = {
  pickAgent(mode: AssignmentMode, candidates: AssignableAgent[]): AssignableAgent | null {
    if (mode === "manual") return null;
    return this.orderFallbackQueue(mode, candidates)[0] ?? null;
  },

  orderFallbackQueue(mode: AssignmentMode, candidates: AssignableAgent[]): AssignableAgent[] {
    const queue = [...candidates];
    queue.sort(mode === "least_busy" ? byLeastBusy : byRoundRobin);
    return queue;
  },
};
