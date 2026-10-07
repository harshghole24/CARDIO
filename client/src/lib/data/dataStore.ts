/**
 * DataStore: loads all CSVs once, validates with Zod, and exposes indexed lookups.
 * Singleton pattern — call loadDataStore() once at app boot.
 */
import { fetchCSV } from './csvParser';
import {
  CreditCardRowSchema, type CreditCardRow,
  CardProgramRatioRowSchema, type CardProgramRatioRow,
  AwardChartRowSchema, type AwardChartRow,
  AirportRowSchema, type AirportRow,
  LoyaltyProgramRowSchema, type LoyaltyProgramRow,
  RewardCurrencyRowSchema, type RewardCurrencyRow,
  TransferRouteCurrencyRowSchema, type TransferRouteCurrencyRow,
  MovieDiningBenefitRowSchema, type MovieDiningBenefitRow,
} from './schemas';

export interface DataStore {
  // Raw arrays
  cards: CreditCardRow[];
  ratios: CardProgramRatioRow[];
  awards: AwardChartRow[];
  airports: AirportRow[];
  programs: LoyaltyProgramRow[];
  currencies: RewardCurrencyRow[];
  transferRoutes: TransferRouteCurrencyRow[];
  movieDining: MovieDiningBenefitRow[];

  // Indexed lookups
  cardById: Map<string, CreditCardRow>;
  ratiosByCard: Map<string, CardProgramRatioRow[]>;
  ratiosByProgram: Map<string, CardProgramRatioRow[]>;
  ratioByCardAndProgram: Map<string, CardProgramRatioRow[]>; // key: `${card_id}::${program_id}`
  awardsByRoute: Map<string, AwardChartRow[]>;             // key: `${origin}::${dest}`
  awardByRouteProgramCabin: Map<string, AwardChartRow[]>;  // key: `${origin}::${dest}::${program}::${cabin}`
  airportByIata: Map<string, AirportRow>;
  programById: Map<string, LoyaltyProgramRow>;
  currencyById: Map<string, RewardCurrencyRow>;
  movieDiningByCard: Map<string, MovieDiningBenefitRow[]>;

  // Metadata
  dataAsOf: string;
}

function parseAndValidate<T>(
  rawRows: Record<string, string>[],
  schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: unknown } },
  fileName: string
): T[] {
  const results: T[] = [];
  const errors: string[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const parsed = schema.safeParse(rawRows[i]);
    if (parsed.success && parsed.data) {
      results.push(parsed.data);
    } else {
      errors.push(`Row ${i + 2} in ${fileName}: ${JSON.stringify(parsed.error)}`);
    }
  }

  if (errors.length > 0 && import.meta.env.DEV) {
    console.warn(`[DataStore] ${errors.length} validation errors in ${fileName}:`);
    errors.slice(0, 5).forEach(e => console.warn(e));
    if (errors.length > 5) console.warn(`  ... and ${errors.length - 5} more`);
  }

  return results;
}

let _store: DataStore | null = null;
let _loading: Promise<DataStore> | null = null;

export async function loadDataStore(): Promise<DataStore> {
  if (_store) return _store;
  if (_loading) return _loading;

  _loading = (async () => {
    const [
      rawCards, rawRatios, rawAwards, rawAirports,
      rawPrograms, rawCurrencies, rawRoutes, rawMovieDining
    ] = await Promise.all([
      fetchCSV('credit_cards.csv'),
      fetchCSV('card_program_ratios.csv'),
      fetchCSV('award_chart.csv'),
      fetchCSV('airports.csv'),
      fetchCSV('loyalty_programs.csv'),
      fetchCSV('reward_currencies.csv'),
      fetchCSV('transfer_routes_currency_level.csv'),
      fetchCSV('movies_dining_benefits.csv'),
    ]);

    const cards = parseAndValidate<CreditCardRow>(rawCards, CreditCardRowSchema, 'credit_cards.csv');
    const ratios = parseAndValidate<CardProgramRatioRow>(rawRatios, CardProgramRatioRowSchema, 'card_program_ratios.csv');
    const awards = parseAndValidate<AwardChartRow>(rawAwards, AwardChartRowSchema, 'award_chart.csv');
    const airports = parseAndValidate<AirportRow>(rawAirports, AirportRowSchema, 'airports.csv');
    const programs = parseAndValidate<LoyaltyProgramRow>(rawPrograms, LoyaltyProgramRowSchema, 'loyalty_programs.csv');
    const currencies = parseAndValidate<RewardCurrencyRow>(rawCurrencies, RewardCurrencyRowSchema, 'reward_currencies.csv');
    const transferRoutes = parseAndValidate<TransferRouteCurrencyRow>(rawRoutes, TransferRouteCurrencyRowSchema, 'transfer_routes_currency_level.csv');
    const movieDining = parseAndValidate<MovieDiningBenefitRow>(rawMovieDining, MovieDiningBenefitRowSchema, 'movies_dining_benefits.csv');

    if (import.meta.env.DEV) {
      console.log(`[DataStore] Loaded: ${cards.length} cards, ${ratios.length} ratios, ${awards.length} awards, ${airports.length} airports, ${programs.length} programs, ${currencies.length} currencies, ${transferRoutes.length} transfer routes, ${movieDining.length} movie/dining benefits`);
    }

    // Build indexes
    const cardById = new Map<string, CreditCardRow>();
    cards.forEach(c => cardById.set(c.card_id, c));

    const ratiosByCard = new Map<string, CardProgramRatioRow[]>();
    const ratiosByProgram = new Map<string, CardProgramRatioRow[]>();
    const ratioByCardAndProgram = new Map<string, CardProgramRatioRow[]>();
    ratios.forEach(r => {
      // by card
      if (!ratiosByCard.has(r.card_id)) ratiosByCard.set(r.card_id, []);
      ratiosByCard.get(r.card_id)!.push(r);
      // by program
      if (!ratiosByProgram.has(r.program_id)) ratiosByProgram.set(r.program_id, []);
      ratiosByProgram.get(r.program_id)!.push(r);
      // by card+program
      const key = `${r.card_id}::${r.program_id}`;
      if (!ratioByCardAndProgram.has(key)) ratioByCardAndProgram.set(key, []);
      ratioByCardAndProgram.get(key)!.push(r);
    });

    const awardsByRoute = new Map<string, AwardChartRow[]>();
    const awardByRouteProgramCabin = new Map<string, AwardChartRow[]>();
    awards.forEach(a => {
      const routeKey = `${a.origin_iata}::${a.destination}`;
      if (!awardsByRoute.has(routeKey)) awardsByRoute.set(routeKey, []);
      awardsByRoute.get(routeKey)!.push(a);

      const fullKey = `${a.origin_iata}::${a.destination}::${a.program_id}::${a.cabin}`;
      if (!awardByRouteProgramCabin.has(fullKey)) awardByRouteProgramCabin.set(fullKey, []);
      awardByRouteProgramCabin.get(fullKey)!.push(a);
    });

    const airportByIata = new Map<string, AirportRow>();
    airports.forEach(a => airportByIata.set(a.iata, a));

    const programById = new Map<string, LoyaltyProgramRow>();
    programs.forEach(p => programById.set(p.program_id, p));

    const currencyById = new Map<string, RewardCurrencyRow>();
    currencies.forEach(c => currencyById.set(c.currency_id, c));

    const movieDiningByCard = new Map<string, MovieDiningBenefitRow[]>();
    movieDining.forEach(m => {
      if (!movieDiningByCard.has(m.card_id)) movieDiningByCard.set(m.card_id, []);
      movieDiningByCard.get(m.card_id)!.push(m);
    });

    _store = {
      cards, ratios, awards, airports, programs, currencies, transferRoutes, movieDining,
      cardById, ratiosByCard, ratiosByProgram, ratioByCardAndProgram,
      awardsByRoute, awardByRouteProgramCabin,
      airportByIata, programById, currencyById, movieDiningByCard,
      dataAsOf: '7 Oct 2026',
    };

    return _store;
  })();

  return _loading;
}

