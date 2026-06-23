export type CoverageTechnology = 'FOUR_G' | 'FIVE_G';
export type CoverageLayerType = 'COVERAGE' | 'WS';
export type CoverageLayerStatus = 'ACTIVE' | 'ARCHIVED';

export interface CoverageLayerSummary {
  id: string;
  name: string;
  technology: CoverageTechnology;
  layerType: CoverageLayerType;
  governorate?: string;
  sourceFileName?: string;
  color?: string;
  uploadedByEmail?: string;
  status: CoverageLayerStatus;
  createdAt: string;
}

export interface CoverageLayerDetail extends CoverageLayerSummary {
  geoJson: string;
  uploadedByRole?: string;
  updatedAt?: string;
}

export interface CoverageAnalysisSummary {
  totalCases: number;
  analyzedCases: number;
  invalidCoordinateCases: number;
  inside4G: number;
  inside5G: number;
  insideWs4G: number;
  insideWs5G: number;
  outsideAllCoverage: number;
}

export interface CoverageAnalysisResult {
  id: string;
  caseId: string;
  crmCase: string;
  caseType: string;
  governorate?: string;
  latitude: number;
  longitude: number;
  inside4G: boolean;
  inside5G: boolean;
  insideWs4G: boolean;
  insideWs5G: boolean;
  matchedLayerIds: string[];
  decision: string;
  analyzedByEmail?: string;
  analyzedAt: string;
}

/** Default colors for each layer technology + type combination */
export const LAYER_COLORS: Record<string, string> = {
  FOUR_G_COVERAGE: '#FF5722',  // deep orange
  FIVE_G_COVERAGE: '#FFC107',  // amber
  FOUR_G_WS:       '#4CAF50',  // green
  FIVE_G_WS:       '#9C27B0',  // purple
};

export function layerColorKey(tech: CoverageTechnology, type: CoverageLayerType): string {
  return `${tech}_${type}`;
}

export interface PointCheckResponse {
  latitude: number;
  longitude: number;
  inside4G: boolean;
  inside5G: boolean;
  insideWs4G: boolean;
  insideWs5G: boolean;
  decision: string;
  matchedLayerNames: string[];
}
