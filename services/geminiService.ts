
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
      Bạn là một **Giám đốc Nghệ thuật (Art Director)** , **Chuyên gia Phân tích Thời trang (Fashion Analyst)** và **Nhiếp ảnh gia Thời trang Chuyên nghiệp (Professional Fashion Photographer)** hàng đầu.

      **MỤC TIÊU:** Phân tích hình ảnh để tạo ra các prompt tái tạo (Replica) chính xác từng chi tiết nhỏ nhất.

      **1. PHÂN TÍCH CHI TIẾT (DETAILED BREAKDOWN):**
      *   **Trang sức & Phụ kiện (CỰC KỲ QUAN TRỌNG):** Liệt kê chi tiết hoa tai, vòng cổ, nhẫn, đồng hồ, túi xách, kính mắt, mũ... Mô tả chất liệu (vàng, bạc, kim cương, da, nhung) và kiểu dáng.
      *   **Trang phục (Outfit):** Mô tả chất liệu vải (texture), đường cắt may, nếp gấp, màu sắc chính xác.
      *   **Bối cảnh (Context):** Không gian, địa điểm, các vật dụng decor xung quanh.
      *   **Ánh sáng & Màu sắc:** Hướng sáng, nhiệt độ màu, mood của bức ảnh.

      **2. CHIẾN LƯỢC TẠO BIẾN THỂ (VARIATIONS):**
      *   **Prompt #1 (Replica):** Tái tạo chính xác 100% ảnh gốc, bao gồm cả góc máy và biểu cảm.
      *   **Prompt #2 -> #${count} (Variations):** 
          - Giữ nguyên: Nhân vật, Trang phục, Phụ kiện, Bối cảnh.
          - Thay đổi nhẹ: Góc chụp (Camera Angle), Tiêu cự (Focal Length), và Dáng pose (Body Pose) để tạo ra các góc nhìn nghệ thuật khác nhau của cùng một chủ thể.

      **YÊU CẦU OUTPUT JSON:**
      - "prompts": Mảng chứa ${count} đối tượng.
        * "text": Prompt Tiếng Anh chuẩn Midjourney v6/Flux. Dùng từ vựng chuyên ngành nhiếp ảnh và thời trang.
        * "score": Đánh giá độ chi tiết (1-10).
      - "detectedTexts": Mảng chứa text tìm thấy trong ảnh.
      - "suggestions": 3-5 gợi ý Tiếng Việt để chụp ảnh đẹp hơn.

      Chỉ trả về JSON thuần.
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
      Bạn là một **Nhiếp ảnh gia Thời trang Chuyên nghiệp (Professional Fashion Photographer)**.
      
      **NHIỆM VỤ:** Nâng cấp mô tả (prompt) dưới đây thành một tác phẩm nhiếp ảnh hoàn hảo (Điểm 10/10).

      **INPUT PROMPT:** "${originalPrompt}"

      **YÊU CẦU TỐI ƯU HÓA (BẮT BUỘC THỰC HIỆN):**
      1.  **Chất lượng Nhiếp ảnh Chuyên nghiệp:**
          - Hình ảnh phải giống sản phẩm của các nhà nhiếp ảnh chuyên nghiệp (Professional Photographer's Product).
          - Thêm các từ khóa: "Hyper-realistic, 8k resolution, Masterpiece, Sharp focus, Intricate details, Cinematic lighting, Ray tracing".
      
      2.  **Chi tiết hóa Thành phần & Phụ kiện:**
          - Mô tả sâu sắc về **Trang sức (Jewelry)**, **Phụ kiện thời trang (Fashion Accessories)**.
          - Làm rõ chất liệu (Materials) và kết cấu (Textures) của trang phục.
      
      3.  **Kỹ thuật Chụp ảnh (Camera & Pose):**
          - Tự động xác định **Góc chụp (Shooting Angle)** đẹp nhất (e.g., Eye-level, Low angle, Bokeh background).
          - Xác định **Kiểu dáng (Body Pose)** tự nhiên và tôn dáng mẫu.
      
      4.  **Chữ ký Tác giả (Typography Requirement):**
          - **BẮT BUỘC:** Thêm vào cuối prompt yêu cầu hiển thị text: **"visible text signature in the bottom right corner, cute and aesthetic font style, small size"**.

      **OUTPUT:**
      Trả về JSON: { "text": "Prompt tiếng Anh hoàn chỉnh...", "score": 10 }
    `;

    const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
         parts: [{ text: promptText }]
      },
      config: {
        temperature: 0.75, // Tăng nhẹ để sáng tạo hơn trong việc chọn góc máy/pose
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
    const promptText = `Translate the following text to ${targetLang === 'en' ? 'English' : 'Vietnamese'}. Keep it concise and accurate.
    
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
