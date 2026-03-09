import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const EXCEL_FILE = 'Poster Pricing Config.xlsx';
const OUTPUT_FILE = 'data/pricing.json';

// Функція для знаходження останнього рядка з даними в стовпці A
function findLastRow(sheet: XLSX.WorkSheet, startRow: number = 2): number {
  let lastRow = startRow;
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  
  for (let row = startRow; row <= range.e.r + 1; row++) {
    const cellRef = `A${row}`;
    const cell = sheet[cellRef];
    if (!cell || !cell.v || String(cell.v).trim() === '') {
      return row - 1;
    }
    lastRow = row;
  }
  return lastRow;
}

function convert() {
  console.log('Reading Excel file...');
  
  if (!fs.existsSync(EXCEL_FILE)) {
    console.error(`Error: File ${EXCEL_FILE} not found!`);
    process.exit(1);
  }
  
  const workbook = XLSX.readFile(EXCEL_FILE);
  
  // === ТАРИФИ ===
  const tariffsSheet = workbook.Sheets['Tariffs'];
  const tariffsLastRow = findLastRow(tariffsSheet, 2);
  console.log(`Tariffs: rows 2-${tariffsLastRow}`);
  
  const tariffsRange = `A1:M${tariffsLastRow}`;
  const tariffsData = XLSX.utils.sheet_to_json(tariffsSheet, { 
    range: tariffsRange,
    header: ['plan', 'UA', 'CIS', 'Euro', 'World', 'KZ', 'PL', 'UAY', 'CISY', 'EuroY', 'WorldY', 'KZY', 'PLY']
  }) as any[];
  
  const tariffs = tariffsData.slice(1).map((row) => ({
    id: String(row.plan).toLowerCase(),
    name_ua: row.plan,
    name_ru: row.plan,
    prices: {
      UA: Number(row.UA) || 0,
      CIS: Number(row.CIS) || 0,
      Euro: Number(row.Euro) || 0,
      World: Number(row.World) || 0,
      KZ: Number(row.KZ) || 0,
      PL: Number(row.PL) || 0,
    },
    yearlyPrices: {
      UA: Number(row.UAY) || 0,
      CIS: Number(row.CISY) || 0,
      Euro: Number(row.EuroY) || 0,
      World: Number(row.WorldY) || 0,
      KZ: Number(row.KZY) || 0,
      PL: Number(row.PLY) || 0,
    }
  }));

  // === АДДОНИ ===
// Типи аддонів за ID
const ADDON_TYPES_MAP: Record<string, string> = {
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

const addonsSheet = workbook.Sheets['Addons'];
const addonsLastRow = findLastRow(addonsSheet, 2);
console.log(`Addons: rows 2-${addonsLastRow}`);

const addonsRange = `A1:J${addonsLastRow}`; // Додали колонку J для Type (якщо є)
const addonsData = XLSX.utils.sheet_to_json(addonsSheet, {
  range: addonsRange,
  header: ['id', 'Name_UA', 'Name_RU', 'UA', 'CIS', 'Euro', 'World', 'KZ', 'PL', 'Type']
}) as any[];

const addons = addonsData.slice(1).map((row) => ({
  id: row.id,
  name_ua: row.Name_UA || '',
  name_ru: row.Name_RU || '',
  prices: {
    UA: Number(row.UA) || 0,
    CIS: Number(row.CIS) || 0,
    Euro: Number(row.Euro) || 0,
    World: Number(row.World) || 0,
    KZ: Number(row.KZ) || 0,
    PL: Number(row.PL) || 0,
  },
  type: row.Type || ADDON_TYPES_MAP[row.id] || 'boolean', // Беремо з Excel або з мапи
}));

  // === EXTRAS ===
  const extrasSheet = workbook.Sheets['Extra'];
  const extrasLastRow = findLastRow(extrasSheet, 2);
  console.log(`Extras: rows 2-${extrasLastRow}`);
  
  const extrasRange = `A1:I${extrasLastRow}`;
  const extrasData = XLSX.utils.sheet_to_json(extrasSheet, {
    range: extrasRange,
    header: ['id', 'Name_UA', 'Name_RU', 'UA', 'CIS', 'Euro', 'World', 'KZ', 'PL']
  }) as any[];
  
  const extras = extrasData.slice(1).map((row) => ({
    id: row.id,
    name_ua: row.Name_UA || '',
    name_ru: row.Name_RU || '',
    prices: {
      UA: Number(row.UA) || 0,
      CIS: Number(row.CIS) || 0,
      Euro: Number(row.Euro) || 0,
      World: Number(row.World) || 0,
      KZ: Number(row.KZ) || 0,
      PL: Number(row.PL) || 0,
    },
  }));

  // === EQUIPMENT ===
  const equipmentSheet = workbook.Sheets['Equipment'];
  const equipmentLastRow = findLastRow(equipmentSheet, 2);
  console.log(`Equipment: rows 2-${equipmentLastRow}`);
  
  const equipmentRange = `A1:C${equipmentLastRow}`;
  const equipmentData = XLSX.utils.sheet_to_json(equipmentSheet, {
    range: equipmentRange,
    header: ['id', 'Name_UA', 'Price']
  }) as any[];
  
  const equipment = equipmentData.slice(1).map((row) => ({
    id: row.id,
    name_ua: row.Name_UA || '',
    price: Number(row.Price) || 0,
  }));

  const result = {
    tariffs,
    addons,
    extras,
    equipment,
  };

  const dataDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
  
  console.log(`\n✓ Converted successfully to ${OUTPUT_FILE}`);
  console.log(`  Tariffs: ${tariffs.length}`);
  console.log(`  Addons: ${addons.length}`);
  console.log(`  Extras: ${extras.length}`);
  console.log(`  Equipment: ${equipment.length}`);
  
  console.log('\n  Addon IDs:', addons.map(a => a.id).join(', '));
  console.log('  Extra IDs:', extras.map(e => e.id).join(', '));
  console.log('  Equipment IDs (first 10):', equipment.slice(0, 10).map(e => e.id).join(', '));
}

convert();