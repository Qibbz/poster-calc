import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import path from 'path';
import { calculate } from '@/lib/pricing/calc';
import { loadPricing } from '@/lib/pricing/loadPricing';
import { Region, REGION_CURRENCY } from '@/types';

const TABLE_CONFIG = {
  startX: 50,
  startY: 285,
  rowHeight: 20,
  colWidths: [240, 90, 80, 110, 90],
  fontSize: 10,
  headerFontSize: 12,
};

export async function POST(request: NextRequest) {
  console.log('[PDF Region] Request received');
  
  try {
    const body = await request.json();
    console.log('[PDF Region] Request body:', JSON.stringify(body, null, 2));
    
    const { region, restaurantName, venues, months, tariffId, addons, extras, debug } = body;

    if (!region || !restaurantName || !tariffId) {
      console.error('[PDF Region] Missing required fields');
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const currency = REGION_CURRENCY[region as Region];
    console.log('[PDF Region] Using currency:', currency);

    const templatePath = path.join(process.cwd(), 'public', 'templates', 'regions', `${region}.pdf`);
    console.log(`[PDF Region] Template path: ${templatePath}`);
    
    if (!fs.existsSync(templatePath)) {
      console.error(`[PDF Region] Template not found: ${templatePath}`);
      return NextResponse.json({ error: `Template not found for region: ${region}` }, { status: 404 });
    }

    console.log('[PDF Region] Loading template...');
    const templateBytes = fs.readFileSync(templatePath);
    console.log(`[PDF Region] Template loaded, size: ${templateBytes.length} bytes`);
    
    const pdfDoc = await PDFDocument.load(templateBytes);
    pdfDoc.registerFontkit(fontkit);
    console.log(`[PDF Region] PDF loaded, pages: ${pdfDoc.getPageCount()}`);
    
    let font;
    try {
      const fontPath = path.join(process.cwd(), 'public', 'fonts', 'DejaVuLGCSans.ttf');
      console.log(`[PDF Region] Loading font: ${fontPath}`);
      
      if (fs.existsSync(fontPath)) {
        const fontBytes = fs.readFileSync(fontPath);
        font = await pdfDoc.embedFont(fontBytes);
        console.log('[PDF Region] Custom font loaded');
      } else {
        console.warn('[PDF Region] Custom font not found, using Helvetica');
        font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      }
    } catch (fontError) {
      console.error('[PDF Region] Font error:', fontError);
      font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    }

    console.log('[PDF Region] Calculating pricing...');
    const pricing = loadPricing();
    const calc = calculate({
      region: region as Region,
      venues,
      months,
      tariffId,
      addons: addons || [],
      extraIds: extras || [],
      equipment: [],
    }, pricing);
    console.log('[PDF Region] Calculation done:', { total: calc.total });

    const pages = pdfDoc.getPages();
    const pageIndex = Math.min(3, pages.length - 1);
    const page = pages[pageIndex];
    console.log(`[PDF Region] Using page ${pageIndex + 1} of ${pages.length} for table`);

    if (debug) {
      try {
        page.drawRectangle({
          x: TABLE_CONFIG.startX - 5,
          y: TABLE_CONFIG.startY - 100,
          width: TABLE_CONFIG.colWidths.reduce((a, b) => a + b, 0) + 10,
          height: 200,
          borderColor: rgb(1, 0, 0),
          borderWidth: 2,
        });
        console.log('[PDF Region] Debug rectangle drawn');
      } catch (e) {
        console.error('[PDF Region] Error drawing debug rectangle:', e);
      }
    }

    let currentY = TABLE_CONFIG.startY;

    // Заголовки колонок (РОСІЙСЬКОЮ)
    const headers = ['Подписка', 'Цена', 'Количество', 'Месяцы', 'Всего'];
    let currentX = TABLE_CONFIG.startX;
    
    headers.forEach((header, i) => {
      try {
        page.drawText(header, {
          x: currentX,
          y: currentY,
          size: TABLE_CONFIG.fontSize,
          font,
          color: rgb(0.4, 0.4, 0.4),
        });
      } catch (e) {
        console.error(`[PDF Region] Error drawing header ${header}:`, e);
      }
      currentX += TABLE_CONFIG.colWidths[i];
    });
    currentY -= TABLE_CONFIG.rowHeight;
    
    const tableWidth = TABLE_CONFIG.colWidths.reduce((a, b) => a + b, 0);
    page.drawLine({
      start: { x: TABLE_CONFIG.startX, y: currentY + TABLE_CONFIG.rowHeight * 0.5 },
      end: { x: TABLE_CONFIG.startX + tableWidth, y: currentY + TABLE_CONFIG.rowHeight * 0.5 },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });

    // Тариф
    try {
      currentX = TABLE_CONFIG.startX;
      page.drawText(calc.details.tariff.name, {
        x: currentX,
        y: currentY,
        size: TABLE_CONFIG.fontSize,
        font,
      });
      
      currentX += TABLE_CONFIG.colWidths[0];
      page.drawText(calc.details.tariff.price.toFixed(0), {
        x: currentX,
        y: currentY,
        size: TABLE_CONFIG.fontSize,
        font,
      });
      
      currentX += TABLE_CONFIG.colWidths[1];
      page.drawText(String(venues), {
        x: currentX,
        y: currentY,
        size: TABLE_CONFIG.fontSize,
        font,
      });
      
      currentX += TABLE_CONFIG.colWidths[2];
      page.drawText(String(months), {
        x: currentX,
        y: currentY,
        size: TABLE_CONFIG.fontSize,
        font,
      });
      
      currentX += TABLE_CONFIG.colWidths[3];
      page.drawText(calc.tariffTotal.toFixed(0), {
        x: currentX,
        y: currentY,
        size: TABLE_CONFIG.fontSize,
        font,
      });
      
      console.log('[PDF Region] Tariff row drawn');
    } catch (e) {
      console.error('[PDF Region] Error drawing tariff row:', e);
    }
    currentY -= TABLE_CONFIG.rowHeight;

    // Аддони
    calc.details.addons.forEach((addon, idx) => {
      try {
        currentX = TABLE_CONFIG.startX;
        page.drawText(addon.name.substring(0, 25), {
          x: currentX,
          y: currentY,
          size: TABLE_CONFIG.fontSize,
          font,
        });
        
        currentX += TABLE_CONFIG.colWidths[0];
        page.drawText(addon.price.toFixed(0), {
          x: currentX,
          y: currentY,
          size: TABLE_CONFIG.fontSize,
          font,
        });
        
        currentX += TABLE_CONFIG.colWidths[1];
        page.drawText(String(addon.qty), {
          x: currentX,
          y: currentY,
          size: TABLE_CONFIG.fontSize,
          font,
        });
        
        currentX += TABLE_CONFIG.colWidths[2];
        page.drawText(String(months), {
          x: currentX,
          y: currentY,
          size: TABLE_CONFIG.fontSize,
          font,
        });
        
        currentX += TABLE_CONFIG.colWidths[3];
        page.drawText(addon.total.toFixed(0), {
          x: currentX,
          y: currentY,
          size: TABLE_CONFIG.fontSize,
          font,
        });
      } catch (e) {
        console.error(`[PDF Region] Error drawing addon ${idx}:`, e);
      }
      currentY -= TABLE_CONFIG.rowHeight;
    });

    // Обов'язкові рядки (3 рядки з ціною 0)
    const mandatoryRows = [
      'Приложение Poster Boss',
      'Тех.поддержка 24/7',
      'Обучающие материалы',
    ];
    
    mandatoryRows.forEach((rowName) => {
      try {
        currentX = TABLE_CONFIG.startX;
        page.drawText(rowName, {
          x: currentX,
          y: currentY,
          size: TABLE_CONFIG.fontSize,
          font,
        });
        
        currentX += TABLE_CONFIG.colWidths[0];
        page.drawText('0', {
          x: currentX,
          y: currentY,
          size: TABLE_CONFIG.fontSize,
          font,
        });
        
        // Інші колонки порожні для обов'язкових рядків
      } catch (e) {
        console.error(`[PDF Region] Error drawing mandatory row ${rowName}:`, e);
      }
      currentY -= TABLE_CONFIG.rowHeight;
    });

    page.drawLine({
      start: { x: TABLE_CONFIG.startX, y: currentY + TABLE_CONFIG.rowHeight * 0.5 },
      end: { x: TABLE_CONFIG.startX + tableWidth, y: currentY + TABLE_CONFIG.rowHeight * 0.5 },
      thickness: 2,
      color: rgb(0, 0, 0),
    });

    // Підсумок
    currentY -= TABLE_CONFIG.rowHeight;
    try {
      page.drawText('Всего к оплате:', {
        x: TABLE_CONFIG.startX,
        y: currentY,
        size: TABLE_CONFIG.headerFontSize,
        font,
        color: rgb(0, 0.5, 0),
      });
      
      // Сума підсумку - вирівнюємо по правій колонці
      const totalX = TABLE_CONFIG.startX + 
        TABLE_CONFIG.colWidths[0] + 
        TABLE_CONFIG.colWidths[1] + 
        TABLE_CONFIG.colWidths[2] + 
        TABLE_CONFIG.colWidths[3];
      
        page.drawText(`${calc.total.toFixed(0)} ${currency}`, {
        x: totalX,
        y: currentY,
        size: TABLE_CONFIG.headerFontSize,
        font,
        color: rgb(0, 0.5, 0),
        });
      
      console.log('[PDF Region] Total drawn');
    } catch (e) {
      console.error('[PDF Region] Error drawing total:', e);
    }

    if (debug) {
      currentY -= TABLE_CONFIG.rowHeight * 2;
      try {
        const { width, height } = page.getSize();
        page.drawText(`Debug: Page ${width.toFixed(0)}x${height.toFixed(0)}, Y: ${TABLE_CONFIG.startY}`, {
          x: TABLE_CONFIG.startX,
          y: currentY,
          size: 8,
          font,
          color: rgb(1, 0, 0),
        });
      } catch (e) {
        console.error('[PDF Region] Error drawing debug info:', e);
      }
    }

    console.log('[PDF Region] Saving PDF...');
    const pdfBytes = await pdfDoc.save();
    console.log(`[PDF Region] PDF saved, size: ${pdfBytes.length} bytes`);

    const safeName = restaurantName.replace(/[^a-zA-Z0-9а-яА-ЯіІїЇєЄґҐ\s-]/g, '').replace(/\s+/g, '_');
    
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(safeName)}_${region}.pdf"`,
      },
    });
    
  } catch (error) {
    console.error('[PDF Region] CRITICAL ERROR:', error);
    console.error('[PDF Region] Stack:', (error as Error).stack);
    return NextResponse.json({ 
      error: 'PDF generation failed',
      details: (error as Error).message 
    }, { status: 500 });
  }
}