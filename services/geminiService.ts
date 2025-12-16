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
      Đóng vai một Giám đốc Nghệ thuật (Art Director) và Nhiếp ảnh gia Chân dung kỳ cựu (Senior Portrait Photographer). Nhiệm vụ của bạn là giải mã hình ảnh để viết prompt tái tạo, đặc biệt chú trọng vào **THẦN THÁI (Vibe)** và **DÁNG POSE (Body Language)**.

      Hãy phân tích theo quy trình chuyên sâu sau:

      **BƯỚC 1: CẤU TRÚC ẢNH (STRUCTURE)**
      - Xác định đây là ảnh đơn hay ảnh ghép (Grid/Collage).
      - Nếu là Grid, bắt buộc prompt bắt đầu bằng: "A split screen...", "A photo collage...", "A character sheet...".

      **BƯỚC 2: PHẪU THUẬT THỜI TRANG (FASHION)**
      - Mô tả trang phục (Outfit), Chất liệu (Fabric texture - rất quan trọng), và Phụ kiện.

      **BƯỚC 3: DIỄN XUẤT & GÓC MÁY (QUAN TRỌNG NHẤT - THE "PRO" TOUCH)**
      - **Ánh mắt (The Gaze):** Mô tả hướng nhìn và cảm xúc. VD: "Piercing eye contact with the camera" (nhìn xoáy vào ống kính), "Looking away with longing", "Smizing" (cười bằng mắt).
      - **Tư thế (The Pose):** Mô tả sự phân bổ trọng lượng cơ thể (Contrapposto), vị trí đặt tay (Natural hand placement). Đảm bảo tư thế trông thoải mái, không bị cứng (stiff).
      - **Góc máy (Camera Angle):** Low angle (tôn vinh chủ thể), High angle (gợi cảm giác nhỏ bé), Eye-level (chân thực), Dutch angle (năng động).
      - **Tiêu cự & Kỹ thuật:** Bokeh (xóa phông), Depth of field, Shutter speed (nếu có chuyển động).

      **BƯỚC 4: ÁNH SÁNG & MÔI TRƯỜNG (LIGHTING & ATMOSPHERE)**
      - Golden hour, Rembrandt lighting, Softbox studio light, Neon Noir, v.v.

      ---
      **YÊU CẦU OUTPUT JSON:**
      
      - "prompts": Mảng chứa ${count} chuỗi văn bản.
        *   **Prompt Index 0 (The Replica):** Tái tạo chính xác ảnh gốc. Cấu trúc: "[Structure keyword]. [Subject Description] wearing [Detailed Outfit]. [POSE & EYE CONTACT DESCRIPTION]. [Environment]. [Lighting & Camera settings]."
        
        *   **Prompt Index 1 trở đi (Professional Variations):**
            - Giữ nguyên Nhân vật và Trang phục.
            - **THAY ĐỔI DÁNG (RE-POSE):** Đề xuất các tư thế khác năng động hơn hoặc giàu cảm xúc hơn. Ví dụ: Nếu ảnh gốc đang đứng, hãy thử "Walking towards camera" hoặc "Sitting elegantly".
            - **THAY ĐỔI GÓC MÁY:** Thử nghiệm "Extreme close-up on eyes", "Wide angle shot from below".
            - **QUAN TRỌNG:** Luôn thêm các từ khóa chất lượng cao: *"Masterpiece, highly detailed skin texture, anatomically correct, natural features, professional color grading, 8k resolution".*

      - "suggestions": 3-5 gợi ý ngắn gọn (Tiếng Việt) về cách cải thiện bố cục hoặc tư thế (VD: "Thử góc chụp từ dưới lên để chân dài hơn", "Dùng từ khóa 'eye contact' để tăng tương tác").

      Đảm bảo JSON hợp lệ. Không markdown.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [imagePart, { text: promptText }]
      },
      config: {
        temperature: 0.4, // Tăng nhẹ để phần biến thể (variations) sáng tạo hơn về dáng pose
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