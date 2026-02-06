import React from 'react';
interface Review {
  id: string;
  name: string;
  avatar: string;
  text: string;
  rating: number;
}
const REVIEWS: Review[] = [{
  id: '1',
  name: 'Анна М.',
  avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&h=100',
  text: 'Невероятное качество! Фото получились как из профессиональной студии 🔥',
  rating: 5
}, {
  id: '2',
  name: 'Дмитрий К.',
  avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&h=100',
  text: 'Использую для Instagram — подписчики думают, что я на реальной съёмке!',
  rating: 5
}, {
  id: '3',
  name: 'Елена С.',
  avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=100&h=100',
  text: 'Очень быстро и удобно. Стили просто шикарные, особенно футуристичные!',
  rating: 5
}];
export default function ReviewsSection() {
  return <section className="w-full mt-10 mb-6">
      <h3 className="text-center mb-4 font-serif text-2xl font-bold text-slate-200">Отзывы клиентов</h3>
      
      <div className="overflow-x-auto scrollbar-hide -mx-6 px-6">
        <div className="flex gap-3 pb-2" style={{
        width: 'max-content'
      }}>
          {REVIEWS.map(review => <div key={review.id} className="w-[280px] bg-card border border-border rounded-2xl p-4 flex-shrink-0">
              {/* Header */}
              <div className="flex items-center gap-3 mb-3">
                <img src={review.avatar} alt={review.name} className="w-10 h-10 rounded-full object-cover" />
                <div>
                  <div className="font-semibold text-sm">{review.name}</div>
                  <div className="flex gap-0.5">
                    {Array.from({
                  length: review.rating
                }).map((_, i) => <svg key={i} className="w-3.5 h-3.5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>)}
                  </div>
                </div>
              </div>
              
              {/* Text */}
              <p className="text-sm leading-relaxed text-slate-100">
                "{review.text}"
              </p>
            </div>)}
        </div>
      </div>
    </section>;
}