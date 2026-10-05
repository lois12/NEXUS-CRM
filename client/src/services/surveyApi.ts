import axios, { AxiosInstance } from 'axios';
import api from './api';

export interface SurveyQuestion {
  id?: string;
  type: 'choice' | 'open';
  title: string;
  options: string[];
  required?: boolean;
  position?: number;
}

export interface Survey {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  isAnonymous: boolean;
  isPublic: boolean;
  publicSlug: string | null;
  questions?: SurveyQuestion[];
  responseCount?: number;
  questionCount?: number;
  updatedAt?: string;
  createdAt?: string;
  creatorName?: string;
}

/** Admin surveys API (auth) */
export const surveyApi = {
  getAll: () => api.get('/surveys').then((r) => r.data),
  getOne: (id: string) => api.get(`/surveys/${id}`).then((r) => r.data),
  create: (data: Partial<Survey>) => api.post('/surveys', data).then((r) => r.data),
  update: (id: string, data: Partial<Survey>) => api.put(`/surveys/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/surveys/${id}`).then((r) => r.data),
  togglePublish: (id: string) => api.post(`/surveys/${id}/toggle-publish`).then((r) => r.data),
  uploadImage: (id: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post(`/surveys/${id}/image`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
  },
  createQuestion: (id: string, q: SurveyQuestion) => api.post(`/surveys/${id}/questions`, q).then((r) => r.data),
  updateQuestion: (id: string, qid: string, q: Partial<SurveyQuestion>) =>
    api.put(`/surveys/${id}/questions/${qid}`, q).then((r) => r.data),
  deleteQuestion: (id: string, qid: string) => api.delete(`/surveys/${id}/questions/${qid}`).then((r) => r.data),
  reorderQuestions: (id: string, order: string[]) =>
    api.put(`/surveys/${id}/questions-reorder`, { order }).then((r) => r.data),
  stats: (id: string) => api.get(`/surveys/${id}/stats`).then((r) => r.data),
  downloadCsv: async (id: string) => {
    const res = await api.get(`/surveys/${id}/export/csv`, { responseType: 'blob' });
    return res.data as Blob;
  },
  exportPdfUrl: (id: string) => `/api/surveys/${id}/export/pdf`,
};

/** Public surveys API — own client, NO login redirect on 401 */
const publicClient: AxiosInstance = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

export const publicSurveyApi = {
  getBySlug: (slug: string) => publicClient.get(`/surveys/public/${slug}`).then((r) => r.data),
  submit: (slug: string, data: {
    deviceId: string;
    contactName?: string;
    contactPhone?: string;
    contactEmail?: string;
    answers: Record<string, string>;
  }) => publicClient.post(`/surveys/public/${slug}/submit`, data).then((r) => r.data),
};

/** stable per-browser device id for one-response-per-device */
export function getSurveyDeviceId(): string {
  const KEY = 'survey_device_id';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}
