import { GoogleGenAI } from "@google/genai";
import { Product } from "../types";

/**
 * Generates a high-conversion text advertisement for WhatsApp.
 */
export const generateAdParagraph = async (product: Product): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Write a powerful, high-conversion WhatsApp advertisement paragraph for a university student audience in Ghana. 
      Product: ${product.name}
      Price: GHS ${product.sellingPrice}
      Key Benefit: ${product.description}
      Tone: Relatable, energetic, and urgent. Mention hostel life convenience. 
      Include relevant emojis and a clear WhatsApp call to action.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "Failed to generate marketing text.";
  } catch (error) {
    console.error("Ad Text Error:", error);
    return "Error generating ad text. Please try again.";
  }
};

/**
 * Generates a visual marketing flyer as an image.
 */
export const generateFlyerImage = async (product: Product): Promise<string | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `A professional, high-quality social media marketing flyer for: ${product.name}. 
      Display price GHS ${product.sellingPrice} prominently. 
      Style: Modern university aesthetic, high contrast, clean product focus. 
      The layout should be bold and ready for WhatsApp status or Instagram. 
      Background: Vibrant but minimalist.`;

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

    // Exhaustive search for the image part in response parts
    const candidates = response.candidates;
    if (candidates && candidates.length > 0) {
      const parts = candidates[0].content?.parts || [];
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    
    console.warn("Gemini did not return an image part. Content might have been filtered.");
    return null;
  } catch (error) {
    console.error("Flyer Image Generation Failure:", error);
    return null;
  }
};

/**
 * Researches real-time market trends in Ghana for students using Google Search.
 */
export const searchMarketTrends = async (): Promise<{ text: string; sources: any[] }> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = "What are the top 5 trending products for university students in Ghana right now (2025)? Focus on items students in Dormaa, Kumasi and Accra are buying for hostels (e.g., gadgets, snacks, essentials). Provide specific item names.";

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', // Pro model required for reliable search tool usage
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
      text: "Unable to reach the live market at this time. Please verify your search tool access in AI Studio.", 
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
    const prompt = `Analyze this student product for arbitrage: 
      Item: ${product.name} 
      Wholesale Cost: GHS ${product.sourcePrice} 
      Current Retail: GHS ${product.sellingPrice}. 
      
      Suggest: 
      1. A 'Sweet Spot' price to beat competitors. 
      2. A 'Hostel Bundle' idea. 
      3. A marketing hook for campus influencers.`;

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