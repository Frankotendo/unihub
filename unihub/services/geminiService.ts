
import { GoogleGenAI } from "@google/genai";
import { Product, Order } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const predictMarketTrends = async (products: Product[], orders: Order[]): Promise<string> => {
  try {
    const productList = products.map(p => p.name).join(', ') || 'no active items';
    
    const prompt = `Act as the UniHub Strategy Chief for a student-run dropshipping hub in a Ghana university.
    CONTEXT:
    - Currently Stocked: ${productList}
    - Total Orders to Date: ${orders.length}
    - Categories: ${[...new Set(products.map(p => p.category))].join(', ')}

    TASK:
    1. MARKET TRENDS: List 3 items trending in Ghana hostels right now (be specific).
    2. BUSINESS ADVICE: Suggest 1 way to improve profit based on the current stock.
    3. MARKET GAP: What should I buy from the market today that I don't have?
    
    TONE: High-energy, encouraging, uses Ghana campus slang (e.g., 'charley', 'mad', 'levels'). Use emojis.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    
    return response.text || "Strategy stream interrupted. Refreshing the hub...";
  } catch (error) {
    console.error("Gemini Strategy Error:", error);
    return "The Hub Strategy Bot is currently busy navigating market routes.";
  }
};

export const generateAdText = async (product: Product): Promise<string> => {
  try {
    const prompt = `Act as UniHub's Head of Marketing. 
    Create a high-energy, persuasive WhatsApp Status / Instagram caption for this item:
    ITEM: ${product.name}
    PRICE: GHS ${product.sellingPrice}
    HUB: UniHub (Hostel Delivery)

    REQUIREMENTS:
    - Use student slang common in Ghana.
    - Emphasize speed of delivery to hostels.
    - Include a Clear Call to Action (e.g., "DM for instant drop").
    - Use plenty of relevant emojis.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    return response.text || "Ad generator stalled.";
  } catch (error) {
    console.error("Gemini Ads Error:", error);
    return "Marketing Bot is offline.";
  }
};

export const getBusinessIdeas = async (products: Product[]): Promise<string> => {
  try {
    const currentStock = products.map(p => p.name).slice(0, 5).join(', ');
    const prompt = `Act as an Entrepreneurial Coach for university students in Ghana.
    Suggest 3 NEW, low-cost business side-hustles (< 200 GHS start capital) that can be run alongside a UniHub delivery service.
    
    IDEAS SHOULD:
    - Solve a real campus/hostel problem.
    - Be easy to market via WhatsApp.
    - Context: Existing business delivers ${currentStock}.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    return response.text || "Brainstorming is ongoing.";
  } catch (error) {
    console.error("Gemini Ideas Error:", error);
    return "Innovation lab is updating.";
  }
};

export const draftCustomerReply = async (query: string): Promise<string> => {
  try {
    const prompt = `Act as UniHub Customer Support. 
    A customer just messaged: "${query}"
    Reply politely with Ghana student vibe, closing the sale.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    return response.text || "Failed to draft reply.";
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    return "Support Bot is busy.";
  }
};

export const optimizePricing = async (product: Product): Promise<string> => {
  try {
    const prompt = `Act as a Financial Auditor for UniHub.
    ITEM: ${product.name}
    YOUR COST: GHS ${product.sourcePrice}
    SELLING FOR: GHS ${product.sellingPrice}
    Analyze margin and suggest better pricing.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    return response.text || "Pricing check complete.";
  } catch (error) {
    console.error("Gemini Pricing Error:", error);
    return "Financial metrics updated later.";
  }
};
