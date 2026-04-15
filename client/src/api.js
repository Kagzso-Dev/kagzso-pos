import axios from "axios";

// ─── Dynamic API Configuration for Multi-Device Dev ────────────────
const getBaseURL = () => {
    // 1. Prioritize explicit environment override (e.g., from Vercel/Render)
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;

    // 2. Production fallback if not in development
    if (import.meta.env.MODE !== 'development') {
        return "https://restaurant-kagzso-backend.onrender.com";
    }

    // 3. Smart Dev Discovery: If we are on mobile/tab via IP (e.g. 192.168.x.x), 
    // use that same hostname for the API instead of 'localhost'.
    const hostname = window.location.hostname;
    
    // If on live domain, use relative /api (nginx handles proxy)
    if (hostname === 'food.kagzso.com') {
        return "/api";
    }

    const isIP = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(hostname);
    if (isIP || (hostname !== 'localhost' && hostname !== '127.0.0.1')) {
        return `http://${hostname}:5005/api`;
    }

    // 4. Smart Local Development: If on localhost, use local backend
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return "http://localhost:5005/api";
    }

    // 5. Default VPS/Production URL as requested
    return "http://139.84.152.58:5005/api";
};

const baseURL = getBaseURL().replace(/\/+$/, "");

// Create axios instance
const api = axios.create({
    baseURL,
    withCredentials: true,
    headers: {
        "Content-Type": "application/json",
    },
});

// Request interceptor (Token)
api.interceptors.request.use(
    (config) => {
        // Fix duplicate /api/api in URL paths globally
        if (config.url && config.url.startsWith('/api/')) {
            config.url = config.url.replace(/^\/api\//, '/');
        }

        try {
            const user = JSON.parse(sessionStorage.getItem("user"));

            // Add JWT token
            if (user?.token) {
                config.headers.Authorization = `Bearer ${user.token}`;
            }
        } catch (error) {
            console.error("LocalStorage error:", error);
        }

        return config;
    },
    (error) => Promise.reject(error)
);

export default api;
export { baseURL };