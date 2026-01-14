
import { GoogleGenAI, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getFunnyComment = async (score: number): Promise<string> => {
  try {
    // Determine tone based on score
    const tone = score > 30 ? "impressed but still sassy" : "extremely mocking and funny";
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `The player got a score of ${score} in 'Dodge the Poop'. 
      Provide a very short (max 10 words) commentary in Korean.
      Character: A funny, cocky, sassy Korean guy (깐죽거리는 남자).
      Tone: ${tone}. 
      If score is high, praise them in a backhanded way. If low, tease them hard.`,
      config: {
        thinkingConfig: { thinkingBudget: 0 }
      }
    });
    return response.text?.trim() || "으악! 똥 맞았대요~";
  } catch (error) {
    console.error("Gemini commentary failed", error);
    return "실력이 그것밖에 안 돼요?";
  }
};

export const playTtsComment = async (text: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            // 'Puck' is great for mischievous, 'Charon' or 'Fenrir' are also alternatives.
            // Sticking with 'Puck' as requested for that "mischievous guy" vibe.
            prebuiltVoiceConfig: { voiceName: 'Puck' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const audioData = decode(base64Audio);
      const audioBuffer = await decodeAudioData(audioData, audioCtx, 24000, 1);
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      source.start();
    }
  } catch (error) {
    console.error("TTS failed", error);
  }
};

// Utils for audio handling
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}
