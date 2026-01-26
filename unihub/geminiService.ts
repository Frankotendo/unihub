
import { GoogleGenAI, Type } from "@google/genai";

export const generateMarketingCopy = async (product: string, tone: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate a short, punchy marketing description and 3 catchy social media captions for this product: ${product}. Tone should be ${tone}.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            captions: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["description", "captions"]
        }
      },
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
};
