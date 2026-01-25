import { GoogleGenAI } from "@google/genai";
import { Product, Order } from "../types";

/**
 * STRATEGY & TRENDS: The "working" blueprint for all other functions.
 */
export const predictMarketTrends = async (products: Product[], orders: Order[]): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const productList = products.map(p => p.name).join(', ') || 'no items yet';
    const categoryList = products.map(p => p.category).join(', ') || 'no categories yet';
    
    const prompt = `Act as a UniHub Senior Strategy Advisor for a campus delivery business in Ghana.
    CONTEXT:
    - Business: UniHub (Hostel Delivery)
    - Current Products: ${productList}
    - Product Categories: ${categoryList}
    - Total Sales Count: ${orders.length}

    TASK:
    1. TRENDS: Mention 3 specific items (brands/types) currently "moving" in Ghana universities.
    2. STRATEGY: Suggest 1 way to improve hostel delivery speed.
    3. MARKET GAP: What should I buy from the market today that isn't in my stock?
    
    Keep the tone: Encouraging, student-friendly, uses emojis.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Insight stream interrupted. Please refresh.";
  } catch (error) {
    console.error("AI Error (Trends):", error);
    return "The Hub Analyst is checking the routes. Try again in 30 seconds.";
  }
};

/**
 * AD TEXT GENERATOR: Catchy copy for WhatsApp and Social Media.
 */
export const generateAdText = async (product: Product): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Act as the UniHub Marketing Lead. 
    Create a catchy, high-energy WhatsApp Status / Instagram caption for this item:
    ITEM: ${product.name}
    PRICE: GHS ${product.sellingPrice}
    HUB: UniHub (Hostel Delivery)

    REQUIREMENTS:
    - Use student slang common in Ghana (e.g., 'charley', 'mad', 'levels').
    - Emphasize "Direct Hostel Delivery".
    - Include a clear call to action (e.g., "DM for instant drop").
    - Use plenty of relevant emojis.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Ad generator stalled. Try a different item.";
  } catch (error) {
    console.error("AI Error (Ads):", error);
    return "The Marketing Bot is re-fueling. Try again shortly.";
  }
};

/**
 * BUSINESS IDEAS: Innovative campus hustles.
 */
export const getBusinessIdeas = async (products: Product[]): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const currentStock = products.map(p => p.name).slice(0, 5).join(', ');
    
    const prompt = `Act as a Creative Business Coach for UniHub.
    Suggest 3 NEW, low-cost business ideas that a university student in Ghana can start today alongside UniHub.
    
    IDEAS SHOULD:
    - Be tailored to hostel life.
    - Solve a problem (hunger, tech, convenience).
    - Leverage the existing UniHub delivery network.
    
    Explain why each idea will make money and how to start with less than 200 GHS.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Ideas are cooking. Please check back later.";
  } catch (error) {
    console.error("AI Error (Ideas):", error);
    return "The Idea Lab is currently brainstorming. Try again soon.";
  }
};

/**
 * CUSTOMER CHAT BOT: Drafts professional and persuasive replies.
 */
export const draftCustomerReply = async (query: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Act as the UniHub Customer Support Expert.
    A customer just sent this message on WhatsApp: "${query}"

    TASK:
    Write a reply that is:
    - Professional yet friendly (Ghana student vibe).
    - Clear about the delivery process.
    - Persuasive to ensure they place the order.
    - Include 1-2 emojis.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Reply draft failed. Try shorter text.";
  } catch (error) {
    console.error("AI Error (Replies):", error);
    return "The Chat Assistant is on a break. Try again in a minute.";
  }
};

/**
 * PRICING AUDIT: Optimized margins for student markets.
 */
export const optimizePricing = async (product: Product): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Act as the UniHub Financial Auditor.
    PRODUCT: ${product.name}
    YOUR COST: GHS ${product.sourcePrice}
    SELLING FOR: GHS ${product.sellingPrice}

    TASK:
    - Is this a fair price for a Ghana university student?
    - Is the profit margin healthy?
    - Suggest the absolute "best price" to sell fast while keeping profit.
    Keep it to 3 bullet points.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Pricing audit skipped.";
  } catch (error) {
    console.error("AI Error (Pricing):", error);
    return "The Financial Bot is crunching numbers. Try again later.";
  }
};