
import { GoogleGenAI, Type } from "@google/genai";
import { Product, Location } from "../types.ts";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Generates a high-conversion text advertisement for WhatsApp.
 */
export const generateAdParagraph = async (product: Product): Promise<string> => {
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

  return response.text || "Failed to generate ad.";
};

/**
 * Generates a visual marketing flyer as an image.
 */
export const generateFlyerImage = async (product: Product): Promise<string | null> => {
  const prompt = `A professional, high-quality social media marketing flyer for a university product. 
    Product Name: ${product.name}
    Price: GHS ${product.sellingPrice}
    Style: Clean, modern, vibrant colors, "Premium Student" aesthetic. 
    Layout: Central product focus, bold price tag, minimal text, high contrast. 
    The image should look like an Instagram or WhatsApp status ad.`;

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

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }

  return null;
};

/**
 * Researches real-time market trends in Ghana for students using Google Search.
 */
export const searchMarketTrends = async (): Promise<{ text: string; sources: any[] }> => {
  const prompt = "What are the most trending and high-demand products for university students in Ghana right now (2024/2025)? Focus on hostel essentials, tech gadgets, and fashion. Provide specific items and why they are trending.";

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  return {
    text: response.text || "No trends found.",
    sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
  };
};

/**
 * Analyzes current inventory to suggest the best pricing and bundles.
 */
export const optimizeProfitMargins = async (product: Product): Promise<string> => {
  const prompt = `Analyze this product for a university market in Ghana:
    Product: ${product.name}
    Cost Price: GHS ${product.sourcePrice}
    Current Selling Price: GHS ${product.sellingPrice}
    Location: ${product.location}
    
    Tasks:
    1. Suggest an optimized selling price to maximize profit without scaring off students.
    2. Suggest a "Combo Deal" (e.g., buy this with X to save GHS 5).
    3. Calculate estimated weekly profit if 10 students buy it.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
  });

  return response.text || "Failed to optimize strategy.";
};
