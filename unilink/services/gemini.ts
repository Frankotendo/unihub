
import { GoogleGenAI } from "@google/genai";
import { Message } from "../types";

const SYSTEM_INSTRUCTION = `
You are the UniHub Logistics Assistant, a specialized AI for hostel-based delivery services. 
Your goal is to help operators manage orders, track deliveries to specific hostel rooms, and provide business insights.

Tone: Professional, efficient, slightly tech-forward, and helpful.
Capabilities:
- Explain logistics metrics.
- Assist with delivery route optimization queries.
- Help with 'Listed Assets' and 'Sales' inquiries.

Format responses with Markdown. Use bold headers for key information.
`;

export const getAIResponse = async (history: Message[], userInput: string): Promise<string> => {
  // Initialize AI client strictly with process.env.API_KEY per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        ...history.map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }]
        })),
        { role: 'user', parts: [{ text: userInput }] }
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
      }
    });

    // Access the generated text directly from the response object property
    return response.text || "I'm sorry, I couldn't process that request.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "The system is currently busy. Please ensure your API key is valid and try again.";
  }
};