export function getDataStore(): DataStore | null {
  return _store;
}

// ─── Convenience query helpers ──────────────────────────────────────────

/** Find award chart entries for a route (tries both directions) */
export function findAwards(
  store: DataStore,
  origin: string,
  destination: string,
  programId?: string,
  cabin?: string
): AwardChartRow[] {
  let results: AwardChartRow[] = [];

  if (programId && cabin) {
    const key = `${origin}::${destination}::${programId}::${cabin}`;
    results = store.awardByRouteProgramCabin.get(key) ?? [];
    if (results.length === 0) {
      // Try reverse
      const revKey = `${destination}::${origin}::${programId}::${cabin}`;
      results = (store.awardByRouteProgramCabin.get(revKey) ?? []).map(a => ({
        ...a,
        notes: (a.notes ? a.notes + '; ' : '') + 'Reverse direction assumed equal — verify on airline site',
      }));
    }
  } else {
    const routeKey = `${origin}::${destination}`;
    results = store.awardsByRoute.get(routeKey) ?? [];
    if (results.length === 0) {
      const revKey = `${destination}::${origin}`;
      results = (store.awardsByRoute.get(revKey) ?? []).map(a => ({
        ...a,
        notes: (a.notes ? a.notes + '; ' : '') + 'Reverse direction assumed equal — verify on airline site',
      }));
    }

    if (programId) results = results.filter(a => a.program_id === programId);
    if (cabin) results = results.filter(a => a.cabin === cabin);
  }

  return results;
}

/** Get all transfer ratios from a specific card to a specific program */
export function getTransferRatio(
  store: DataStore,
  cardId: string,
  programId: string
): CardProgramRatioRow | undefined {
  const key = `${cardId}::${programId}`;
  const list = store.ratioByCardAndProgram.get(key);
  return list?.[0];
}

/** Get programs reachable from a card */
export function getReachablePrograms(
  store: DataStore,
  cardId: string
): { program: LoyaltyProgramRow; ratio: CardProgramRatioRow }[] {
  const ratios = store.ratiosByCard.get(cardId) ?? [];
  const result: { program: LoyaltyProgramRow; ratio: CardProgramRatioRow }[] = [];
  for (const r of ratios) {
    const program = store.programById.get(r.program_id);
    if (program) {
      result.push({ program, ratio: r });
    }
  }
  return result;
}

/** Airport search: match IATA, city, name, country — case insensitive */
export function searchAirports(store: DataStore, query: string): AirportRow[] {
  if (!query || query.length < 1) return [];
  const q = query.toLowerCase();

  // Score each airport
  const scored = store.airports.map(a => {
    let score = 0;
    const iata = a.iata.toLowerCase();
    const city = a.city.toLowerCase();
    const name = a.name.toLowerCase();
    const country = a.country_code.toLowerCase();

    // Exact IATA match = highest
    if (iata === q) score = 100;
    else if (iata.startsWith(q)) score = 80;
    else if (city === q) score = 70;
    else if (city.startsWith(q)) score = 60;
    else if (name.includes(q)) score = 40;
    else if (country === q) score = 30;
    else score = -1; // no match

    return { airport: a, score };
  }).filter(s => s.score > 0);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 15).map(s => s.airport);
}

/** Calculate distance between two airports in km using Haversine */
export function getDistanceKm(a: AirportRow, b: AirportRow): number {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lon - a.lon) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const aa = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return R * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}
