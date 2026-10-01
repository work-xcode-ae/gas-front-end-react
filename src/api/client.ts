import axios from 'axios';

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

const client = axios.create({
  baseURL: '',          // relative — Vite proxy handles dev.local
  withCredentials: true,
  headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
});

client.interceptors.request.use(config => {
  if (['post', 'put', 'delete', 'patch'].includes(config.method || '')) {
    const csrf = getCookie('csrftoken');
    if (csrf) config.headers['X-Frappe-CSRF-Token'] = csrf;
  }
  return config;
});

client.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 403) {
      // Only fire logout on auth failures, NOT on doctype PermissionError
      // Frappe returns exc_type: 'PermissionError' for missing roles,
      // and exc_type: 'AuthenticationError' (or no exc_type) when session expired
      const excType = err.response?.data?.exc_type;
      if (!excType || excType === 'AuthenticationError') {
        window.dispatchEvent(new Event('frappe:unauthorized'));
      }
    }
    return Promise.reject(err);
  }
);

export const frappe = {
  get: (method: string, args: Record<string, unknown> = {}) =>
    client.get(`/api/method/${method}`, { params: args }),
  post: (method: string, args: Record<string, unknown> = {}) =>
    client.post(`/api/method/${method}`, args),
  getDoc: (doctype: string, name: string) =>
    client.get(`/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`),
  getList: (doctype: string, params: Record<string, unknown> = {}) =>
    client.get(`/api/resource/${encodeURIComponent(doctype)}`, { params }),
  createDoc: (doctype: string, data: Record<string, unknown>) =>
    client.post(`/api/resource/${encodeURIComponent(doctype)}`, data),
  updateDoc: (doctype: string, name: string, data: Record<string, unknown>) =>
    client.put(`/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`, data),
  submitDoc: (doctype: string, name: string) =>
    client.put(`/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`, { docstatus: 1 }),
};

export default client;
