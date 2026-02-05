
import { PlanType, User, Job, Style } from '../types';
import { PACKAGES, STYLES } from '../constants';
import { GoogleGenAI } from "@google/genai";

const STORAGE_KEYS = {
  USER: 'ai_studio_user_data',
  JOBS: 'ai_studio_jobs_data'
};

const ACCESS_CODES: Record<string, PlanType> = {
  'CODE-START-777': PlanType.START,
  'CODE-PREM-888': PlanType.PREMIUM,
  'CODE-VIP-999': PlanType.VIP,
};

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const errorMsg = error?.message || '';
      const isQuotaError = 
        error?.status === 429 || 
        errorMsg.includes('RESOURCE_EXHAUSTED');

      if (isQuotaError && i < maxRetries - 1) {
        const delay = Math.pow(2, i + 1) * 1000 + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

class BackendService {
  private getTgUserId(): string {
    const tg = (window as any).Telegram?.WebApp;
    return tg?.initDataUnsafe?.user?.id ? `tg_${tg.initDataUnsafe.user.id}` : 'guest_local_user';
  }

  private async compressImage(base64Str: string, quality = 0.9): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 1200; 
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
        } else {
          if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
        }
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(base64Str);
    });
  }

  getUser(): User {
    const userId = this.getTgUserId();
    const stored = localStorage.getItem(`${STORAGE_KEYS.USER}_${userId}`);
    if (stored) return JSON.parse(stored);

    const newUser: User = {
      id: userId,
      plan: PlanType.FREE,
      remainingCredits: 0,
      allowedStylesCount: 0,
      history: []
    };
    this.saveUser(newUser);
    return newUser;
  }

  private saveUser(user: User) {
    localStorage.setItem(`${STORAGE_KEYS.USER}_${user.id}`, JSON.stringify(user));
  }

  activateCode(code: string): { success: boolean; message: string } {
    const planType = ACCESS_CODES[code];
    if (!planType) return { success: false, message: 'Неверный код доступа' };
    const user = this.getUser();
    const pkg = PACKAGES.find(p => p.id === planType)!;
    user.plan = planType;
    user.remainingCredits += pkg.credits;
    user.allowedStylesCount = pkg.stylesLimit;
    this.saveUser(user);
    return { success: true, message: `Пакет ${pkg.name} активирован!` };
  }

  async createJob(image: string, styleIds: string[], customPrompt?: string, intensity = 70, isFullBody = false): Promise<Job> {
    const user = this.getUser();
    if (user.remainingCredits <= 0) throw new Error('INSUFFICIENT_CREDITS');

    localStorage.removeItem(STORAGE_KEYS.JOBS);
    const optimizedImage = await this.compressImage(image, 0.95);
    const jobId = Math.random().toString(36).substring(7);
    const newJob: Job = {
      id: jobId,
      userId: user.id,
      status: 'queued',
      styleIds,
      isFullBody,
      customPrompt,
      originalImage: optimizedImage,
      results: [],
      createdAt: Date.now()
    };

    this.saveJobs([newJob]);
    user.remainingCredits -= 1;
    this.saveUser(user);

    this.processJob(jobId, false, intensity).catch(console.error);
    return newJob;
  }

  async refineJob(baseImage: string, editPrompt: string): Promise<Job> {
    const user = this.getUser();
    if (user.remainingCredits <= 0) throw new Error('INSUFFICIENT_CREDITS');

    localStorage.removeItem(STORAGE_KEYS.JOBS);
    const optimizedImage = await this.compressImage(baseImage, 0.95);
    const jobId = 'refine_' + Math.random().toString(36).substring(7);
    
    const isFullBodyRefinement = editPrompt.toLowerCase().includes('full-length') || editPrompt.toLowerCase().includes('toe');

    const newJob: Job = {
      id: jobId,
      userId: user.id,
      status: 'queued',
      styleIds: [],
      isFullBody: isFullBodyRefinement,
      customPrompt: editPrompt,
      originalImage: optimizedImage,
      results: [],
      createdAt: Date.now()
    };

    this.saveJobs([newJob]);
    user.remainingCredits -= 1;
    this.saveUser(user);

    this.processJob(jobId, true).catch(console.error);
    return newJob;
  }

  private async processJob(jobId: string, isRefinement = false, intensity = 70) {
    const jobs = this.getJobs();
    const jobIndex = jobs.findIndex(j => j.id === jobId);
    if (jobIndex === -1) return;

    jobs[jobIndex].status = 'running';
    this.saveJobs(jobs);

    try {
      const job = jobs[jobIndex];
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      
      const negativePrompt = "distorted face, extra fingers, cartoonish, low resolution, blurry skin, fake eyes, inconsistent lighting, plastic look, double head, weird anatomy";
      const identityRules = `
        CORE IDENTITY LOCK:
        - The face must be EXACTLY as in the provided photo. Do not improve features.
        - Style Change Level: ${intensity}/100.
      `;

      const fullBodyInstruction = job.isFullBody ? `
        CAMERA VIEW: FULL BODY SHOT. 
        - Subject must be standing, visible from head to toe.
        - Show legs, outfit details and matching high-end shoes.
        - Wider framing to capture the entire silhouette.
      ` : "";

      let systemInstruction = '';

      if (isRefinement) {
        systemInstruction = `
          ROLE: ELITE PHOTO RETOUCHER. 
          TASK: ${job.customPrompt}.
          ${identityRules}
          ${fullBodyInstruction}
          NEGATIVE: ${negativePrompt}.
        `;
      } else {
        const selectedStyles = STYLES.filter(s => job.styleIds.includes(s.id));
        const stylePrompts = selectedStyles.map(s => s.prompt).join('. ');
        const isWild = selectedStyles.some(s => s.category === 'wild');

        systemInstruction = `
          ROLE: ${isWild ? 'CINEMATIC CONCEPT ARTIST' : 'ELITE FASHION PHOTOGRAPHER'}.
          GOAL: Transform the subject into the selected high-end style.
          ${identityRules}
          ${fullBodyInstruction}
          STYLE PROMPTS: ${stylePrompts}.
          USER WISH: ${job.customPrompt || 'No additional wishes'}.
          NEGATIVE: ${negativePrompt}.
        `;
      }

      const base64Data = job.originalImage.split(',')[1];
      
      const response = await withRetry(async () => {
        return await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
            parts: [
              { inlineData: { data: base64Data, mimeType: 'image/jpeg' } },
              { text: systemInstruction }
            ]
          },
          config: { imageConfig: { aspectRatio: job.isFullBody ? "9:16" : "3:4" } }
        });
      });

      const results: string[] = [];
      if (response.candidates && response.candidates[0].content.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            results.push(`data:image/png;base64,${part.inlineData.data}`);
          }
        }
      }

      if (results.length === 0) throw new Error("EMPTY_AI_RESPONSE");

      const finalJobs = this.getJobs();
      const finalIndex = finalJobs.findIndex(j => j.id === jobId);
      if (finalIndex !== -1) {
        finalJobs[finalIndex].results = results;
        finalJobs[finalIndex].status = 'done';
        this.saveJobs(finalJobs);
      }
    } catch (e: any) {
      console.error('Job failed:', e);
      const finalJobs = this.getJobs();
      const finalIndex = finalJobs.findIndex(j => j.id === jobId);
      if (finalIndex !== -1) {
        finalJobs[finalIndex].status = 'error';
        this.saveJobs(finalJobs);
        const user = this.getUser();
        user.remainingCredits += 1;
        this.saveUser(user);
      }
    }
  }

  getJobs(): Job[] {
    const stored = localStorage.getItem(STORAGE_KEYS.JOBS);
    return stored ? JSON.parse(stored) : [];
  }

  private saveJobs(jobs: Job[]) {
    localStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(jobs));
  }

  deleteJob(id: string) {
    const jobs = this.getJobs().filter(j => j.id !== id);
    this.saveJobs(jobs);
  }
}

export const backend = new BackendService();
