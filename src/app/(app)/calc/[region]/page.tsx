import CalcClient from './CalcClient';
import type { Region } from '@/types';

function isRegion(v: string): v is Region {
  return ['UA', 'CIS', 'Euro', 'World', 'KZ', 'PL'].includes(v);
}

interface PageProps {
  params: Promise<{ region: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function CalcPage({ params, searchParams }: PageProps) {
  const { region } = await params;
  const validRegion: Region = isRegion(region) ? region : 'UA';

  return <CalcClient region={validRegion} />;
}