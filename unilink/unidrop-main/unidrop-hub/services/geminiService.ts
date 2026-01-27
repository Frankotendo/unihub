
import { GoogleGenAI, Type } from "@google/genai";
import { Product, Order, AISuggestion } from "../types";

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
    console.error("Gemini Error:", error);
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

/**
 * SMART SEARCH: Matches query intent to product IDs.
 */
export const getSmartSearch = async (query: string, allProducts: Product[]): Promise<string[]> => {
  try {
    const productList = allProducts.map(p => `${p.id}: ${p.name} (${p.category}) - ${p.description}`).join('\n');
    const prompt = `A user is searching for: "${query}". Based on the following catalog, return a JSON array of the IDs of the products that best match the user's intent. Even if keywords aren't exact, prioritize conceptual matches for a university student.
    Catalog:
    ${productList}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            matchingIds: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        }
      }
    });

    const data = JSON.parse(response.text);
    return data.matchingIds || [];
  } catch (error) {
    console.error("Smart Search Error:", error);
    return [];
  }
};

/**
 * AI RECOMMENDATIONS: Suggests items to complement the cart.
 */
export const getAIRecommendations = async (cartIds: string[], allProducts: Product[]): Promise<AISuggestion> => {
  try {
    const cartItems = allProducts.filter(p => cartIds.includes(p.id)).map(p => p.name).join(', ');
    const candidates = allProducts.filter(p => !cartIds.includes(p.id)).map(p => `${p.id}: ${p.name}`).join(', ');
    
    const prompt = `The user has [${cartItems}] in their cart. Suggest 2 items from [${candidates}] that would complement their selection. Provide a friendly reason for the recommendation using university student vibes.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reason: { type: Type.STRING },
            productIds: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["reason", "productIds"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("AI Stylist Error:", error);
    return { reason: "Check out these other essentials!", productIds: allProducts.slice(0, 2).map(p => p.id) };
  }
};
