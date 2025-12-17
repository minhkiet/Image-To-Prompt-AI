
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { AnalysisResult, PromptItem } from "../types";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key chưa được cấu hình trong hệ thống. Vui lòng kiểm tra biến môi trường.");
  }
  return new GoogleGenAI({ apiKey });
};

// Helper function to pause execution
export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Generic retry wrapper for API calls
const retryOperation = async <T>(
  operation: () => Promise<T>, 
  retries: number = 3, 
  baseDelay: number = 2000
): Promise<T> => {
  let lastError: any;
  
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      const errorMessage = (error.message || JSON.stringify(error)).toLowerCase();
      
      // Identify retryable errors
      const isRateLimit = errorMessage.includes('429') || errorMessage.includes('resource exhausted') || errorMessage.includes('quota');
      const isNetwork = 
        errorMessage.includes('500') || 
        errorMessage.includes('503') || 
        errorMessage.includes('fetch failed') ||
        errorMessage.includes('network error') ||
        errorMessage.includes('overloaded');

      if ((!isRateLimit && !isNetwork) || i === retries - 1) {
        throw error;
      }

      // Exponential backoff: Wait longer if it's a rate limit error
      const delay = isRateLimit 
        ? (baseDelay * Math.pow(2, i)) + 1000 
        : baseDelay * Math.pow(2, i);
      
      console.warn(`Gemini API retry attempt ${i + 1}/${retries} after ${delay}ms. Reason: ${isRateLimit ? 'Rate Limit' : 'Network/Server'}`);
      await wait(delay);
    }
  }
  
  throw lastError;
};

export const decodeImagePrompt = async (base64Data: string, mimeType: string, count: number = 1): Promise<AnalysisResult> => {
  try {
    const ai = getClient();
    
    const imagePart = {
      inlineData: {
        mimeType: mimeType,
        data: base64Data
      }
    };

    // MERGED PROMPT: Combines Analysis + Optimization + Variations in ONE shot for maximum speed.
    const promptText = `
      You are a world-class Art Director and Fashion Analyst.
      
      GOAL: Analyze the image and generate ${count} ultra-precise, "Ready-to-Use" fashion editorial prompts.
      
      CRITICAL INSTRUCTION: Apply the "ART DIRECTOR LOCK SYSTEM" immediately to ALL generated prompts. Do not generate a draft first. Generate the final polished version directly.

      ––––––––––––––––––––––
      1. ANALYSIS PHASE (Internal Processing)
      - Scan for: Jewelry details (material, cut), Garment specs (fabric, fit), and Lighting (key/fill).
      - Analyze the vibe and aesthetic.

      ––––––––––––––––––––––
      2. GENERATION RULES (Apply to EVERY prompt)

      Structure every prompt with these layers:

      [LAYER 1: CHARACTER LOCK]
      - Start with: "Create a highly realistic studio portrait of the woman/man from the uploaded photo, ensuring face is 99.99% identical to the reference."
      - Add: "same person, identical bone structure, consistent identity, no face variation."

      [LAYER 2: FASHION LOCK]
      - Add: "exact same outfit, identical garments, same fabric texture, same jewelry pieces, same accessories, no outfit drift."

      [LAYER 3: CAMPAIGN SPECS]
      - Add: "shot on full-frame camera, 85mm lens, aperture f/2.8, soft directional studio lighting, ultra-high resolution, 8k, Vogue-level styling."

      [LAYER 4: TEXT SIGNATURE]
      - Add: "visible text signature in the bottom right corner, cute and aesthetic font style, small size."

      ––––––––––––––––––––––
      3. VARIATION STRATEGY
      
      - Prompt #1: Absolute Replica (Same pose, same angle).
      - Prompt #2-${count}: Editorial Variations. Keep Identity and Outfit LOCKED. Only change Camera Angle (Low angle, Profile), Focal Length, or Micro-Expressions.

      ––––––––––––––––––––––
      4. OUTPUT FORMAT (JSON ONLY)
      {
        "prompts": [
          { "text": "Full optimized prompt...", "score": 10 }
        ],
        "detectedTexts": ["Any visible text in image"],
        "suggestions": ["3 short tips for photography"]
      }
    `;

    const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [imagePart, { text: promptText }]
      },
      config: {
        temperature: 0.65,
        topK: 40,
        topP: 0.90,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            prompts: {
              type: Type.ARRAY,
              items: { 
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  score: { type: Type.NUMBER }
                },
                required: ["text", "score"]
              }
            },
            detectedTexts: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            suggestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["prompts", "suggestions"]
        }
      }
    }));

    const text = response.text;
    if (!text) throw new Error("AI không trả về nội dung.");

    try {
      return JSON.parse(text) as AnalysisResult;
    } catch (e) {
      console.error("JSON parse error:", text);
      throw new Error("Lỗi định dạng dữ liệu từ AI.");
    }

  } catch (error: any) {
    console.error("Lỗi khi gọi Gemini API:", error);
    throw error;
  }
};

export const optimizePrompt = async (originalPrompt: string): Promise<PromptItem> => {
  try {
    const ai = getClient();
    const promptText = `
      You are a Professional Fashion Photographer using the "ART DIRECTOR SYSTEM".
      TASK: Upgrade this prompt to 10/10 quality.
      INPUT: "${originalPrompt}"
      
      MANDATORY LAYERS:
      1. Start with: "Create a highly realistic studio portrait of the man/woman from the uploaded photo, ensuring him/her face is 99.99% identical to the reference."
      2. Append: "same person, identical bone structure, no face variation."
      3. Append: "exact same outfit, identical garments, same jewelry, same accessories."
      4. Tech Specs: "85mm lens, f/2.8, soft lighting, 8k resolution, masterpiece."
      5. Signature: "visible text signature in the bottom right corner, cute and aesthetic font style."

      OUTPUT JSON: { "text": "Final string...", "score": 10 }
    `;

    const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
         parts: [{ text: promptText }]
      },
      config: {
        temperature: 0.75,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING },
            score: { type: Type.NUMBER }
          },
          required: ["text", "score"]
        }
      }
    }));

    const text = response.text;
    if (!text) throw new Error("No response");
    return JSON.parse(text) as PromptItem;

  } catch (error: any) {
     console.error("Optimize error:", error);
     throw new Error("Không thể tối ưu hóa prompt lúc này.");
  }
};

export const translateText = async (text: string, targetLang: 'en' | 'vi'): Promise<string> => {
  try {
    const ai = getClient();
    const promptText = `Translate to ${targetLang === 'en' ? 'English' : 'Vietnamese'}. Concise. Text: "${text}"`;

    const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
         parts: [{ text: promptText }]
      },
      config: {
        temperature: 0.3,
        responseMimeType: 'text/plain'
      }
    }));

    return response.text?.trim() || text;
  } catch (error) {
    console.error("Translation error:", error);
    throw error;
  }
};
