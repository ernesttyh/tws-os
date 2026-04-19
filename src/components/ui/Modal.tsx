'use client';
import { X } from 'lucide-react';
import { useEffect } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export default function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  // Prevent body scroll on mobile when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  const sizeClass = size === 'sm' ? 'max-w-md' : size === 'md' ? 'max-w-lg' : 'max-w-2xl';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div 
        className={`relative w-full ${sizeClass} bg-[#1a1a2e] border border-white/10 shadow-2xl
          rounded-t-2xl sm:rounded-2xl
          max-h-[85vh] sm:max-h-[80vh] sm:mx-4 overflow-hidden flex flex-col`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-white/10 shrink-0">
          {/* Mobile drag handle */}
          <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-8 h-1 bg-white/20 rounded-full sm:hidden" />
          <h2 className="text-base sm:text-lg font-semibold text-white mt-1 sm:mt-0">{title}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition"><X size={18} /></button>
        </div>
        {/* Body */}
        <div className="px-4 sm:px-6 py-4 sm:py-5 overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}
