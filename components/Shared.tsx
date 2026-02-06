
import React from 'react';

export const StatCard: React.FC<{ label: string; value: string | number; icon: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center transition-all hover:shadow-md">
    <div className="text-blue-600 mb-2">{icon}</div>
    <div className="text-3xl font-bold text-slate-800 mb-1">{value}</div>
    <div className="text-sm text-slate-500 font-medium uppercase tracking-wider">{label}</div>
  </div>
);

export const Alert: React.FC<{ type: 'success' | 'error' | 'info' | 'warning'; message: string | React.ReactNode }> = ({ type, message }) => {
  const styles = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    error: 'bg-rose-50 text-rose-700 border-rose-200',
    info: 'bg-sky-50 text-sky-700 border-sky-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
  };

  return (
    <div className={`p-4 rounded-xl border ${styles[type]} mb-4 animate-in fade-in duration-300`}>
      {message}
    </div>
  );
};

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' }> = ({ children, variant = 'primary', className, ...props }) => {
  const variants = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200',
    secondary: 'bg-slate-600 hover:bg-slate-700 text-white shadow-slate-200',
    success: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200',
    danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200',
    warning: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-200',
  };

  return (
    <button 
      className={`px-4 py-2.5 rounded-xl font-semibold transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:pointer-events-none ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
