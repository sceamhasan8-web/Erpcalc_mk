import { ProductionFlow } from '@/types';

export function isMultiProcessDept(dept?: string): boolean {
  const lower = (dept || '').toLowerCase().trim();
  return lower === 'printing' || lower === 'embossing';
}

export interface MultiProcessProductionResult {
  totalCompleted: number;
  completedBySize: Record<string, number>;
  processCounts: number;
  allStages: string[];
  stageTotals: Record<string, number>;
  stageSizeTotals: Record<string, Record<string, number>>;
  isComplete: boolean;
}

/**
 * Calculates size-wise completed production for a department across all processes/stages.
 * In a multi-process section (e.g. Printing, Embossing), a pair of size X is ONLY complete
 * when ALL stages of the process have finished size X (e.g. min(Back Part size 41, Toe Cap size 41)).
 */
export function calculateMultiProcessProduction(
  flows: ProductionFlow[],
  department: string,
  configuredStages: string[] = [],
  target: number = 0
): MultiProcessProductionResult {
  const deptFlows = flows.filter((f) => f.department === department);
  const isMulti = isMultiProcessDept(department);

  if (!isMulti) {
    const total = deptFlows.reduce((sum, f) => sum + (f.completed || 0), 0);
    const bySize: Record<string, number> = {};
    deptFlows.forEach((f) => {
      if (f.sizeBreakdown) {
        Object.entries(f.sizeBreakdown).forEach(([sz, qty]) => {
          const n = Number(qty) || 0;
          if (n > 0) {
            bySize[sz] = (bySize[sz] || 0) + n;
          }
        });
      }
    });

    return {
      totalCompleted: total,
      completedBySize: bySize,
      processCounts: 0,
      allStages: [],
      stageTotals: {},
      stageSizeTotals: {},
      isComplete: target > 0 && total >= target,
    };
  }

  // Multi-process department (e.g. Printing, Embossing)
  const recordedProcesses = Array.from(
    new Set(deptFlows.map((f) => f.processName).filter(Boolean))
  ) as string[];

  // Merge configured stages with recorded stages
  const allStages = Array.from(new Set([...configuredStages, ...recordedProcesses]));

  if (allStages.length === 0) {
    const total = deptFlows.reduce((sum, f) => sum + (f.completed || 0), 0);
    const bySize: Record<string, number> = {};
    deptFlows.forEach((f) => {
      if (f.sizeBreakdown) {
        Object.entries(f.sizeBreakdown).forEach(([sz, qty]) => {
          const n = Number(qty) || 0;
          if (n > 0) {
            bySize[sz] = (bySize[sz] || 0) + n;
          }
        });
      }
    });

    return {
      totalCompleted: total,
      completedBySize: bySize,
      processCounts: 0,
      allStages: [],
      stageTotals: {},
      stageSizeTotals: {},
      isComplete: target > 0 && total >= target,
    };
  }

  // Track per-stage totals and size breakdowns
  const stageTotals: Record<string, number> = {};
  const stageSizeTotals: Record<string, Record<string, number>> = {};
  const allSizeKeys = new Set<string>();

  allStages.forEach((st) => {
    stageTotals[st] = 0;
    stageSizeTotals[st] = {};
  });

  deptFlows.forEach((f) => {
    const proc = f.processName || allStages[0];
    if (stageTotals[proc] === undefined) stageTotals[proc] = 0;
    if (!stageSizeTotals[proc]) stageSizeTotals[proc] = {};

    stageTotals[proc] += f.completed || 0;

    if (f.sizeBreakdown && Object.keys(f.sizeBreakdown).length > 0) {
      Object.entries(f.sizeBreakdown).forEach(([sz, qty]) => {
        const val = Number(qty) || 0;
        if (val > 0) {
          allSizeKeys.add(sz);
          stageSizeTotals[proc][sz] = (stageSizeTotals[proc][sz] || 0) + val;
        }
      });
    }
  });

  const completedBySize: Record<string, number> = {};
  let totalCompleted = 0;

  if (allSizeKeys.size > 0) {
    // Size-wise completed calculation:
    // For every size, completed = min(stage 1 size count, stage 2 size count, ...)
    allSizeKeys.forEach((sz) => {
      const stageOutputsForSize = allStages.map((st) => stageSizeTotals[st]?.[sz] || 0);
      const minForSize = Math.min(...stageOutputsForSize);
      completedBySize[sz] = minForSize;
      totalCompleted += minForSize;
    });

    // Also account for direct/non-sized quantity if any entries didn't use sizeBreakdown
    const directQtyByStage = allStages.map((st) => {
      return deptFlows
        .filter(
          (f) =>
            (f.processName || allStages[0]) === st &&
            (!f.sizeBreakdown || Object.keys(f.sizeBreakdown).length === 0)
        )
        .reduce((sum, f) => sum + (f.completed || 0), 0);
    });
    const minDirect = Math.min(...directQtyByStage);
    totalCompleted += minDirect;
  } else {
    // If no size breakdowns exist across all flows in this multi-process department
    const stageOutputs = allStages.map((st) => stageTotals[st] || 0);
    totalCompleted = Math.min(...stageOutputs);
  }

  const isComplete = target > 0 && totalCompleted >= target;

  return {
    totalCompleted,
    completedBySize,
    processCounts: allStages.length,
    allStages,
    stageTotals,
    stageSizeTotals,
    isComplete,
  };
}
