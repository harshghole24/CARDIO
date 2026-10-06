import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Clock, ArrowRight, Plane } from 'lucide-react';

interface Step {
  id: string;
  title: string;
  description: string;
  status: 'completed' | 'in-progress' | 'pending';
}

export const TravelExecutionPlan = () => {
  const steps: Step[] = [
    { id: '1', title: 'Add eligible credit cards', description: 'Axis Atlas and SBI Cashback added.', status: 'completed' },
    { id: '2', title: 'Add Maharaja Club balance', description: 'Current balance: 1,500 points.', status: 'completed' },
    { id: '3', title: 'Use Axis Atlas for travel spending', description: 'Expected reward: 5x points on flights.', status: 'in-progress' },
    { id: '4', title: 'Use SBI Cashback for online purchases', description: 'Targeting ₹20,000 spend this month.', status: 'pending' },
    { id: '5', title: 'Transfer eligible rewards', description: 'When threshold of 1,000 points is reached.', status: 'pending' },
    { id: '6', title: 'Check flight redemption', description: 'Mumbai → Goa requires 2,500 points.', status: 'pending' },
  ];

  return (
    <div className="bg-white rounded-2xl p-8 shadow-lg border border-slate-100 max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-8 border-b pb-6">
        <div className="bg-indigo-100 p-3 rounded-full">
          <Plane className="w-8 h-8 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Your Travel Execution Plan</h2>
          <p className="text-slate-500">Mumbai → Goa • 15 Nov 2026 • 1,500 / 2,500 Points (60%)</p>
        </div>
      </div>

      <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
        {steps.map((step, index) => (
          <motion.div 
            key={step.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-slate-100 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10">
              {step.status === 'completed' && <CheckCircle className="w-5 h-5 text-green-500" />}
              {step.status === 'in-progress' && <Clock className="w-5 h-5 text-amber-500" />}
              {step.status === 'pending' && <ArrowRight className="w-5 h-5 text-slate-400" />}
            </div>
            
            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-slate-800">{step.title}</h3>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full uppercase ${
                  step.status === 'completed' ? 'bg-green-100 text-green-700' :
                  step.status === 'in-progress' ? 'bg-amber-100 text-amber-700' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  {step.status}
                </span>
              </div>
              <p className="text-sm text-slate-500">{step.description}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
