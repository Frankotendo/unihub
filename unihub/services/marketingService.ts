
import { Product } from "../types";

/**
 * Service to generate high-quality marketing flyers using professional AI models.
 */
export const generateFlyerImage = async (product: Product, style: string = 'Modern'): Promise<string> => {
  // Enhanced prompt logic for better visual quality and commercial appeal.
  const prompt = encodeURIComponent(
    `A high-end professional commercial marketing flyer for "${product.name}". 
    The item name "${product.name}" and price "GHS ${product.sellingPrice}" are integrated into the design with bold, modern typography. 
    Style: ${style}. 
    Features a high-resolution professional studio photograph of the product. 
    Aesthetic: clean lines, vibrant premium colors, depth of field, sharp focus, advertising-grade quality.`
  );
  
  const seed = Math.floor(Math.random() * 1000000);
  // Default to Pollinations for fast previews, but the MarketingAI component now prefers Gemini native.
  const imageUrl = `https://image.pollinations.ai/prompt/${prompt}?width=1024&height=1024&nologo=true&seed=${seed}`;
  
  return imageUrl;
};
