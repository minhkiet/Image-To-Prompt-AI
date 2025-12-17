import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from "../types";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key chưa được cấu hình trong hệ thống. Vui lòng kiểm tra biến môi trường.");
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
      Đóng vai một **Giám đốc Sáng tạo (Creative Director)** và **Nhiếp ảnh gia Thời trang Cao cấp (High-End Fashion Photographer)** của tạp chí Vogue/Harper's Bazaar. Nhiệm vụ của bạn là giải mã hình ảnh để viết prompt tái tạo với độ chính xác tuyệt đối, mang tính thẩm mỹ nghệ thuật cao.

      Hãy thực hiện quy trình phân tích "Lớp Phẫu Thuật Hình Ảnh" (Layered Visual Surgery) sau đây:

      **LỚP 1: THÔNG SỐ KỸ THUẬT & CHẤT MÀU (FILM LOOK & COLOR GRADING)**
      - **Camera & Lens:** Xác định tiêu cự (85mm portrait, 35mm street, 100mm macro). Độ sâu trường ảnh (Depth of field/Bokeh).
      - **Chất màu (Color Palette):** Phân tích tông màu chủ đạo. Có phải là màu phim (Kodak Portra 400, CineStill 800T)? Hay là tông màu kỹ thuật số sắc nét? (Desaturated, Vivid, Pastel, Dark Moody, Teal and Orange).
      - **Ánh sáng:** Studio Lighting (Softbox, Rembrandt), Natural Light (Golden Hour, Overcast), hay Neon Noir?

      **LỚP 2: PHẪU THUẬT THỜI TRANG & CHI TIẾT (LUXURY DETAILS)**
      - **Trang phục (Outfit):** Không chỉ gọi tên. Hãy mô tả **CHẤT LIỆU (Texture)**: Lụa satin bóng, nhung mịn (velvet), len dệt kim (knitted), da thuộc (leather), vải xuyên thấu (sheer). Mô tả cách vải rủ xuống cơ thể (draping).
      - **Phụ kiện & Trang sức (Jewelry & Accessories - RẤT QUAN TRỌNG):** "Zoom" vào chi tiết. Khuyên tai to bản (Statement earrings), vòng cổ nhiều lớp (Layered necklaces), nhẫn đính đá, gọng kính kim loại, túi xách có vân da cá sấu...
      - **Trang điểm (Makeup):** Dewy skin, Matte finish, Red bold lips, Graphic eyeliner.

      **LỚP 3: CHỦ THỂ & THẦN THÁI (SUBJECT & VIBE)**
      - **Đặc điểm:** Tóc (Kiểu dáng, màu sắc, texture), Màu da tự nhiên (Highly detailed skin texture).
      - **Posing & Eye Contact:** Ánh mắt là điểm nhấn. Dáng đứng/ngồi phải chuẩn thời trang (High fashion pose, Broken down poses, Fluid motion).

      ---
      **YÊU CẦU OUTPUT JSON:**
      
      - "prompts": Mảng chứa ${count} chuỗi văn bản Tiếng Anh.
        *   **Quy tắc chung cho mọi prompt:** Phải bắt đầu bằng các từ khóa định hình phong cách (VD: "Editorial photography, Shot on 35mm film..."). Kết thúc bằng các từ khóa chất lượng cao ("8k, masterpiece, ultra-detailed textures").
        
        *   **Prompt Index 0 (Bản sao hoàn hảo - The Replica):**
            - Mô tả chính xác 100% ảnh gốc từ góc máy, ánh sáng đến nếp gấp quần áo.
            - Cấu trúc: "[Medium/Film Stock]. [Subject Description + Makeup]. [DETAILED OUTFIT & JEWELRY]. [Specific Pose & Eye Contact]. [Background/Environment]. [Lighting & Color Grading]."
        
        *   **Prompt Index 1 trở đi (Biến thể Lookbook - Consistent Style):**
            - **QUAN TRỌNG:** Giữ nguyên 100% "Chất màu" (Lớp 1) và "Thời trang/Phụ kiện" (Lớp 2) để tạo sự đồng nhất (Consistency) cho bộ ảnh.
            - **THAY ĐỔI:** Chỉ thay đổi dáng Pose và Góc máy (Camera Angle).
            - Ví dụ biến thể:
                + "A close-up portrait shot focusing on the jewelry and eyes..." (Cận cảnh phụ kiện/mắt).
                + "Full body shot, subject walking towards camera, dynamic movement..." (Toàn thân, chuyển động).
                + "Side profile shot, looking at a light source..." (Góc nghiêng).

      - "suggestions": 3-5 gợi ý ngắn gọn (Tiếng Việt) mang tính chuyên môn cao (VD: "Sử dụng key light chếch 45 độ để làm nổi bật khối mặt", "Chú ý texture vải nhung để tăng cảm giác sang trọng").

      Đảm bảo JSON hợp lệ. Không markdown.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [imagePart, { text: promptText }]
      },
      config: {
        temperature: 0.45, // Giữ ở mức vừa phải để đảm bảo tính chính xác của chi tiết thời trang
        topK: 40,
        topP: 0.95,
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
      throw new Error("AI không trả về nội dung nào. Có thể ảnh quá phức tạp hoặc bị hệ thống lọc chặn.");
    }

    try {
      return JSON.parse(text) as AnalysisResult;
    } catch (e) {
      throw new Error("Lỗi định dạng dữ liệu từ AI. Vui lòng thử lại.");
    }

  } catch (error: any) {
    console.error("Lỗi khi gọi Gemini API:", error);
    
    const msg = error.message || "";
    
    if (msg.includes("API_KEY") || msg.includes("400")) {
      throw new Error("Khóa API không hợp lệ hoặc đã hết hạn. Vui lòng kiểm tra cấu hình.");
    }
    
    if (msg.includes("SAFETY") || msg.includes("blocked") || msg.includes("finishReason")) {
      throw new Error("Hình ảnh bị hệ thống an toàn chặn. Vui lòng thử ảnh khác ít nhạy cảm hơn.");
    }
    
    if (msg.includes("429") || msg.includes("Quota") || msg.includes("resource exhausted")) {
      throw new Error("Hệ thống đang quá tải hoặc hết hạn ngạch. Vui lòng đợi 1 phút và thử lại.");
    }
    
    if (msg.includes("500") || msg.includes("503") || msg.includes("Failed to fetch")) {
      throw new Error("Lỗi kết nối mạng hoặc máy chủ Google đang bảo trì.");
    }

    throw new Error(msg || "Đã xảy ra lỗi không xác định khi phân tích hình ảnh.");
  }
};