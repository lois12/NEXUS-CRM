import { ContentApproval } from '../../types';
import { CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

const actionConfig = {
  pending: { label: 'Ожидает', color: '#eab308', icon: Clock },
  approved: { label: 'Согласовал', color: '#00ff88', icon: CheckCircle2 },
  revision: { label: 'На доработку', color: '#ff3b30', icon: AlertTriangle },
};

export default function ApprovalStatus({ approvals }: { approvals: ContentApproval[] }) {
  if (approvals.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="text-[10px] font-mono font-bold" style={{ color: 'var(--color-text-secondary)' }}>
        СОГЛАСОВАНИЕ
      </div>
      <div className="space-y-1">
        {approvals.map(a => {
          const config = actionConfig[a.action] || actionConfig.pending;
          const Icon = config.icon;
          return (
            <div key={a.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
              style={{ backgroundColor: `${config.color}08`, border: `1px solid ${config.color}15` }}>
              <div className="w-5 h-5 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
                style={{ border: `1px solid ${config.color}30` }}>
                {a.approverAvatar ? (
                  <img loading="lazy" decoding="async" src={`http://localhost:3001${a.approverAvatar}`} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[7px] font-mono font-bold" style={{ color: config.color }}>
                    {a.approverName?.charAt(0) || '?'}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-mono text-gray-300 flex-1">{a.approverName}</span>
              <Icon className="w-3 h-3" style={{ color: config.color }} />
              <span className="text-[9px] font-mono" style={{ color: config.color }}>{config.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
