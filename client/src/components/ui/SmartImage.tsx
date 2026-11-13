import { useState } from 'react';

interface SmartImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
}

/**
 * Картинка со скелетоном и спиннером: пока грузится — показывает заглушку,
 * после загрузки плавно проявляет изображение. Убирает «скачки» в сетках.
 */
export default function SmartImage({ src, alt, className = '', style, draggable, ...rest }: SmartImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <span
      className={`smart-image ${className}`}
      style={{ position: 'relative', display: 'block', overflow: 'hidden', ...style }}
    >
      {!loaded && !failed && (
        <span className="smart-image-skeleton" aria-hidden="true">
          <span className="smart-image-spinner" />
        </span>
      )}
      {failed && (
        <span className="smart-image-skeleton smart-image-failed" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="8.5" cy="10" r="1.5" />
            <path d="M21 16l-5-5-4 4-2-2-7 7" />
          </svg>
        </span>
      )}
      <img
        src={src}
        alt={alt}
        draggable={draggable}
        className={`smart-image-el ${loaded ? 'is-loaded' : ''} ${failed ? 'is-failed' : ''} ${className}`}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        {...rest}
      />
    </span>
  );
}
