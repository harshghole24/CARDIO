import React, { useMemo } from 'react';
import { Plane, Sparkles, Zap, Scissors, Printer } from 'lucide-react';
import type { AirportRow } from '../lib/data/schemas';
import './BoardingPass.css';

interface BoardingPassProps {
  origin: AirportRow | null;
  destination: AirportRow | null;
  cabin: string;
  tripType: 'ONE_WAY' | 'RETURN';
  travellers: number;
  passengerName: string;
  boardingPassData: {
    award: any;
    program: any;
    pointsRequired: number;
    multiplier: number;
  } | null;
  distance: number;
  savingGoal: boolean;
  saveSuccess: boolean;
  onSaveGoal: () => void;
}

function formatINR(n: number) {
  if (!isFinite(n) || n > 1e9) return '∞';
  return n.toLocaleString('en-IN');
}

export const BoardingPass: React.FC<BoardingPassProps> = ({
  origin,
  destination,
  cabin,
  tripType,
  travellers,
  passengerName,
  boardingPassData,
  distance,
  savingGoal,
  saveSuccess,
  onSaveGoal
}) => {
  // Derived airport codes and names
  const originIata = origin?.iata || 'DEL';
  const originCity = origin?.city || 'Delhi';
  const originCountry = origin?.country_code === 'IN' ? 'India' : (origin?.name || 'India');

  const destIata = destination?.iata || 'BOM';
  const destCity = destination?.city || 'Mumbai';
  const destCountry = destIata === 'BOM'
    ? 'Maharashtra, India'
    : (destination?.country_code === 'IN' ? `${destCity}, India` : (destination?.name || 'International'));

  // Airline & program information
  const airlineName = useMemo(() => {
    if (!boardingPassData) return 'Air India';
    const name = boardingPassData.program.name;
    if (name.includes('Air India')) return 'Air India';
    if (name.includes('Singapore')) return 'Singapore Airlines';
    if (name.includes('British Airways')) return 'British Airways';
    if (name.includes('Virgin')) return 'Virgin Atlantic';
    if (name.includes('Emirates')) return 'Emirates';
    if (name.includes('Qatar')) return 'Qatar Airways';
    return name;
  }, [boardingPassData]);

  const clubName = useMemo(() => {
    if (!boardingPassData) return 'Maharaja Club';
    const name = boardingPassData.program.name;
    if (name.includes('Maharaja')) return 'Maharaja Club';
    if (name.includes('KrisFlyer')) return 'KrisFlyer';
    if (name.includes('Executive Club')) return 'Executive Club';
    return boardingPassData.program.currency_name || 'Frequent Flyer';
  }, [boardingPassData]);

  // Derived flight metadata
  const flightNumber = useMemo(() => {
    if (!boardingPassData) return 'AI-804';
    const progId = boardingPassData.program.program_id;
    if (progId === 'AIR_INDIA_MAHARAJA') return 'AI-804';
    if (progId === 'SINGAPORE_KRISFLYER') return 'SQ-423';
    if (progId === 'BRITISH_AIRWAYS_EXECUTIVE_CLUB') return 'BA-138';
    return `CD-${originIata.slice(0, 1)}${destIata.slice(0, 2)}`;
  }, [boardingPassData, originIata, destIata]);

  const seatAssignment = useMemo(() => {
    if (cabin === 'FIRST') return '01A Window';
    if (cabin === 'BUSINESS') return '03F Window';
    return '14B Window';
  }, [cabin]);

  const cabinDisplay = useMemo(() => {
    if (cabin === 'FIRST') return 'First';
    if (cabin === 'BUSINESS') return 'Business';
    return 'Economy';
  }, [cabin]);

  const displayDistance = distance > 0 ? `${formatINR(Math.round(distance))} km` : '1,137 km';
  const pointsRequired = boardingPassData ? boardingPassData.pointsRequired : 5000;
  const currencyName = boardingPassData ? boardingPassData.program.currency_name : 'Maharaja Points';
  const programFullName = boardingPassData ? boardingPassData.program.name : 'Air India Maharaja Club';
  const estCashValue = Math.round(pointsRequired * 0.85);

  // Realistic Barcode Generator (varying widths in SVG)
  const barcodePattern = useMemo(() => [
    2, 1, 3, 1, 2, 4, 1, 3, 1, 2, 1, 4, 2, 1, 3, 2, 1, 1, 4, 2,
    1, 3, 1, 2, 4, 1, 2, 3, 1, 4, 1, 2, 1, 3, 2, 4, 1, 2, 3, 1,
    2, 4, 1, 3, 2, 1, 3, 1
  ], []);

  return (
    <div className="bp-container">
      {/* Main Ticket Container */}
      <div className="bp-ticket">
        {/* Compact Print Icon Button in Top-Right Corner */}
        <button
          onClick={() => window.print()}
          className="bp-print-btn absolute top-3 right-3 p-1.5 rounded-lg text-text-muted hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all z-30 no-print cursor-pointer shadow-sm"
          title="Print or Save as PDF"
          aria-label="Download or Print Boarding Pass"
        >
          <Printer className="w-3.5 h-3.5 text-pastel-lavender" />
        </button>

        {/* Subtle Airline Watermark Background */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.05] select-none overflow-hidden">
          <Plane className="w-72 h-72 rotate-45 text-white" />
        </div>

        {/* ===================================================================
            MAIN SECTION (LEFT)
           =================================================================== */}
        <div className="bp-main">
          {/* a) Header row */}
          <div className="bp-header-row flex justify-between items-center gap-2 relative z-10 mb-2.5 pr-8">
            {/* Left: airline tile + names + letter-spaced caption */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center text-pastel-lavender shadow-inner shrink-0">
                <Plane className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex flex-col justify-center">
                <h4 className="font-display font-bold text-sm text-white tracking-wide leading-tight truncate">
                  {airlineName}
                </h4>
                <p className="text-[11px] font-semibold text-pastel-lavender leading-tight truncate mt-0.5">
                  {clubName}
                </p>
                <p className="bp-header-caption text-[8px] sm:text-[9px] font-mono tracking-[0.14em] uppercase text-text-muted mt-0.5">
                  OFFICIAL ELECTRONIC BOARDING PASS
                </p>
              </div>
            </div>

            {/* Right: pills */}
            <div className="bp-header-pills shrink-0">
              <span className="bp-pill-award inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 whitespace-nowrap shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse shrink-0"></span>
                Award Confirmed
              </span>
              <span className="bp-pill-cabin inline-block text-[10px] sm:text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-white/20 bg-white/[0.04] text-text-primary whitespace-nowrap">
                {cabin.toUpperCase()} CLASS
              </span>
            </div>
          </div>

          {/* b) Route row (the hero) */}
          <div className="bp-route-grid my-2">
            {/* Left: Origin */}
            <div className="min-w-0 text-left">
              <h3 className="bp-iata text-left">
                {originIata}
              </h3>
              <p className="font-semibold text-text-primary text-xs sm:text-sm mt-0.5 truncate">
                {originCity}
              </p>
              <p className="text-[10px] sm:text-xs text-text-muted truncate">
                {originCountry}
              </p>
            </div>

            {/* Center: Flight path */}
            <div className="bp-flight-center flex flex-col items-center justify-center shrink-0">
              <span className="font-mono text-[11px] sm:text-xs font-bold text-pastel-lavender mb-1 whitespace-nowrap">
                {displayDistance}
              </span>
              <div className="w-full relative flex items-center justify-center py-1.5">
                <div className="w-full border-t-2 border-dashed border-pastel-lavender/40 absolute top-1/2 -translate-y-1/2"></div>
                <div className="relative z-10 bg-[#161836] p-1.5 rounded-full border border-pastel-lavender/40 shadow-[0_0_12px_rgba(195,177,225,0.35)]">
                  <Plane className="w-3.5 h-3.5 text-pastel-lavender rotate-90" />
                </div>
              </div>
              <span className="text-[9px] sm:text-[10px] text-text-muted font-medium mt-0.5 whitespace-nowrap">
                Non-Stop Award Route
              </span>
            </div>

            {/* Right: Destination */}
            <div className="min-w-0 text-right">
              <h3 className="bp-iata text-right">
                {destIata}
              </h3>
              <p className="font-semibold text-text-primary text-xs sm:text-sm mt-0.5 truncate">
                {destCity}
              </p>
              <p className="text-[10px] sm:text-xs text-text-muted truncate">
                {destCountry}
              </p>
            </div>
          </div>

          {/* c) Details row */}
          <div className="bp-details-grid border-t border-white/10 pt-3 mt-3 relative z-10">
            {/* Row 1 items */}
            <div className="bp-detail-cell">
              <span className="bp-detail-label">PASSENGER</span>
              <span className="bp-detail-val bp-ellipsis" title={passengerName}>
                {passengerName}
              </span>
            </div>
            <div className="bp-detail-cell">
              <span className="bp-detail-label">FLIGHT</span>
              <span className="bp-detail-val text-pastel-lavender">
                {flightNumber}
              </span>
            </div>
            <div className="bp-detail-cell">
              <span className="bp-detail-label">BOARDING</span>
              <span className="bp-detail-val">
                45m prior
              </span>
            </div>
            <div className="bp-detail-cell">
              <span className="bp-detail-label">GATE / TERM</span>
              <span className="bp-detail-val text-pastel-mint">
                B12 • T2
              </span>
            </div>
            <div className="bp-detail-cell">
              <span className="bp-detail-label">CABIN</span>
              <span className="bp-detail-val">
                {cabinDisplay}
              </span>
            </div>
            <div className="bp-detail-cell">
              <span className="bp-detail-label">SEAT</span>
              <span className="bp-detail-val text-pastel-lavender">
                {seatAssignment}
              </span>
            </div>

            {/* Row 2 items */}
            <div className="bp-details-subgrid">
              <div className="bp-detail-cell bp-sub-1">
                <span className="bp-detail-label">TRIP</span>
                <span className="bp-detail-val">
                  {tripType === 'RETURN' ? 'Return, Direct' : 'One-way, Direct'}
                </span>
              </div>
              <div className="bp-detail-cell bp-sub-2">
                <span className="bp-detail-label">TRAVELLERS</span>
                <span className="bp-detail-val">
                  {travellers} Adult{travellers > 1 ? 's' : ''}
                </span>
              </div>
              <div className="bp-detail-cell bp-sub-3">
                <span className="bp-detail-label">CLASS ZONE</span>
                <span className="bp-detail-val text-emerald-400">
                  Zone 1
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ===================================================================
            PERFORATION DIVIDERS (DESKTOP & MOBILE)
           =================================================================== */}
        {/* Desktop Vertical Divider */}
        <div className="bp-divider-vertical">
          <div className="bp-notch bp-notch-top"></div>
          <div className="bp-divider-line-v"></div>
          <div className="bp-scissor-v">
            <Scissors className="w-3 h-3" />
          </div>
          <div className="bp-notch bp-notch-bottom"></div>
        </div>

        {/* Mobile Horizontal Divider */}
        <div className="bp-divider-horizontal">
          <div className="bp-notch bp-notch-left"></div>
          <div className="bp-divider-line-h"></div>
          <div className="bp-scissor-h">
            <Scissors className="w-2.5 h-2.5" />
          </div>
          <div className="bp-notch bp-notch-right"></div>
        </div>

        {/* ===================================================================
            STUB SECTION (RIGHT)
           =================================================================== */}
        <div className="bp-stub">
          {/* Header */}
          <div className="flex justify-between items-center border-b border-white/10 pb-2">
            <div>
              <span className="text-[9px] font-mono uppercase tracking-[0.16em] text-text-muted block">
                BOARDING STUB
              </span>
              <h5 className="font-bold text-xs sm:text-sm text-white mt-0.5">
                {originIata} → {destIata}
              </h5>
            </div>
            <span className="text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-pastel-lavender/15 text-pastel-lavender border border-pastel-lavender/30 font-bold">
              ZONE 1
            </span>
          </div>

          {/* Center Glass Card */}
          <div className="my-2.5 p-3 rounded-xl bg-white/[0.04] border border-white/10 text-center flex flex-col items-center relative overflow-hidden">
            <Sparkles className="w-4 h-4 text-pastel-mint mb-0.5" />
            <span className="text-[9px] font-mono uppercase tracking-widest text-text-muted">
              POINTS REQUIRED
            </span>
            <div className="text-2xl sm:text-3xl font-black tracking-tight mt-0.5 mb-0.5 bg-gradient-to-br from-[#A7F3D0] to-[#6EE7B7] bg-clip-text text-transparent">
              {formatINR(pointsRequired)}
            </div>
            <p className="text-[11px] font-bold text-pastel-lavender">
              {currencyName}
            </p>
            <p className="text-[10px] text-text-muted mt-0.5 truncate max-w-full">
              {programFullName}
            </p>

            <div className="w-full border-t border-white/10 my-2"></div>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-pastel-peach font-semibold">
              <Zap className="w-3 h-3 text-pastel-peach shrink-0" />
              <span>Est. Cash Value: ₹{formatINR(estCashValue)}</span>
            </div>

            {boardingPassData && boardingPassData.multiplier > 1 && (
              <span className="mt-1.5 text-[8px] text-pastel-lavender font-semibold bg-pastel-lavender/10 px-2 py-0.5 rounded-full border border-pastel-lavender/20">
                2× Return Flight Included
              </span>
            )}
          </div>

          {/* Primary Action Button */}
          <button
            onClick={onSaveGoal}
            disabled={savingGoal}
            className="w-full py-2.5 px-3 rounded-xl text-xs font-bold pastel-button flex items-center justify-center gap-1.5 shadow-md transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Sparkles className="w-3 h-3 shrink-0" />
            <span>
              {savingGoal ? 'Saving...' : saveSuccess ? '✓ Saved' : 'Save as Active Goal'}
            </span>
          </button>

          {/* Bottom Barcode & ETKT */}
          <div className="flex flex-col items-center gap-1 pt-2.5 mt-2 border-t border-white/10">
            {/* SVG Barcode */}
            <svg
              className="bp-barcode-svg w-full h-6 overflow-hidden"
              viewBox="0 0 240 24"
              preserveAspectRatio="none"
            >
              {barcodePattern.reduce<{ elements: React.ReactNode[]; currentX: number }>(
                (acc, width, index) => {
                  acc.elements.push(
                    <rect
                      key={index}
                      x={acc.currentX}
                      y={0}
                      width={width * 1.5}
                      height={24}
                      fill="rgba(255, 255, 255, 0.75)"
                    />
                  );
                  acc.currentX += width * 1.5 + 2.5;
                  return acc;
                },
                { elements: [], currentX: 4 }
              ).elements}
            </svg>

            {/* ETKT and SEQ metadata */}
            <div className="flex justify-between items-center w-full text-[10px] font-mono text-text-muted tracking-wider">
              <span>ETKT: 098 7491 8023 44</span>
              <span>SEQ: 042</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BoardingPass;
