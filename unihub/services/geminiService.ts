import { GoogleGenAI } from "@google/genai";
import { Product } from "../types";

/**
 * Generates a high-conversion text advertisement for WhatsApp.
 */
export const generateAdParagraph = async (product: Product): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Write a professional, high-conversion WhatsApp advertisement for a university student audience in Ghana. 
      Product: ${product.name}
      Price: GHS ${product.sellingPrice}
      Description: ${product.description}
      Context: Campus life, hostel essentials, and student convenience.
      Tone: Energetic, urgent, and relatable. 
      Include relevant emojis and a clear call to action.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "Marketing copy is being drafted. Please try again.";
  } catch (error) {
    console.error("Ad Text Error:", error);
    return "Error generating ad text. Please check your connectivity.";
  }
};

/**
 * Generates a visual marketing flyer as an image using Gemini.
 */
export const generateFlyerImage = async (product: Product): Promise<string | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Using a very "safe" commercial prompt to avoid policy triggers
    const prompt = `A professional commercial studio photograph of a ${product.name}. 
      The shot features clean, high-end studio lighting on a minimalist, elegant background. 
      The aesthetic is modern, high-quality, and suitable for a commercial advertisement. 
      Sharp focus, 4k resolution, cinematic still life.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    });

    // Iterate through parts to find the image data
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        const base64EncodeString = part.inlineData.data;
        return `data:image/png;base64,${base64EncodeString}`;
      }
    }
    
    return null;
  } catch (error) {
    console.error("Gemini Image Generation Failure:", error);
    return null;
  }
};

/**
 * Researches real-time market trends in Ghana for students using Google Search.
 */
export const searchMarketTrends = async (): Promise<{ text: string; sources: any[] }> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = "What are the top 5 most trending products for university students in Ghana right now? Focus on student needs in Dormaa and Kumasi. Provide a short summary.";

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    return {
      text: response.text || "No trending data retrieved.",
      sources: groundingChunks
    };
  } catch (error) {
    console.error("Trend Research Error:", error);
    return { 
      text: "Market Intelligence search is currently unavailable.", 
      sources: [] 
    };
  }
};

/**
 * Analyzes current inventory to suggest the best pricing and bundles.
 */
export const optimizeProfitMargins = async (product: Product): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Analyze this product for student dropshipping: 
      Item: ${product.name} 
      Wholesale Cost: GHS ${product.sourcePrice} 
      Current Retail: GHS ${product.sellingPrice}. 
      Suggest optimized pricing and a quick marketing hook.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "Pricing analysis unavailable.";
  } catch (error) {
    console.error("Strategy Optimization Error:", error);
    return "Failed to run strategic analysis.";
  }
};
