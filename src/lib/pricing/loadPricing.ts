import { PricingData, Region } from '@/types';
import pricingJson from '../../../data/pricing.json';

// Типи аддонів (тимчасово, поки не додано в Excel)
const ADDON_TYPES: Record<string, 'boolean' | 'quantity' | 'pl-report'> = {
  'addon_terminal': 'quantity',
  'addon_mobile': 'quantity',
  'addon_site': 'boolean',
  'addon_qr': 'boolean',
  'addon_ai': 'boolean',
  'addon_kk': 'quantity',
  'addon_pnl': 'pl-report',
  'addon_prro': 'quantity',
  'addon_cour': 'quantity',
};

export function loadPricing(): PricingData {
  const data = pricingJson as PricingData;
  
  // Додаємо типи до аддонів
  data.addons = data.addons.map(addon => ({
    ...addon,
    type: ADDON_TYPES[addon.id] || addon.type || 'boolean',
  }));
  
  return data;
}

export function getTariffs() {
  return loadPricing().tariffs;
}

export function getAddons() {
  return loadPricing().addons;
}

export function getExtras() {
  return loadPricing().extras;
}

export function getEquipment() {
  return loadPricing().equipment;
}

export function getPriceForRegion(prices: Record<Region, number>, region: Region): number {
  return prices[region] || 0;
}