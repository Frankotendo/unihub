
import { Product } from "../types";

/**
 * Generates a visual marketing flyer using Pollinations.ai (Free & Unblocked).
 * This service bypasses the strict commercial safety filters of enterprise AI models.
 */
export const generateFlyerImage = async (product: Product): Promise<string> => {
  // We use Pollinations.ai because it is free, requires no API key, and is perfect for 
  // commercial product photography without safety blocks.
  // The prompt now explicitly asks for typography to be included in the image.
  const prompt = encodeURIComponent(
    `A high-end professional marketing flyer for "${product.name}". 
    The text "${product.name}" is displayed in large, bold, modern typography. 
    The price "GHS ${product.sellingPrice}" is also clearly visible on the poster. 
    Features a professional studio photograph of the item in the center. 
    Style: Minimalist graphic design, clean layout, vibrant premium background, 
    university student lifestyle aesthetic, sharp focus, 8k resolution.`
  );
  
  const seed = Math.floor(Math.random() * 1000000);
  const imageUrl = `https://image.pollinations.ai/prompt/${prompt}?width=1024&height=1024&nologo=true&seed=${seed}`;
  
  // We return the URL directly as Pollinations generates on-the-fly via URL
  return imageUrl;
};
