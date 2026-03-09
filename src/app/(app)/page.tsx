'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Region } from '@/types';

const REGIONS: { value: Region; label: string; flag: string }[] = [
  { value: 'UA', label: 'Україна', flag: '🇺🇦' },
  { value: 'CIS', label: 'CIS', flag: '💲' },
  { value: 'Euro', label: 'Європа', flag: '🇪🇺' },
  { value: 'World', label: 'Світ', flag: '💲' },
  { value: 'KZ', label: 'Казахстан', flag: '🇰🇿' },
  { value: 'PL', label: 'Польща', flag: '🇵🇱' },
];

export default function HomePage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    restaurantName: '',
    region: 'UA' as Region,
    venues: 1,
    months: 1,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const params = new URLSearchParams({
      name: formData.restaurantName,
      venues: formData.venues.toString(),
      months: formData.months.toString(),
    });
    
    router.push(`/calc/${formData.region}?${params}`);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-xl"> {/* max-w-2xl → max-w-xl */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Калькулятор комерційних пропозицій</h1>
        </div>
        
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-2xl mx-auto">
          <h2 className="text-xl font-semibold mb-6">Дані клієнта</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Назва закладу
              </label>
              <input
                type="text"
                value={formData.restaurantName}
                onChange={(e) => setFormData({ ...formData, restaurantName: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:border-[#0066CC] transition-colors"
                placeholder="Ресторан 'Смак'"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Регіон
              </label>
              <select
                value={formData.region}
                onChange={(e) => setFormData({ ...formData, region: e.target.value as Region })}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:border-[#0066CC] transition-colors"
              >
                {REGIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.flag} {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Кількість закладів: {formData.venues}
              </label>
              <div className="flex items-center gap-4">
                <input
                type="range"
                min="1"
                max="4"
                value={formData.venues}
                onChange={(e) => setFormData({ ...formData, venues: Number(e.target.value) })}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#0066CC]"
              />
  <span className="text-lg font-semibold text-[#0066CC] w-8">{formData.venues}</span>
</div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>1</span>
                <span>2</span>
                <span>3</span>
                <span>4</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Кількість місяців
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[1, 3, 6, 12].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setFormData({ ...formData, months: m })}
                    className={`py-2 px-4 rounded-full font-medium transition-colors ${
                      formData.months === m
                        ? 'bg-[#0066CC] text-white'
                        : 'border border-gray-300 text-gray-700 hover:border-gray-400 bg-white'
                    }`}
                  >
                    {m} {m === 1 ? 'міс' : 'міс'}
                    {formData.months === m && <span className="ml-1">✓</span>}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-[#F29C1E] text-white py-3 rounded-xl hover:bg-[#E08C0E] transition-colors font-semibold flex items-center justify-center gap-2"
            >
              Перейти до калькулятора
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}