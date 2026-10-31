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
  dark: 'bg-gradient-to-br from-slate-900 to-slate-800 text-white',
  blue: 'bg-gradient-to-br from-blue-900 to-blue-700 text-white',
  gold: 'bg-gradient-to-br from-amber-600 to-amber-400 text-white',
  silver: 'bg-gradient-to-br from-gray-400 to-gray-300 text-slate-900',
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
      className={`relative w-96 h-56 rounded-2xl p-6 shadow-2xl overflow-hidden cursor-pointer ${themeClasses[theme]}`}
      whileHover={{ scale: 1.05, rotateY: 10, rotateX: 5 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      style={{ perspective: 1000 }}
    >
      {/* Shine effect */}
      {isHovered && (
        <motion.div
          className="absolute inset-0 z-10 bg-gradient-to-tr from-white/0 via-white/30 to-white/0"
          initial={{ x: '-100%', y: '-100%' }}
          animate={{ x: '100%', y: '100%' }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        />
      )}

      <div className="flex justify-between items-start mb-8 relative z-20">
        <div>
          <h3 className="font-bold text-xl tracking-wider">{bank}</h3>
          <p className="text-sm opacity-80">{cardName}</p>
        </div>
        <div className="font-black italic text-2xl opacity-90">
          {network}
        </div>
      </div>

      <div className="mb-6 relative z-20">
        <div className="w-12 h-10 bg-yellow-400/80 rounded-md mb-2 overflow-hidden relative">
          <div className="absolute inset-0 border border-yellow-300/30"></div>
          {/* Chip lines */}
          <div className="absolute top-1/2 w-full h-px bg-yellow-600/50"></div>
          <div className="absolute left-1/3 h-full w-px bg-yellow-600/50"></div>
        </div>
        <p className="font-mono text-xl tracking-widest drop-shadow-md">
          •••• •••• •••• {lastFour}
        </p>
      </div>

      <div className="flex justify-between items-end relative z-20">
        <div>
          <p className="text-xs opacity-60 uppercase tracking-widest mb-1">Cardholder</p>
          <p className="font-medium tracking-wide uppercase">{cardholderName}</p>
        </div>
        <div>
          <p className="text-xs opacity-60 uppercase tracking-widest mb-1">Expires</p>
          <p className="font-medium tracking-wide">{expiry}</p>
        </div>
      </div>
    </motion.div>
  );
};
