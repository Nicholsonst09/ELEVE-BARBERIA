const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
export const API_BASE_URL = isDevelopment
  ? 'http://localhost:3000/api/v1'
  : 'https://eleve-barberia-xi.vercel.app/api/v1';
