import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { calculate } from '@/lib/pricing/calc';
import { loadPricing } from '@/lib/pricing/loadPricing';
import fontkit from '@pdf-lib/fontkit';
import { REGION_CURRENCY } from '@/types';

// Маніфест файлів UA PDF
const UA_MANIFEST = {
  core: ['cover.pdf', 'pricing-summary.pdf', 'equipment-summary.pdf', 'start-what-you-get.pdf'],
  tariffs: {
    starter: 'tariffs/tariff-starter.pdf',
    mini: 'tariffs/tariff-mini.pdf',
    business: 'tariffs/tariff-business.pdf',
    pro: 'tariffs/tariff-pro.pdf',
  },
  extras: {
    'quick_start': 'extras/extra-quick-start.pdf',
    'premium_support': 'extras/extra-premium-support.pdf',
  },
  addons: {
    'addon_prro': 'addons/addon-prro.pdf',
    'addon_qr': 'addons/addon-poster-qr.pdf',
    'addon_site': 'addons/addon-poster-site.pdf',
    'addon_mobile': 'addons/addon-mobile-pos.pdf',
    'addon_terminal': 'addons/addon-additional-cashdesk.pdf',
    'addon_pnl': 'addons/addon-pl-report.pdf',
    'addon_ai': 'addons/addon-postie-ai.pdf',
    'addon_kk': 'addons/addon-kitchen-kit.pdf',
  },
  upsell: {
    'quick_start': 'upsell/upsell-quick-start.pdf',
    'premium_support': 'upsell/upsell-premium-support.pdf',
    'addon_prro': 'upsell/upsell-prro.pdf',
    'addon_qr': 'upsell/upsell-poster-qr.pdf',
    'addon_site': 'upsell/upsell-poster-site.pdf',
    'addon_mobile': 'upsell/upsell-mobile-pos.pdf',
    'addon_terminal': 'upsell/upsell-additional-cashdesk.pdf',
    'addon_pnl': 'upsell/upsell-pl-report.pdf',
    'addon_ai': 'upsell/upsell-postie-ai.pdf',
    'addon_kk': 'upsell/upsell-kitchen-kit.pdf',
  },
  final: ['final/final-what-you-get-block.pdf', 'final/final-block.pdf'],
};

// Оновлена конфігурація — ширші стовпці для кращого використання простору
const PRICING_TABLE_CONFIG = {
  startX: 45,        // трохи лівіше
  startY: 285,
  rowHeight: 18,
  colWidths: [285, 80, 70, 90, 110], // ширше: сумарно 550 (було 460)
  fontSize: 10,
};

const EQUIPMENT_TABLE_CONFIG = {
  startX: 45,        // узгоджено з основною таблицею
  startY: 250,
  rowHeight: 18,
  colWidths: [400, 90, 120], // також ширше
  fontSize: 10,
};

interface TableRow {
  name: string;
  price: number;
  qty: number;
  months: number;
  total: number;
}

async function loadPdfBytes(filePath: string): Promise<Uint8Array | null> {
  const fullPath = path.join(process.cwd(), 'public', 'templates', 'ua', filePath);
  console.log(`[PDF UA] Trying to load: ${fullPath}`);
  
  if (!fs.existsSync(fullPath)) {
    console.warn(`[PDF UA] File NOT FOUND: ${fullPath}`);
    return null;
  }
  
  console.log(`[PDF UA] File FOUND: ${fullPath}`);
  return fs.readFileSync(fullPath);
}

