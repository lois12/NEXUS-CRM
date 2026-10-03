import { showToast } from '../components/ui/NexusModal';

/**
 * Share text to MAX messenger.
 * - Mobile: Web Share API opens the native share sheet (user picks the MAX app)
 * - Desktop: copy to clipboard and open the MAX web version
 */
export async function shareToMax(title: string, text: string): Promise<void> {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (isMobile && navigator.share) {
    try {
      await navigator.share({ title, text });
      return;
    } catch { /* cancelled — fall through to web */ }
  }

  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
  showToast('Скопировано — вставьте в МАКС', 'success');
  window.open('https://web.max.ru', '_blank', 'noopener');
}
