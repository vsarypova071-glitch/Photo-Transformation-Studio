import { PlanType, User, Job } from '../types';
import { createLogger } from '../utils/logger';
import { supabase } from '@/integrations/supabase/client';

const log = createLogger('BackendService');

const STORAGE_KEYS = {
  JOBS: 'ai_studio_jobs_data'
};

// Use sessionStorage for sensitive image data (auto-clears on tab close)
const useSessionStorage = true;

async function compressImage(base64Str: string, quality = 0.9): Promise<string> {
  log.info('Compressing image', { quality, originalSize: base64Str.length });
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
      const result = canvas.toDataURL('image/jpeg', quality);
      log.info('Image compressed', { newSize: result.length });
      resolve(result);
    };
    img.onerror = () => resolve(base64Str);
  });
}

class BackendService {
  private async getAuthUserId(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id ?? null;
  }

  async getUser(): Promise<User> {
    const userId = await this.getAuthUserId();
    
    if (!userId) {
      log.warn('No authenticated user');
      throw new Error('NOT_AUTHENTICATED');
    }
    
    try {
      const { data, error } = await supabase.functions.invoke('validate-code', {
        body: { action: 'get_user' }
      });
      
      if (error) {
        log.error('Error fetching user from server', { error });
        throw error;
      }
      
      if (data?.success && data?.user) {
        const serverUser = data.user;
        const user: User = {
          id: serverUser.user_id,
          plan: serverUser.plan as PlanType,
          remainingCredits: serverUser.remaining_credits,
          allowedStylesCount: serverUser.allowed_styles_count,
          history: []
        };
        log.debug('User loaded from server', { plan: user.plan, credits: user.remainingCredits });
        return user;
      }
      
      throw new Error('Failed to get user data');
    } catch (error) {
      log.error('Failed to fetch user', { error });
      throw error;
    }
  }

  async activateCode(code: string): Promise<{ success: boolean; message: string }> {
    const userId = await this.getAuthUserId();
    
    if (!userId) {
      return { success: false, message: 'Требуется авторизация' };
    }
    
    try {
      const { data, error } = await supabase.functions.invoke('validate-code', {
        body: { action: 'activate_code', code }
      });
      
      if (error) {
        log.error('Error activating code', { error });
        return { success: false, message: 'Ошибка сервера' };
      }
      
      log.info('Code activation result', { success: data?.success });
      return {
        success: data?.success || false,
        message: data?.message || 'Неизвестная ошибка'
      };
    } catch (error) {
      log.error('Failed to activate code', { error });
      return { success: false, message: 'Ошибка соединения' };
    }
  }

  private async useCredit(): Promise<boolean> {
    const userId = await this.getAuthUserId();
    
    if (!userId) {
      log.error('No authenticated user for credit use');
      return false;
    }
    
    try {
      const { data, error } = await supabase.functions.invoke('validate-code', {
        body: { action: 'use_credit' }
      });
      
      if (error) {
        log.error('Error using credit', { error });
        return false;
      }
      
      return data?.success || false;
    } catch (error) {
      log.error('Failed to use credit', { error });
      return false;
    }
  }

  async createJob(image: string, styleIds: string[], customPrompt?: string, intensity = 70, isFullBody = false): Promise<Job> {
    log.info('Creating job', { styleIds, intensity, isFullBody });
    
    const userId = await this.getAuthUserId();
    if (!userId) {
      throw new Error('NOT_AUTHENTICATED');
    }
    
    // Validate credits server-side
    const creditUsed = await this.useCredit();
    if (!creditUsed) {
      log.error('Insufficient credits');
      throw new Error('INSUFFICIENT_CREDITS');
    }

    localStorage.removeItem(STORAGE_KEYS.JOBS);
    const optimizedImage = await compressImage(image, 0.95);

    // Measure original image dimensions to preserve aspect ratio
    const imageDimensions = await new Promise<{ width: number; height: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({ width: 0, height: 0 });
      img.src = image;
    });

    const jobId = Math.random().toString(36).substring(7);
    
    const newJob: Job = {
      id: jobId,
      userId: userId,
      status: 'queued',
      styleIds,
      isFullBody,
      customPrompt,
      originalImage: optimizedImage,
      results: [],
      createdAt: Date.now()
    };

