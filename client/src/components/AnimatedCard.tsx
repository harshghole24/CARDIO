import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface AnimatedCardProps {
  bank: string;
  cardName: string;
  network: string;
  lastFour: string;
  cardholderName: string;
  expiry: string;
  theme?: 'dark' | 'blue' | 'gold' | 'silver';
}

const themeClasses = {
  dark: 'bg-gradient-to-br from-slate-900 via-neutral-900 to-zinc-800 text-white border border-white/10 shadow-black/50',
  blue: 'bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 text-white border border-blue-500/20 shadow-blue-950/40',
  gold: 'bg-gradient-to-br from-amber-700 via-amber-600 to-yellow-500 text-white border border-yellow-300/30 shadow-amber-900/40',
  silver: 'bg-gradient-to-br from-zinc-300 via-slate-200 to-zinc-400 text-zinc-900 border border-white/40 shadow-slate-900/30',
};

export const AnimatedCard: React.FC<AnimatedCardProps> = ({
  bank,
  cardName,
  network,
  lastFour,
  cardholderName,
  expiry,
  theme = 'dark'
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      className={`relative w-full max-w-[360px] aspect-[1.586/1] rounded-2xl p-5 sm:p-6 shadow-xl overflow-hidden cursor-pointer select-none transition-shadow ${themeClasses[theme]}`}
      whileHover={{ y: -4 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {/* Dynamic Shine effect */}
      {isHovered && (
        <motion.div
          className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-tr from-white/0 via-white/20 to-white/0"
          initial={{ x: '-100%', y: '-100%' }}
          animate={{ x: '100%', y: '100%' }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
        />
      )}

      {/* Subtle card surface texture pattern */}
      <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:12px_12px] pointer-events-none" />

      {/* Card Header: Bank & Network */}
      <div className="flex justify-between items-start mb-4 relative z-20">
        <div className="max-w-[70%]">
          <h3 className="font-bold text-base sm:text-lg tracking-wide truncate">{bank || 'CardIO Bank'}</h3>
          <p className="text-xs opacity-75 font-medium truncate">{cardName || 'Credit Card'}</p>
        </div>
        <div className="font-black italic text-lg sm:text-xl tracking-tight opacity-90 shrink-0">
          {network || 'VISA'}
        </div>
      </div>

      {/* Card Middle: EMV Chip & Contactless */}
      <div className="mb-4 relative z-20 flex items-center justify-between">
        <div className="w-10 h-7 bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-500 rounded-md overflow-hidden relative shadow-inner border border-amber-300/40">
          <div className="absolute top-1/2 w-full h-[0.5px] bg-amber-700/40"></div>
          <div className="absolute left-1/3 h-full w-[0.5px] bg-amber-700/40"></div>
          <div className="absolute left-2/3 h-full w-[0.5px] bg-amber-700/40"></div>
        </div>
        
        {/* Contactless waves icon */}
        <svg className="w-5 h-5 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M8.5 16.5a5 5 0 0 1 0-7" strokeLinecap="round" />
          <path d="M12 19a8.5 8.5 0 0 0 0-12" strokeLinecap="round" />
          <path d="M15.5 21.5a12 12 0 0 0 0-17" strokeLinecap="round" />
        </svg>
      </div>

      {/* Masked Card Number */}
      <div className="mb-4 relative z-20">
        <p className="font-mono text-base sm:text-lg tracking-[0.2em] font-semibold drop-shadow-sm">
          •••• •••• •••• {lastFour || '••••'}
        </p>
      </div>

      {/* Card Footer: Cardholder & Expiry */}
      <div className="flex justify-between items-end relative z-20 pt-1">
        <div className="max-w-[70%]">
          <p className="text-[9px] uppercase tracking-widest opacity-60 font-semibold mb-0.5">Cardholder</p>
          <p className="font-medium text-xs sm:text-sm tracking-wide uppercase truncate">
            {cardholderName || 'CARDHOLDER'}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[9px] uppercase tracking-widest opacity-60 font-semibold mb-0.5">Expires</p>
          <p className="font-mono text-xs sm:text-sm font-medium tracking-wider">{expiry || '12/28'}</p>
        </div>
      </div>
    </motion.div>
  );
};
