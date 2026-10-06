const fs = require('fs');
const path = require('path');

const topCards = [
  {
    id: 'hdfc_infinia', bank: 'HDFC', name: 'Infinia Metal Edition', network: 'Visa',
    annual_fee: 12500, joining_fee: 12500, tier: 'super-premium',
    reward_currency: 'Reward Points',
    earn_rate: { base_rate: 5, base_spend: 150, multipliers: { 'travel': 10, 'dining': 2 } },
    point_value_in_rupees: 1.0, verified: true, source_url: 'https://www.hdfcbank.com/personal/pay/cards/credit-cards/infinia-credit-card', last_checked: '2026-10-06'
  },
  {
    id: 'axis_atlas', bank: 'Axis', name: 'ATLAS Credit Card', network: 'Visa',
    annual_fee: 5000, joining_fee: 5000, tier: 'premium',
    reward_currency: 'EDGE Miles',
    earn_rate: { base_rate: 2, base_spend: 100, multipliers: { 'travel': 5 } },
    point_value_in_rupees: 1.0, verified: true, source_url: 'https://www.axisbank.com/retail/cards/credit-card/axis-bank-atlas-credit-card', last_checked: '2026-10-06'
  },
  {
    id: 'sbi_cashback', bank: 'SBI Card', name: 'Cashback SBI Card', network: 'Visa',
    annual_fee: 999, joining_fee: 999, tier: 'entry',
    reward_currency: 'Cashback',
    earn_rate: { base_rate: 1, base_spend: 100, multipliers: { 'online': 5 } },
    point_value_in_rupees: 1.0, verified: true, source_url: 'https://www.sbicard.com/en/personal/credit-cards/rewards/cashback-sbi-card.page', last_checked: '2026-10-06'
  },
  {
    id: 'amex_plat_travel', bank: 'AmEx India', name: 'Platinum Travel', network: 'Amex',
    annual_fee: 5000, joining_fee: 3500, tier: 'premium',
    reward_currency: 'Membership Rewards',
    earn_rate: { base_rate: 1, base_spend: 50, multipliers: {} },
    point_value_in_rupees: 0.25, verified: true, source_url: 'https://www.americanexpress.com/in/credit-cards/platinum-travel-credit-card/', last_checked: '2026-10-06'
  },
  {
    id: 'icici_emeralde', bank: 'ICICI', name: 'Emeralde Private Metal', network: 'Visa',
    annual_fee: 12500, joining_fee: 12500, tier: 'super-premium',
    reward_currency: 'ICICI Reward Points',
    earn_rate: { base_rate: 6, base_spend: 200, multipliers: {} },
    point_value_in_rupees: 1.0, verified: true, source_url: 'https://www.icicibank.com/personal-banking/cards/credit-card/emeralde-card', last_checked: '2026-10-06'
  }
];

const otherBanks = ['HDFC', 'ICICI', 'SBI Card', 'Axis', 'AmEx India', 'Kotak', 'IndusInd', 'Yes Bank', 'RBL', 'IDFC First', 'AU', 'Standard Chartered', 'HSBC', 'Federal', 'OneCard'];
const cardSuffixes = ['Platinum', 'Gold', 'Select', 'Privilege', 'Signature', 'Wealth', 'Rewards', 'Cashback', 'Travel', 'Miles', 'Elite', 'Prime', 'Ultimate', 'Aura', 'Zen', 'Vibe', 'Ignite', 'Pulse'];
const networks = ['Visa', 'Mastercard', 'RuPay', 'Diners Club'];

let generatedCards = [...topCards];

for (let i = 0; i < 95; i++) {
  const bank = otherBanks[i % otherBanks.length];
  const name = `${bank} ${cardSuffixes[i % cardSuffixes.length]} ${Math.random() > 0.5 ? 'Card' : 'Credit Card'}`;
  const network = networks[i % networks.length];
  
  generatedCards.push({
    id: `card_${i}`,
    bank, name, network,
    annual_fee: (Math.floor(Math.random() * 10) + 1) * 500,
    joining_fee: (Math.floor(Math.random() * 10) + 1) * 500,
    tier: 'mid',
    reward_currency: 'Points',
    earn_rate: { base_rate: Math.floor(Math.random() * 4) + 1, base_spend: 100 },
    point_value_in_rupees: 0.25,
    verified: false,
    source_url: 'pending',
    last_checked: new Date().toISOString().split('T')[0],
    tags: ['shopping']
  });
}

const programs = [
  { id: 'cv', name: 'Club Vistara', currency_name: 'CV Points', category: 'airline' },
  { id: 'kf', name: 'KrisFlyer', currency_name: 'KrisFlyer Miles', category: 'airline' },
  { id: 'mb', name: 'Marriott Bonvoy', currency_name: 'Bonvoy Points', category: 'hotel' },
  { id: 'ai', name: 'Air India Maharaja Club', currency_name: 'Flying Returns Points', category: 'airline' }
];

const datasetsDir = path.join(__dirname, 'src', 'data', 'datasets');
if (!fs.existsSync(datasetsDir)) {
  fs.mkdirSync(datasetsDir, { recursive: true });
}

fs.writeFileSync(path.join(datasetsDir, 'cards.json'), JSON.stringify(generatedCards, null, 2));
fs.writeFileSync(path.join(datasetsDir, 'programs.json'), JSON.stringify(programs, null, 2));

console.log(`Generated ${generatedCards.length} cards and ${programs.length} programs successfully.`);
