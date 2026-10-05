/** Privacy / PD consent checkboxes (same copy as PublicRegistration) */
export default function SurveyConsent({
  checked,
  onChange,
  errors,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  errors?: { privacy?: string };
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 w-4 h-4"
          style={{ accentColor: 'var(--color-primary)' }}
        />
        <span className="font-mono text-[10px] text-gray-400 leading-relaxed">
          Согласен с{' '}
          <a href="/privacy-policy.html" target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)' }}>
            Политикой конфиденциальности
          </a>{' '}
          и{' '}
          <a href="/privacy-policy.html" target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)' }}>
            Политикой обработки персональных данных
          </a>{' '}
          (152-ФЗ)
        </span>
      </label>
      {errors?.privacy && (
        <p className="font-mono text-[9px] text-red-400">{errors.privacy}</p>
      )}
    </div>
  );
}
