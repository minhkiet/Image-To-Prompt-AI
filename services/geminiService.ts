import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from "../types";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key chưa được cấu hình.");
  }
  return new GoogleGenAI({ apiKey });
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
      Đóng vai một chuyên gia hàng đầu về Reverse Prompt Engineering và Giám đốc sáng tạo thời trang (Fashion Creative Director). Nhiệm vụ của bạn là giải mã hình ảnh này và tạo ra ${count} prompt(s).

      Hãy phân tích cực kỳ chi tiết các yếu tố sau để đảm bảo độ bám sát cao nhất:
      1.  **Thần thái (Charisma & Aura):** Mô tả kỹ ánh mắt, biểu cảm, độ "lạnh" hay "ấm" của gương mặt, phong thái (sang trọng, ngầu, dịu dàng, high-fashion...).
      2.  **Thời trang (Fashion Style):** Phân tích chi tiết trang phục, chất liệu vải (lụa, da, denim, ren...), kiểu dáng, đường cắt may.
      3.  **Chi tiết Ngoại hình (Precise Details):** 
          - **Kiểu tóc (Hairstyle):** Bắt buộc mô tả chính xác độ dài, màu sắc, cách tạo kiểu, kết cấu tóc (xoăn, thẳng, vuốt ngược, rối nhẹ...).
          - **Phụ kiện (Accessories):** Liệt kê đầy đủ trang sức (khuyên tai, vòng cổ, nhẫn), kính, mũ, thắt lưng...
      4.  **Chất màu & Kỹ thuật (Color Tone & Tech):** Màu phim, độ hạt (grain), độ bão hòa, tương phản, và cách đánh sáng (Rembrandt, Butterfly, Neon, Softbox...).

      Yêu cầu Output JSON:
      - "prompts": Một mảng chứa đúng ${count} chuỗi văn bản (strings).
        *   **Prompt Index 0 (Bản sao hoàn hảo):** Mục tiêu là tái tạo ảnh gốc chính xác nhất có thể.
            - Bắt đầu bằng: "Professional fashion photography of..."
            - Nội dung: Mô tả chính xác khuôn mặt (facial features), **giữ nguyên hoàn toàn kiểu tóc (exact hairstyle)**, trang phục, trang sức và thần thái. Mô tả kỹ chất màu (color grading) và ánh sáng để ra đúng "vibe" của ảnh gốc.
        *   **Prompt Index 1 trở đi (Biến thể Lookbook):** Tạo các góc chụp khác nhau cho cùng một concept.
            - **BẮT BUỘC GIỮ NGUYÊN:** Khuôn mặt (Identity), **Kiểu tóc**, **Trang phục/Phụ kiện** và **Chất màu** (Color Palette) của ảnh gốc.
            - **THAY ĐỔI:** Góc máy (Camera Angle - Low angle, High angle, Close-up), Tiêu cự (Focal length), và Tư thế (Pose) để tạo ra một bộ ảnh thời trang đa dạng nhưng đồng nhất về concept.
      - "suggestions": Danh sách 3-5 gợi ý kỹ thuật cụ thể bằng TIẾNG VIỆT để nâng tầm bức ảnh này (ví dụ: gợi ý về bố cục, cách phối màu, hoặc lighting setup tốt hơn).

      Đảm bảo JSON hợp lệ.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [imagePart, { text: promptText }]
      },
      config: {
        temperature: 0.4, // Giảm temperature để tăng độ chính xác chi tiết
        topK: 32,
        topP: 0.9,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            prompts: {
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
    });

    const text = response.text;
    if (!text) {
      throw new Error("Không nhận được phản hồi từ AI.");
    }

    return JSON.parse(text) as AnalysisResult;
  } catch (error: any) {
    console.error("Lỗi khi gọi Gemini API:", error);
    throw new Error(error.message || "Đã xảy ra lỗi khi phân tích hình ảnh.");
  }
};