// Таблиця для тарифів та аддонів (5 колонок)
function drawTable(
  page: any,
  font: any,
  config: typeof PRICING_TABLE_CONFIG,
  data: TableRow[],
  debug: boolean
) {
  let y = config.startY;

  if (debug) {
    try {
      page.drawRectangle({
        x: config.startX - 5,
        y: y - (data.length + 3) * config.rowHeight,
        width: config.colWidths.reduce((a, b) => a + b, 0) + 10,
        height: (data.length + 3) * config.rowHeight + 10,
        borderColor: rgb(1, 0, 0),
        borderWidth: 1,
      });
    } catch (e) {
      console.error('[PDF UA] Error drawing debug rectangle:', e);
    }
  }

  const headers = ['Підписка', 'Ціна', 'Кількість', 'Місяці', 'Всього'];
  let x = config.startX;
  
  headers.forEach((h, i) => {
    try {
      page.drawText(h, {
        x,
        y,
        size: config.fontSize,
        font,
        color: rgb(0.4, 0.4, 0.4),
      });
    } catch (e) {
      console.error(`[PDF UA] Error drawing header "${h}":`, e);
    }
    x += config.colWidths[i];
  });
  
  y -= config.rowHeight;

  // Горизонтальна лінія під заголовками
  const tableWidth = config.colWidths.reduce((a, b) => a + b, 0);
  page.drawLine({
    start: { x: config.startX, y: y + config.rowHeight * 0.5 },
    end: { x: config.startX + tableWidth, y: y + config.rowHeight * 0.5 },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });

  data.forEach((row, idx) => {
    x = config.startX;
    try {
      const name = row.name ? row.name.substring(0, 35) : 'Unknown';
      page.drawText(name, { x, y, size: config.fontSize, font });
      x += config.colWidths[0];
      
      // Виправлена логіка: перевіряємо чи це обов'язковий рядок (ціна 0 та спеціальні назви)
      const isMandatoryRow = row.price === 0 && row.total === 0 && 
        (name.includes('Poster Boss') || 
         name.includes('Тех.підтримка') || 
         name.includes('Навчальні матеріали') ||
         name.includes('Застосунок'));
      
      if (isMandatoryRow) {
        // Для обов'язкових рядків: тільки ціна 0, решта порожньо
        page.drawText('0', { x, y, size: config.fontSize, font });
        // Кількість, Місяці, Всього — не виводимо нічого
      } else {
        // Для звичайних рядків: виводимо все
        page.drawText(String(row.price || 0), { x, y, size: config.fontSize, font });
        x += config.colWidths[1];
        
        page.drawText(String(row.qty || 0), { x, y, size: config.fontSize, font });
        x += config.colWidths[2];
        
        page.drawText(String(row.months || 0), { x, y, size: config.fontSize, font });
        x += config.colWidths[3];
        
        page.drawText(String(row.total || 0), { x, y, size: config.fontSize, font });
      }
      
    } catch (e) {
      console.error(`[PDF UA] Error drawing row ${idx}:`, e, row);
    }
    y -= config.rowHeight;
  });

  return y;
}

// Таблиця для обладнання (3 колонки)
function drawEquipmentTable(
  page: any,
  font: any,
  config: typeof EQUIPMENT_TABLE_CONFIG,
  data: { name: string; price: number; qty: number; total: number }[],
  debug: boolean
) {
  let y = config.startY;

  if (debug) {
    try {
      page.drawRectangle({
        x: config.startX - 5,
        y: y - (data.length + 3) * config.rowHeight,
        width: config.colWidths.reduce((a, b) => a + b, 0) + 10,
        height: (data.length + 3) * config.rowHeight + 10,
        borderColor: rgb(1, 0, 0),
        borderWidth: 1,
      });
    } catch (e) {
      console.error('[PDF UA] Error drawing debug rectangle:', e);
    }
  }

  const headers = ['Найменування', 'Кількість', 'Сума'];
  let x = config.startX;
  
  headers.forEach((h, i) => {
    try {
      page.drawText(h, {
        x,
        y,
        size: config.fontSize,
        font,
        color: rgb(0.4, 0.4, 0.4),
      });
    } catch (e) {
      console.error(`[PDF UA] Error drawing header "${h}":`, e);
    }
    x += config.colWidths[i];
  });
  
  y -= config.rowHeight;

  // Горизонтальна лінія під заголовками
  const tableWidth = config.colWidths.reduce((a, b) => a + b, 0);
  page.drawLine({
    start: { x: config.startX, y: y + config.rowHeight * 0.5 },
    end: { x: config.startX + tableWidth, y: y + config.rowHeight * 0.5 },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });

  data.forEach((row, idx) => {
    x = config.startX;
    try {
      const name = row.name ? row.name.substring(0, 50) : 'Unknown';
      page.drawText(name, { x, y, size: config.fontSize, font });
      x += config.colWidths[0];
      
      page.drawText(String(row.qty || 0), { x, y, size: config.fontSize, font });
      x += config.colWidths[1];
      
      page.drawText(String(row.total || 0), { x, y, size: config.fontSize, font });
    } catch (e) {
      console.error(`[PDF UA] Error drawing row ${idx}:`, e, row);
    }
    y -= config.rowHeight;
  });

  // Горизонтальна лінія після таблиці
  page.drawLine({
    start: { x: config.startX, y: y + config.rowHeight * 0.5 },
    end: { x: config.startX + tableWidth, y: y + config.rowHeight * 0.5 },
    thickness: 2,
    color: rgb(0, 0, 0),
  });

  return y;
}

