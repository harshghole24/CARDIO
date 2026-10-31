const fs = require('fs');
const path = require('path');

const today = new Date().toISOString().split('T')[0];

const topCards = [
  { id: 'hdfc_infinia', bank: 'HDFC Bank', name: 'Infinia Metal', network: 'Visa', annual_fee: 12500, joining_fee: 12500, tier: 'super-premium', reward_currency: 'Reward Points', earn_rate: { base_rate: 5, base_spend: 150, multipliers: { travel: 10, dining: 2 } }, point_value_in_rupees: 1.0, transfer_partners: [{ partner_id: 'kf', ratio_from: 1, ratio_to: 1, min_transfer: 100 }], verified: true, source_url: 'hdfcbank.com', last_checked: today, tags: ['travel', 'lounge'] },
  { id: 'axis_atlas', bank: 'Axis Bank', name: 'ATLAS', network: 'Visa', annual_fee: 5000, joining_fee: 5000, tier: 'premium', reward_currency: 'EDGE Miles', earn_rate: { base_rate: 2, base_spend: 100, multipliers: { travel: 5 } }, point_value_in_rupees: 1.0, transfer_partners: [{ partner_id: 'kf', ratio_from: 1, ratio_to: 2, min_transfer: 500 }], verified: true, source_url: 'axisbank.com', last_checked: today, tags: ['travel'] }
];

const bankNames = ['HDFC Bank', 'SBI Card', 'Axis Bank', 'ICICI Bank', 'AmEx India', 'Kotak Mahindra', 'IndusInd', 'Yes Bank', 'RBL Bank', 'IDFC First'];
const cardNames = ['Platinum', 'Gold', 'Select', 'Privilege', 'Signature', 'Wealth', 'Rewards', 'Cashback', 'Travel', 'Miles', 'Elite'];

let generatedCards = [...topCards];

for (let b of bankNames) {
  for (let c of cardNames) {
    if (generatedCards.length >= 100) break;
    generatedCards.push({
      id: `card_${b.replace(/\s+/g,'').toLowerCase()}_${c.toLowerCase()}`,
      bank: b, name: c, network: 'Visa', annual_fee: 1000, joining_fee: 1000, tier: 'mid', reward_currency: 'Points', earn_rate: { base_rate: 1, base_spend: 100 }, point_value_in_rupees: 0.25, verified: false, source_url: 'pending', last_checked: today, tags: []
    });
  }
}

const programs = [
  { id: 'ai', name: 'Air India Maharaja Club', currency_name: 'Flying Returns Points', category: 'airline' },
  { id: 'cv', name: 'Club Vistara', currency_name: 'CV Points', category: 'airline' },
  { id: 'kf', name: 'KrisFlyer', currency_name: 'KrisFlyer Miles', category: 'airline' }
];

const award_charts = [
  { program_id: 'kf', pricing_model: 'zone-based', last_checked: today, popular_routes: [{ origin: 'BOM', destination: 'SIN', cabin: 'economy', type: 'one-way', points_required: 20000, is_approximate: false }] }
];

const dir = path.join(__dirname, 'src', 'data', 'datasets');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

fs.writeFileSync(path.join(dir, 'cards.json'), JSON.stringify(generatedCards, null, 2));
fs.writeFileSync(path.join(dir, 'programs.json'), JSON.stringify(programs, null, 2));
fs.writeFileSync(path.join(dir, 'award_charts.json'), JSON.stringify(award_charts, null, 2));

console.log('Dataset written.');
