import { PricingData, CalculationInput, CalculationResult, Region, Addon } from '@/types';
import { loadPricing } from './loadPricing';

function getPriceForRegion(prices: Record<Region, number>, region: Region): number {
  return prices[region] || 0;
}

function calculateAddonPrice(addon: Addon, qty: number, region: Region, months: number): number {
  const basePrice = getPriceForRegion(addon.prices, region);
  
  // Boolean аддони — разова оплата, не множимо на місяці
  if (addon.type === 'boolean') {
    return qty > 0 ? basePrice : 0;
  }
  
  // P&L — особлива логіка, не множимо на місяці
  if (addon.type === 'pl-report') {
    if (qty <= 0) return 0;
    if (qty === 1) return basePrice;
    const firstUnit = basePrice;
    const additionalUnits = (qty - 1) * (basePrice * 0.5);
    return firstUnit + additionalUnits;
  }
  
  // Quantity аддони — ціна × кількість × місяці
  return basePrice * qty * months;
}

// Розрахунок Premium підтримки
function calculatePremiumSupport(terminalQty: number, mobileQty: number): number {
  const totalTerminals = terminalQty + mobileQty;
  
  if (totalTerminals <= 1) {
    return 1200;
  } else {
    return 1080 + (360 * (totalTerminals - 1));
  }
}

// Розрахунок Premium впровадження
function calculatePremiumImpl(terminalQty: number, mobileQty: number): number {
  const totalTerminals = terminalQty + mobileQty;
  
  if (totalTerminals <= 1) {
    return 2600;
  } else {
    return 2600 + (200 * (totalTerminals - 1));
  }
}

export function calculate(input: CalculationInput, pricing?: PricingData): CalculationResult {
  const data = pricing || loadPricing();
  
  // Знаходимо тариф
  const tariff = data.tariffs.find(t => t.id === input.tariffId);
  if (!tariff) {
    throw new Error(`Tariff ${input.tariffId} not found`);
  }
  
  // === РОЗРАХУНОК ТАРИФУ ===
  // 12 міс = річна ціна × заклади × 12 міс
  // 1,3,6 міс = місячна ціна × заклади × місяці
  
  const isYearly = input.months === 12;
  const tariffPricePerMonth = isYearly 
    ? getPriceForRegion(tariff.yearlyPrices, input.region)
    : getPriceForRegion(tariff.prices, input.region);
  
  // Загальна сума тарифу = ціна за місяць × заклади × місяці
  const tariffTotal = tariffPricePerMonth * input.venues * input.months;
  
  // === РОЗРАХУНОК АДДОНІВ ===
  // НЕ множимо на заклади, множимо на місяці (крім boolean і P&L)
  
  let addonsTotal = 0;
  const addonsDetails: CalculationResult['details']['addons'] = [];
  
  // Зберігаємо кількість терміналів для extras
  let terminalQty = 0;
  let mobileQty = 0;
  
  for (const selected of input.addons) {
    const addon = data.addons.find(a => a.id === selected.addonId);
    if (!addon || selected.quantity <= 0) continue;
    
    // Запам'ятовуємо кількість терміналів для extras
    if (addon.id === 'addon_terminal') terminalQty = selected.quantity;
    if (addon.id === 'addon_mobile') mobileQty = selected.quantity;
    
    const addonTotal = calculateAddonPrice(addon, selected.quantity, input.region, input.months);
    addonsTotal += addonTotal;
    
    addonsDetails.push({
      name: input.region === 'UA' ? addon.name_ua : addon.name_ru,
      price: getPriceForRegion(addon.prices, input.region),
      qty: selected.quantity,
      total: addonTotal,
    });
  }
  
  // === РОЗРАХУНОК EXTRAS ===
  let extrasTotal = 0;
  const extrasDetails: CalculationResult['details']['extras'] = [];
  
  for (const extraId of input.extraIds) {
    const extra = data.extras.find(e => e.id === extraId);
    if (!extra) continue;
    
    let extraPrice = getPriceForRegion(extra.prices, input.region);
    
    // Особлива логіка для Premium підтримки
    if (extraId === 'premium_support') {
      extraPrice = calculatePremiumSupport(terminalQty, mobileQty);
    }
    
    // Особлива логіка для Premium впровадження
    if (extraId === 'premium_impl') {
      extraPrice = calculatePremiumImpl(terminalQty, mobileQty);
    }
    
    // Швидкий старт завжди 2000 (фіксовано в pricing.json)
    
    extrasTotal += extraPrice;
    
    extrasDetails.push({
      name: input.region === 'UA' ? extra.name_ua : extra.name_ru,
      price: extraPrice,
      total: extraPrice,
    });
  }
  
  // === РОЗРАХУНОК EQUIPMENT (тільки для UA) ===
  let equipmentTotal = 0;
  const equipmentDetails: CalculationResult['details']['equipment'] = [];
  
  if (input.region === 'UA') {
    for (const selected of input.equipment) {
      const item = data.equipment.find(e => e.id === selected.itemId);
      if (!item || selected.quantity <= 0) continue;
      
      const itemTotal = item.price * selected.quantity;
      equipmentTotal += itemTotal;
      
      equipmentDetails.push({
        name: item.name_ua,
        price: item.price,
        qty: selected.quantity,
        total: itemTotal,
      });
    }
  }
  
  const total = tariffTotal + addonsTotal + extrasTotal + equipmentTotal;
  
  return {
    tariffTotal,
    addonsTotal,
    extrasTotal,
    equipmentTotal,
    total,
    details: {
      tariff: {
        name: input.region === 'UA' ? tariff.name_ua : tariff.name_ru,
        price: tariffPricePerMonth,
        qty: input.venues * input.months, // Загальна кількість: заклади × місяці
        total: tariffTotal,
      },
      addons: addonsDetails,
      extras: extrasDetails,
      equipment: equipmentDetails,
    },
  };
}