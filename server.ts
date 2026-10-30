import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { AnalysisResult, PromptItem } from './types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new Error('API Key chưa được cấu hình trong hệ thống. Vui lòng kiểm tra biến môi trường.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

      const isRateLimit =
        errorMessage.includes('429') ||
        errorMessage.includes('resource exhausted') ||
        errorMessage.includes('quota');
      const isNetwork =
        errorMessage.includes('500') ||
        errorMessage.includes('503') ||
        errorMessage.includes('fetch failed') ||
        errorMessage.includes('network error') ||
        errorMessage.includes('overloaded');

      if ((!isRateLimit && !isNetwork) || i === retries - 1) {
        throw error;
      }

      const delay = isRateLimit ? baseDelay * Math.pow(2, i) + 500 : baseDelay * Math.pow(2, i);
      await wait(delay);
    }
  }

  throw lastError;
};

// API: Decode Image to Prompts
app.post('/api/decode', async (req, res) => {
  try {
    const { base64Data, mimeType, count = 1 } = req.body;

    if (!base64Data || !mimeType) {
      return res.status(400).json({ error: 'Thiếu dữ liệu hình ảnh hoặc mimeType.' });
    }

    const ai = getGeminiClient();

    const imagePart = {
      inlineData: {
        mimeType: mimeType,
        data: base64Data,
      },
    };

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

    const response = await retryOperation(() =>
      ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: {
          parts: [imagePart, { text: promptText }],
        },
        config: {
          temperature: 0.75,
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
                    score: { type: Type.NUMBER },
                  },
                  required: ['text', 'score'],
                },
              },
              suggestions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              detectedTexts: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ['prompts', 'suggestions'],
          },
        },
      })
    );

    const text = response.text;
    if (!text) {
      throw new Error('AI không trả về nội dung.');
    }

    const result = JSON.parse(text) as AnalysisResult;
    return res.json(result);
  } catch (error: any) {
    console.error('Lỗi server decode:', error);
    const statusCode = error.message?.includes('429') ? 429 : 500;
    return res.status(statusCode).json({ error: error.message || 'Lỗi khi giải mã hình ảnh.' });
  }
});

// API: Optimize Prompt
app.post('/api/optimize', async (req, res) => {
  try {
    const { prompt: originalPrompt, base64Data, mimeType } = req.body;

    if (!originalPrompt) {
      return res.status(400).json({ error: 'Thiếu câu prompt gốc cần tối ưu.' });
    }

    const ai = getGeminiClient();
    const parts: any[] = [];

    if (base64Data && mimeType) {
      parts.push({
        inlineData: {
          mimeType: mimeType,
          data: base64Data,
        },
      });
    }

    const promptText = `
      You are an expert **Prompt Engineer** and **Image Analyst**.
      GOAL: Take the input prompt and rewrite it to be **SIGNIFICANTLY MORE DETAILED**.
      CRITICAL: The subject in the prompt MUST be described so precisely that an AI image generator will recreate the EXACT SAME PERSON and OUTFIT as seen in the reference image.
      
      INPUT PROMPT: "${originalPrompt}"
      
      INSTRUCTIONS:
      1.  **Analyze the Reference Image**: Look closely at the person/subject in the provided image.
      2.  **Subject Accuracy (Highest Priority)**: Describe the subject's facial features, bone structure, eye shape/color, nose, lips, jawline, skin texture, makeup, and hair with extreme, hyper-realistic precision. The goal is to create a "textual deepfake" of this specific person.
      3.  **Outfit Accuracy**: Describe the clothing, fabric, and accessories exactly as they appear in the reference image.
      4.  **Preserve the Input Prompt's Intent**: Keep the environment, pose, and camera angles described in the INPUT PROMPT. Do NOT change the setting back to the reference image if the input prompt describes a different setting or angle.
      5.  **Explode the Details**: Add meticulous details about lighting, atmosphere, and camera specs based on the input prompt's context.
      6.  **Format**: Return a massive, cohesive, narrative-style block of text (200-300 words).
    `;

    parts.push({ text: promptText });

    const response = await retryOperation(() =>
      ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: {
          parts: parts,
        },
        config: {
          temperature: 0.7,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              score: { type: Type.NUMBER },
            },
            required: ['text', 'score'],
          },
        },
      })
    );

    const text = response.text;
    if (!text) throw new Error('Không nhận được phản hồi từ AI.');

    const result = JSON.parse(text) as PromptItem;
    return res.json(result);
  } catch (error: any) {
    console.error('Lỗi server optimize:', error);
    const statusCode = error.message?.includes('429') ? 429 : 500;
    return res.status(statusCode).json({ error: error.message || 'Không thể tối ưu hóa prompt lúc này.' });
  }
});

// API: Translate Text
app.post('/api/translate', async (req, res) => {
  try {
    const { text, targetLang } = req.body;

    if (!text) {
      return res.json({ text: '' });
    }

    const ai = getGeminiClient();
    const promptText = `
      Task: Translate the following text to ${targetLang === 'en' ? 'English' : 'Vietnamese'}.
      
      Constraints:
      1. Keep fashion technical terms (e.g., organza, ethereal, sheer, bokeh, shot on 35mm) in English.
      2. Keep camera terms and specific identity prefixes in English.
      3. **CRITICAL**: Return ONLY the translated text directly. Do NOT include any introductory phrases like "Here is the translation" or "Dưới đây là bản dịch".
      
      Text to translate: "${text}"
    `;

    const response = await retryOperation(() =>
      ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: {
          parts: [{ text: promptText }],
        },
        config: {
          temperature: 0.1,
        },
      })
    );

    const translated = response.text?.trim() || text;
    return res.json({ text: translated });
  } catch (error: any) {
    console.error('Lỗi server translate:', error);
    return res.json({ text: req.body.text || '' });
  }
});

// Vite middleware or production static serving
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
} else {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true, hmr: false },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});
