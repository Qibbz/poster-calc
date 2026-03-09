'use client';

import { useMemo, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { Region, PricingData, CalculationResult } from '@/types';

// Іконка стрілки для акордеону
const ChevronIcon = ({ isOpen }: { isOpen: boolean }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="20" 
    height="20" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    style={{ 
      transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
      transition: 'transform 0.2s ease'
    }}
  >
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
);

// Галочка для обраного тарифу
const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-[#F29C1E]">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

// Валюти для регіонів
const REGION_CURRENCY: Record<Region, string> = {
  UA: 'грн',
  CIS: '$',
  Euro: '€',
  World: '$',
  KZ: '₸',
  PL: 'zł',
};

interface AccordionSectionProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  badge?: number;
  isCollapsible?: boolean;
}

const AccordionSection = ({ 
  title, 
  isOpen, 
  onToggle, 
  children, 
  badge = 0,
  isCollapsible = true 
}: AccordionSectionProps) => {
  const actuallyOpen = isCollapsible ? isOpen : true;
  
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <button
        onClick={isCollapsible ? onToggle : undefined}
        className={`w-full p-5 flex items-center justify-between bg-white hover:bg-gray-50 transition-colors ${
          isCollapsible ? 'cursor-pointer' : 'cursor-default'
        }`}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">{title}</h2>
          {badge > 0 && (
            <span className="bg-[#F29C1E] text-white text-xs px-2 py-0.5 rounded-full font-medium">
              {badge}
            </span>
          )}
        </div>
        {isCollapsible && (
          <ChevronIcon isOpen={actuallyOpen} />
        )}
      </button>
      
      <div 
        className="overflow-hidden transition-all duration-200"
        style={{ 
          maxHeight: actuallyOpen ? '2000px' : '0',
          opacity: actuallyOpen ? 1 : 0
        }}
      >
        <div className="px-5 pb-5">
          {children}
        </div>
      </div>
    </div>
  );
};

