
import { GoogleGenAI, Type } from "@google/genai";
import { Driver } from "./types";

export const generateMarketingCopy = async (driverName: string, vehicleType: string) => {
  // Correctly using process.env.API_KEY directly for initialization
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate a high-energy marketing promo for a student transport service in Dormaa. Driver: ${driverName}, Vehicle: ${vehicleType}. Focus on safety, speed, and campus vibes. Use Ghana campus slang.`,
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

export const generateFlyerWithGemini = async (driver: any, style: string): Promise<string> => {
  // Correctly using process.env.API_KEY directly for initialization
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `A professional commercial marketing poster for a student transport service. 
  "Ride with ${driver.name}" and "${driver.vehicleType}" clearly visible. 
  Style: ${style}. 
  Features a sleek modern tricycle or taxi on a clean college campus background. 
  Text "GHS ${driver.pricePerSeat} Per Seat" stylistically integrated.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: { aspectRatio: "1:1" }
      }
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image data");
  } catch (error) {
    const seed = Math.floor(Math.random() * 1000000);
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${seed}`;
  }
};
