import { GoogleGenAI, GenerateContentParameters } from "@google/genai";
import { ModelMetrics, ModelConfig } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const generateMLTips = async (
  config: ModelConfig,
  metrics: ModelMetrics,
  columnNames: string[]
): Promise<string> => {
  if (!apiKey) {
    return "API Key is missing. Please configure the environment variable to receive AI tips.";
  }

  const prompt = `
    I have trained a regression model using the Auto ML Wizard.
    
    Context:
    - Algorithm: ${config.algorithm}
    - Target Variable: ${config.targetColumn}
    - Features Used: ${config.featureColumns.join(', ')}
    - Total Columns Available: ${columnNames.join(', ')}
    - Train/Test Split: ${config.splitRatio * 100}% Train / ${(1 - config.splitRatio) * 100}% Test
    
    Results:
    - R2 Score: ${metrics.r2.toFixed(4)}
    - Mean Squared Error: ${metrics.mse.toFixed(4)}
    
    Please provide 3-4 specific, high-impact data science tips to improve this model based on the metrics and feature context. 
    Focus on feature engineering, data quality, or model selection. Keep it professional but encouraging.
    Format the output as a clean Markdown list.
  `;

  // 1. Define the System Instruction (Persona) separately
  const systemInstruction = "You are an expert Senior Data Scientist helping a user improve their machine learning model. Your response must be a clean Markdown list only.";

  // 2. Define the content with only the 'user' role
  const contents = [
    {
      role: "user",
      parts: [{ text: prompt }]
    }
  ];

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: contents,
      config: {
        // 3. Pass the System Instruction in the config object
        systemInstruction: systemInstruction,
        // Optional: you can also set temperature, maxOutputTokens, etc., here
      }
    } as GenerateContentParameters); // Cast to help with Type checking if needed

    return response.text ?? "No tips could be generated at this time.";
  } catch (error: unknown) {
    console.error("Gemini API Error:", error);
    return "Failed to generate tips due to an API error.";
  }
};

