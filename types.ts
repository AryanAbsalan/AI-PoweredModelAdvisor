export interface DataRow {
  [key: string]: string | number | null;
}

export interface ColumnStat {
  name: string;
  type: 'number' | 'string';
  missingCount: number;
  uniqueCount: number;
  sample: (string | number | null)[];
}

export interface CleaningOptions {
  method: 'drop_rows' | 'fill_mean' | 'fill_median' | 'fill_mode';
  targetColumns: string[];
}

export interface ModelConfig {
  targetColumn: string;
  featureColumns: string[];
  splitRatio: number; // 0.1 to 0.9
  algorithm: 'linear_regression' | 'ridge' | 'decision_tree' | 'random_forest';
}

export interface ModelMetrics {
  mae: number;
  mse: number;
  r2: number;
  predictions: { actual: number; predicted: number }[];
}

export enum AppStep {
  UPLOAD = 0,
  CLEANING = 1,
  CONFIGURATION = 2,
  MODEL_SELECTION = 3,
  RESULTS = 4,
}
