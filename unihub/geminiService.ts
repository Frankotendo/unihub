
import { GoogleGenAI, Type } from "@google/genai";
import { Product } from "./types";

export const generateMarketingCopy = async (product: string, tone: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate a short, punchy marketing description and 3 catchy social media captions for this product: ${product}. Tone should be ${tone}. Use Ghana campus slang where appropriate.`,
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

export const generateFlyerWithGemini = async (product: Product, style: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  const prompt = `Create a high-end, professional commercial marketing flyer for "${product.name}". 
  The text "${product.name}" and the price "GHS ${product.sellingPrice}" must be clearly visible and stylistically integrated into the design.
  Style: ${style}. 
  Composition: The product is centered, professional studio lighting, clean background, advertising photography style. 
  The aesthetic should appeal to university students.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: prompt }],
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
    throw new Error("No image data returned");
  } catch (error) {
    console.error("Gemini Image Error:", error);
    // Fallback to pollinations if Gemini fails or for high-traffic moments
    const seed = Math.floor(Math.random() * 1000000);
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${seed}`;
  }
};
