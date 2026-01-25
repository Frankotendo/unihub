
import { GoogleGenAI } from "@google/genai";
import { Product, Order } from "../types";

/**
 * STRATEGY TOOL: Predicts market trends and recommends items.
 */
export const predictMarketTrends = async (products: Product[], orders: Order[]): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const context = `I am running 'UniHub', a campus delivery business. I have ${products.length} products and ${orders.length} sales. Current categories: ${products.map(p => p.category).join(', ')}.`;
    const prompt = `${context}
    Act as a UniHub Business Mentor. 
    1. List TOP 3 SPECIFIC ITEMS (brands/models) students at a Ghana university need right now.
    2. Identify a MARKET GAP based on my categories.
    3. Give a 1-sentence tip to move stock faster.
    Use simple English and emojis.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Analysis complete. Waiting for more data.";
  } catch (error) {
    console.error("AI Error:", error);
    return "The Strategy Bot is currently reloading. Please try again in a moment.";
  }
};

/**
 * ADS MAKER: Generates catchy WhatsApp/Social Media text.
 */
export const generateAdText = async (product: Product): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Act as a cool UniHub Marketing Expert.
    Create a catchy WhatsApp Status or Instagram caption for:
    Item: ${product.name}
    Price: GHS ${product.sellingPrice}
    
    Guidelines:
    - Use Ghana campus student slang (cool but polite).
    - Make it sound like an 'exclusive drop' from UniHub.
    - End with a Call to Action (e.g., 'DM to secure yours').
    - Use many emojis.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Could not generate ad text. Try a shorter product name.";
  } catch (error) {
    console.error("AI Error:", error);
    return "The Ads Bot is stuck in traffic. Please try again.";
  }
};

/**
 * SIDE HUSTLES: Provides new business ideas for students.
 */
export const getBusinessIdeas = async (products: Product[]): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const context = `I already sell: ${products.map(p => p.name).slice(0, 5).join(', ')}.`;
    const prompt = `${context}
    Act as a UniHub Innovation Coach.
    Suggest 3 NEW simple side-hustles for a student in a Ghana university hostel.
    - Low starting cost.
    - Solves a hostel problem (e.g., laundry, late-night food, tech fix).
    - Explain 'How to start today'.
    Keep it very practical and encouraging.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "No new ideas right now. Focus on your current stock!";
  } catch (error) {
    console.error("AI Error:", error);
    return "The Idea Bot is brainstorming. Try again later.";
  }
};

/**
 * CHAT BOT: Drafts professional customer replies.
 */
export const draftCustomerReply = async (query: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Act as the UniHub Customer Success Manager. 
    A student just sent this WhatsApp message: "${query}".
    
    Write a reply that is:
    - Extremely polite and professional.
    - Clear about the delivery to their hostel.
    - Persuasive so they complete the order.
    - Use 1 or 2 emojis.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Customer query analyzed. No draft needed.";
  } catch (error) {
    console.error("AI Error:", error);
    return "The Chat Bot is busy with another customer. Try again.";
  }
};

/**
 * PRICE AUDIT: Suggests price optimizations.
 */
export const optimizePricing = async (product: Product): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Act as a UniHub Pricing Specialist.
    Item: ${product.name}
    Current Cost: GHS ${product.sourcePrice}
    Current Sale Price: GHS ${product.sellingPrice}
    
    Analyze if this margin is good for a student business in Ghana. 
    Suggest a 'Sweet Spot' price that students won't find too expensive but gives you good profit.
    Explain your logic in 2 short sentences.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Pricing looks good from here!";
  } catch (error) {
    console.error("AI Error:", error);
    return "The Pricing Analyst is calculating. Try again.";
  }
};
