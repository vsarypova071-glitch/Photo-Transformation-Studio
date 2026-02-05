
 import { backend } from './backendApi';
 import { STYLES } from './constants';
 import { PlanType, StyleCategory } from './types';
 import { createLogger } from './src/utils/logger';
 
 const log = createLogger('MainApp');

/**
 * APPLICATION STATE
 */
const AppState = {
    user: backend.getUser(),
    activeScreen: 'welcome',
    uploadedImage: '',
    selectedStyles: [] as string[],
    activeCategory: 'realistic' as StyleCategory,
    intensity: 70,
    isFullBody: false,
    currentJobId: null as string | null
};

/**
 * CORE NAVIGATION
 */
function navigateTo(screenId: string) {
    const screens = document.querySelectorAll('.screen');
    screens.forEach(s => s.classList.remove('active'));
    
    const target = document.getElementById(`screen-${screenId}`);
    if (target) target.classList.add('active');
    
    AppState.activeScreen = screenId;
    
    const header = document.getElementById('main-header');
    if (screenId === 'welcome') header?.classList.add('hidden');
    else header?.classList.remove('hidden');

    // Lifecycle triggers
    if (screenId === 'styles') renderStyleSelection();
    if (screenId === 'results') renderResults();
    
    window.scrollTo(0, 0);
}

/**
 * UI UPDATERS
 */
function syncUserUI() {
    AppState.user = backend.getUser();
    const planText = document.getElementById('header-plan-text');
    const profPlan = document.getElementById('prof-plan-name');
    const profCredits = document.getElementById('prof-credits-count');
    
    if (planText) planText.textContent = `${AppState.user.plan} • ${AppState.user.remainingCredits}`;
    if (profPlan) profPlan.textContent = AppState.user.plan;
    if (profCredits) profCredits.textContent = AppState.user.remainingCredits.toString();
}

function renderStyleSelection() {
    const catList = document.getElementById('style-cat-list');
    const gridList = document.getElementById('style-grid-list');
    if (!catList || !gridList) return;

    // Render Categories
    const categories: {id: StyleCategory, label: string}[] = [
        { id: 'realistic', label: 'РЕАЛИЗМ' },
        { id: 'wild', label: 'СИЛА' },
        { id: 'futuristic', label: 'ФУТУРИЗМ' }
    ];

    catList.innerHTML = categories.map(cat => `
        <button class="style-cat-btn px-5 py-3 rounded-full text-[10px] font-black border transition-all flex-shrink-0 snap-start ${AppState.activeCategory === cat.id ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-400'}" data-id="${cat.id}">
            ${cat.label}
        </button>
    `).join('');

    // Render Styles
    gridList.innerHTML = STYLES.filter(s => s.category === AppState.activeCategory).map(style => `
        <div class="style-card-item relative rounded-[2rem] overflow-hidden cursor-pointer border-4 transition-all active:scale-95 group ${AppState.selectedStyles.includes(style.id) ? 'border-blue-500 scale-[1.02]' : 'border-transparent'}" data-id="${style.id}">
            <img src="${style.previewUrl}" class="w-full aspect-[3/4] object-cover" loading="lazy" />
            <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80 group-hover:opacity-100 transition-opacity"></div>
            <p class="absolute bottom-4 left-4 text-[10px] font-black text-white uppercase">${style.name}</p>
            ${AppState.selectedStyles.includes(style.id) ? `
                <div class="absolute top-4 right-4 w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center border-2 border-white">
                    <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M5 13l4 4L19 7" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" /></svg>
                </div>
            ` : ''}
        </div>
    `).join('');

    // Events
    document.querySelectorAll('.style-cat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            AppState.activeCategory = btn.getAttribute('data-id') as StyleCategory;
            renderStyleSelection();
        });
    });

    document.querySelectorAll('.style-card-item').forEach(card => {
        card.addEventListener('click', () => {
            const sid = card.getAttribute('data-id')!;
            if (AppState.selectedStyles.includes(sid)) {
                AppState.selectedStyles = AppState.selectedStyles.filter(id => id !== sid);
            } else {
                AppState.selectedStyles = [sid]; // One style for now
            }
            renderStyleSelection();
            updateGenerateButton();
        });
    });
}

function updateGenerateButton() {
    const btn = document.getElementById('btn-do-generate') as HTMLButtonElement;
    const customVal = (document.getElementById('custom-prompt-input') as HTMLTextAreaElement).value.trim();
    if (btn) btn.disabled = AppState.selectedStyles.length === 0 && customVal === '';
}

function renderResults() {
    const job = backend.getJobs().find(j => j.id === AppState.currentJobId);
    if (!job || job.results.length === 0) return;

    const img = document.getElementById('final-result-img') as HTMLImageElement;
    const dl = document.getElementById('download-link-btn') as HTMLAnchorElement;
    const fbBtn = document.getElementById('btn-res-fullbody');

    img.src = job.results[0];
    dl.href = job.results[0];
    
    // Show "Make Full Body" only if current result is NOT full body
    if (fbBtn) fbBtn.classList.toggle('hidden', job.isFullBody === true);
}

/**
 * ACTIONS
 */
async function startJob() {
    if (AppState.user.remainingCredits <= 0) {
        alert("Недостаточно кредитов. Активируйте промокод в профиле.");
        return;
    }

    navigateTo('processing');
    const customPrompt = (document.getElementById('custom-prompt-input') as HTMLTextAreaElement).value;
    
    try {
        const job = await backend.createJob(
            AppState.uploadedImage,
            AppState.selectedStyles,
            customPrompt,
            AppState.intensity,
            AppState.isFullBody
        );
        AppState.currentJobId = job.id;
        pollJob(job.id);
    } catch (e) {
        alert("Ошибка старта. Проверьте соединение.");
        navigateTo('styles');
    }
}

