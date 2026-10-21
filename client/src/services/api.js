import axios from 'axios';

const api = axios.create({ baseURL: `${import.meta.env.VITE_API_URL}/api/v1`, withCredentials: true, timeout: 20000 });

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const e = err.response?.data?.error;
    err.userMessage = e?.message
      || (err.code === 'ERR_NETWORK' ? 'Cannot reach the server. Check your connection and try again.'
        : err.code === 'ECONNABORTED' ? 'The request took too long. Try again.' : 'Something went wrong. Try again.');
    err.apiCode = e?.code;
    err.fieldErrors = e?.details;
    return Promise.reject(err);
  },
);

export const assetUrl = (p) => (!p ? null : /^https?:/.test(p) ? p : `${import.meta.env.VITE_ASSET_URL}${p}`);
export const unwrap = (res) => res.data.data;
export default api;
