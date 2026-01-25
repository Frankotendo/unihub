import { GoogleGenAI } from "@google/genai";
import { Product, Order } from "../types";

/**
 * STRATEGY TOOL: Predicts market trends and recommends items.
 * Optimized for Vercel Serverless reliability.
 */
export const predictMarketTrends = async (products: Product[], orders: Order[]): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
    return "The Hub Strategy Bot is currently busy navigating market routes. Please try again in 30 seconds.";
  }
};

/**
 * ADS MAKER: Catchy WhatsApp/Social media copy.
 */
export const generateAdText = async (product: Product): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
    return response.text || "Ad generator stalled. Please try a different item.";
  } catch (error) {
    console.error("Gemini Ads Error:", error);
    return "Marketing Bot is offline. Let's try that again shortly!";
  }
};

/**
 * SIDE HUSTLES: Innovative campus business ideas.
 */
export const getBusinessIdeas = async (products: Product[]): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const currentStock = products.map(p => p.name).slice(0, 5).join(', ');
    
    const prompt = `Act as an Entrepreneurial Coach for university students in Ghana.
    Suggest 3 NEW, low-cost business side-hustles (< 200 GHS start capital) that can be run alongside a UniHub delivery service.
    
    IDEAS SHOULD:
    - Solve a real campus/hostel problem.
    - Be easy to market via WhatsApp.
    - Explain 'How to start today'.
    
    Context of existing business: We already deliver ${currentStock}.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    return response.text || "Brainstorming is ongoing. Check back soon.";
  } catch (error) {
    console.error("Gemini Ideas Error:", error);
    return "The Innovation Lab is checking current trends. Try again soon.";
  }
};

/**
 * CHAT BOT: Drafts professional responses.
 */
export const draftCustomerReply = async (query: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Act as UniHub Customer Support. 
    A customer just messaged us on WhatsApp saying: "${query}"
    
    Draft a reply that is:
    - Polite and professional.
    - Friendly (Ghana student vibe).
    - Persuasive to close the sale.
    - Include delivery info.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    return response.text || "Failed to draft reply. Please try again.";
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    return "Support Bot is assisting another customer. One moment!";
  }
};

/**
 * PRICING AUDIT: Financial optimizations.
 */
export const optimizePricing = async (product: Product): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Act as a Financial Auditor for UniHub.
    ITEM: ${product.name}
    YOUR COST: GHS ${product.sourcePrice}
    SELLING FOR: GHS ${product.sellingPrice}

    TASK:
    - Analyze if the profit margin is healthy for a campus business.
    - Suggest a 'sweet spot' price to sell faster.
    - Provide 3 bullet points of advice.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    return response.text || "Pricing check complete. Looks okay!";
  } catch (error) {
    console.error("Gemini Pricing Error:", error);
    return "Financial metrics are being updated. Try again later.";
  }
};