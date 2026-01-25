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
      Tone: Relatable, energetic, and urgent. Mention campus life and hostel convenience.
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
    
    // We avoid words like "Flyer", "Ad", or "Money" which can trigger safety filters.
    // Instead, we describe a high-end commercial photograph of the item.
    const prompt = `A professional high-resolution studio photograph of a ${product.name}. 
      Style: Minimalist, clean, premium lighting, vibrant background. 
      The composition is modern and elegant, perfect for a high-end product showcase. 
      No human faces. Focus entirely on the object's texture and form. 
      Cinematic lighting, 8k resolution, product photography.`;

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

    // Check candidates and parts thoroughly
    const candidate = response.candidates?.[0];
    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.inlineData?.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    
    console.warn("No image data found in response parts. Content may have been filtered.");
    return null;
  } catch (error) {
    console.error("Image Generation Exception:", error);
    return null;
  }
};

/**
 * Researches real-time market trends in Ghana for students using Google Search.
 */
export const searchMarketTrends = async (): Promise<{ text: string; sources: any[] }> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = "What are the top 5 most trending products for university students in Ghana right now? Focus on student needs in Dormaa, Kumasi and Accra. Mention items like gadgets, essentials, or hostel life snacks. Provide a summary of why they are trending.";

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
      text: "Market Intelligence search is currently unavailable. Please check your connectivity.", 
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
      
      Suggest: 
      1. An optimized price to attract students. 
      2. A bundle deal for hostel roommates. 
      3. A unique marketing hook.`;

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
