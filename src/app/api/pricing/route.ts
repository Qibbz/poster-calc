import { NextResponse } from 'next/server';
import { loadPricing } from '@/lib/pricing/loadPricing';

export async function GET() {
  const pricing = loadPricing();
  return NextResponse.json(pricing);
}