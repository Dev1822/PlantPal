// utils/api.js - Centralized API client

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.error || `Request failed: ${res.status}`);
  }

  return data;
}

export const api = {
  getPlants: () => request('/plants'),
  getPlant: (id) => request(`/plants/${id}`),
  analyze: (payload) => request('/analyze', { method: 'POST', body: JSON.stringify(payload) }),
  saveUserPlant: (payload) => request('/user-plant', { method: 'POST', body: JSON.stringify(payload) }),
  getUserPlants: () => request('/user-plants'),
};
