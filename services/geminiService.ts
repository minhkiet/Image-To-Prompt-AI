
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

    // Prompt mẫu chuẩn "Gold Standard" từ người dùng
    const referencePrompt = `
      Create a portrait of a young woman with a fresh, delicate face and naturally smooth, radiant skin. She wears light makeup in soft pink–peach tones, giving a clear and youthful look. Her brown hair is side-braided with gentle volume, a few loose strands falling naturally.
      She is wearing a deep red vintage-style áo dài. The mid-length sleeves are made of sheer chiffon with a subtle flare, while the main body is crafted from lightweight linen, modest and elegant. Keep the original facial features and her gentle smile from the reference image unchanged.
      She is sitting on a low wooden step in an outdoor Vietnamese Lunar New Year (Tết) flower market. Around her are apricot blossom trees, kumquat trees, peach blossom branches decorated with red lanterns and hanging tags with handwritten New Year wishes. Behind her are wooden stalls selling traditional Tết items (bánh chưng, bánh tét, calligraphy artwork, red envelopes), softly blurred in the background.
      The character is holding a traditional red paper fan. Her sitting posture is graceful, legs neatly folded, with a gentle and warm expression. She is looking directly at the camera, creating a friendly and welcoming springtime feeling.
      Outdoor setting with natural late-afternoon light at the end of the year. Soft golden sunlight shines diagonally through the Tết flowers and across her face, creating gentle shadows and a warm atmosphere—lively yet poetic.
      The image is captured with a professional mirrorless or DSLR camera, using an 85mm lens at f/1.8 aperture. Shallow depth of field, smooth background blur of the festival scene, and round, soft bokeh created by lantern lights behind her.
      Overall color palette is warm and rich with a strong Tết spirit—harmonious reds, yellows, and wooden browns. Photorealistic style, resembling a real-life photograph, natural skin texture, no excessive smoothing, no artificial effects.
      Emotional tone of the image: traditional Vietnamese Tết, cozy, nostalgic, joyful spring atmosphere that feels peaceful and heartfelt.
    `;

    const promptText = `
      You are an expert **Visual Novelist** and **Cinematic Prompt Engineer**.
      
      **MISSION**: Analyze the uploaded image and generate ${count} prompt(s).
      
      **CRITICAL REQUIREMENT - EXTREME VERBOSITY**:
      Every single prompt (including variations) must be a **massive wall of text** (200-300 words minimum).
      
      **REFERENCE STANDARD (TARGET LENGTH)**:
      Your output MUST match the length, depth, and descriptive style of this text exactly:
      """
      ${referencePrompt}
      """

      **STRICT FORMULA FOR EVERY PROMPT (1 to ${count})**:
      
      1.  **THE SUBJECT (Face & Identity)**: [Minimum 4 sentences]
          - Describe skin texture, makeup tones, specific eye shape/color, and hair details (strands, volume) like a hyper-realist painter.
          - *For Variations*: COPY THIS SECTION EXACTLY from Prompt 1.
          
      2.  **THE OUTFIT (Material Physics)**: [Minimum 4 sentences]
          - Describe fabric weight, texture (sheer, rough, silky), embroidery, stitching, transparency, and accessories.
          - *For Variations*: COPY THIS SECTION EXACTLY from Prompt 1.
          
      3.  **THE ENVIRONMENT (Contextual Consistency)**: [Minimum 5 sentences]
          - *For Prompt 1*: Describe the actual image background exactly.
          - *For Variations*: **MAINTAIN THE SAME THEME & LOGIC**. 
            - Do NOT change the genre (e.g., do not go from Tet Market to Cyberpunk). 
            - Instead, describe a **different angle** or a **nearby spot** within the SAME world/location.
            - Example: If Prompt 1 is "sitting on steps at a flower market", Prompt 2 could be "standing beneath a row of red lanterns in the same market" or "strolling past a calligraphy stall".
            - **CRITICAL**: Keep the same lighting (e.g., golden hour), season, and color palette.
          
      4.  **THE POSE & ACTION**: [Minimum 3 sentences]
          - Describe posture, hand placement, and interaction with props suitable for the new spot in the environment.
          
      5.  **LIGHTING & TECHNICAL SPECS**: [Minimum 3 sentences]
          - Light sources, direction, color grading (warm, cool, cinematic).
          - Camera gear: "Shot on Sony A7R IV, 85mm f/1.4 GM, shallow depth of field, creamy bokeh".

      **OUTPUT INSTRUCTIONS**:
      - **Prompt 1 (Master Replica)**: Describe the uploaded image exactly using the formula above.
      - **Prompt 2 to ${count} (Logical Variations)**: 
        - **RULE 1**: The "Subject" and "Outfit" sections MUST BE IDENTICAL to Prompt 1.
        - **RULE 2**: The "Environment" must be a **LOGICAL EXTENSION** of the original setting. Same vibe, same place, different viewpoint.
        - **RULE 3**: The variations must be JUST AS LONG AND DETAILED as the Master Replica.

      Output strictly in JSON format.
    `;

    const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [imagePart, { text: promptText }]
      },
      config: {
        temperature: 0.75, // Slightly lowered to ensure thematic consistency while maintaining creativity
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
            },
            detectedTexts: {
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
      You are a **Prompt Expander** and **Detail Maximizer**.
      GOAL: Take the input prompt and rewrite it to be **SIGNIFICANTLY LONGER (3x length)**, richer, and more detailed.
      
      INPUT PROMPT: "${originalPrompt}"
      
      INSTRUCTIONS:
      1.  **Explode the Details**: 
          - Convert "red dress" -> "a flowing crimson gown made of crushed velvet with intricate gold embroidery along the hem".
          - Convert "sunlight" -> "warm, dappled sunlight filtering through the canopy, creating dancing shadows on her skin".
      2.  **Add Sensory Information**: Describe texture, temperature, smell (implied), and atmosphere.
      3.  **Preserve Core Identity**: Do not change the person's face or main outfit type.
      4.  **Format**: Return a massive, cohesive, narrative-style block of text.
    `;

    const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
         parts: [{ text: promptText }]
      },
      config: {
        temperature: 0.7,
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
