import { DataRow, ColumnStat, CleaningOptions, ModelMetrics } from "../types";

// --- Parsing ---

export const parseCSV = (csvText: string): DataRow[] => {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const data: DataRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rowStr = lines[i].trim();
    if (!rowStr) continue;
    
    // Basic CSV split respecting quotes (simplified for demo)
    const values = rowStr.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    
    if (values.length === headers.length) {
      const row: DataRow = {};
      headers.forEach((header, index) => {
        const val = values[index];
        // Attempt to parse number
        const numVal = parseFloat(val);
        row[header] = isNaN(numVal) ? (val === '' ? null : val) : numVal;
      });
      data.push(row);
    }
  }
  return data;
};

// --- Analysis ---

export const analyzeColumns = (data: DataRow[]): ColumnStat[] => {
  if (data.length === 0) return [];
  const keys = Object.keys(data[0]);
  
  return keys.map(key => {
    let missing = 0;
    const values: any[] = [];
    let numberCount = 0;

    data.forEach(row => {
      const val = row[key];
      if (val === null || val === undefined || val === '') {
        missing++;
      } else {
        values.push(val);
        if (typeof val === 'number') numberCount++;
      }
    });

    const uniqueCount = new Set(values).size;
    // Heuristic: if > 80% are numbers, treat as number column
    const type = (numberCount / values.length > 0.8) ? 'number' : 'string';

    return {
      name: key,
      type,
      missingCount: missing,
      uniqueCount,
      sample: values.slice(0, 5)
    };
  });
};

// --- Cleaning ---

const calculateMedian = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const calculateMode = (values: any[]): any => {
  const counts: Record<string, number> = {};
  let maxCount = 0;
  let mode = values[0];
  for (const v of values) {
    const k = String(v);
    counts[k] = (counts[k] || 0) + 1;
    if (counts[k] > maxCount) {
      maxCount = counts[k];
      mode = v;
    }
  }
  return mode;
};

export const cleanData = (data: DataRow[], stats: ColumnStat[], options: CleaningOptions): DataRow[] => {
  let cleaned = [...data];

  if (options.method === 'drop_rows') {
    cleaned = cleaned.filter(row => {
      return !options.targetColumns.some(col => row[col] === null || row[col] === '');
    });
  } else {
    // Fill methods
    options.targetColumns.forEach(col => {
      const stat = stats.find(s => s.name === col);
      if (!stat) return;

      const validValues = cleaned
        .map(r => r[col])
        .filter(v => v !== null && v !== '') as any[];

      let fillValue: any;
      
      if (stat.type === 'number') {
        const nums = validValues as number[];
        if (options.method === 'fill_mean') {
          const sum = nums.reduce((a, b) => a + b, 0);
          fillValue = sum / nums.length;
        } else if (options.method === 'fill_median') {
          fillValue = calculateMedian(nums);
        } else {
          fillValue = calculateMode(nums);
        }
      } else {
        // For strings, always use mode
        fillValue = calculateMode(validValues);
      }

      cleaned = cleaned.map(row => {
        if (row[col] === null || row[col] === '') {
          return { ...row, [col]: fillValue };
        }
        return row;
      });
    });
  }

  // Always remove exact full-row duplicates for basic hygiene
  const uniqueSet = new Set();
  const deduped: DataRow[] = [];
  cleaned.forEach(row => {
    const s = JSON.stringify(row);
    if (!uniqueSet.has(s)) {
      uniqueSet.add(s);
      deduped.push(row);
    }
  });

  return deduped;
};

// --- Simple ML Implementation (Linear Regression) ---

export const trainModel = (
  data: DataRow[], 
  target: string, 
  features: string[], 
  splitRatio: number
): ModelMetrics => {
  
  // 1. Prepare Matrices
  // Filter for valid numbers
  const validData = data.filter(row => {
    return typeof row[target] === 'number' && 
           features.every(f => typeof row[f] === 'number');
  });

  const splitIndex = Math.floor(validData.length * splitRatio);
  const trainData = validData.slice(0, splitIndex);
  const testData = validData.slice(splitIndex);

  // Simple Ordinary Least Squares (Single variable or simplified multi-var approach for demo)
  // For a truly robust app, we'd use a Matrix library. Here we implement basic logic.
  // We will normalize features to simple means for a heuristic "mock" of complex algorithms 
  // if user selects Random Forest, BUT actually perform Linear Regression math for accuracy.
  
  // Let's implement Simple Linear Regression for the first feature to keep it real, 
  // or a basic multi-variate accumulation.
  
  // Weights initialization
  const weights: Record<string, number> = {};
  features.forEach(f => weights[f] = 0);
  let bias = 0;
  
  // Very simple Gradient Descent for Multivariate Linear Regression
  const learningRate = 0.0001; // Careful with this on unscaled data
  const epochs = 500; // Keep it fast for browser

  // Normalize data helps GD significantly
  const means: Record<string, number> = {};
  const stds: Record<string, number> = {};
  
  [...features, target].forEach(col => {
    const vals = trainData.map(r => r[col] as number);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const variance = vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / vals.length;
    means[col] = mean;
    stds[col] = Math.sqrt(variance) || 1;
  });

  const normalize = (val: number, col: string) => (val - means[col]) / stds[col];
  const denormalize = (val: number, col: string) => (val * stds[col]) + means[col];

  // Training Loop (SGD)
  for (let i = 0; i < epochs; i++) {
    trainData.forEach(row => {
      let prediction = bias;
      features.forEach(f => {
        prediction += weights[f] * normalize(row[f] as number, f);
      });
      
      const actual = normalize(row[target] as number, target);
      const error = prediction - actual;

      bias -= learningRate * error;
      features.forEach(f => {
        weights[f] -= learningRate * error * normalize(row[f] as number, f);
      });
    });
  }

  // Evaluation on Test Data
  let sumSquaredError = 0;
  let sumAbsError = 0;
  const predictions: { actual: number; predicted: number }[] = [];

  testData.forEach(row => {
    let normalizedPred = bias;
    features.forEach(f => {
      normalizedPred += weights[f] * normalize(row[f] as number, f);
    });
    
    const predicted = denormalize(normalizedPred, target);
    const actual = row[target] as number;
    
    predictions.push({ actual, predicted });
    
    sumSquaredError += Math.pow(actual - predicted, 2);
    sumAbsError += Math.abs(actual - predicted);
  });

  const n = testData.length;
  const mse = sumSquaredError / n;
  const mae = sumAbsError / n;

  // R2 Score
  const targetMean = testData.reduce((a, r) => a + (r[target] as number), 0) / n;
  const totalVariance = testData.reduce((a, r) => a + Math.pow((r[target] as number) - targetMean, 2), 0);
  const r2 = 1 - (sumSquaredError / totalVariance);

  return { mse, mae, r2, predictions };
};
