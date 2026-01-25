import { GoogleGenAI } from "@google/genai";
import { Product } from "../types";

/**
 * Helper to initialize the AI client with the build-time API Key
 */
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Generates a high-conversion text advertisement for WhatsApp.
 */
export const generateAdParagraph = async (product: Product): Promise<string> => {
  try {
    const ai = getAI();
    const prompt = `Write a powerful, high-conversion WhatsApp advertisement paragraph for a university student audience. 
      Product: ${product.name}
      Price: GHS ${product.sellingPrice}
      Key Benefit: ${product.description}
      Tone: Relatable, energetic, and urgent (e.g., "Don't get left behind during exams!").
      Include relevant emojis and a clear WhatsApp call to action. 
      Focus on hostel life benefits.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "Failed to generate text copy.";
  } catch (error) {
    console.error("Ad Generation Error:", error);
    return "Error generating ad text. Please check your API key.";
  }
};

/**
 * Generates a visual marketing flyer as an image.
 */
export const generateFlyerImage = async (product: Product): Promise<string | null> => {
  try {
    const ai = getAI();
    const prompt = `A professional, high-quality social media marketing flyer for: ${product.name}. 
      Price to display: GHS ${product.sellingPrice}.
      Vibe: Premium university student aesthetic, modern, clean, high contrast. 
      Central focus on the product item. Minimal text. Instagram-ready layout.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    
    // If text was returned instead of an image
    console.warn("Model returned text instead of image:", response.text);
    return null;
  } catch (error) {
    console.error("Image Generation Error:", error);
    return null;
  }
};

/**
 * Researches real-time market trends in Ghana for students using Google Search.
 */
export const searchMarketTrends = async (): Promise<{ text: string; sources: any[] }> => {
  try {
    const ai = getAI();
    const prompt = "What are the trending and high-demand products for university students in Ghana right now (2024/2025)? List 5 specific items trending in hostel markets and why students are buying them.";

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    return {
      text: response.text || "No market intelligence available at the moment.",
      sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  } catch (error) {
    console.error("Market Search Error:", error);
    return { 
      text: "Market search failed. This usually happens if the API key is restricted or the search tool is unavailable.", 
      sources: [] 
    };
  }
};

/**
 * Analyzes current inventory to suggest the best pricing and bundles.
 */
export const optimizeProfitMargins = async (product: Product): Promise<string> => {
  try {
    const ai = getAI();
    const prompt = `Analyze this student product: ${product.name} (Cost: GHS ${product.sourcePrice}, Selling: GHS ${product.sellingPrice}). 
      Provide a 3-point strategy for a university campus in Ghana: 
      1. Pricing optimization 
      2. Student bundle idea 
      3. Marketing hook.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "Analysis complete but no text returned.";
  } catch (error) {
    console.error("Profit Optimization Error:", error);
    return "Strategic analysis failed. Try again later.";
  }
};