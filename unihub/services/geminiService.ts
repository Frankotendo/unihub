
import { GoogleGenAI } from "@google/genai";
import { Product, Order } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Predicts market trends and recommends specific items to look out for.
 */
export const predictMarketTrends = async (products: Product[], orders: Order[]): Promise<string> => {
  try {
    const context = `I have ${products.length} products and ${orders.length} sales. Current stock categories: ${products.map(p => p.category).join(', ')}.`;
    const prompt = `Act as a Student Business Mentor at a University in Ghana. 
    Analyze this context: ${context}.
    Provide:
    1. TOP 3 ITEMS TO LOOK OUT FOR: List 3 specific hot items (e.g. particular brands of mini-fans, snacks, or tech) that students need right now.
    2. MARKET GAP: What is currently missing from campus stores that you should buy from the city market today?
    3. WEEKLY TIP: One way to get more students to trust you.
    Keep it in simple, encouraging English with emojis.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Analysis complete. Waiting for next market sync.";
  } catch (error) {
    return "The market analyst is currently busy. Try again in a few minutes!";
  }
};

/**
 * Generates catchy WhatsApp or Social Media ad text for a product.
 */
export const generateAdText = async (product: Product): Promise<string> => {
  try {
    const prompt = `Act as a Marketing Expert for students. 
    Create a catchy WhatsApp Status/Instagram caption for this product:
    Item: ${product.name}
    Price: GHS ${product.sellingPrice}
    Category: ${product.category}
    
    Make it:
    - Energetic and cool for university students.
    - Include a "Call to Action" (e.g. "DM to order now").
    - Use student slang (Ghanian campus style like 'charley', 'mad', etc. but keep it polite).
    - Use emojis.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Could not generate ad text.";
  } catch (error) {
    return "Error creating ad post.";
  }
};

/**
 * Provides new business ideas for university students.
 */
export const getBusinessIdeas = async (): Promise<string> => {
  try {
    const prompt = `Act as a Creative Entrepreneurship Coach.
    Suggest 3 NEW simple business ideas for a student living in a university hostel in Ghana.
    The ideas should:
    - Require very little starting money.
    - Be something that can be done while studying.
    - Solve a common student problem (e.g. hunger, laundry, charging, printing).
    Explain why each idea will make money and how to start it today.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "No new ideas right now. Focus on your current sales!";
  } catch (error) {
    return "The idea bot is thinking too hard. Try later.";
  }
};

/**
 * Drafts professional customer replies
 */
export const draftCustomerReply = async (query: string): Promise<string> => {
  try {
    const prompt = `Act as a Professional Store Manager. A student customer just asked: "${query}".
    Write a polite, professional WhatsApp reply that:
    - Sounds helpful but firm.
    - Encourages them to complete their purchase.
    - Uses 1 or 2 relevant emojis.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "No draft generated.";
  } catch (error) {
    return "Could not generate reply draft.";
  }
};

/**
 * Suggests price optimizations for products
 */
export const optimizePricing = async (product: Product): Promise<string> => {
  try {
    const prompt = `Act as a Pricing Strategist.
    Product: ${product.name}
    Cost: GHS ${product.sourcePrice}
    Current Sale Price: GHS ${product.sellingPrice}
    
    Is this price fair for a student? Suggest a 'Best Price' and why.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Pricing audit complete.";
  } catch (error) {
    return "Pricing analyst is offline.";
  }
};