    this.saveJobs([newJob]);
    log.info('Job created', { jobId });

    this.processJob(jobId, intensity);
    return newJob;
  }

  async refineJob(baseImage: string, editPrompt: string): Promise<Job> {
    log.info('Creating refine job');
    
    const userId = await this.getAuthUserId();
    if (!userId) {
      throw new Error('NOT_AUTHENTICATED');
    }
    
    // Validate credits server-side
    const creditUsed = await this.useCredit();
    if (!creditUsed) {
      throw new Error('INSUFFICIENT_CREDITS');
    }

    localStorage.removeItem(STORAGE_KEYS.JOBS);
    const optimizedImage = await compressImage(baseImage, 0.95);
    const jobId = 'refine_' + Math.random().toString(36).substring(7);
    const isFullBodyRefinement = editPrompt.toLowerCase().includes('full-length');

    const newJob: Job = {
      id: jobId,
      userId: userId,
      status: 'queued',
      styleIds: [],
      isFullBody: isFullBodyRefinement,
      customPrompt: editPrompt,
      originalImage: optimizedImage,
      results: [],
      createdAt: Date.now()
    };

    this.saveJobs([newJob]);
    log.info('Refine job created', { jobId });

    this.processJob(jobId, 70, true);
    return newJob;
  }

  private async processJob(jobId: string, intensity = 70, isRefinement = false) {
    log.info('Processing job', { jobId, isRefinement });
    const jobs = this.getJobs();
    const jobIndex = jobs.findIndex(j => j.id === jobId);
    if (jobIndex === -1) return;

    jobs[jobIndex].status = 'running';
    this.saveJobs(jobs);

    try {
      const job = jobs[jobIndex];
      
      // Build style prompt from selected style IDs
      const { STYLES } = await import('../lib/constants');
      const selectedStylePrompts = job.styleIds
        .map(id => STYLES.find(s => s.id === id)?.prompt)
        .filter(Boolean)
        .join('\n');
      
      const stylePrompt = selectedStylePrompts || 'Luxury fashion portrait photography';

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 300 sec

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-photo`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            imageBase64: job.originalImage,
            stylePrompt,
            isPremium: false,
            customPrompt: job.customPrompt || '',
          }),
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      const data = await response.json();
      const error = !response.ok ? data?.error : null;

      const finalJobs = this.getJobs();
      const finalIndex = finalJobs.findIndex(j => j.id === jobId);
      if (finalIndex === -1) return;

      if (error || !data?.imageUrl) {
        log.error('AI generation failed', { error, data });
        finalJobs[finalIndex].status = 'error';
        this.saveJobs(finalJobs);
        return;
      }

      finalJobs[finalIndex].results = [data.imageUrl];
      finalJobs[finalIndex].status = 'done';
      this.saveJobs(finalJobs);
      log.info('Job completed with AI generation', { jobId });
    } catch (err) {
      log.error('processJob error', err);
      const finalJobs = this.getJobs();
      const finalIndex = finalJobs.findIndex(j => j.id === jobId);
      if (finalIndex !== -1) {
        finalJobs[finalIndex].status = 'error';
        this.saveJobs(finalJobs);
      }
    }
  }

  getJobs(): Job[] {
    // Try sessionStorage first (more secure), fall back to localStorage
    const storage = useSessionStorage ? sessionStorage : localStorage;
    const stored = storage.getItem(STORAGE_KEYS.JOBS);
    return stored ? JSON.parse(stored) : [];
  }

  private saveJobs(jobs: Job[]) {
    // Use sessionStorage for sensitive image data (auto-clears on tab close)
    const storage = useSessionStorage ? sessionStorage : localStorage;
    storage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(jobs));
    
    // Also clear any old localStorage data if we're using sessionStorage
    if (useSessionStorage) {
      localStorage.removeItem(STORAGE_KEYS.JOBS);
    }
  }
  
  // Clean up old jobs (called periodically or on logout)
  clearJobData() {
    sessionStorage.removeItem(STORAGE_KEYS.JOBS);
    localStorage.removeItem(STORAGE_KEYS.JOBS);
    log.info('Job data cleared');
  }
}

export const backend = new BackendService();
