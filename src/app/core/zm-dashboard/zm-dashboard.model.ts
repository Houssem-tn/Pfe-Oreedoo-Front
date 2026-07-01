/** Response shape of GET /api/v1/zm/dashboard — mirrors ZmDashboardResponse (backend). */

export interface ZmDashboardKpis {
  totalCases: number;
  pending: number;
  assignedStt: number;
  assignedTech: number;
  inProgress: number;
  workDone: number;
  waitingValidation: number;
  closed: number;
  overdueSla: number;
  activeStts: number;
  openDpms: number;
  pendingReturns: number;
}

export interface ZmModuleStats {
  module: string; // ACT | PLT | RES
  total: number;
  pending: number;
  assignedStt: number;
  assignedTech: number;
  inProgress: number;
  workDone: number;
  waitingValidation: number;
  closed: number;
  overdue: number;
}

export interface ZmStatusCount {
  status: string;
  count: number;
}

export interface ZmSttPerformance {
  sttId: string;
  sttName: string | null;
  sttEmail: string | null;
  assigned: number;
  completed: number;
  pending: number;
  late: number;
  avgResolutionMinutes: number;
  slaRespectPercent: number;
  materialReceived: number;
  materialDistributed: number;
  materialReturned: number;
  materialDamagedMissing: number;
}

export interface ZmActionPreview {
  id: string | null;
  reference: string | null;
  label: string | null;
  meta: string | null;
}

export interface ZmActionGroup {
  count: number;
  preview: ZmActionPreview[];
}

export interface ZmActionItems {
  waitingAssignment: ZmActionGroup;
  waitingValidation: ZmActionGroup;
  overdue: ZmActionGroup;
  pendingReturns: ZmActionGroup;
  dpmFollowUp: ZmActionGroup;
  missingImeiSerial: ZmActionGroup;
  stockAnomalies: ZmActionGroup;
}

export interface ZmStockOverview {
  dpmCreated: number;
  dpmConfirmed: number;
  materialReceivedByStt: number;
  materialDistributed: number;
  materialConsumed: number;
  materialReturned: number;
  recoverable: number;
  trackedUnits: number;
  missingImeiSerial: number;
}

export interface ZmTodoImportStat {
  module: string;
  fileName: string | null;
  importDate: string | null;
  totalRows: number;
  createdCases: number;
  duplicateRows: number;
  invalidRows: number;
  status: string;
}

export interface ZmGovernorateStat {
  governorate: string;
  total: number;
  pending: number;
  overdue: number;
}

export interface ZmCompletionPoint {
  date: string;
  completed: number;
}

export interface ZmAlertItem {
  title: string | null;
  message: string | null;
  level: string | null;
  category: string | null;
  createdAt: string | null;
  relatedCaseId: string | null;
}

export interface ZmDashboardResponse {
  kpis: ZmDashboardKpis;
  casesByModule: ZmModuleStats[];
  casesByStatus: ZmStatusCount[];
  sttPerformance: ZmSttPerformance[];
  actionItems: ZmActionItems;
  stockOverview: ZmStockOverview;
  todoImportStats: ZmTodoImportStat[];
  governorateStats: ZmGovernorateStat[];
  completionTrend: ZmCompletionPoint[];
  recentAlerts: ZmAlertItem[];
  generatedAt: string;
}
