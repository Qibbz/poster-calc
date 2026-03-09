export type Region = 'UA' | 'CIS' | 'Euro' | 'World' | 'KZ' | 'PL';

export const REGION_CURRENCY: Record<Region, string> = {
  UA: 'грн',
  CIS: '$',
  Euro: '€',
  World: '$',
  KZ: '₸',
  PL: 'zł',
}

export interface ClientData {
  restaurantName: string;
  region: Region;
  venues: number;
  months: number;
}

export interface Tariff {
  id: string;
  name_ua: string;
  name_ru: string;
  prices: Record<Region, number>;
  yearlyPrices: Record<Region, number>;
}

export interface Addon {
  id: string;
  name_ua: string;
  name_ru: string;
  prices: Record<Region, number>;
  type: 'boolean' | 'quantity' | 'pl-report';
}

export interface Extra {
  id: string;
  name_ua: string;
  name_ru: string;
  prices: Record<Region, number>;
}

export interface EquipmentItem {
  id: string;
  name_ua: string;
  price: number;
}

export interface PricingData {
  tariffs: Tariff[];
  addons: Addon[];
  extras: Extra[];
  equipment: EquipmentItem[];
}

export interface SelectedAddon {
  addonId: string;
  quantity: number;
}

export interface SelectedEquipment {
  itemId: string;
  quantity: number;
}

export interface CalculationInput {
  region: Region;
  venues: number;
  months: number;
  tariffId: string;
  addons: SelectedAddon[];
  extraIds: string[];
  equipment: SelectedEquipment[];
}

export interface CalculationResult {
  tariffTotal: number;
  addonsTotal: number;
  extrasTotal: number;
  equipmentTotal: number;
  total: number;
  details: {
    tariff: { name: string; price: number; qty: number; total: number };
    addons: Array<{ name: string; price: number; qty: number; total: number }>;
    extras: Array<{ name: string; price: number; total: number }>;
    equipment: Array<{ name: string; price: number; qty: number; total: number }>;
  };
}