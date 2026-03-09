import * as fs from 'fs';
import * as path from 'path';

console.log('=== Checking PDF Templates ===\n');

const regions = ['CIS', 'Euro', 'KZ', 'PL', 'World'];
const uaFiles = {
  core: ['cover.pdf', 'pricing-summary.pdf', 'equipment-summary.pdf', 'start-what-you-get.pdf'],
  tariffs: ['tariff-starter.pdf', 'tariff-mini.pdf', 'tariff-business.pdf', 'tariff-pro.pdf'],
  extras: ['extra-quick-start.pdf', 'extra-premium-support.pdf'],
  addons: ['addon-prro.pdf', 'addon-poster-qr.pdf', 'addon-poster-site.pdf', 'addon-mobile-pos.pdf', 
           'addon-additional-cashdesk.pdf', 'addon-pl-report.pdf', 'addon-postie-ai.pdf', 'addon-kitchen-kit.pdf'],
};

// Check regions
console.log('Region templates:');
regions.forEach(r => {
  const p = path.join(process.cwd(), 'public', 'templates', 'regions', `${r}.pdf`);
  console.log(`  ${r}: ${fs.existsSync(p) ? '✅' : '❌'} ${p}`);
});

// Check UA
console.log('\nUA templates:');
Object.entries(uaFiles).forEach(([dir, files]) => {
  console.log(`  ${dir}/`);
  files.forEach(f => {
    const p = path.join(process.cwd(), 'public', 'templates', 'ua', dir, f);
    console.log(`    ${f}: ${fs.existsSync(p) ? '✅' : '❌'}`);
  });
});

// Check font
const fontPath = path.join(process.cwd(), 'public', 'fonts', 'DejaVuLGCSans.ttf');
console.log(`\nFont: ${fs.existsSync(fontPath) ? '✅' : '❌'} ${fontPath}`);

// Check pricing
const pricingPath = path.join(process.cwd(), 'data', 'pricing.json');
console.log(`Pricing: ${fs.existsSync(pricingPath) ? '✅' : '❌'} ${pricingPath}`);