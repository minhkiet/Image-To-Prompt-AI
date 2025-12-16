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
      Đóng vai một Giám đốc Nghệ thuật (Art Director) và Nhiếp ảnh gia Chân dung chuyên nghiệp (Professional Portrait Photographer) với 20 năm kinh nghiệm. Nhiệm vụ của bạn là giải mã hình ảnh để viết prompt tái tạo, tối ưu hóa cho **THẦN THÁI (Vibe)**, **DÁNG POSE (Posing)** và **GÓC MÁY (Composition)**.

      Hãy phân tích theo quy trình nhiếp ảnh chuyên sâu sau:

      **BƯỚC 1: CẤU TRÚC ẢNH (STRUCTURE)**
      - Xác định loại ảnh: Portrait, Full body, Macro, Landscape, hay Grid/Collage.
      - Nếu là Grid, bắt buộc prompt bắt đầu bằng: "A split screen...", "A photo collage...".

      **BƯỚC 2: PHẪU THUẬT THỜI TRANG & CHỦ THỂ (SUBJECT & FASHION)**
      - Mô tả chi tiết trang phục (Outfit), nếp gấp vải (Fabric folds/drape), chất liệu (Texture).
      - Mô tả đặc điểm khuôn mặt nhưng tập trung vào vẻ đẹp tự nhiên (Natural skin texture).

      **BƯỚC 3: DIỄN XUẤT ÁNH MẮT & DÁNG POSE (QUAN TRỌNG NHẤT)**
      - **Ánh mắt (The Gaze):** Đây là linh hồn bức ảnh. Mô tả chi tiết hướng nhìn, độ mở của mắt, ánh sáng phản chiếu trong mắt (catchlights). VD: "Intense gaze directly at viewer", "Dreamy look looking sideways", "Soft eyes with catchlights".
      - **Dáng Pose (Body Language):** Phân tích giải phẫu cơ thể. Mô tả tư thế tay (hand placement) sao cho tự nhiên, không bị cứng. Sử dụng các thuật ngữ như "Contrapposto" (dáng đứng chân trụ chân nghỉ), "Fluid pose", "Relaxed shoulders". Đảm bảo tỉ lệ cơ thể hài hòa.

      **BƯỚC 4: KỸ THUẬT NHIẾP ẢNH (CINEMATOGRAPHY)**
      - **Góc máy:** Low angle (quyền lực), High angle (vulnerable), Eye-level (personal), Dutch angle (dynamic).
      - **Bố cục:** Rule of thirds, Center frame, Leading lines.
      - **Ánh sáng:** Cinematic lighting, Volumetric lighting, Rembrandt, Butterfly lighting, Golden Hour.
      - **Thiết bị:** 85mm f/1.8 (chân dung xóa phông), 35mm (đời thường), Film grain (nếu có chất vintage).

      ---
      **YÊU CẦU OUTPUT JSON:**
      
      - "prompts": Mảng chứa ${count} chuỗi văn bản.
        *   **Prompt Index 0 (The Faithful Replica):** Tái tạo chính xác ảnh gốc.
            - Cấu trúc: "[Structure]. [Subject & Outfit]. [SPECIFIC POSE & EYE CONTACT]. [Environment]. [Lighting & Camera Details]."
        
        *   **Prompt Index 1 trở đi (Creative Variations - Đa dạng phong cách):**
            - Giữ nguyên: Nhân vật và Trang phục.
            - **THAY ĐỔI DÁNG (DYNAMIC POSING):** Đề xuất các tư thế khác nhau hoàn toàn để tạo bộ ảnh đa dạng.
              + VD: Đang đi dạo (Walking motion), Vuốt tóc (Hand passing through hair), Ngồi thư thái (Sitting casually), Nhìn qua vai (Looking over shoulder).
              + *Lưu ý:* Pose phải tự nhiên, tuân thủ giải phẫu học (anatomically correct).
            - **THAY ĐỔI GÓC NHÌN (FRESH PERSPECTIVES):**
              + Thử nghiệm góc cận cảnh (Extreme close-up) vào mắt hoặc môi.
              + Thử nghiệm góc rộng (Wide angle) để lấy bối cảnh hùng vĩ.
            - **QUALITY BOOSTERS:** Luôn kèm theo: *"Masterpiece, award-winning photography, highly detailed, 8k, natural skin texture, realistic anatomy".*

      - "suggestions": 3-5 gợi ý ngắn (Tiếng Việt) cho người chụp ảnh để có bức ảnh đẹp hơn (VD: "Nên hất cằm lên một chút để đón ánh sáng", "Thả lỏng vai để dáng tự nhiên hơn").

      Đảm bảo JSON hợp lệ. Không markdown.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [imagePart, { text: promptText }]
      },
      config: {
        temperature: 0.5, // Tăng nhẹ để phần biến thể sáng tạo hơn
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