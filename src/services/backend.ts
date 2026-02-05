 import { PlanType, User, Job, Style } from '../types';
 import { PACKAGES, STYLES } from '../lib/constants';
 import { createLogger } from '../utils/logger';
 
 const log = createLogger('BackendService');
 
 const STORAGE_KEYS = {
   USER: 'ai_studio_user_data',
   JOBS: 'ai_studio_jobs_data'
 };
 
 const ACCESS_CODES: Record<string, PlanType> = {
   'CODE-START-777': PlanType.START,
   'CODE-PREM-888': PlanType.PREMIUM,
   'CODE-VIP-999': PlanType.VIP,
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
     log.debug('getTgUserId', { userId });
     return userId;
   }
 
   getUser(): User {
     const userId = this.getTgUserId();
     const stored = localStorage.getItem(`${STORAGE_KEYS.USER}_${userId}`);
     if (stored) {
       const user = JSON.parse(stored);
       log.debug('User loaded', { userId, plan: user.plan, credits: user.remainingCredits });
       return user;
     }
 
     const newUser: User = {
       id: userId,
       plan: PlanType.FREE,
       remainingCredits: 0,
       allowedStylesCount: 0,
       history: []
     };
     log.info('Created new user', { userId });
     this.saveUser(newUser);
     return newUser;
   }
 
   private saveUser(user: User) {
     log.debug('Saving user', { userId: user.id, credits: user.remainingCredits });
     localStorage.setItem(`${STORAGE_KEYS.USER}_${user.id}`, JSON.stringify(user));
   }
 
   activateCode(code: string): { success: boolean; message: string } {
     const planType = ACCESS_CODES[code];
     if (!planType) {
       log.warn('Invalid access code', { code });
       return { success: false, message: 'Неверный код доступа' };
     }
     const user = this.getUser();
     const pkg = PACKAGES.find(p => p.id === planType)!;
     user.plan = planType;
     user.remainingCredits += pkg.credits;
     user.allowedStylesCount = pkg.stylesLimit;
     this.saveUser(user);
     log.info('Code activated', { code, plan: planType, newCredits: user.remainingCredits });
     return { success: true, message: `Пакет ${pkg.name} активирован!` };
   }
 
   async createJob(image: string, styleIds: string[], customPrompt?: string, intensity = 70, isFullBody = false): Promise<Job> {
     log.info('Creating job', { styleIds, intensity, isFullBody });
     const user = this.getUser();
     if (user.remainingCredits <= 0) {
       log.error('Insufficient credits', { userId: user.id });
       throw new Error('INSUFFICIENT_CREDITS');
     }
 
     localStorage.removeItem(STORAGE_KEYS.JOBS);
     const optimizedImage = await compressImage(image, 0.95);
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
     log.info('Job created', { jobId });
 
     this.processJob(jobId, intensity);
     return newJob;
   }
 
   async refineJob(baseImage: string, editPrompt: string): Promise<Job> {
     log.info('Creating refine job', { prompt: editPrompt.substring(0, 50) });
     const user = this.getUser();
     if (user.remainingCredits <= 0) throw new Error('INSUFFICIENT_CREDITS');
 
     localStorage.removeItem(STORAGE_KEYS.JOBS);
     const optimizedImage = await compressImage(baseImage, 0.95);
     const jobId = 'refine_' + Math.random().toString(36).substring(7);
     const isFullBodyRefinement = editPrompt.toLowerCase().includes('full-length');
 
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