import React, { useState, useEffect, useCallback } from 'react';
import { 
  AppStep, 
  DataRow, 
  ColumnStat, 
  CleaningOptions, 
  ModelConfig, 
  ModelMetrics 
} from './types';
import { parseCSV, analyzeColumns, cleanData, trainModel } from './utils/dataUtils';
import { generateMLTips } from './services/geminiService';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, LineChart, Line
} from 'recharts';

// --- Icons ---
const UploadIcon = () => <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>;
const CleanIcon = () => <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>;
const SettingsIcon = () => <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>;
const ModelIcon = () => <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>;
const BrainIcon = () => <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>;
const CheckCircle = () => <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>;

const STEPS = [
  { id: AppStep.UPLOAD, label: 'Upload Data', icon: UploadIcon },
  { id: AppStep.CLEANING, label: 'Data Cleaning', icon: CleanIcon },
  { id: AppStep.CONFIGURATION, label: 'Feature Config', icon: SettingsIcon },
  { id: AppStep.MODEL_SELECTION, label: 'Train Model', icon: ModelIcon },
  { id: AppStep.RESULTS, label: 'Evaluation', icon: BrainIcon },
];

export default function App() {
  const [currentStep, setCurrentStep] = useState<AppStep>(AppStep.UPLOAD);
  
  // Data State
  const [rawData, setRawData] = useState<DataRow[]>([]);
  const [cleanedData, setCleanedData] = useState<DataRow[]>([]);
  const [columnStats, setColumnStats] = useState<ColumnStat[]>([]);
  
  // Config State
  const [cleaningOptions, setCleaningOptions] = useState<CleaningOptions>({
    method: 'fill_mean',
    targetColumns: []
  });
  
  const [modelConfig, setModelConfig] = useState<ModelConfig>({
    targetColumn: '',
    featureColumns: [],
    splitRatio: 0.8,
    algorithm: 'linear_regression'
  });

  // Results State
  const [isTraining, setIsTraining] = useState(false);
  const [metrics, setMetrics] = useState<ModelMetrics | null>(null);
  const [geminiTips, setGeminiTips] = useState<string | null>(null);
  const [isLoadingTips, setIsLoadingTips] = useState(false);

  // --- Handlers ---

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target?.result as string;
        const parsed = parseCSV(text);
        if (parsed.length > 0) {
          setRawData(parsed);
          setCleanedData(parsed); // Initial clean is just raw
          setColumnStats(analyzeColumns(parsed));
          setCurrentStep(AppStep.CLEANING);
        } else {
          alert("Could not parse CSV or file is empty.");
        }
      };
      reader.readAsText(file);
    }
  };

  const handleCleanData = () => {
    const cleaned = cleanData(rawData, columnStats, cleaningOptions);
    setCleanedData(cleaned);
    setColumnStats(analyzeColumns(cleaned)); // Re-analyze after clean
    setCurrentStep(AppStep.CONFIGURATION);
  };

  const handleTrain = async () => {
    if (!modelConfig.targetColumn || modelConfig.featureColumns.length === 0) {
      alert("Please select a target and at least one feature.");
      return;
    }
    
    setIsTraining(true);
    
    // Simulate training delay for UX
    setTimeout(() => {
      try {
        const result = trainModel(
          cleanedData,
          modelConfig.targetColumn,
          modelConfig.featureColumns,
          modelConfig.splitRatio
        );
        setMetrics(result);
        setCurrentStep(AppStep.RESULTS);
      } catch (err) {
        console.error(err);
        alert("Error training model. Please check data types.");
      } finally {
        setIsTraining(false);
      }
    }, 1500);
  };

  const handleGetTips = async () => {
    if (!metrics) return;
    setIsLoadingTips(true);
    const tips = await generateMLTips(modelConfig, metrics, columnStats.map(c => c.name));
    setGeminiTips(tips);
    setIsLoadingTips(false);
  };

  // --- Components for Steps ---

  const renderProgressBar = () => (
    <div className="mb-8">
      <div className="flex justify-between">
        {STEPS.map((step, idx) => {
          const isActive = currentStep === step.id;
          const isCompleted = currentStep > step.id;
          return (
            <div key={step.id} className="flex flex-col items-center flex-1">
              <div 
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isActive ? 'bg-blue-600 text-white shadow-lg scale-110' : 
                  isCompleted ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                }`}
              >
                {isCompleted ? <CheckCircle /> : <step.icon />}
              </div>
              <span className={`text-xs mt-2 font-medium ${isActive ? 'text-blue-600' : 'text-gray-500'}`}>
                {step.label}
              </span>
              {idx !== STEPS.length - 1 && (
                <div className={`h-1 w-full mt-[-2rem] ml-[50%] absolute z-[-1] max-w-[10%] bg-gray-200`} />
              )}
            </div>
          );
        })}
      </div>
      {/* Simple Progress Line */}
      <div className="w-full bg-gray-200 h-2 mt-4 rounded-full overflow-hidden">
        <div 
          className="bg-blue-600 h-full transition-all duration-500 ease-out" 
          style={{ width: `${((currentStep) / (STEPS.length - 1)) * 100}%` }}
        />
      </div>
    </div>
  );

  const StepUpload = () => (
    <div className="flex flex-col items-center justify-center h-96 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
      <UploadIcon />
      <p className="mt-4 text-xl text-gray-600 font-semibold">Drop your CSV file here</p>
      <p className="text-gray-400 mb-6">or click to browse</p>
      <input 
        type="file" 
        accept=".csv"
        onChange={handleFileUpload} 
        className="hidden" 
        id="file-upload"
      />
      <label 
        htmlFor="file-upload" 
        className="px-6 py-3 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 font-medium"
      >
        Select File
      </label>
      <div className="mt-8 text-sm text-gray-400 max-w-md text-center">
        Supported formats: CSV. The file will be parsed locally in your browser.
      </div>
    </div>
  );

  const StepCleaning = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h3 className="text-lg font-bold mb-4">Dataset Overview</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
              <tr>
                <th className="px-6 py-3">Column</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Missing Values</th>
                <th className="px-6 py-3">Sample Data</th>
              </tr>
            </thead>
            <tbody>
              {columnStats.map(col => (
                <tr key={col.name} className="bg-white border-b">
                  <td className="px-6 py-4 font-medium text-gray-900">{col.name}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs ${col.type === 'number' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {col.type}
                    </span>
                  </td>
                  <td className={`px-6 py-4 ${col.missingCount > 0 ? 'text-red-500 font-bold' : 'text-green-500'}`}>
                    {col.missingCount}
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-400">
                    {col.sample.join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h3 className="text-lg font-bold mb-4">Cleaning Strategy</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block mb-2 text-sm font-medium text-gray-900">Handle Missing Values By:</label>
            <select 
              value={cleaningOptions.method}
              onChange={(e) => setCleaningOptions({...cleaningOptions, method: e.target.value as any})}
              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
            >
              <option value="fill_mean">Filling with Mean (Average)</option>
              <option value="fill_median">Filling with Median (Middle)</option>
              <option value="fill_mode">Filling with Mode (Most Frequent)</option>
              <option value="drop_rows">Removing Rows</option>
            </select>
          </div>
          <div>
            <label className="block mb-2 text-sm font-medium text-gray-900">Apply to Columns with Nulls:</label>
            <div className="flex flex-wrap gap-2">
              {columnStats.filter(c => c.missingCount > 0).map(c => (
                <label key={c.name} className="inline-flex items-center space-x-2 bg-gray-50 px-3 py-1 rounded border">
                  <input 
                    type="checkbox" 
                    checked={cleaningOptions.targetColumns.includes(c.name)}
                    onChange={(e) => {
                      const newTargets = e.target.checked 
                        ? [...cleaningOptions.targetColumns, c.name]
                        : cleaningOptions.targetColumns.filter(n => n !== c.name);
                      setCleaningOptions({...cleaningOptions, targetColumns: newTargets});
                    }}
                    className="form-checkbox h-4 w-4 text-blue-600"
                  />
                  <span>{c.name}</span>
                </label>
              ))}
              {columnStats.every(c => c.missingCount === 0) && (
                <span className="text-sm text-green-600">No missing values detected!</span>
              )}
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button 
            onClick={handleCleanData}
            className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 mr-2 mb-2 focus:outline-none"
          >
            Apply & Continue
          </button>
        </div>
      </div>
    </div>
  );

  const StepConfiguration = () => (
    <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Problem Definition</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Target Variable */}
        <div>
          <label className="block mb-2 text-sm font-bold text-gray-900">
            Target Variable (Y)
            <span className="block font-normal text-xs text-gray-500">What do you want to predict?</span>
          </label>
          <select 
            value={modelConfig.targetColumn}
            onChange={(e) => setModelConfig({...modelConfig, targetColumn: e.target.value})}
            className="bg-blue-50 border border-blue-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
          >
            <option value="">Select a column...</option>
            {columnStats.filter(c => c.type === 'number').map(c => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
          {modelConfig.targetColumn && (
            <div className="mt-2 text-xs text-green-600">
              Selected target: <strong>{modelConfig.targetColumn}</strong>
            </div>
          )}
        </div>

        {/* Feature Variables */}
        <div>
          <label className="block mb-2 text-sm font-bold text-gray-900">
            Feature Variables (X)
            <span className="block font-normal text-xs text-gray-500">What data should be used for prediction?</span>
          </label>
          <div className="max-h-60 overflow-y-auto border rounded-lg p-3 bg-gray-50">
            {columnStats
              .filter(c => c.name !== modelConfig.targetColumn && c.type === 'number')
              .map(c => (
                <label key={c.name} className="flex items-center space-x-3 mb-2 cursor-pointer hover:bg-gray-100 p-1 rounded">
                  <input 
                    type="checkbox"
                    checked={modelConfig.featureColumns.includes(c.name)}
                    onChange={(e) => {
                      const newFeatures = e.target.checked
                        ? [...modelConfig.featureColumns, c.name]
                        : modelConfig.featureColumns.filter(f => f !== c.name);
                      setModelConfig({...modelConfig, featureColumns: newFeatures});
                    }}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-900">{c.name}</span>
                </label>
            ))}
            {columnStats.filter(c => c.name !== modelConfig.targetColumn && c.type !== 'number').length > 0 && (
                 <div className="text-xs text-yellow-600 mt-2 p-2 bg-yellow-50 rounded">
                   Note: Non-numeric columns are hidden. Feature encoding is not supported in this demo.
                 </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <label className="block mb-2 text-sm font-bold text-gray-900">
          Train / Test Split
        </label>
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-gray-600">Train: {Math.round(modelConfig.splitRatio * 100)}%</span>
          <input 
            type="range" 
            min="0.5" 
            max="0.9" 
            step="0.05"
            value={modelConfig.splitRatio}
            onChange={(e) => setModelConfig({...modelConfig, splitRatio: parseFloat(e.target.value)})}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-sm font-medium text-gray-600">Test: {Math.round((1 - modelConfig.splitRatio) * 100)}%</span>
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <button 
          onClick={() => setCurrentStep(AppStep.MODEL_SELECTION)}
          disabled={!modelConfig.targetColumn || modelConfig.featureColumns.length === 0}
          className="text-white bg-blue-700 hover:bg-blue-800 disabled:bg-gray-300 font-medium rounded-lg text-sm px-5 py-2.5 focus:outline-none"
        >
          Next Step
        </button>
      </div>
    </div>
  );

  const StepModelSelection = () => (
    <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 max-w-2xl mx-auto text-center">
      <h2 className="text-2xl font-bold mb-6">Choose Algorithm</h2>
      
      <div className="grid grid-cols-1 gap-4 mb-8">
        {[
          { id: 'linear_regression', name: 'Linear Regression', desc: 'Best for simple relationships. Fast and interpretable.' },
          { id: 'ridge', name: 'Ridge Regression', desc: 'Linear regression with regularization to prevent overfitting.' },
          { id: 'random_forest', name: 'Random Forest', desc: 'Ensemble learning method. Good for complex non-linear data.' },
        ].map((algo) => (
          <div 
            key={algo.id}
            onClick={() => setModelConfig({...modelConfig, algorithm: algo.id as any})}
            className={`p-4 border rounded-lg cursor-pointer text-left transition-all ${
              modelConfig.algorithm === algo.id 
                ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' 
                : 'border-gray-200 hover:border-blue-300'
            }`}
          >
            <div className="font-bold text-gray-900">{algo.name}</div>
            <div className="text-sm text-gray-500">{algo.desc}</div>
          </div>
        ))}
      </div>

      <button 
        onClick={handleTrain}
        className="w-full text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 font-bold rounded-lg text-lg px-5 py-4 shadow-lg transform transition hover:scale-[1.02]"
      >
        {isTraining ? 'Training Model...' : 'Start Training'}
      </button>
      
      {isTraining && (
         <div className="mt-4 text-sm text-gray-500 animate-pulse">
           Optimizing weights... Validating on test set...
         </div>
      )}
    </div>
  );

  const StepResults = () => {
    if (!metrics) return null;

    // Prepare chart data (subset for performance if needed)
    const chartData = metrics.predictions.slice(0, 100).map((p, i) => ({
      index: i,
      actual: parseFloat(p.actual.toFixed(2)),
      predicted: parseFloat(p.predicted.toFixed(2))
    }));

    return (
      <div className="space-y-8">
        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="text-sm text-gray-500 uppercase tracking-wide">R² Score</div>
            <div className="text-3xl font-bold text-blue-600 mt-2">{metrics.r2.toFixed(4)}</div>
            <div className="text-xs text-gray-400 mt-1">1.0 is perfect correlation</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="text-sm text-gray-500 uppercase tracking-wide">Mean Squared Error</div>
            <div className="text-3xl font-bold text-gray-800 mt-2">{metrics.mse.toFixed(4)}</div>
            <div className="text-xs text-gray-400 mt-1">Lower is better</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="text-sm text-gray-500 uppercase tracking-wide">Model Type</div>
            <div className="text-lg font-bold text-gray-800 mt-2 capitalize">{modelConfig.algorithm.replace('_', ' ')}</div>
            <div className="text-xs text-gray-400 mt-1">{modelConfig.featureColumns.length} Features</div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-96">
            <h3 className="font-bold mb-4 text-gray-700">Actual vs Predicted (First 100 Test Samples)</h3>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="index" hide />
                <YAxis />
                <RechartsTooltip />
                <Legend />
                <Line type="monotone" dataKey="actual" stroke="#9ca3af" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="predicted" stroke="#2563eb" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-96">
            <h3 className="font-bold mb-4 text-gray-700">Prediction Scatter Plot</h3>
             <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid />
                <XAxis type="number" dataKey="actual" name="Actual" unit="" label={{ value: 'Actual', position: 'insideBottom', offset: -10 }} />
                <YAxis type="number" dataKey="predicted" name="Predicted" unit="" label={{ value: 'Predicted', angle: -90, position: 'insideLeft' }} />
                <RechartsTooltip cursor={{ strokeDasharray: '3 3' }} />
                <Scatter name="Values" data={chartData} fill="#3b82f6" fillOpacity={0.6} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI Advisor Section */}
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-8 rounded-xl border border-indigo-100">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-bold text-indigo-900 flex items-center gap-2">
                <BrainIcon /> AI Model Advisor
              </h3>
              <p className="text-indigo-600 mt-2">Get personalized tips to improve your model's performance.</p>
            </div>
            {!geminiTips && (
              <button 
                onClick={handleGetTips}
                disabled={isLoadingTips}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {isLoadingTips ? 'Analyzing...' : 'Generate Insights'}
              </button>
            )}
          </div>
          
          {geminiTips && (
            <div className="mt-6 p-6 bg-white rounded-lg shadow-sm text-gray-700 prose max-w-none">
              <div dangerouslySetInnerHTML={{ __html: geminiTips.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
            </div>
          )}
        </div>

        <div className="flex justify-center mt-8">
            <button 
                onClick={() => window.location.reload()}
                className="text-gray-500 underline hover:text-gray-700"
            >
                Start Over
            </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen pb-12">
      <header className="bg-white shadow-sm mb-8">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <div className="bg-blue-600 p-2 rounded-lg text-white">
                    <BrainIcon />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-gray-900">AutoML Wizard</h1>
                    <p className="text-xs text-gray-500">React + Tailwind + Gemini</p>
                </div>
            </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4">
        {renderProgressBar()}

        <div className="mt-8 transition-all duration-300">
          {currentStep === AppStep.UPLOAD && <StepUpload />}
          {currentStep === AppStep.CLEANING && <StepCleaning />}
          {currentStep === AppStep.CONFIGURATION && <StepConfiguration />}
          {currentStep === AppStep.MODEL_SELECTION && <StepModelSelection />}
          {currentStep === AppStep.RESULTS && <StepResults />}
        </div>
      </main>
    </div>
  );
}
