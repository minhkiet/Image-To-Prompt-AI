
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

      // Exponential backoff
      const delay = isRateLimit 
        ? (baseDelay * Math.pow(2, i)) + 1000 
        : baseDelay * Math.pow(2, i);
      
      console.warn(`Gemini API retry attempt ${i + 1}/${retries} after ${delay}ms.`);
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

    const mandatoryPrefix = "Create a highly realistic studio portrait of the Subject from the uploaded photo, ensuring Subject face is 99.99% identical to the reference.";

    const promptText = `
      You are a world-class Art Director, Fashion Photographer, and Reverse Prompt Engineer.
      GOAL: Analyze the image and decode it into a base "Absolute Replica" (Bản Sao Hoàn Hảo) prompt, and generate ${count} editorial variations.

      CRITICAL MANDATORY RULE:
      Every prompt you generate MUST start exactly with this sentence:
      "${mandatoryPrefix}"

      CRITICAL FOCUS 1: MASTER SUBJECT DESCRIPTION
      Describe the subject in extreme detail. This description must be consistent in all prompts:
      - CLOTHING: Specific garments, materials (silk, organza, denim, etc.), and textures.
      - ACCESSORIES & JEWELRY: Detail every item (earrings, necklaces, belts, eyewear).
      - HAIR & BEAUTY: Precise hairstyle, hair texture, and makeup style.
      - IDENTITY: Lock the facial features.

      CRITICAL FOCUS 2: TEXT & TYPOGRAPHY
      If the image contains text, identify exact words, font, color, size, and position. 
      In variations, keep the SAME text but reposition it logically to fit the new pose/angle.

      VARIATION DIRECTION: 
      - ONLY vary: Poses, Camera Angles, Shot Distance, and Text Placement.
      - THE SUBJECT (CLOTHES, HAIR, FACE) MUST NEVER CHANGE.

      OUTPUT FORMAT (JSON ONLY)
      {
        "prompts": [
          { "text": "${mandatoryPrefix} [Detailed Subject] + [Original Typography] + [Original Pose]", "score": 10 },
          { "text": "${mandatoryPrefix} [Detailed Subject] + [Repositioned Typography] + [New Pose/Angle]", "score": 10 }
        ],
        "detectedTexts": ["Exact words found in image"],
        "suggestions": ["Design tips"]
      }
    `;

    const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [imagePart, { text: promptText }]
      },
      config: {
        temperature: 0.5,
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
    const mandatoryPrefix = "Create a highly realistic studio portrait of the Subject from the uploaded photo, ensuring Subject face is 99.99% identical to the reference.";

    const promptText = `
      You are a Professional Graphic Design & Photography Consultant.
      TASK: Optimize this prompt for maximum realism while strictly preserving every detail of the subject's outfit and identity.
      
      RULES:
      1. MANDATORY START: The optimized prompt MUST start with: "${mandatoryPrefix}"
      2. Subject Integrity: Do not remove details about fabrics, jewelry, or hairstyle. Refine to professional terminology.
      3. Typography Clarity: Ensure text instructions are integrated.
      4. Technical Polish: Enhance camera and lighting specs.

      INPUT: "${originalPrompt}"

      OUTPUT JSON: { "text": "${mandatoryPrefix} [Polished Details]", "score": 10 }
    `;

    const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
         parts: [{ text: promptText }]
      },
      config: {
        temperature: 0.7,
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
    const promptText = `Translate to ${targetLang === 'en' ? 'English' : 'Vietnamese'}. Do NOT translate the prefix "Create a highly realistic studio portrait..." if it exists. Keep technical fashion and photography terms accurate. Text: "${text}"`;

    const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
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
