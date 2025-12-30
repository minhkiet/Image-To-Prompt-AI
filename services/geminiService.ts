
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

// Generic retry wrapper for API calls with faster backoff
const retryOperation = async <T>(
  operation: () => Promise<T>, 
  retries: number = 3, 
  baseDelay: number = 1000
): Promise<T> => {
  let lastError: any;
  
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      const errorMessage = (error.message || JSON.stringify(error)).toLowerCase();
      
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

      const delay = isRateLimit 
        ? (baseDelay * Math.pow(2, i)) + 500 
        : baseDelay * Math.pow(2, i);
      
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

    const promptText = `
      You are an Elite AI Art Director & Cinematic Storyboard Artist.
      GOAL: Analyze the uploaded image to create a "Character Consistency Storyboard" with ${count} distinct scenes.

      PHASE 1: CHARACTER LOCK (The Anchor)
      Analyze and lock the following details to ensure consistency across ALL prompts:
      1. **IDENTITY**: Exact face, age, ethnicity, skin details, hairstyle, and hair color.
      2. **OUTFIT**: Every garment, fabric, accessory, and shoe detail.
      3. **STYLE**: The visual aesthetic (e.g., Photorealistic, Anime, Oil Painting).

      PHASE 2: STORYBOARD GENERATION

      **Prompt 1: THE REFERENCE SHOT (Exact Reconstruction)**
      - Describe the original image exactly as is.
      - **Focus**: Accurate lighting, pose, and background from the source.
      - **Start with**: "Frame 1 (Reference): [Full Character Description]... ensuring subject face is 99.99% identical to the reference."

      **Prompt 2 to ${count}: THE CINEMATIC SCENES (Variations)**
      - **RULE 1 (CONSISTENCY)**: The Character (Face, Body, Hair) and Outfit MUST BE IDENTICAL to Prompt 1.
      - **RULE 2 (DIVERSITY)**: You MUST change the Scene, Angle, Framing, and Pose for each prompt.
      
      **Generate diverse scenarios using these variables**:
      - **CONTEXT (Bối cảnh)**: Change locations (e.g., Coffee Shop, Busy Street, Neon Rooftop, Luxury Interior, Beach at Sunset, Snowy Park).
      - **CAMERA ANGLE (Góc chụp)**: Low Angle (Heroic), High Angle (Vulnerable), Dutch Angle (Dynamic), Over-the-shoulder, Eye-level.
      - **FRAMING (Khoảng cách)**: Extreme Close-up (Eyes/Lips), Medium Shot (Waist up), Cowboy Shot (Knees up), Wide Shot (Full Body + Environment).
      - **POSE (Dáng)**: Dynamic action (Running, Dancing), Candid (Laughing, Fixing hair), Resting (Sitting, Leaning), Editorial (High Fashion Posing).

      **Structure for Prompts 2-${count}**:
      "Cinematic shot. [Insert Character & Outfit Description from Phase 1]. The character is [Action/Pose] in [New Environment/Context]. Shot from a [Camera Angle] with [Framing]. Lighting is [Lighting Style], ensuring subject face is 99.99% identical to the reference."
    `;

    const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [imagePart, { text: promptText }]
      },
      config: {
        temperature: 0.75, // Increased slightly for more creative variations
        thinkingConfig: { thinkingBudget: 0 },
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
    return JSON.parse(text) as AnalysisResult;
  } catch (error: any) {
    console.error("Lỗi Gemini API:", error);
    throw error;
  }
};

export const optimizePrompt = async (originalPrompt: string): Promise<PromptItem> => {
  try {
    const ai = getClient();
    const promptText = `
      Professional Prompt Optimizer.
      GOAL: Upgrade this prompt to "Award-Winning Photography" level.
      
      INSTRUCTIONS:
      1.  **Preserve Core Elements**: Do NOT change the description of the person or clothes.
      2.  **Enhance Aesthetics**: Add professional keywords for lighting (e.g., volumetric lighting, rim light), texture (e.g., 8k, highly detailed), and camera gear.
      3.  **Conciseness**: Remove redundant words, focus on visual impact.
      4.  Input: "${originalPrompt}"
    `;

    const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
         parts: [{ text: promptText }]
      },
      config: {
        temperature: 0.5,
        thinkingConfig: { thinkingBudget: 0 },
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
     throw new Error("Không thể tối ưu hóa prompt lúc này.");
  }
};

export const translateText = async (text: string, targetLang: 'en' | 'vi'): Promise<string> => {
  try {
    const ai = getClient();
    const promptText = `
      Task: Translate the following text to ${targetLang === 'en' ? 'English' : 'Vietnamese'}.
      
      Constraints:
      1. Keep fashion technical terms (e.g., organza, ethereal, sheer, bokeh, shot on 35mm) in English.
      2. Keep camera terms and specific identity prefixes in English.
      3. **CRITICAL**: Return ONLY the translated text directly. Do NOT include any introductory phrases like "Here is the translation" or "Dưới đây là bản dịch".
      
      Text to translate: "${text}"
    `;

    const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
         parts: [{ text: promptText }]
      },
      config: {
        temperature: 0.1,
        thinkingConfig: { thinkingBudget: 0 }
      }
    }));

    return response.text?.trim() || text;
  } catch (error) {
    return text;
  }
};