function pollJob(jobId: string) {
    let secs = 0;
    const timer = setInterval(() => {
        secs++;
        const timerEl = document.getElementById('processing-timer');
        if (timerEl) timerEl.textContent = `${secs}s`;
        
        const statusEl = document.getElementById('processing-status-text');
        if (statusEl) {
            if (secs > 5) statusEl.textContent = "Масштабирование";
            if (secs > 12) statusEl.textContent = "Финальный рендеринг";
        }
    }, 1000);

    const interval = setInterval(() => {
        const current = backend.getJobs().find(j => j.id === jobId);
        if (current) {
            if (current.status === 'done') {
                clearInterval(interval);
                clearInterval(timer);
                syncUserUI();
                navigateTo('results');
            } else if (current.status === 'error') {
                clearInterval(interval);
                clearInterval(timer);
                alert("Ошибка генерации. Попробуйте другой стиль.");
                navigateTo('styles');
            }
        }
    }, 2000);
}

/**
 * INITIALIZATION
 */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Navigation
    document.getElementById('btn-welcome-start')?.addEventListener('click', () => navigateTo('upload'));
    document.getElementById('btn-styles-back')?.addEventListener('click', () => navigateTo('upload'));
    document.getElementById('btn-res-new')?.addEventListener('click', () => {
        AppState.uploadedImage = '';
        AppState.selectedStyles = [];
        navigateTo('upload');
    });
    document.getElementById('btn-res-styles')?.addEventListener('click', () => navigateTo('styles'));

    // 2. Upload
    const fileInput = document.getElementById('main-file-input') as HTMLInputElement;
    fileInput?.addEventListener('change', async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
            document.getElementById('upload-idle')?.classList.add('hidden');
            document.getElementById('upload-processing')?.classList.remove('hidden');
            
            const reader = new FileReader();
            reader.onload = (ev) => {
                AppState.uploadedImage = ev.target?.result as string;
                navigateTo('styles');
                // reset upload view for next time
                document.getElementById('upload-idle')?.classList.remove('hidden');
                document.getElementById('upload-processing')?.classList.add('hidden');
            };
            reader.readAsDataURL(file);
        }
    });

    // 3. Style Controls
    document.getElementById('full-body-toggle-row')?.addEventListener('click', () => {
        AppState.isFullBody = !AppState.isFullBody;
        const track = document.getElementById('fb-track');
        const dot = document.getElementById('fb-dot');
        track?.classList.toggle('bg-blue-600', AppState.isFullBody);
        track?.classList.toggle('bg-slate-700', !AppState.isFullBody);
        dot?.classList.toggle('left-7', AppState.isFullBody);
        dot?.classList.toggle('left-1', !AppState.isFullBody);
    });

    document.getElementById('intensity-input')?.addEventListener('input', (e) => {
        const val = (e.target as HTMLInputElement).value;
        AppState.intensity = parseInt(val);
        const display = document.getElementById('intensity-val-box');
        if (display) display.textContent = `${val}%`;
    });

    document.getElementById('custom-prompt-input')?.addEventListener('input', updateGenerateButton);
    document.getElementById('btn-do-generate')?.addEventListener('click', startJob);

    // 4. Results Actions
    document.getElementById('btn-res-magick')?.addEventListener('click', () => {
        document.getElementById('magick-edit-overlay')?.classList.toggle('hidden');
        document.getElementById('results-action-panel')?.classList.toggle('hidden');
    });

    document.getElementById('btn-refine-cancel')?.addEventListener('click', () => {
        document.getElementById('magick-edit-overlay')?.classList.add('hidden');
        document.getElementById('results-action-panel')?.classList.remove('hidden');
    });

    document.getElementById('btn-refine-go')?.addEventListener('click', async () => {
        const prompt = (document.getElementById('refine-prompt-input') as HTMLTextAreaElement).value;
        if (!prompt) return;
        
        const job = backend.getJobs().find(j => j.id === AppState.currentJobId);
        if (job && job.results[0]) {
            navigateTo('processing');
            try {
                const newJob = await backend.refineJob(job.results[0], prompt);
                AppState.currentJobId = newJob.id;
                pollJob(newJob.id);
            } catch (e) {
                alert("Ошибка.");
                navigateTo('results');
            }
        }
    });

    document.getElementById('btn-res-fullbody')?.addEventListener('click', async () => {
        const job = backend.getJobs().find(j => j.id === AppState.currentJobId);
        if (job && job.results[0]) {
            navigateTo('processing');
            try {
                const newJob = await backend.refineJob(
                    job.results[0], 
                    "Extend this specific portrait to a full-length standing shot, showing the person from head to toe including matching high-end shoes, maintaining exactly the same style and face."
                );
                AppState.currentJobId = newJob.id;
                pollJob(newJob.id);
            } catch (e) {
                alert("Ошибка.");
                navigateTo('results');
            }
        }
    });

    // 5. Profile & User
    document.getElementById('header-user-btn')?.addEventListener('click', () => {
        document.getElementById('overlay-profile')?.classList.remove('hidden');
        document.getElementById('overlay-profile')?.classList.add('flex');
    });

    document.getElementById('btn-profile-close')?.addEventListener('click', () => {
        document.getElementById('overlay-profile')?.classList.add('hidden');
        document.getElementById('overlay-profile')?.classList.remove('flex');
    });

    document.getElementById('btn-prof-vip')?.addEventListener('click', () => {
        backend.activateCode('CODE-VIP-999');
        syncUserUI();
        alert("VIP Активирован!");
    });

    // Final Sync
    syncUserUI();
});
