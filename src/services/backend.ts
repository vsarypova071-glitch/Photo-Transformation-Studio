import { PlanType, User, Job } from '../types';
import { PACKAGES } from '../lib/constants';
import { createLogger } from '../utils/logger';
import { supabase } from '@/integrations/supabase/client';

const log = createLogger('BackendService');

const STORAGE_KEYS = {
  JOBS: 'ai_studio_jobs_data'
};

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
  private getTgUserId(): string {
    const tg = (window as any).Telegram?.WebApp;
    const userId = tg?.initDataUnsafe?.user?.id ? `tg_${tg.initDataUnsafe.user.id}` : 'guest_local_user';
    log.debug('getTgUserId', { hasUserId: !!userId });
    return userId;
  }

  async getUser(): Promise<User> {
    const userId = this.getTgUserId();
    
    try {
      const { data, error } = await supabase.functions.invoke('validate-code', {
        body: { action: 'get_user', userId }
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
      log.error('Failed to fetch user, using fallback', { error });
      // Fallback for offline/error scenarios
      return {
        id: userId,
        plan: PlanType.FREE,
        remainingCredits: 0,
        allowedStylesCount: 0,
        history: []
      };
    }
  }

  async activateCode(code: string): Promise<{ success: boolean; message: string }> {
    const userId = this.getTgUserId();
    
    try {
      const { data, error } = await supabase.functions.invoke('validate-code', {
        body: { action: 'activate_code', userId, code }
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
    const userId = this.getTgUserId();
    
    try {
      const { data, error } = await supabase.functions.invoke('validate-code', {
        body: { action: 'use_credit', userId }
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
    
    // Validate credits server-side
    const creditUsed = await this.useCredit();
    if (!creditUsed) {
      log.error('Insufficient credits');
      throw new Error('INSUFFICIENT_CREDITS');
    }

    localStorage.removeItem(STORAGE_KEYS.JOBS);
    const optimizedImage = await compressImage(image, 0.95);
    const jobId = Math.random().toString(36).substring(7);
    const userId = this.getTgUserId();
    
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
    
    // Validate credits server-side
    const creditUsed = await this.useCredit();
    if (!creditUsed) {
      throw new Error('INSUFFICIENT_CREDITS');
    }

    localStorage.removeItem(STORAGE_KEYS.JOBS);
    const optimizedImage = await compressImage(baseImage, 0.95);
    const jobId = 'refine_' + Math.random().toString(36).substring(7);
    const isFullBodyRefinement = editPrompt.toLowerCase().includes('full-length');
    const userId = this.getTgUserId();

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

    // Simulate processing (replace with actual AI call)
    setTimeout(() => {
      const finalJobs = this.getJobs();
      const finalIndex = finalJobs.findIndex(j => j.id === jobId);
      if (finalIndex !== -1) {
        // Mock result - in production this would be AI-generated
        finalJobs[finalIndex].results = [finalJobs[finalIndex].originalImage];
        finalJobs[finalIndex].status = 'done';
        this.saveJobs(finalJobs);
        log.info('Job completed', { jobId });
      }
    }, 3000);
  }

  getJobs(): Job[] {
    const stored = localStorage.getItem(STORAGE_KEYS.JOBS);
    return stored ? JSON.parse(stored) : [];
  }

  private saveJobs(jobs: Job[]) {
    localStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(jobs));
  }
}

export const backend = new BackendService();