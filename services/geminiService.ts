
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

    // Updated Prefix: Locks ALL visual elements including Composition and Style
    const mandatoryPrefix = "Create a high-fidelity photorealistic image. Strictly maintain the Subject (Identity, Hair, Body), Outfit (Fabric, Cut, Colors, Details), Accessories, Background Context, Lighting, and Composition (Pose & Framing) from the reference. ";

    const promptText = `
      You are an Elite AI Visionary & Hyper-Detail Image Analyst.
      GOAL: Perform a pixel-perfect scan of the uploaded image and generate ${count} comprehensive prompts.

      PHASE 1: DEEP SCAN ANALYSIS (Internal Processing)
      You must internally analyze and extract every single detail to ensure perfect consistency:
      1. **SUBJECT**: Exact age, ethnicity, skin texture (pores, moles), makeup details, eye color, body shape, exact hairstyle & color.
      2. **FASHION**: Every garment, specific fabrics (e.g., rib-knit, sheer organza, distressed denim, satin), patterns, folds, stitching, footwear.
      3. **ACCESSORIES**: Jewelry (gold/silver, gemstone type), glasses, hats, bags, handheld items.
      4. **ENVIRONMENT (CONTEXT)**: Exact location (indoor/outdoor), architectural style, furniture, nature elements, weather, time of day.
      5. **AESTHETICS & EFFECTS**: Lighting source (softbox, natural, neon, rim light), color grade, film grain, lens effects (bokeh, flare).
      6. **COMPOSITION (Bố Cục)**: Exact camera angle (high/low/eye-level), framing (close-up/wide), subject placement, pose.

      PHASE 2: PROMPT GENERATION RULES:

      **Prompt 1: THE FORENSIC REPLICA (Detailed Description)**
      - Describe everything exactly as seen in the image.
      - List all details from Phase 1 clearly and objectively.
      - Focus on accuracy of the scene, lighting, and colors.

      **Prompt 2 to ${count}: THE HIGH-FASHION EDITORIAL (Artistic Enhancement)**
      - **CRITICAL**: Do NOT change the Subject, Outfit, Context, or **COMPOSITION**. The image content must remain consistent.
      - **GOAL**: Upgrade the *description* to be more "Vogue/Harper's Bazaar" quality. Use evocative, sensory, and professional photography vocabulary to describe the *same* scene.
      - **Enhance**:
         - Instead of "wearing a red dress", use "draped in a crimson silk chiffon gown".
         - Instead of "sunlight", use "bathed in golden hour ethereal glow".
         - Instead of "looking at camera", use "piercing gaze engaging the viewer".
         - Mention specific film stocks (Kodak Portra 400), camera gears (Hasselblad, 85mm f/1.2), and render engines (Unreal Engine 5, Octane Render) to boost quality.

      MANDATORY: Start every prompt with: "${mandatoryPrefix}"
    `;

    const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [imagePart, { text: promptText }]
      },
      config: {
        temperature: 0.65, // Balanced for creativity vs accuracy in Flash model
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
      1.  **Preserve Identity & Composition**: Do NOT change the description of the person, clothes, setting, or pose.
      2.  **Enhance Aesthetics**: Add professional keywords for lighting (e.g., volumetric lighting), texture (e.g., subsurface scattering), and composition.
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
