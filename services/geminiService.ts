
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
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Generic retry wrapper for API calls
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
      
      // Identify retryable errors
      // 500: Internal Server Error
      // 503: Service Unavailable
      // xhr error/rpc failed: Network/transport issues typical in browser
      // fetch failed: Network issues
      const isRetryable = 
        errorMessage.includes('500') || 
        errorMessage.includes('503') || 
        errorMessage.includes('xhr error') || 
        errorMessage.includes('rpc failed') ||
        errorMessage.includes('fetch failed') ||
        errorMessage.includes('network error');

      if (!isRetryable || i === retries - 1) {
        throw error;
      }

      const delay = baseDelay * Math.pow(2, i);
      console.warn(`Gemini API retry attempt ${i + 1}/${retries} after ${delay}ms due to:`, errorMessage);
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
      Bạn là một **Nhiếp ảnh gia Chuyên nghiệp (Professional Photographer)** kiêm **Giám đốc Nghệ thuật (Art Director)** đẳng cấp thế giới.
      
      **NHIỆM VỤ:** Giải mã hình ảnh đầu vào để tạo ra một "Bộ ảnh concept" (Photoshoot Set). Các prompt phải đảm bảo tính nhất quán về nhân vật nhưng cực kỳ đa dạng về góc máy và tạo dáng.

      **QUY TẮC BẤT DI BẤT DỊCH (CONSTANTS - GIỮ NGUYÊN 100%):**
      1. **Nhân dạng (Identity):** Giữ nguyên khuôn mặt, đặc điểm cơ thể, kiểu tóc, trang điểm.
      2. **Trang phục (Attire):** Giữ nguyên quần áo, phụ kiện, chất liệu vải (fabric texture), trang sức.
      3. **Bối cảnh & Ánh sáng:** Giữ nguyên địa điểm (Location), thời gian trong ngày, setup ánh sáng (Cinematic, Softbox, Rim light...), tông màu (Color Grading).
      4. **Văn bản (Text):** Nếu ảnh gốc có chữ, bắt buộc phải giữ nguyên.

      **BIẾN SỐ NHIẾP ẢNH (VARIABLES - CẦN SỰ SÁNG TẠO ĐA CHIỀU):**
      Để tạo ra sự khác biệt chuyên nghiệp, các biến thể phải thay đổi mạnh mẽ các yếu tố sau:
      - **Góc máy (Camera Angles):** 
        + Low angle (Hất từ dưới lên - tạo vẻ quyền lực/chân dài).
        + High angle (Từ trên xuống - tạo vẻ ngây thơ/nhỏ bé).
        + Dutch angle (Góc nghiêng kịch tính).
        + Over-the-shoulder (Góc nhìn qua vai).
        + Eye-level (Góc nhìn ngang tầm mắt).
      - **Cự ly & Tiêu cự (Shot Size & Focal Length):**
        + Extreme Close-up (Macro chi tiết mắt/môi).
        + Medium Shot (Ngang hông/ngực).
        + Cowboy Shot (Ngang đùi).
        + Full Body / Wide Shot (Toàn thân lấy bối cảnh).
        + Sử dụng từ khóa lens: "35mm wide lens", "85mm portrait lens", "200mm telephoto lens".
      - **Tạo dáng (Poses):** 
        + Dynamic poses (Đang bước đi, tóc bay, váy tung).
        + Candid moments (Khoảnh khắc tự nhiên, không nhìn vào camera).
        + Interactive poses (Dựa vào tường, cầm đồ vật, vuốt tóc).
      - **Chiều sâu (Depth):** Depth of field, Bokeh background, Foreground elements (tiền cảnh mờ).

      **YÊU CẦU OUTPUT JSON:**
      
      - "prompts": Mảng chứa ${count} đối tượng.
        * "text": Prompt Tiếng Anh. 
           - **Prompt #1 (The Replica):** Tái tạo chính xác 100% ảnh gốc (Góc chụp, Pose y hệt).
           - **Prompt #2 -> #${count} (The Variations):** Giữ nguyên Subject/Outfit/Lighting nhưng THAY ĐỔI HOÀN TOÀN Góc chụp (Angle), Cự ly (Distance) và Dáng (Pose).
             + Ví dụ: Nếu ảnh gốc là Close-up, hãy làm 1 biến thể Full Body góc thấp (Low angle).
             + Ví dụ: Nếu ảnh gốc nhìn thẳng, hãy làm 1 biến thể nhìn nghiêng (Profile view) hoặc nhìn xa xăm (Looking away).
             + Bắt buộc dùng từ vựng nhiếp ảnh chuyên nghiệp (Photorealistic terms).
        * "score": Đánh giá chất lượng (1-10).
      
      - "detectedTexts": Mảng chứa các chuỗi văn bản (text) tìm thấy trong ảnh. Nếu không có thì để mảng rỗng.
      
      - "suggestions": 3-5 gợi ý ngắn (Tiếng Việt) để cải thiện chất lượng ảnh (ví dụ: đổi lens, thêm fill light, chỉnh khẩu độ).

      Không dùng markdown. Chỉ trả về JSON thuần.
    `;

    // Wrap the generateContent call with retry logic
    const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [imagePart, { text: promptText }]
      },
      config: {
        temperature: 0.75, // Tăng nhẹ temperature để có nhiều biến thể góc chụp sáng tạo hơn
        topK: 40,
        topP: 0.95,
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
                  score: { type: Type.NUMBER, description: "Rating 1-10" }
                },
                required: ["text", "score"]
              }
            },
            detectedTexts: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of exact text strings visible in the image"
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
    if (!text) {
      throw new Error("AI không trả về nội dung nào.");
    }

    try {
      return JSON.parse(text) as AnalysisResult;
    } catch (e) {
      console.error("JSON parse error:", text);
      throw new Error("Lỗi định dạng dữ liệu từ AI.");
    }

  } catch (error: any) {
    console.error("Lỗi khi gọi Gemini API:", error);
    // Return original error if possible to let App.tsx analyze it, otherwise wrap
    throw error;
  }
};

export const optimizePrompt = async (originalPrompt: string): Promise<PromptItem> => {
  try {
    const ai = getClient();
    const promptText = `
      Bạn là một chuyên gia Prompt Engineering (Midjourney v6/Flux).
      Nhiệm vụ: Nâng cấp prompt sau lên điểm 10/10 (Photorealistic/High Art).
      
      Prompt gốc: "${originalPrompt}"
      
      Yêu cầu:
      1. Giữ nguyên ý nghĩa, nội dung text (nếu có), màu sắc và bố cục gốc.
      2. Bổ sung từ khóa về chất lượng: "8k resolution, hyper-detailed, photorealistic, masterpiece, cinematic lighting, ray tracing".
      3. Làm rõ chất liệu (texture) và quang học (camera lens, depth of field).
      
      Output JSON: { "text": "...", "score": 10 }
    `;

    // Wrap the generateContent call with retry logic
    const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-2.5-flash',
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
     throw new Error("Không thể tối ưu hóa prompt lúc này. Vui lòng thử lại.");
  }
};

export const translateText = async (text: string, targetLang: 'en' | 'vi'): Promise<string> => {
  try {
    const ai = getClient();
    const promptText = `Translate the following text to ${targetLang === 'en' ? 'English' : 'Vietnamese'}. Keep it concise and accurate. Do not add any explanations.
    
    Text: "${text}"`;

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
