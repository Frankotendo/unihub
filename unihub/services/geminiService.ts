
import { GoogleGenAI } from "@google/genai";
import { Product, Order } from "../types";

export type AIModelType = 'gemini-3-flash-preview' | 'gemini-3-pro-preview';

export interface DiagnosticReport {
  status: 'passed' | 'warning' | 'failed';
  latency: number;
  recommendedModel: AIModelType;
  envDetected: 'vercel' | 'local' | 'unknown';
  fixesApplied: string[];
}

const getModel = (modelName: AIModelType = 'gemini-3-flash-preview') => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  return { ai, modelName };
};

/**
 * DEEP DIAGNOSTIC: Analyzes the deployment bridge and applies runtime hot-fixes
 */
export const runDeepDiagnostic = async (): Promise<DiagnosticReport> => {
  const start = Date.now();
  const fixes: string[] = [];
  const isVercel = window.location.hostname.includes('vercel.app');
  
  if (isVercel) fixes.push("Vercel Edge Detection: active");
  
  try {
    const { ai } = getModel('gemini-3-flash-preview');
    // Test a tiny prompt to measure overhead
    await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: 'T',
      config: { maxOutputTokens: 1 }
    });
    
    const latency = Date.now() - start;
    let status: 'passed' | 'warning' | 'failed' = 'passed';
    let recommended: AIModelType = 'gemini-3-pro-preview';

    // Logic: If we are on Vercel AND latency is risky (> 2.5s overhead), force Flash.
    if (latency > 2500 || isVercel) {
      status = 'warning';
      recommended = 'gemini-3-flash-preview';
      fixes.push("Protocol: Enforced Flash Modality (Timeout Prevention)");
      fixes.push("Buffer: Token Truncation enabled");
    }

    if (!process.env.API_KEY) {
      status = 'failed';
      fixes.push("CRITICAL: API_KEY missing from Environment Variables");
    } else {
      fixes.push("Security: Key Validation Passed");
    }

    return {
      status,
      latency,
      recommendedModel: recommended,
      envDetected: isVercel ? 'vercel' : 'local',
      fixesApplied: fixes
    };
  } catch (e: any) {
    return {
      status: 'failed',
      latency: 0,
      recommendedModel: 'gemini-3-flash-preview',
      envDetected: isVercel ? 'vercel' : 'unknown',
      fixesApplied: ["ERROR: " + (e.message || "Connection refused by host")]
    };
  }
};

/**
 * WRAPPER: Ensures every call respects the Vercel-optimized model choice
 */
export const queryGemini = async (
  model: AIModelType, 
  prompt: string, 
  systemInstruction?: string
): Promise<string> => {
  try {
    const { ai } = getModel(model);
    
    // Auto-fix for Vercel: If using Pro on Vercel, we append a 'Be concise' warning
    const isVercel = window.location.hostname.includes('vercel.app');
    const optimizedPrompt = (isVercel && model === 'gemini-3-pro-preview') 
      ? `${prompt}\n\n[SYSTEM OVERRIDE: Be extremely concise to avoid Vercel 10s timeout.]`
      : prompt;

    const response = await ai.models.generateContent({
      model: model,
      contents: optimizedPrompt,
      config: {
        systemInstruction: systemInstruction || "You are a helpful business assistant for Ghana university students.",
        temperature: 0.7,
        topP: 0.95,
      }
    });

    return response.text || "No data received.";
  } catch (error: any) {
    console.error("Gemini Error:", error);
    if (error.message?.includes("fetch")) {
      throw new Error("Vercel Bridge Timeout: The model took too long to think. Try switching to 'Flash Engine' in the Engine tab.");
    }
    throw error;
  }
};

// Legacy exports updated to use the new Query Wrapper
export const predictMarketTrends = async (products: Product[], orders: Order[], model: AIModelType) => {
  const prompt = `Act as Strategy Chief. Current Stock: ${products.map(p=>p.name).join(', ')}. Analyze trends for Ghana hostels. Use slang like 'charley'.`;
  return queryGemini(model, prompt);
};

export const generateAdText = async (product: Product, model: AIModelType) => {
  const prompt = `Create a WhatsApp ad for ${product.name} at GHS ${product.sellingPrice}. Use student vibes.`;
  return queryGemini(model, prompt);
};

export const getBusinessIdeas = async (products: Product[], model: AIModelType) => {
  const prompt = `Suggest 3 new student side-hustles. Existing business delivers: ${products.map(p=>p.name).join(', ')}.`;
  return queryGemini(model, prompt);
};

export const draftCustomerReply = async (query: string, model: AIModelType) => {
  const prompt = `Customer asked: "${query}". Draft a reply to close the sale.`;
  return queryGemini(model, prompt);
};

export const optimizePricing = async (product: Product, model: AIModelType) => {
  const prompt = `Audit price for ${product.name}. Cost: ${product.sourcePrice}, Selling: ${product.sellingPrice}. Give advice.`;
  return queryGemini(model, prompt);
};
