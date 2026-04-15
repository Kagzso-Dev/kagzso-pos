import axios from "axios";
import { syncPendingOrders } from "../utils/syncEngine";

// ─── API Configuration ────────────────────────────────────────────────────────
// Use the centralized VITE_API_URL, which should be the Cloudflare Tunnel URL.
const API_BASE = import.meta.env.VITE_API_URL || "";
const baseURL = API_BASE.trim().replace(/\/+$/, "");

// Create axios instance
const api = axios.create({
    baseURL,
    withCredentials: true,
    headers: {
        "Content-Type": "application/json",
    },
});

const OFFLINE_METHODS = ['GET'];
const QUEUEABLE_METHODS = ['POST', 'PUT', 'DELETE'];

// Request interceptor (JWT Token) — essential for cross-origin authentication
api.interceptors.request.use(
    (config) => {
        try {
            const user = JSON.parse(sessionStorage.getItem("user"));
            if (user?.token) {
                config.headers.Authorization = `Bearer ${user.token}`;
            }
        } catch (error) {
            console.error("SessionStorage error:", error);
        }

        if (!navigator.onLine) {
            if (OFFLINE_METHODS.includes(config.method?.toUpperCase())) {
                return config;
            }
            if (QUEUEABLE_METHODS.includes(config.method?.toUpperCase())) {
                const queueKey = `${config.method}:${config.url}`;
                const pending = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
                if (!pending.includes(queueKey)) {
                    pending.push(queueKey);
                    localStorage.setItem('offlineQueue', JSON.stringify(pending));
                }
            }
            return Promise.reject(new Error("offline"));
        }

        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor — handle token expiry globally
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Token expired or invalid — clear session and redirect to login
            try { sessionStorage.removeItem("user"); } catch { /* ignore */ }
            if (!window.location.pathname.includes("/login")) {
                window.location.href = "/login";
            }
        }
        return Promise.reject(error);
    }
);

const handleOnline = () => {
    const pending = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
    if (pending.length > 0) {
        localStorage.removeItem('offlineQueue');
        syncPendingOrders();
    }
};

window.addEventListener('online', handleOnline);

export const isOnline = () => navigator.onLine;

export default api;
export { baseURL };
