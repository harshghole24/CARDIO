import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plane, ArrowRight, MapPin, Calculator, Sparkles, Navigation, X,
  ShieldAlert, ShieldCheck, CreditCard, Clock, TrendingUp, Zap
} from 'lucide-react';
import { requiredSpendForAward, monthsToGoal } from '../lib/calculators/travelPlanner';
import { api } from '../lib/api';
import { useDataStore } from '../lib/data/DataContext';
import { findAwards, searchAirports, getDistanceKm } from '../lib/data/dataStore';
import type { AirportRow, LoyaltyProgramRow, AwardChartRow } from '../lib/data/schemas';
import { useNavigate } from 'react-router-dom';

function formatINR(n: number) {
  if (!isFinite(n) || n > 1e9) return '∞';
  return n.toLocaleString('en-IN');
}

function formatTimeline(months: number) {
  if (!isFinite(months) || months > 999) return '> 5 years';
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} month${m !== 1 ? 's' : ''}`;
  if (m === 0) return `${y} year${y !== 1 ? 's' : ''}`;
  return `${y}y ${m}m`;
}

const TravelGoals = () => {
  const { store, loading: dataLoading } = useDataStore();
  const navigate = useNavigate();
  const [userCards, setUserCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [originQuery, setOriginQuery] = useState('');
  const [origin, setOrigin] = useState<AirportRow | null>(null);
  const [destQuery, setDestQuery] = useState('');
  const [destination, setDestination] = useState<AirportRow | null>(null);

  const [showOriginDropdown, setShowOriginDropdown] = useState(false);
  const [showDestDropdown, setShowDestDropdown] = useState(false);

  const [tripType, setTripType] = useState<'ONE_WAY' | 'RETURN'>('ONE_WAY');
  const [cabin, setCabin] = useState('ECONOMY');
  const [travellers, setTravellers] = useState(1);
  const [monthlySpend, setMonthlySpend] = useState(50000);

  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);

  useEffect(() => {
    api.getCards()
      .then(cards => setUserCards(cards || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const originResults = useMemo(() => store ? searchAirports(store, originQuery) : [], [store, originQuery]);
  const destResults = useMemo(() => store ? searchAirports(store, destQuery) : [], [store, destQuery]);

  const availableAwards = useMemo(() => {
    if (!store || !origin || !destination) return [];
    return findAwards(store, origin.iata, destination.iata, undefined, cabin);
  }, [store, origin, destination, cabin]);

  // Auto-select first available program
  useEffect(() => {
    if (availableAwards.length > 0 && !selectedProgramId) {
      setSelectedProgramId(availableAwards[0].program_id);
    }
    if (availableAwards.length === 0) setSelectedProgramId(null);
  }, [availableAwards]);

  // --- Program groups: derived entirely from monthly spend (no stale state) ---
  const programGroups = useMemo(() => {
    if (!store || availableAwards.length === 0) return { ready: [], stretch: [], noPath: [] };

    const ready: any[] = [];
    const stretch: any[] = [];
    const noPath: any[] = [];

    availableAwards.forEach(award => {
      const program = store.programById.get(award.program_id);
      if (!program) return;

      const multiplier = (tripType === 'RETURN' && award.trip_type === 'ONE_WAY') ? 2 : 1;
      const pointsRequired = award.points_required * travellers * multiplier;

      // Find which owned cards can transfer to this program
      const userPaths = userCards.map(uc => {
        const dbCard = store.cardById.get(uc.card_id);
        if (!dbCard) return null;
        const ratio = store.ratioByCardAndProgram.get(`${dbCard.card_id}::${program.program_id}`)?.[0];
        if (!ratio) return null;

        const req = requiredSpendForAward(pointsRequired, dbCard, ratio);
        // Timeline is pure derived data — recomputed live from monthlySpend
        const timeline = monthsToGoal(req.spendInr, monthlySpend);

        return { userCard: uc, dbCard, ratio, req, timeline };
      }).filter(Boolean);

      if (userPaths.length === 0) {
        noPath.push({ program, award, paths: [] });
      } else {
        // Can ANY card reach the goal in 48 months at this spend?
        const canAchieve = userPaths.some(p => p!.timeline.achievable);
        if (canAchieve) ready.push({ program, award, paths: userPaths });
        else stretch.push({ program, award, paths: userPaths });
      }
    });

    return { ready, stretch, noPath };
  }, [store, availableAwards, userCards, travellers, tripType, monthlySpend]);

  const selectedAwardData = useMemo(() => {
    if (!selectedProgramId) return null;
    return [...programGroups.ready, ...programGroups.stretch, ...programGroups.noPath]
      .find(g => g.program.program_id === selectedProgramId) || null;
  }, [programGroups, selectedProgramId]);

  // Boarding pass: exact points from award chart — never invented
  const boardingPassData = useMemo(() => {
    if (!selectedAwardData) return null;
    const award = selectedAwardData.award;
    const program = selectedAwardData.program;
    const multiplier = (tripType === 'RETURN' && award.trip_type === 'ONE_WAY') ? 2 : 1;
    const pointsRequired = award.points_required * travellers * multiplier;
    return { award, program, pointsRequired, multiplier };
  }, [selectedAwardData, tripType, travellers]);

  // --- Card Recommendation Engine (Task 3) ---
  const cardRecommendation = useMemo(() => {
    if (!store || !boardingPassData) return null;
    const { pointsRequired, program } = boardingPassData;

    // Step A: Rank owned cards
    const ownedPaths = userCards.map(uc => {
      const dbCard = store.cardById.get(uc.card_id);
      if (!dbCard) return null;
      const ratio = store.ratioByCardAndProgram.get(`${dbCard.card_id}::${program.program_id}`)?.[0];
      if (!ratio) return null;
      const req = requiredSpendForAward(pointsRequired, dbCard, ratio);
      const timeline = monthsToGoal(req.spendInr, monthlySpend);
      const netCost = dbCard.annual_fee_inr;
      return { userCard: uc, dbCard, ratio, req, timeline, netCost, source: 'owned' as const };
    }).filter(Boolean).sort((a, b) => a!.timeline.months - b!.timeline.months);

    const bestOwned = ownedPaths[0] || null;

    // Step B: Search all 280 cards for cards not in wallet
    const alternatives = store.cards
      .filter(c => !userCards.some(uc => uc.card_id === c.card_id))
      .map(dbCard => {
        const ratio = store.ratioByCardAndProgram.get(`${dbCard.card_id}::${program.program_id}`)?.[0];
        if (!ratio) return null;
        const req = requiredSpendForAward(pointsRequired, dbCard, ratio);
        const timeline = monthsToGoal(req.spendInr, monthlySpend);
        const netCost = dbCard.annual_fee_inr;
        return { dbCard, ratio, req, timeline, netCost, source: 'catalogue' as const };
      })
      .filter(Boolean)
      .sort((a, b) => {
        // Rank by fastest, then by fee
        if (a!.timeline.months !== b!.timeline.months) return a!.timeline.months - b!.timeline.months;
        return a!.netCost - b!.netCost;
      })
      .slice(0, 3);

    // Only show catalogue alternatives if they're materially better (≥25% faster)
    const MATERIALLY_BETTER = 0.75; // must be ≤75% of bestOwned months
    const filteredAlternatives = bestOwned
      ? alternatives.filter(a => a!.timeline.months <= bestOwned!.timeline.months * MATERIALLY_BETTER)
      : alternatives;

    return { bestOwned, alternatives: filteredAlternatives };
  }, [store, boardingPassData, userCards, monthlySpend]);

  const distance = origin && destination ? getDistanceKm(origin, destination) : 0;

  if (dataLoading || loading) {
    return <div className="flex justify-center items-center h-screen"><div className="animate-spin w-8 h-8 border-4 border-pastel-lavender border-t-transparent rounded-full"></div></div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen">
      <header className="mb-10">
        <h1 className="text-3xl font-display font-bold text-text-primary mb-2 flex items-center gap-3">
          <Plane className="w-8 h-8 text-pastel-lavender" />
          Travel Goals Engine
        </h1>
        <p className="text-text-muted font-medium">Live exact calculations — from credit card to award flight.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* ── LEFT COLUMN ── */}
        <div className="lg:col-span-5 space-y-6">

          {/* 1. Where to? */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="glass-card p-6 border border-white/10 rounded-3xl">
            <h2 className="text-xl font-display font-bold text-text-primary mb-6 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-pastel-pink" /> 1. Where to?
            </h2>

            {/* Origin */}
            <div className="relative mb-2">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-pastel-lavender z-10" />
              <input
                type="text"
                placeholder="Origin Airport (BOM, Delhi…)"
                value={originQuery}
                onChange={e => { setOriginQuery(e.target.value); setOrigin(null); setShowOriginDropdown(true); }}
                onFocus={() => setShowOriginDropdown(true)}
                onBlur={() => setTimeout(() => setShowOriginDropdown(false), 200)}
                className="w-full bg-dark-elevated border border-white/10 rounded-xl py-3 pl-10 pr-10 text-text-primary focus:outline-none focus:border-pastel-lavender/50 shadow-inner"
              />
              {origin && <button onClick={() => { setOrigin(null); setOriginQuery(''); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded-full z-10"><X className="w-4 h-4" /></button>}
              {showOriginDropdown && originResults.length > 0 && !origin && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-dark-surface border border-white/10 rounded-xl shadow-2xl max-h-52 overflow-y-auto z-50">
                  {originResults.map(a => (
                    <div key={a.iata} onMouseDown={() => { setOrigin(a); setOriginQuery(`${a.iata} — ${a.city}`); setShowOriginDropdown(false); }} className="p-3 hover:bg-white/5 cursor-pointer flex justify-between items-center border-b border-white/5 last:border-0">
                      <div><p className="font-bold">{a.city}</p><p className="text-xs text-text-muted">{a.name}</p></div>
                      <span className="bg-white/10 px-2 py-1 rounded text-xs font-mono">{a.iata}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Swap button */}
            <div className="flex justify-center my-1">
              <button onClick={() => {
                const [o, oq, d, dq] = [origin, originQuery, destination, destQuery];
                setOrigin(d); setOriginQuery(dq); setDestination(o); setDestQuery(oq);
              }} className="bg-dark-base p-2 rounded-full border border-white/10 hover:border-pastel-lavender/50 transition-colors text-text-muted hover:text-pastel-lavender">
                ⇅
              </button>
            </div>

            {/* Destination */}
            <div className="relative">
              <Plane className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-pastel-pink z-10" />
              <input
                type="text"
                placeholder="Destination (SIN, London…)"
                value={destQuery}
                onChange={e => { setDestQuery(e.target.value); setDestination(null); setShowDestDropdown(true); }}
                onFocus={() => setShowDestDropdown(true)}
                onBlur={() => setTimeout(() => setShowDestDropdown(false), 200)}
                className="w-full bg-dark-elevated border border-white/10 rounded-xl py-3 pl-10 pr-10 text-text-primary focus:outline-none focus:border-pastel-pink/50 shadow-inner"
              />
              {destination && <button onClick={() => { setDestination(null); setDestQuery(''); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded-full z-10"><X className="w-4 h-4" /></button>}
              {showDestDropdown && destResults.length > 0 && !destination && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-dark-surface border border-white/10 rounded-xl shadow-2xl max-h-52 overflow-y-auto z-50">
                  {destResults.map(a => (
                    <div key={a.iata} onMouseDown={() => { setDestination(a); setDestQuery(`${a.iata} — ${a.city}`); setShowDestDropdown(false); }} className="p-3 hover:bg-white/5 cursor-pointer flex justify-between items-center border-b border-white/5 last:border-0">
                      <div><p className="font-bold">{a.city}</p><p className="text-xs text-text-muted">{a.name}</p></div>
                      <span className="bg-white/10 px-2 py-1 rounded text-xs font-mono">{a.iata}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <select value={cabin} onChange={e => setCabin(e.target.value)} className="bg-dark-elevated border border-white/10 rounded-xl p-3 focus:outline-none focus:border-pastel-lavender text-sm">
                <option value="ECONOMY">Economy</option>
                <option value="BUSINESS">Business</option>
                <option value="FIRST">First</option>
              </select>
              <select value={tripType} onChange={e => setTripType(e.target.value as any)} className="bg-dark-elevated border border-white/10 rounded-xl p-3 focus:outline-none focus:border-pastel-lavender text-sm">
                <option value="ONE_WAY">One-way</option>
                <option value="RETURN">Return</option>
              </select>
            </div>
          </motion.div>

          {/* 2. Personal Constraints — timeline is derived, not stored state */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="glass-card p-6 border border-white/10 rounded-3xl">
            <h2 className="text-lg font-display font-bold text-text-primary mb-4 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-pastel-mint" /> 2. Personal Constraints
            </h2>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-xs text-text-muted uppercase font-bold">Monthly Spend (₹)</label>
                  <span className="font-bold text-pastel-mint">₹{formatINR(monthlySpend)}</span>
                </div>
                <input type="range" min="5000" max="500000" step="5000" value={monthlySpend} onChange={e => setMonthlySpend(parseInt(e.target.value))} className="w-full accent-pastel-mint" />
                {monthlySpend <= 0 && <p className="text-xs text-red-400 mt-1">Add monthly spend to see timelines</p>}
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-xs text-text-muted uppercase font-bold">Travellers</label>
                  <span className="font-bold text-pastel-lavender">{travellers}</span>
                </div>
                <input type="range" min="1" max="6" step="1" value={travellers} onChange={e => setTravellers(parseInt(e.target.value))} className="w-full accent-pastel-lavender" />
              </div>
            </div>
          </motion.div>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="lg:col-span-7 flex flex-col gap-6">

          {/* BOARDING PASS */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="w-full">
            <div className="flex flex-col md:flex-row shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
              {/* Left ticket */}
              <div className="bg-gradient-to-br from-pastel-lavender/10 to-pastel-pink/10 backdrop-blur-xl border border-white/20 p-8 rounded-t-3xl md:rounded-l-3xl md:rounded-tr-none flex-1 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><Plane className="w-32 h-32 rotate-45" /></div>

                <div className="flex justify-between items-center mb-10 relative z-10">
                  <span className="text-xs font-bold uppercase tracking-widest text-text-muted border border-white/10 px-3 py-1 rounded-full bg-dark-base/50">Award Flight</span>
                  <span className="font-display font-bold text-pastel-lavender text-sm">
                    {origin && destination ? 'Route Confirmed' : 'Select Route'}
                  </span>
                </div>

                <div className="flex justify-between items-center relative z-10">
                  <div>
                    <h3 className="text-5xl font-display font-black text-text-primary">{origin ? origin.iata : 'XXX'}</h3>
                    <p className="text-text-muted mt-2 text-sm uppercase tracking-wider">{origin ? origin.city : 'Departure'}</p>
                  </div>

                  <div className="flex-1 px-6 flex flex-col items-center justify-center relative">
                    <div className="w-full border-t-2 border-dashed border-pastel-lavender/30 absolute top-1/2 -translate-y-1/2"></div>
                    {origin && destination && (
                      <motion.div animate={{ x: [0, 140, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} className="bg-dark-base p-2 rounded-full z-10 border border-pastel-lavender/20 shadow-[0_0_15px_rgba(230,230,250,0.3)]">
                        <Plane className="w-5 h-5 text-pastel-lavender" />
                      </motion.div>
                    )}
                  </div>

                  <div className="text-right">
                    <h3 className="text-5xl font-display font-black text-text-primary">{destination ? destination.iata : 'XXX'}</h3>
                    <p className="text-text-muted mt-2 text-sm uppercase tracking-wider">{destination ? destination.city : 'Arrival'}</p>
                  </div>
                </div>

                <div className="mt-8 grid grid-cols-3 gap-3 relative z-10">
                  <div>
                    <p className="text-xs text-text-muted uppercase mb-1">Distance</p>
                    <p className="font-bold text-text-primary text-sm">{distance > 0 ? `${formatINR(Math.round(distance))} km` : '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted uppercase mb-1">Cabin</p>
                    <p className="font-bold text-text-primary text-sm">{cabin}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted uppercase mb-1">Trip Type</p>
                    <p className="font-bold text-text-primary text-sm">{tripType === 'RETURN' ? 'Return' : 'One-way'}</p>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="bg-dark-surface flex flex-row md:flex-col items-center justify-center relative border-y md:border-y-0 md:border-x border-white/10 px-0 md:px-0 w-6">
                <div className="absolute top-0 w-4 h-4 rounded-full bg-dark-base -translate-y-1/2"></div>
                <div className="w-full h-full border-t md:border-l md:border-t-0 border-dashed border-white/20 mx-auto"></div>
                <div className="absolute bottom-0 w-4 h-4 rounded-full bg-dark-base translate-y-1/2"></div>
              </div>

              {/* Right ticket — EXACT points from award chart */}
              <div className="bg-dark-elevated border border-white/10 p-8 rounded-b-3xl md:rounded-r-3xl md:rounded-bl-none md:w-60 flex flex-col justify-center items-center text-center">
                <Sparkles className="w-8 h-8 text-pastel-mint mb-3" />
                {boardingPassData ? (
                  <>
                    <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Points Required</p>
                    <h3 className="text-3xl font-black text-pastel-mint mb-1">
                      {formatINR(boardingPassData.pointsRequired)}
                    </h3>
                    <p className="text-xs text-pastel-lavender font-bold mb-2">{boardingPassData.program.currency_name}</p>
                    <p className="text-xs text-text-muted">{boardingPassData.program.name}</p>
                    {boardingPassData.multiplier > 1 && (
                      <p className="text-xs text-pastel-peach mt-1">×{boardingPassData.multiplier} (return)</p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-xs text-text-muted uppercase tracking-wider mb-2">Points Required</p>
                    <p className="text-2xl font-black text-text-muted">—</p>
                    <p className="text-xs text-text-muted mt-2">Select route</p>
                  </>
                )}
              </div>
            </div>
          </motion.div>

          {/* 3. Loyalty Program Selector */}
          {origin && destination && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 border border-white/10 rounded-3xl">
              <h2 className="text-xl font-display font-bold text-text-primary mb-5 flex items-center gap-2">
                <Navigation className="w-5 h-5 text-pastel-blue" /> 3. Choose Loyalty Club
              </h2>

              {availableAwards.length === 0 ? (
                <div className="p-8 text-center text-text-muted border border-dashed border-white/10 rounded-xl">
                  <p className="font-bold mb-1">No published award chart for this route</p>
                  <p className="text-xs">No verified price in our dataset for {origin.iata} ↔ {destination.iata} ({cabin}).</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Ready */}
                  {programGroups.ready.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-pastel-mint mb-3 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4" /> Ready — reachable within timeline
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {programGroups.ready.map(({ program, award }) => {
                          const multiplier = (tripType === 'RETURN' && award.trip_type === 'ONE_WAY') ? 2 : 1;
                          const pts = award.points_required * travellers * multiplier;
                          const bestPath = [...programGroups.ready.find(g => g.program.program_id === program.program_id)?.paths || []].sort((a, b) => a.timeline.months - b.timeline.months)[0];
                          return (
                            <button key={program.program_id} onClick={() => setSelectedProgramId(program.program_id)}
                              className={`p-4 rounded-xl text-left border transition-all ${selectedProgramId === program.program_id ? 'border-pastel-mint bg-pastel-mint/10' : 'border-white/10 bg-dark-elevated hover:border-pastel-mint/50'}`}
                            >
                              <p className="font-bold text-text-primary">{program.name}</p>
                              <p className="text-xs text-text-muted mt-0.5">{program.alliance_general_knowledge || program.type}</p>
                              <div className="flex justify-between items-center mt-2">
                                <span className="text-sm font-bold text-pastel-mint">{formatINR(pts)} {program.currency_name}</span>
                                {bestPath && <span className="text-xs text-text-muted">{formatTimeline(bestPath.timeline.months)}</span>}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Stretch */}
                  {programGroups.stretch.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-pastel-peach mb-3 flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4" /> Possible with more time or spend
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {programGroups.stretch.map(({ program, award }) => {
                          const multiplier = (tripType === 'RETURN' && award.trip_type === 'ONE_WAY') ? 2 : 1;
                          const pts = award.points_required * travellers * multiplier;
                          const bestPath = [...programGroups.stretch.find(g => g.program.program_id === program.program_id)?.paths || []].sort((a, b) => a.timeline.months - b.timeline.months)[0];
                          return (
                            <button key={program.program_id} onClick={() => setSelectedProgramId(program.program_id)}
                              className={`p-4 rounded-xl text-left border transition-all ${selectedProgramId === program.program_id ? 'border-pastel-peach bg-pastel-peach/10' : 'border-white/10 bg-dark-elevated hover:border-pastel-peach/50'}`}
                            >
                              <p className="font-bold text-text-primary">{program.name}</p>
                              <p className="text-xs text-text-muted mt-0.5">{program.alliance_general_knowledge || program.type}</p>
                              <div className="flex justify-between items-center mt-2">
                                <span className="text-sm font-bold text-pastel-peach">{formatINR(pts)} {program.currency_name}</span>
                                {bestPath && <span className="text-xs text-text-muted">{formatTimeline(bestPath.timeline.months)}</span>}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* No Path */}
                  {programGroups.noPath.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3 flex items-center gap-2">
                        <X className="w-4 h-4" /> No transfer path from your cards
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 opacity-50">
                        {programGroups.noPath.map(({ program, award }) => {
                          const multiplier = (tripType === 'RETURN' && award.trip_type === 'ONE_WAY') ? 2 : 1;
                          const pts = award.points_required * travellers * multiplier;
                          return (
                            <div key={program.program_id} className="p-4 rounded-xl text-left border border-white/5 bg-dark-base cursor-not-allowed">
                              <p className="font-bold text-text-primary">{program.name}</p>
                              <p className="text-xs text-text-muted mt-0.5">{program.alliance_general_knowledge || program.type}</p>
                              <p className="text-sm text-text-muted mt-2">{formatINR(pts)} {program.currency_name}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* 4. Conversion Breakdown (Transparent Conversion Panel) */}
          {selectedAwardData && selectedAwardData.paths.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 border border-pastel-lavender/30 rounded-3xl">
              <h2 className="text-xl font-display font-bold text-text-primary mb-5 flex items-center gap-2">
                <ArrowRight className="w-5 h-5 text-pastel-lavender" /> 4. Transparent Conversion Panel
              </h2>

              <div className="space-y-5">
                {[...selectedAwardData.paths].sort((a, b) => a.req.spendInr - b.req.spendInr).map((path: any, idx: number) => (
                  <div key={path.userCard.id} className={`p-5 rounded-2xl border ${idx === 0 ? 'border-pastel-lavender bg-pastel-lavender/5' : 'border-white/5 bg-dark-elevated'}`}>
                    {idx === 0 && <span className="bg-pastel-lavender text-dark-base text-xs font-bold px-2 py-1 rounded mb-3 inline-block uppercase tracking-wider">Best Option</span>}

                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-lg font-bold text-text-primary">{path.dbCard.name}</h3>
                      <div className="text-right">
                        <p className="font-bold text-pastel-mint">₹{formatINR(Math.round(path.req.spendInr))}</p>
                        <p className="text-xs text-text-muted flex items-center gap-1 justify-end mt-0.5">
                          <Clock className="w-3 h-3" /> {formatTimeline(path.timeline.months)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-text-muted mb-4">
                      <div className="bg-dark-base/50 p-2 rounded-lg">
                        <p>Award Price</p>
                        <p className="font-bold text-text-primary mt-0.5">{formatINR(selectedAwardData.award.points_required)} {selectedAwardData.program.currency_name}</p>
                      </div>
                      <div className="bg-dark-base/50 p-2 rounded-lg">
                        <p>Ratio</p>
                        <p className="font-bold text-text-primary mt-0.5">{path.ratio.ratio_text}</p>
                      </div>
                      <div className="bg-dark-base/50 p-2 rounded-lg">
                        <p>Bank Points Needed</p>
                        <p className="font-bold text-text-primary mt-0.5">{formatINR(path.req.bankPointsNeeded)}<span className="text-text-muted font-normal"> (min block: {path.ratio.min_transfer})</span></p>
                      </div>
                      <div className="bg-dark-base/50 p-2 rounded-lg">
                        <p>Earn Rate</p>
                        <p className="font-bold text-text-primary mt-0.5">{path.dbCard.base_points_per_100_inr_derived} pts/₹100</p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full bg-dark-base rounded-full h-2 overflow-hidden mb-2">
                      <div className="bg-gradient-to-r from-pastel-lavender to-pastel-pink h-full transition-all" style={{ width: `${Math.min(100, (monthlySpend * 12 / path.req.spendInr) * 100)}%` }}></div>
                    </div>
                    <p className="text-xs text-text-muted">At ₹{formatINR(monthlySpend)}/mo — {formatTimeline(path.timeline.months)} to goal</p>
                    {path.req.warning && <p className="text-xs text-red-400 mt-2 flex items-center gap-1"><ShieldAlert className="w-3 h-3" />{path.req.warning}</p>}
                    <p className="text-xs text-text-muted/60 mt-2">Confidence: {path.ratio.confidence}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* 5. Card Recommendation Engine */}
          {boardingPassData && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 border border-white/10 rounded-3xl">
              <h2 className="text-xl font-display font-bold text-text-primary mb-5 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-pastel-peach" /> 5. Card Recommendation
              </h2>

              {cardRecommendation?.bestOwned ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-pastel-mint mb-2 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Best card in your wallet</p>
                    <div className="p-4 bg-pastel-mint/5 border border-pastel-mint/20 rounded-2xl">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-text-primary">{cardRecommendation.bestOwned.dbCard.name}</p>
                          <p className="text-xs text-text-muted">{cardRecommendation.bestOwned.ratio.ratio_text} to {boardingPassData.program.name}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-pastel-mint">{formatTimeline(cardRecommendation.bestOwned.timeline.months)}</p>
                          <p className="text-xs text-text-muted">₹{formatINR(Math.round(cardRecommendation.bestOwned.req.spendInr))} spend</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {cardRecommendation.alternatives.length > 0 && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-pastel-peach mb-2 flex items-center gap-1"><Zap className="w-3 h-3" /> Optional upgrade (≥25% faster)</p>
                      <div className="space-y-2">
                        {cardRecommendation.alternatives.map((alt: any, idx: number) => (
                          <div key={alt.dbCard.card_id} className="p-4 bg-pastel-peach/5 border border-pastel-peach/20 rounded-2xl flex items-center justify-between gap-4">
                            <div>
                              <p className="font-bold text-text-primary">{alt.dbCard.name}</p>
                              <p className="text-xs text-text-muted">{alt.dbCard.issuer} • ₹{formatINR(alt.dbCard.annual_fee_inr)} fee • {alt.ratio.ratio_text}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="font-bold text-pastel-peach">{formatTimeline(alt.timeline.months)}</p>
                              <button onClick={() => navigate('/cards')} className="text-xs text-pastel-lavender hover:underline mt-1 flex items-center gap-1 justify-end">
                                <CreditCard className="w-3 h-3" /> Add to wallet →
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <p className="text-text-muted text-sm mb-4">No cards in your wallet that can reach this program. Here are the top cards you could get:</p>
                  {(cardRecommendation?.alternatives || []).length === 0 ? (
                    <div className="p-6 text-center border border-dashed border-white/10 rounded-xl text-text-muted text-sm">
                      No cards found with a transfer path to {boardingPassData.program.name}. Try a different loyalty program.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(cardRecommendation?.alternatives || []).map((alt: any) => (
                        <div key={alt.dbCard.card_id} className="p-4 bg-dark-elevated border border-white/10 rounded-2xl flex items-center justify-between gap-4">
                          <div>
                            <p className="font-bold text-text-primary">{alt.dbCard.name}</p>
                            <p className="text-xs text-text-muted">{alt.dbCard.issuer} • ₹{formatINR(alt.dbCard.annual_fee_inr)} annual fee</p>
                            <p className="text-xs text-text-muted">Transfer: {alt.ratio.ratio_text} • Earn: {alt.dbCard.base_points_per_100_inr_derived} pts/₹100</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-bold text-pastel-lavender">{formatTimeline(alt.timeline.months)}</p>
                            <p className="text-xs text-text-muted">₹{formatINR(Math.round(alt.req.spendInr))}</p>
                            <button onClick={() => navigate('/cards')} className="text-xs text-pastel-lavender hover:underline mt-1 flex items-center gap-1 justify-end">
                              <CreditCard className="w-3 h-3" /> Add to wallet →
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TravelGoals;
