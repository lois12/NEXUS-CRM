import { useState, useEffect, useCallback } from 'react';

export function useChatSettings() {
  const [chatTheme, setChatTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('nexus_chat_theme') as 'dark' | 'light') || 'dark');
  const [chatWallpaper, setChatWallpaper] = useState<string>(() => localStorage.getItem('nexus_chat_wallpaper') || '');
  const [dndEnabled, setDndEnabled] = useState(() => localStorage.getItem('nexus_chat_dnd') === 'on');
  const [dndStart, setDndStart] = useState(() => localStorage.getItem('nexus_chat_dnd_start') || '22:00');
  const [dndEnd, setDndEnd] = useState(() => localStorage.getItem('nexus_chat_dnd_end') || '08:00');
  const [soundPrivate, setSoundPrivate] = useState(() => localStorage.getItem('nexus_chat_sound_private') || 'icq');
  const [soundGroup, setSoundGroup] = useState(() => localStorage.getItem('nexus_chat_sound_group') || 'ding');
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('nexus_chat_sound') !== 'off');

  // Persist to localStorage
  useEffect(() => { localStorage.setItem('nexus_chat_sound_private', soundPrivate); }, [soundPrivate]);
  useEffect(() => { localStorage.setItem('nexus_chat_sound_group', soundGroup); }, [soundGroup]);
  useEffect(() => { localStorage.setItem('nexus_chat_sound', soundEnabled ? 'on' : 'off'); }, [soundEnabled]);
  useEffect(() => { localStorage.setItem('nexus_chat_theme', chatTheme); }, [chatTheme]);
  useEffect(() => { localStorage.setItem('nexus_chat_dnd', dndEnabled ? 'on' : 'off'); }, [dndEnabled]);
  useEffect(() => { localStorage.setItem('nexus_chat_dnd_start', dndStart); }, [dndStart]);
  useEffect(() => { localStorage.setItem('nexus_chat_dnd_end', dndEnd); }, [dndEnd]);
  useEffect(() => { localStorage.setItem('nexus_chat_wallpaper', chatWallpaper); }, [chatWallpaper]);

  const isDndActive = useCallback(() => {
    if (!dndEnabled) return false;
    const now = new Date();
    const [sh, sm] = dndStart.split(':').map(Number);
    const [eh, em] = dndEnd.split(':').map(Number);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    if (startMin > endMin) return nowMin >= startMin || nowMin < endMin;
    return nowMin >= startMin && nowMin < endMin;
  }, [dndEnabled, dndStart, dndEnd]);

  return {
    chatTheme, setChatTheme,
    chatWallpaper, setChatWallpaper,
    dndEnabled, setDndEnabled,
    dndStart, setDndStart,
    dndEnd, setDndEnd,
    soundPrivate, setSoundPrivate,
    soundGroup, setSoundGroup,
    soundEnabled, setSoundEnabled,
    isDndActive,
  };
}