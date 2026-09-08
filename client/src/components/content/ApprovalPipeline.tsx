import { ContentStatus } from '../../types';
import { FileText, Timer, AlertTriangle, CheckCircle2, Shield, Send } from 'lucide-react';

const pipelineSteps: { status: ContentStatus; label: string; color: string; icon: typeof FileText }[] = [
  { status: 'черновик', label: 'Черновик', color: '#6b7280', icon: FileText },
  { status: 'запланирован', label: 'На согласовании', color: '#eab308', icon: Timer },
  { status: 'на_доработку', label: 'Доработка', color: '#ff3b30', icon: AlertTriangle },
  { status: 'согласован', label: 'Согласован', color: '#00d4ff', icon: CheckCircle2 },
  { status: 'утверждён', label: 'Утверждён', color: '#bf00ff', icon: Shield },
  { status: 'опубликован', label: 'Опубликован', color: '#00ff88', icon: Send },
];

export default function ApprovalPipeline({ currentStatus }: { currentStatus: ContentStatus }) {
  const activeIndex = pipelineSteps.findIndex(s => s.status === currentStatus);

  return (
    <div className="flex items-center gap-1 overflow-x-auto py-1">
      {pipelineSteps.map((step, i) => {
        const isActive = i === activeIndex;
        const isPast = i < activeIndex;
        const Icon = step.icon;
        return (
          <div key={step.status} className="flex items-center gap-1">
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-bold transition-all ${
              isActive ? 'ring-1 scale-105' : isPast ? 'opacity-60' : 'opacity-30'
            }`} style={{
              backgroundColor: isActive ? `${step.color}20` : 'rgba(255,255,255,0.03)',
              color: step.color,
              boxShadow: isActive ? `0 0 0 1px ${step.color}` : 'none',
              border: `1px solid ${isActive ? step.color + '50' : 'rgba(255,255,255,0.06)'}`,
            }}>
              <Icon className="w-3 h-3" />
              <span className="hidden sm:inline">{step.label}</span>
            </div>
            {i < pipelineSteps.length - 1 && (
              <div className="w-3 h-px" style={{ backgroundColor: isPast ? step.color : 'rgba(255,255,255,0.1)' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
