import { GoogleGenAI, GenerateContentResponse, Type, FunctionDeclaration } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface MapResult {
  uri: string;
  title: string;
}

export interface ChatMessage {
  role: "user" | "model";
  text: string;
  mapResults?: MapResult[];
}

const listGithubReposTool: FunctionDeclaration = {
  name: "list_github_repositories",
  description: "List the user's GitHub repositories. Use this when the user asks to see their repos or projects on GitHub.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

export async function chatWithMaps(
  message: string,
  location?: { latitude: number; longitude: number }
): Promise<{ response: GenerateContentResponse; chatMessage: ChatMessage }> {
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: message,
      config: {
        tools: [
          { googleMaps: {} }, 
          { googleSearch: {} },
          { functionDeclarations: [listGithubReposTool] }
        ],
        toolConfig: {
          retrievalConfig: location ? {
            latLng: {
              latitude: location.latitude,
              longitude: location.longitude,
            },
          } : undefined,
        },
      },
    });

    const text = response.text || "";
    
    // Extract map results from grounding chunks
    const mapResults: MapResult[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    
    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.maps) {
          mapResults.push({
            uri: chunk.maps.uri,
            title: chunk.maps.title || "View on Google Maps",
          });
        }
      });
    }

    return {
      response,
      chatMessage: {
        role: "model",
        text,
        mapResults: mapResults.length > 0 ? mapResults : undefined,
      }
    };
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return {
      response: {} as any,
      chatMessage: {
        role: "model",
        text: "I encountered an error while trying to find that information. Please try again.",
      }
    };
  }
}
