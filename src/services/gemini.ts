import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Gemini API
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_API_KEY || '');

// Get the model
const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export class GeminiService {
  private chat;
  private history: ChatMessage[] = [];

  constructor() {
    this.chat = model.startChat({
      history: [],
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
      },
    });
  }

  async sendMessage(message: string): Promise<string> {
    try {
      // Add user message to history
      this.history.push({ role: 'user', content: message });

      // Get response from Gemini
      const result = await this.chat.sendMessage(message);
      const response = await result.response;
      const text = response.text();

      // Add assistant response to history
      this.history.push({ role: 'assistant', content: text });

      return text;
    } catch (error) {
      console.error('Error sending message to Gemini:', error);
      throw error;
    }
  }

  getHistory(): ChatMessage[] {
    return this.history;
  }

  clearHistory(): void {
    this.history = [];
    this.chat = model.startChat({
      history: [],
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
      },
    });
  }
} 