export default function CalcClient({ region }: { region: Region }) {
  const router = useRouter();
  const sp = useSearchParams();

  const restaurantName = sp.get('name') ?? '';
  const venuesFromUrl = Number(sp.get('venues') ?? 1);
  const monthsFromUrl = Number(sp.get('months') ?? 1);

  const [venues, setVenues] = useState<number>(Number.isFinite(venuesFromUrl) ? venuesFromUrl : 1);
  const [months, setMonths] = useState<number>(Number.isFinite(monthsFromUrl) ? monthsFromUrl : 1);
  const [pricing, setPricing] = useState<PricingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  
  const [selectedTariff, setSelectedTariff] = useState<string>('business');
  const [selectedAddons, setSelectedAddons] = useState<Record<string, number>>({});
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<Record<string, number>>({});

  const [debugMode, setDebugMode] = useState(false);

  const [isExtrasOpen, setIsExtrasOpen] = useState(region !== 'UA');
  const [isEquipmentOpen, setIsEquipmentOpen] = useState(false);

  useEffect(() => {
    fetch('/api/pricing')
      .then(r => r.json())
      .then(data => {
        setPricing(data);
        setLoading(false);
      });
  }, []);

  const calculation: CalculationResult | null = useMemo(() => {
    if (!pricing) return null;

    const tariff = pricing.tariffs.find(t => t.id === selectedTariff);
    if (!tariff) return null;

    const isYearly = months === 12;
    const tariffPricePerMonth = isYearly 
      ? (tariff.yearlyPrices[region] || 0)
      : (tariff.prices[region] || 0);
    
    const tariffTotal = tariffPricePerMonth * venues * months;

    let terminalQty = 0;
    let mobileQty = 0;
    let addonsTotal = 0;
    const addonsDetails = [];
    
    for (const [addonId, qty] of Object.entries(selectedAddons)) {
      if (qty <= 0) continue;
      const addon = pricing.addons.find(a => a.id === addonId);
      if (!addon) continue;
      
      if (addonId === 'addon_terminal') terminalQty = qty;
      if (addonId === 'addon_mobile') mobileQty = qty;
      
      const basePrice = addon.prices[region] || 0;
      let addonTotal = 0;
      
      if (addon.type === 'boolean') {
        addonTotal = basePrice;
      } else if (addon.type === 'pl-report') {
        if (qty === 1) addonTotal = basePrice;
        else addonTotal = basePrice + (qty - 1) * (basePrice * 0.5);
      } else {
        addonTotal = basePrice * qty * months;
      }
      
      addonsTotal += addonTotal;
      
      addonsDetails.push({
        name: region === 'UA' ? addon.name_ua : addon.name_ru,
        price: basePrice,
        qty,
        total: addonTotal,
      });
    }

    let extrasTotal = 0;
    const extrasDetails = [];
    
    for (const extraId of selectedExtras) {
      const extra = pricing.extras.find(e => e.id === extraId);
      if (!extra) continue;
      
      let price = extra.prices[region] || 0;
      
      if (extraId === 'premium_support') {
        const totalTerminals = terminalQty + mobileQty;
        if (totalTerminals <= 1) {
          price = 1200;
        } else {
          price = 1080 + (360 * (totalTerminals - 1));
        }
      }
      
      if (extraId === 'premium_impl') {
        const totalTerminals = terminalQty + mobileQty;
        if (totalTerminals <= 1) {
          price = 2600;
        } else {
          price = 2600 + (200 * (totalTerminals - 1));
        }
      }
      
      extrasTotal += price;
      
      extrasDetails.push({
        name: region === 'UA' ? extra.name_ua : extra.name_ru,
        price,
        total: price,
      });
    }

    let equipmentTotal = 0;
    const equipmentDetails = [];
    
    if (region === 'UA') {
      for (const [itemId, qty] of Object.entries(selectedEquipment)) {
        if (qty <= 0) continue;
        const item = pricing.equipment.find(e => e.id === itemId);
        if (!item) continue;
        const total = item.price * qty;
        equipmentTotal += total;
        equipmentDetails.push({
          name: item.name_ua,
          price: item.price,
          qty,
          total,
        });
      }
    }

    return {
      tariffTotal,
      addonsTotal,
      extrasTotal,
      equipmentTotal,
      total: tariffTotal + addonsTotal + extrasTotal + equipmentTotal,
      details: {
        tariff: {
          name: region === 'UA' ? tariff.name_ua : tariff.name_ru,
          price: tariffPricePerMonth,
          qty: venues * months,
          total: tariffTotal,
        },
        addons: addonsDetails,
        extras: extrasDetails,
        equipment: equipmentDetails,
      },
    };
  }, [pricing, region, venues, months, selectedTariff, selectedAddons, selectedExtras, selectedEquipment]);

  const generatePDF = async () => {
    if (!calculation) return;
    setGenerating(true);

    try {
      const endpoint = region === 'UA' ? '/api/pdf/ua' : '/api/pdf/region';
      
      const body = {
        region,
        restaurantName,
        venues,
        months,
        tariffId: selectedTariff,
        addons: Object.entries(selectedAddons)
          .filter(([_, qty]) => qty > 0)
          .map(([addonId, quantity]) => ({ addonId, quantity })),
        extras: selectedExtras,
        equipment: region === 'UA' 
          ? Object.entries(selectedEquipment)
              .filter(([_, qty]) => qty > 0)
              .map(([itemId, quantity]) => ({ itemId, quantity }))
          : [],
        debug: debugMode,
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('PDF generation failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = restaurantName.replace(/[^a-zA-Z0-9а-яА-ЯіІїЇєЄґҐ\s-]/g, '').replace(/\s+/g, '_');
      a.download = `${safeName}_${region}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Помилка генерації PDF: ' + (err as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Завантаження...</div>;
  }

  if (!pricing) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Помилка завантаження даних</div>;
  }

  const selectedEquipmentCount = Object.values(selectedEquipment).filter(q => q > 0).length;

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="container mx-auto px-4 max-w-6xl">
        
        {/* Хедер */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="text-gray-600 hover:text-gray-900 flex items-center gap-1 text-sm font-medium"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
              Назад
            </button>
            <span className="text-gray-300">|</span>
            <p className="text-gray-500 text-sm">
              {restaurantName || 'Без назви'} • {region} • {venues} {venues === 1 ? 'заклад' : venues < 5 ? 'заклади' : 'закладів'} • {months} міс
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={debugMode}
                onChange={(e) => setDebugMode(e.target.checked)}
                className="rounded border-gray-300 text-[#F29C1E] focus:ring-[#F29C1E]"
              />
              Debug
            </label>
            <button
              onClick={handleLogout}
              className="text-gray-500 hover:text-gray-700 text-sm font-medium"
            >
              Вийти
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Ліва колонка - налаштування */}
          <div className="lg:col-span-2 space-y-5">
            
            {/* Тарифи */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">ОБЕРІТЬ ТАРИФ</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {pricing.tariffs.filter(t => t.prices[region] > 0 || t.yearlyPrices[region] > 0).map((tariff) => {
                  const isSelected = selectedTariff === tariff.id;
                  return (
                    <button
                      key={tariff.id}
                      onClick={() => setSelectedTariff(tariff.id)}
                      className={`relative p-4 rounded-xl text-left transition-all ${
                        isSelected
                          ? 'bg-orange-50 border-2 border-[#F29C1E]'
                          : 'bg-white border border-gray-200 hover:border-gray-300 hover:shadow-md'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-2 right-2">
                          <CheckIcon />
                        </div>
                      )}
                      <div className={`text-sm font-medium ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>
                        {region === 'UA' ? tariff.name_ua : tariff.name_ru}
                      </div>
                      <div className="text-lg font-bold text-gray-900 mt-1">
                        {tariff.prices[region]} {REGION_CURRENCY[region]}
                      </div>
                      <div className="text-xs text-gray-500">/ міс</div>
                      {tariff.yearlyPrices[region] > 0 && (
                        <div className="text-xs text-[#0066CC] mt-1 font-medium">
                          Річний: {tariff.yearlyPrices[region]}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Додаткові модулі */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">ДОДАТКОВІ МОДУЛІ</h2>
              <div className="space-y-0 divide-y divide-gray-100">
                {pricing.addons.filter(a => a.prices[region] > 0).map((addon) => (
                  <div key={addon.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <div>
                      <div className="font-medium text-gray-900">{region === 'UA' ? addon.name_ua : addon.name_ru}</div>
                      <div className="text-sm text-gray-500">{addon.prices[region]} {REGION_CURRENCY[region]}</div>
                    </div>
                    
                    {addon.type === 'boolean' ? (
                      <input
                        type="checkbox"
                        checked={(selectedAddons[addon.id] || 0) > 0}
                        onChange={(e) => setSelectedAddons(prev => ({
                          ...prev,
                          [addon.id]: e.target.checked ? 1 : 0
                        }))}
                        className="w-5 h-5 rounded border-gray-300 text-[#F29C1E] focus:ring-[#F29C1E]"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedAddons(prev => ({
                            ...prev,
                            [addon.id]: Math.max(0, (prev[addon.id] || 0) - 1)
                          }))}
                          className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 font-medium"
                        >-</button>
                        <span className="w-8 text-center font-medium text-gray-900">{selectedAddons[addon.id] || 0}</span>
                        <button
                          onClick={() => setSelectedAddons(prev => ({
                            ...prev,
                            [addon.id]: (prev[addon.id] || 0) + 1
                          }))}
                          className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 font-medium"
                        >+</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Додаткові послуги - акордеон */}
            <AccordionSection
              title="ДОДАТКОВІ ПОСЛУГИ"
              isOpen={isExtrasOpen}
              onToggle={() => setIsExtrasOpen(!isExtrasOpen)}
              badge={selectedExtras.length}
              isCollapsible={region === 'UA'}
            >
              <div className="space-y-2">
                {pricing.extras.filter(e => e.prices[region] > 0).map((extra) => (
                  <label key={extra.id} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedExtras.includes(extra.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedExtras([...selectedExtras, extra.id]);
                        } else {
                          setSelectedExtras(selectedExtras.filter(id => id !== extra.id));
                        }
                      }}
                      className="w-5 h-5 rounded border-gray-300 text-[#F29C1E] focus:ring-[#F29C1E]"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{region === 'UA' ? extra.name_ua : extra.name_ru}</div>
                      <div className="text-sm text-gray-500">{extra.prices[region]} {REGION_CURRENCY[region]}</div>
                    </div>
                  </label>
                ))}
              </div>
            </AccordionSection>

            {/* Обладнання - акордеон (тільки для UA) */}
            {region === 'UA' && (
              <AccordionSection
                title="ОБЛАДНАННЯ"
                isOpen={isEquipmentOpen}
                onToggle={() => setIsEquipmentOpen(!isEquipmentOpen)}
                badge={selectedEquipmentCount}
                isCollapsible={true}
              >
                <div className="space-y-0 divide-y divide-gray-100 max-h-96 overflow-y-auto">
                  {pricing.equipment.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-3 first:pt-0">
                      <div>
                        <div className="font-medium text-gray-900 text-sm">{item.name_ua}</div>
                        <div className="text-sm text-gray-500">{item.price} {REGION_CURRENCY[region]}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedEquipment(prev => ({
                            ...prev,
                            [item.id]: Math.max(0, (prev[item.id] || 0) - 1)
                          }))}
                          className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 font-medium"
                        >-</button>
                        <span className="w-8 text-center font-medium text-gray-900">{selectedEquipment[item.id] || 0}</span>
                        <button
                          onClick={() => setSelectedEquipment(prev => ({
                            ...prev,
                            [item.id]: (prev[item.id] || 0) + 1
                          }))}
                          className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 font-medium"
                        >+</button>
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionSection>
            )}
          </div>

          {/* Права колонка - sticky підсумок */}
          <div className="lg:col-span-1">
            <div className="sticky top-4 bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">ПІДСУМОК</h2>
              
              {calculation && (
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-2">
                    <span className="text-gray-600">
                      Тариф {calculation.details.tariff.name}
                    </span>
                    <span className="font-medium text-gray-900 tabular-nums">{calculation.tariffTotal.toFixed(0)} {REGION_CURRENCY[region]}</span>
                  </div>
                  
                  {calculation.addonsTotal > 0 && (
                    <div className="flex justify-between py-2">
                      <span className="text-gray-600">Дод. модулі</span>
                      <span className="font-medium text-gray-900 tabular-nums">{calculation.addonsTotal.toFixed(0)} {REGION_CURRENCY[region]}</span>
                    </div>
                  )}
                  
                  {calculation.extrasTotal > 0 && (
                    <div className="flex justify-between py-2">
                      <span className="text-gray-600">Послуги</span>
                      <span className="font-medium text-gray-900 tabular-nums">{calculation.extrasTotal.toFixed(0)} {REGION_CURRENCY[region]}</span>
                    </div>
                  )}
                  
                  {calculation.equipmentTotal > 0 && (
                    <div className="flex justify-between py-2">
                      <span className="text-gray-600">Обладнання</span>
                      <span className="font-medium text-gray-900 tabular-nums">{calculation.equipmentTotal.toFixed(0)} {REGION_CURRENCY[region]}</span>
                    </div>
                  )}
                  
                  <div className="border-t border-gray-200 pt-3 mt-3">
                    <div className="flex justify-between">
                      <span className="font-bold text-gray-900">РАЗОМ</span>
                      <span className="font-bold text-lg text-gray-900 tabular-nums">{calculation.total.toFixed(0)} {REGION_CURRENCY[region]}</span>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={generatePDF}
                disabled={generating || !calculation}
                className="w-full mt-6 bg-[#F29C1E] text-white py-3 rounded-xl hover:bg-[#E08C0E] disabled:bg-gray-300 font-semibold transition-colors"
              >
                {generating ? 'Генерація...' : 'Згенерувати PDF'}
              </button>

              {debugMode && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800">
                  <p className="font-medium mb-1">Debug режим активний:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Показуються рамки таблиць</li>
                    <li>Координати в консолі</li>
                    <li>Можна налаштувати позиції</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}