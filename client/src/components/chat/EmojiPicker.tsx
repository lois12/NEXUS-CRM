import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';

interface EmojiPickerProps {
  onSelect: (emoji: any) => void;
}

export default function EmojiPicker({ onSelect }: EmojiPickerProps) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
      <Picker
        data={data}
        onEmojiSelect={onSelect}
        theme="dark"
        set="native"
        previewPosition="none"
        skinTonePosition="search"
        maxFrequentRows={2}
        perLine={8}
        emojiSize={28}
        emojiButtonSize={36}
        categories={['frequent', 'people', 'nature', 'foods', 'activity', 'places', 'objects', 'symbols', 'flags']}
        locale="ru"
        style={{
          '--em-rgb-background': '20, 20, 35',
          '--em-rgb-input': '0, 0, 0',
          '--em-rgb-color': '200, 200, 220',
        } as any}
      />
    </div>
  );
}