export async function POST(request: NextRequest) {
  console.log('[PDF UA] Request received');
  
  try {
    const body = await request.json();
    console.log('[PDF UA] Request body:', JSON.stringify(body, null, 2));
    
    const { restaurantName, venues, months, tariffId, addons, extras, equipment, debug } = body;

    if (!restaurantName || !tariffId || !venues || !months) {
      console.error('[PDF UA] Missing required fields:', { restaurantName, tariffId, venues, months });
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const currency = REGION_CURRENCY['UA']; // 'грн'
    console.log('[PDF UA] Using currency:', currency);
    console.log('[PDF UA] Loading pricing...');
    const pricing = loadPricing();
    console.log('[PDF UA] Pricing loaded, tariffs:', pricing.tariffs.length);

    console.log('[PDF UA] Calculating...');
    const calc = calculate({
      region: 'UA',
      venues,
      months,
      tariffId,
      addons: addons || [],
      extraIds: extras || [],
      equipment: equipment || [],
    }, pricing);
    console.log('[PDF UA] Calculation done:', { total: calc.total });

    console.log('[PDF UA] Creating PDF document...');
    const mergedPdf = await PDFDocument.create();
    mergedPdf.registerFontkit(fontkit);
    console.log('[PDF UA] PDF document created');
    
    let font;
    try {
      const fontPath = path.join(process.cwd(), 'public', 'fonts', 'DejaVuLGCSans.ttf');
      console.log(`[PDF UA] Loading font from: ${fontPath}`);
      
      if (!fs.existsSync(fontPath)) {
        console.warn('[PDF UA] Custom font not found, using Helvetica');
        font = await mergedPdf.embedFont(StandardFonts.Helvetica);
      } else {
        const fontBytes = fs.readFileSync(fontPath);
        font = await mergedPdf.embedFont(fontBytes);
        console.log('[PDF UA] Custom font loaded');
      }
    } catch (fontError) {
      console.error('[PDF UA] Font loading error:', fontError);
      font = await mergedPdf.embedFont(StandardFonts.Helvetica);
    }

    console.log('[PDF UA] Processing core files...');
    for (const file of UA_MANIFEST.core) {
      console.log(`[PDF UA] Processing core file: ${file}`);
      const bytes = await loadPdfBytes(`core/${file}`);
      
      if (!bytes) {
        console.log(`[PDF UA] Skipping missing core file: ${file}`);
        continue;
      }
      
      let pdf;
      try {
        pdf = await PDFDocument.load(bytes);
        console.log(`[PDF UA] Loaded PDF: ${file}, pages: ${pdf.getPageCount()}`);
      } catch (e) {
        console.error(`[PDF UA] Error loading PDF ${file}:`, e);
        continue;
      }
      
      if (file === 'pricing-summary.pdf') {
        console.log('[PDF UA] Processing pricing-summary with table overlay...');
        
        try {
          const [copiedPage] = await mergedPdf.copyPages(pdf, [0]);
          console.log('[PDF UA] Page copied for pricing-summary');
          
          // Рахуємо суму тільки за програму (без обладнання)
            const programTotal = calc.tariffTotal + calc.addonsTotal + calc.extrasTotal;

          // Виправлено: додано 3 обов'язкові рядки та виправлено extras
          const tableData: TableRow[] = [
              // Тариф
              { 
                name: calc.details.tariff.name,
                price: calc.details.tariff.price, 
                qty: venues,
                months: months,
                total: calc.tariffTotal 
              },
              // Аддони
              ...calc.details.addons.map(a => ({ 
                name: a.name, 
                price: a.price, 
                qty: a.qty,
                months: months,
                total: a.total 
              })),
              // Extras
              ...calc.details.extras.map(e => ({ 
                name: e.name, 
                price: e.price, 
                qty: 1,
                months: 1,
                total: e.total 
              })),
              // 3 обов'язкові рядки
              { name: 'Застосунок Poster Boss', price: 0, qty: 1, months: 1, total: 0 },
              { name: 'Тех.підтримка 24/7', price: 0, qty: 1, months: 1, total: 0 },
              { name: 'Навчальні матеріали', price: 0, qty: 1, months: 1, total: 0 },
            ];

          console.log('[PDF UA] Table data prepared:', tableData.length, 'rows');

          const finalY = drawTable(
            copiedPage, 
            font, 
            PRICING_TABLE_CONFIG, 
            tableData,
            debug || false
          );

          // Жирна лінія перед підсумком
          const tableWidth = PRICING_TABLE_CONFIG.colWidths.reduce((a, b) => a + b, 0);
          const summaryY = finalY - 10;

          copiedPage.drawLine({
            start: { x: PRICING_TABLE_CONFIG.startX, y: summaryY + 15 },
            end: { x: PRICING_TABLE_CONFIG.startX + tableWidth, y: summaryY + 15 },
            thickness: 2,
            color: rgb(0, 0, 0),
          });

          // Підсумок тільки за програму (без обладнання!)
          const colTotalX = PRICING_TABLE_CONFIG.startX + 
            PRICING_TABLE_CONFIG.colWidths[0] + 
            PRICING_TABLE_CONFIG.colWidths[1] + 
            PRICING_TABLE_CONFIG.colWidths[2] + 
            PRICING_TABLE_CONFIG.colWidths[3];

          // Рахуємо суму тільки за програму: тариф + аддони + extras
          const softwareTotal = calc.tariffTotal + calc.addonsTotal + calc.extrasTotal;

          copiedPage.drawText('Всього за програму:', {
            x: PRICING_TABLE_CONFIG.startX,
            y: summaryY,
            size: 12,
            font,
            color: rgb(0, 0.5, 0),
          });

          copiedPage.drawText(`${softwareTotal.toFixed(0)} ${currency}`, {
            x: colTotalX,
            y: summaryY,
            size: 12,
            font,
            color: rgb(0, 0.5, 0),
          });

          mergedPdf.addPage(copiedPage);
          console.log('[PDF UA] pricing-summary page added');
        } catch (e) {
          console.error('[PDF UA] Error processing pricing-summary:', e);
          const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
          pages.forEach(p => mergedPdf.addPage(p));
        }
      } 
      else if (file === 'equipment-summary.pdf') {
        if (calc.equipmentTotal > 0) {
          console.log('[PDF UA] Processing equipment-summary with table...');
          try {
            const [copiedPage] = await mergedPdf.copyPages(pdf, [0]);
            
            const tableData = calc.details.equipment.map(e => ({
              name: e.name,
              price: e.price,
              qty: e.qty,
              total: e.total,
            }));

            const finalY = drawEquipmentTable(
              copiedPage,
              font,
              EQUIPMENT_TABLE_CONFIG,
              tableData,
              debug || false
            );

            // Підсумок по обладнанню
            const tableWidth = EQUIPMENT_TABLE_CONFIG.colWidths.reduce((a, b) => a + b, 0);
            const summaryY = finalY - 10;
            
            copiedPage.drawLine({
              start: { x: EQUIPMENT_TABLE_CONFIG.startX, y: summaryY + 15 },
              end: { x: EQUIPMENT_TABLE_CONFIG.startX + tableWidth, y: summaryY + 15 },
              thickness: 2,
              color: rgb(0, 0, 0),
            });

            const colTotalX = EQUIPMENT_TABLE_CONFIG.startX + 
              EQUIPMENT_TABLE_CONFIG.colWidths[0] + 
              EQUIPMENT_TABLE_CONFIG.colWidths[1];

            copiedPage.drawText('Всього за обладнання:', {
              x: EQUIPMENT_TABLE_CONFIG.startX,
              y: summaryY,
              size: 12,
              font,
              color: rgb(0, 0.5, 0),
            });

            copiedPage.drawText(`${calc.equipmentTotal.toFixed(0)} ${currency}`, {
              x: colTotalX,
              y: summaryY,
              size: 12,
              font,
              color: rgb(0, 0.5, 0),
            });

            mergedPdf.addPage(copiedPage);
          } catch (e) {
            console.error('[PDF UA] Error processing equipment-summary:', e);
          }
        } else {
          console.log('[PDF UA] Skipping equipment-summary (no equipment)');
        }
      }
      else {
        console.log(`[PDF UA] Adding pages from ${file}`);
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        pages.forEach(p => mergedPdf.addPage(p));
      }
    }

    console.log(`[PDF UA] Processing tariff: ${tariffId}`);
    const tariffFile = UA_MANIFEST.tariffs[tariffId as keyof typeof UA_MANIFEST.tariffs];
    if (tariffFile) {
      const bytes = await loadPdfBytes(tariffFile);
      if (bytes) {
        try {
          const pdf = await PDFDocument.load(bytes);
          const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
          pages.forEach(p => mergedPdf.addPage(p));
          console.log(`[PDF UA] Tariff ${tariffId} added`);
        } catch (e) {
          console.error(`[PDF UA] Error loading tariff ${tariffId}:`, e);
        }
      }
    } else {
      console.warn(`[PDF UA] Tariff ${tariffId} not found in manifest`);
    }

    const hasQuickStart = extras?.includes('quick_start') || false;
    const hasPremiumSupport = extras?.includes('premium_support') || false;
    const hasPremiumImpl = extras?.includes('premium_impl') || false;

    const extrasToAdd: string[] = [];

    if (hasPremiumImpl) {
      extrasToAdd.push('quick_start');
      extrasToAdd.push('premium_support');
      console.log('[PDF UA] premium_impl: adding both quick_start + premium_support');
    } else if (hasQuickStart) {
      extrasToAdd.push('quick_start');
      console.log('[PDF UA] quick_start: adding quick_start');
    } else if (hasPremiumSupport) {
      extrasToAdd.push('premium_support');
      console.log('[PDF UA] premium_support: adding premium_support');
    }

    console.log('[PDF UA] Extras to add after tariff:', extrasToAdd);

    for (const extraId of extrasToAdd) {
      const file = UA_MANIFEST.extras[extraId as keyof typeof UA_MANIFEST.extras];
      if (file) {
        const bytes = await loadPdfBytes(file);
        if (bytes) {
          try {
            const pdf = await PDFDocument.load(bytes);
            const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            pages.forEach(p => mergedPdf.addPage(p));
            console.log(`[PDF UA] Extra ${extraId} added`);
          } catch (e) {
            console.error(`[PDF UA] Error loading extra ${extraId}:`, e);
          }
        }
      } else {
        console.warn(`[PDF UA] Extra ${extraId} not found in manifest`);
      }
    }

    console.log('[PDF UA] Processing addons:', addons);
    for (const addon of (addons || [])) {
      if (addon.quantity > 0) {
        const file = UA_MANIFEST.addons[addon.addonId as keyof typeof UA_MANIFEST.addons];
        if (file) {
          const bytes = await loadPdfBytes(file);
          if (bytes) {
            try {
              const pdf = await PDFDocument.load(bytes);
              const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
              pages.forEach(p => mergedPdf.addPage(p));
              console.log(`[PDF UA] Addon ${addon.addonId} added`);
            } catch (e) {
              console.error(`[PDF UA] Error loading addon ${addon.addonId}:`, e);
            }
          }
        } else {
          console.warn(`[PDF UA] Addon ${addon.addonId} not found in manifest`);
        }
      }
    }

    console.log('[PDF UA] Processing final-what-you-get-block...');
    const finalWhatYouGetBytes = await loadPdfBytes('final/final-what-you-get-block.pdf');
    if (finalWhatYouGetBytes) {
      const pdf = await PDFDocument.load(finalWhatYouGetBytes);
      const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      pages.forEach(p => mergedPdf.addPage(p));
      console.log('[PDF UA] final-what-you-get-block added');
    }

    console.log('[PDF UA] Processing upsells...');

    const selectedAddonIds = new Set<string>((addons || []).filter((a: any) => a.quantity > 0).map((a: any) => a.addonId as string));

    const shouldAddPremiumSupportUpsell = hasQuickStart || (!hasQuickStart && !hasPremiumSupport && !hasPremiumImpl);
    const shouldAddQuickStartUpsell = hasPremiumSupport || (!hasQuickStart && !hasPremiumSupport && !hasPremiumImpl);

    console.log('[PDF UA] Upsell logic:', {
      shouldAddPremiumSupportUpsell,
      shouldAddQuickStartUpsell,
      hasQuickStart,
      hasPremiumSupport,
      hasPremiumImpl
    });

    for (const [upsellId, file] of Object.entries(UA_MANIFEST.upsell)) {
      if (upsellId.startsWith('addon_') && selectedAddonIds.has(upsellId)) {
        console.log(`[PDF UA] Skipping upsell ${upsellId} (selected as addon)`);
        continue;
      }
      
      if (upsellId === 'premium_support' && !shouldAddPremiumSupportUpsell) {
        console.log(`[PDF UA] Skipping premium_support upsell (not needed)`);
        continue;
      }
      
      if (upsellId === 'quick_start' && !shouldAddQuickStartUpsell) {
        console.log(`[PDF UA] Skipping quick_start upsell (not needed)`);
        continue;
      }
      
      const bytes = await loadPdfBytes(file);
      if (bytes) {
        const pdf = await PDFDocument.load(bytes);
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        pages.forEach(p => mergedPdf.addPage(p));
        console.log(`[PDF UA] Upsell ${upsellId} added`);
      }
    }

    console.log('[PDF UA] Processing final-block...');
    const finalBlockBytes = await loadPdfBytes('final/final-block.pdf');
    if (finalBlockBytes) {
      const pdf = await PDFDocument.load(finalBlockBytes);
      const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      pages.forEach(p => mergedPdf.addPage(p));
      console.log('[PDF UA] final-block added');
    }

    console.log('[PDF UA] Saving PDF...');
    const pdfBytes = await mergedPdf.save();
    console.log(`[PDF UA] PDF saved, size: ${pdfBytes.length} bytes`);
    
    const safeName = restaurantName.replace(/[^a-zA-Z0-9а-яА-ЯіІїЇєЄґҐ\s-]/g, '').replace(/\s+/g, '_');
    console.log(`[PDF UA] Filename: ${safeName}_UA.pdf`);

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(safeName)}_UA.pdf"`,
      },
    });
    
  } catch (error) {
    console.error('[PDF UA] CRITICAL ERROR:', error);
    console.error('[PDF UA] Error stack:', (error as Error).stack);
    return NextResponse.json({ 
      error: 'PDF generation failed',
      details: (error as Error).message 
    }, { status: 500 });
  }
}