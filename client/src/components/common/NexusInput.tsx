import { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, forwardRef } from 'react';

const inputClass = 'w-full px-4 py-2.5 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)] transition-colors';

export const NexusInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  (props, ref) => <input ref={ref} className={inputClass} {...props} />
);
NexusInput.displayName = 'NexusInput';

export const NexusTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  (props, ref) => <textarea ref={ref} className={`${inputClass} resize-none`} {...props} />
);
NexusTextarea.displayName = 'NexusTextarea';

export const NexusSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  (props, ref) => <select ref={ref} className={inputClass} {...props} />
);
NexusSelect.displayName = 'NexusSelect';
