import { Job } from '../types';
import { createLogger } from '../utils/logger';

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
  private getAnonymousUserId(): string {
    let id = sessionStorage.getItem('anon_user_id');
    if (!id) {
      id = 'anon_' + Math.random().toString(36).substring(2);
      sessionStorage.setItem('anon_user_id', id);
    }
    return id;
  }

  async createJob(image: string, styleIds: string[], customPrompt?: string, intensity = 70, isFullBody = false): Promise<Job> {
    log.info('Creating job', { styleIds, intensity, isFullBody });
    
    const userId = this.getAnonymousUserId();

    localStorage.removeItem(STORAGE_KEYS.JOBS);
    const optimizedImage = await compressImage(image, 0.95);

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
      originalDimensions: imageDimensions.width > 0 ? imageDimensions : undefined,
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
    
    const userId = this.getAnonymousUserId();

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

  // ⚠️ DEPRECATED — старый batch-путь отключён.
  //
  // Раньше processJob дёргал edge-функцию generate-photo с count=1 в рамках
  // legacy-пакетной модели (5/15/50 фото подряд после оплаты). Это
  // противоречит новой модели "кошелёк": одна генерация = одно нажатие
  // кнопки в StudioScreen → studio.generateOne() → edge-функция generate-one.
  //
  // Чтобы не сломать импорты в App.tsx (createJob/refineJob/getJobs всё ещё
  // вызываются из legacy-веток), оставляем публичный API нетронутым, но
  // processJob больше НИКУДА не ходит и НИЧЕГО не генерирует — просто
  // помечает job как error с пометкой deprecated.
  private async processJob(jobId: string, _intensity = 70, _isRefinement = false) {
    log.warn('processJob is deprecated — legacy batch generation disabled', { jobId });
    const jobs = this.getJobs();
    const jobIndex = jobs.findIndex(j => j.id === jobId);
    if (jobIndex === -1) return;

    jobs[jobIndex].status = 'error';
    this.saveJobs(jobs);
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
