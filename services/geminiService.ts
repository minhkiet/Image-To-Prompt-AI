
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
      Bạn là một **Chuyên gia Phân tích Hình ảnh (Visual Analyst)** kiêm **Đạo diễn Hình ảnh (Director of Photography)** xuất sắc.

      **MỤC TIÊU:** Tạo ra các prompt để tái tạo hình ảnh (Replica) và các biến thể (Variations) với tiêu chí: **"ĐỒNG NHẤT TUYỆT ĐỐI VỚI ẢNH GỐC"**.

      **1. PHÂN TÍCH CỐT LÕI (BẮT BUỘC GIỮ NGUYÊN 100%):**
      *   **Bối cảnh & Hậu cảnh (Context & Background - CỰC KỲ QUAN TRỌNG):** 
          - Mô tả cực chi tiết không gian xung quanh (quán cafe, đường phố, phòng ngủ...).
          - Ghi rõ các chi tiết nền: màu tường, ánh đèn bokeh, đồ vật decor cụ thể.
          - **Yêu cầu:** Bối cảnh trong tất cả các prompt phải khớp hoàn toàn với ảnh gốc, tạo cảm giác cùng một địa điểm.
      *   **Nhân dạng & Trang phục:** Giữ nguyên khuôn mặt, kiểu tóc, trang điểm, quần áo, phụ kiện, chất liệu vải.
      *   **Ánh sáng (Lighting):** Giữ nguyên hướng sáng, nhiệt độ màu (ấm/lạnh), độ tương phản (contrast).

      **2. PHÂN TÍCH BIỂU CẢM & CẢM XÚC (EXPRESSION & MOOD):**
      *   Hãy nhìn sâu vào ánh mắt và cơ mặt nhân vật. Họ đang vui, buồn, quyến rũ, hay suy tư?
      *   **Yêu cầu:** Mọi prompt biến thể phải mô tả chính xác trạng thái cảm xúc này. 
          - *Ví dụ:* Nếu ảnh gốc là "mắt buồn, nhìn xa xăm", thì biến thể không được "cười tươi rạng rỡ".
          - Sử dụng các từ khóa miêu tả vi biểu cảm (micro-expressions): *smizing, pouting, melancholic gaze, soft smile, intense eye contact*.

      **3. CHIẾN LƯỢC BIẾN THỂ (VARIATIONS STRATEGY):**
      Thay vì thay đổi ngẫu nhiên, hãy tạo ra các "Góc máy khác của cùng một khoảnh khắc" (Alternative shots of the same moment).
      *   **Prompt #1 (The Replica):** Tái tạo chính xác 100% ảnh gốc (Góc chụp, Pose, Crop y hệt).
      *   **Prompt #2 -> #${count} (The Consistent Variations):**
          - Giữ nguyên Bối cảnh + Nhân vật + Mood.
          - Thay đổi nhẹ **Góc máy (Camera Angle):** High angle (ngây thơ), Low angle (quyền lực), Dutch angle (nghệ thuật).
          - Thay đổi **Tiêu cự & Cự ly:** Chuyển từ Close-up sang Medium Shot hoặc ngược lại.
          - Thay đổi **Tạo dáng (Pose):** Pose mới phải tự nhiên và **phù hợp với bối cảnh**. (Ví dụ: Đang ngồi ghế thì pose biến thể có thể là vắt chân, chống cằm, nghiêng đầu - nhưng vẫn phải ngồi trên ghế đó).

      **YÊU CẦU OUTPUT JSON:**
      - "prompts": Mảng chứa ${count} đối tượng.
        * "text": Prompt Tiếng Anh chuẩn Midjourney/Flux. Dùng từ vựng nhiếp ảnh chuyên nghiệp (Photorealistic).
        * "score": Đánh giá độ chi tiết (1-10).
      - "detectedTexts": Mảng chứa text tìm thấy trong ảnh (nếu có).
      - "suggestions": 3-5 gợi ý Tiếng Việt để chụp ảnh đẹp hơn (ví dụ: cách đánh đèn, chỉnh pose).

      Chỉ trả về JSON thuần, không Markdown.
    `;

    // Wrap the generateContent call with retry logic
    const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [imagePart, { text: promptText }]
      },
      config: {
        temperature: 0.65, // Giảm nhẹ temperature để tăng tính nhất quán
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
