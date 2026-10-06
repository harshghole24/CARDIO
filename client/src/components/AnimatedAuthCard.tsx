import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, Wifi } from 'lucide-react';

interface AnimatedAuthCardProps {
  name: string;
  isFlipped: boolean;
}

export const AnimatedAuthCard: React.FC<AnimatedAuthCardProps> = ({ name, isFlipped }) => {
  return (
    <div className="relative w-[340px] h-[214px] perspective-[1000px] group">
      <motion.div
        className="w-full h-full relative"
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Front of Card */}
        <div 
          className="absolute inset-0 rounded-2xl p-6 flex flex-col justify-between overflow-hidden shadow-2xl"
          style={{ 
            background: 'linear-gradient(135deg, #232340 0%, #1A1A2E 100%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backfaceVisibility: 'hidden'
          }}
        >
          {/* Shine effect */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent w-[200%] animate-shine opacity-50 pointer-events-none" />
          
          <div className="flex justify-between items-start relative z-10">
            <CreditCard className="w-8 h-8 text-pastel-lavender" />
            <Wifi className="w-6 h-6 text-text-muted rotate-90" />
          </div>
          
          <div className="relative z-10">
            <div className="flex gap-2 items-center mb-2">
              <div className="w-10 h-7 bg-gradient-to-br from-yellow-200 to-yellow-500 rounded-md opacity-80" />
            </div>
            <div className="text-xl tracking-[0.2em] font-mono text-text-primary mb-4">
              •••• •••• •••• 4242
            </div>
            <div className="flex justify-between items-end uppercase text-xs tracking-widest text-text-muted">
              <div>
                <div className="text-[8px] mb-1 opacity-70">Cardholder Name</div>
                <div className="font-medium text-text-primary truncate max-w-[150px]">
                  {name || 'YOUR NAME'}
                </div>
              </div>
              <div>
                <div className="text-[8px] mb-1 opacity-70">Valid Thru</div>
                <div className="font-medium text-text-primary">12/28</div>
              </div>
            </div>
          </div>
        </div>

        {/* Back of Card */}
        <div 
          className="absolute inset-0 rounded-2xl flex flex-col overflow-hidden shadow-2xl"
          style={{ 
            background: 'linear-gradient(135deg, #1A1A2E 0%, #0F0F1A 100%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            transform: 'rotateY(180deg)',
            backfaceVisibility: 'hidden'
          }}
        >
          <div className="w-full h-12 bg-black mt-6" />
          <div className="px-6 mt-4">
            <div className="w-full h-8 bg-white/10 rounded flex items-center justify-end px-4">
              <span className="font-mono text-sm text-text-primary italic">•••</span>
            </div>
            <div className="mt-4 text-[10px] text-text-muted opacity-50 text-center leading-tight">
              This card is issued by CardIO Financial Services. 
              <br/>For customer service, call 1-800-CARDIO.
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
