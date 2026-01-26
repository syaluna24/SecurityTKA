
import { GoogleGenAI, Type } from "@google/genai";

// Use process.env.API_KEY directly as per SDK guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeIncident = async (description: string) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analisis kejadian berikut di perumahan dan berikan saran langkah keamanan (dalam Bahasa Indonesia). Kejadian: ${description}`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            severity: { type: Type.STRING, description: 'LOW, MEDIUM, or HIGH' },
            actionPlan: { type: Type.ARRAY, items: { type: Type.STRING } },
            recommendation: { type: Type.STRING }
          },
          required: ['severity', 'actionPlan', 'recommendation']
        }
      }
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return null;
  }
};

export const getSecurityBriefing = async (shift: string) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Berikan 3 poin briefing singkat dan profesional untuk satpam perumahan yang bertugas shift ${shift}. Fokus pada kewaspadaan dan pelayanan warga.`,
    });
    return response.text;
  } catch (error) {
    return "Tetap waspada dan layani warga dengan ramah.";
  }
};

export const generateWeeklySummary = async (data: { 
  totalPatrols: number, 
  totalIncidents: number, 
  highSeverityIncidents: number,
  averageOccupancy: number 
}) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Buat ringkasan eksekutif profesional untuk laporan keamanan mingguan perumahan TKA berdasarkan data berikut:
      - Total Patroli: ${data.totalPatrols}
      - Total Insiden: ${data.totalIncidents}
      - Insiden Berat (High Severity): ${data.highSeverityIncidents}
      - Rata-rata Hunian Warga: ${data.averageOccupancy}%
      
      Gunakan nada yang menenangkan namun tetap waspada. Berikan saran strategis untuk minggu depan.`,
    });
    return response.text;
  } catch (error) {
    return "Laporan mingguan menunjukkan aktivitas keamanan berjalan normal dengan pengawasan rutin di seluruh area perumahan.";
  }
};
