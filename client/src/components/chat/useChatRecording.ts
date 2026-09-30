import { useState, useRef } from 'react';
import { chatApi } from '../../services/api';
import { showToast } from '../ui/NexusModal';

export function useChatRecording(activeConvRef: React.MutableRefObject<any>) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showToast('Запись аудио требует HTTPS или localhost', 'error');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeTypes = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg'];
      let mimeType = '';
      for (const mt of mimeTypes) { if (MediaRecorder.isTypeSupported(mt)) { mimeType = mt; break; } }
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      const ext = mimeType.split('/')[1] || 'webm';
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
        const file = new File([blob], `audio-${Date.now()}.${ext}`, { type: mimeType || 'audio/webm' });
        const conv = activeConvRef.current;
        if (!conv) return;
        try {
          const u = await chatApi.uploadFile(conv.id, file);
          if (u.success && u.data) { await chatApi.sendMessage(conv.id, { content: u.data.url, type: 'audio' }); }
        } catch { showToast('Ошибка аудио', 'error'); }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordTime(0);
      recordIntervalRef.current = setInterval(() => setRecordTime(t => t + 1), 1000);
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') showToast('Разрешите доступ к микрофону в настройках браузера', 'error');
      else if (err?.name === 'NotFoundError') showToast('Микрофон не найден', 'error');
      else showToast('Ошибка записи: ' + (err?.message || 'Неизвестная'), 'error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
    }
  };

  return { isRecording, recordTime, startRecording, stopRecording, cancelRecording };
}