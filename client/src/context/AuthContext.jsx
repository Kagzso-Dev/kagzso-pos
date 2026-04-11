import { createContext, useState, useEffect, useCallback, useRef } from 'react';
import api, { baseURL as API_BASE } from '../api';
import { io } from 'socket.io-client';

export const AuthContext = createContext({
    user: null,
    socket: null,
    settings: {},
    loading: true,
    login: () => { },
    logout: () => { },
    fetchSettings: () => { },
    formatPrice: (amount) => '',
    role: null,
    isAdmin: false,
    socketConnected: false,
    serverStatus: 'online',
});

// ── Auth Provider Component ──────────────────────────────────────────────────
export const AuthProvider = ({ children }) => {
    // ── Synchronous session restore ───────────────────────────────────────────
    // Uses sessionStorage so each browser tab is fully independent —
    // Tab 1 can be waiter, Tab 2 kitchen, Tab 3 admin simultaneously.
    const [user, setUser] = useState(() => {
        try {
            const raw = sessionStorage.getItem('user');
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    });

    const [loading, setLoading] = useState(false);
    const [socket, setSocket] = useState(null);
    const socketRef = useRef(null);
    const [socketConnected, setSocketConnected] = useState(false);
    const [serverStatus, setServerStatus] = useState('online');
    const [settings, setSettings] = useState({
        restaurantName: 'KAGZSO',
        address: '',
        currency: 'INR',
        currencySymbol: '₹',
        sgst: 0,
        cgst: 0,
        gstNumber: '',
        dashboardView: 'all',
        menuView: 'grid',
        mobileMenuView: 'grid',
        dineInEnabled: true,
        takeawayEnabled: true,
        tableMapEnabled: true,
        waiterServiceEnabled: true,
        enforceMenuView: false,
        cashierOfferEnabled: false,
        cashierOfferDiscount: 0,
        cashierOfferLabel: '',
        cashierQrUploadEnabled: true,
    });

    // ── Socket init (joins restaurant-specific + role-specific rooms) ──────────
    const initSocket = useCallback((role, customToken) => {
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
        }

        const sUser = JSON.parse(sessionStorage.getItem('user') || 'null');
        const token = customToken || sUser?.token || user?.token;

        const socketURL = import.meta.env.VITE_SOCKET_URL || API_BASE;
        const normalizedURL = socketURL.startsWith('http') ? socketURL : window.location.origin;

        const newSocket = io(normalizedURL, {
            transports: ['websocket', 'polling'], // Prioritize websocket
            path: '/socket.io/',
            withCredentials: true,
            autoConnect: true,
            forceNew: true,
            auth: { token },
            reconnection: true,
            reconnectionAttempts: Infinity, // Keep trying forever
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000,
        });

        const joinRooms = () => {
            newSocket.emit('join_branch');
            console.log('%c✅ Socket connected to restaurant main room', 'color: #10b981; font-weight: bold;');

            if (role) {
                newSocket.emit('join_role', role);
                console.log('%c✅ Socket role-room joined:', 'color: #3b82f6; font-weight: bold;', `role_${role}`);
            }
        };

        newSocket.on('connect', () => {
            setSocketConnected(true);
            setServerStatus('online');
            joinRooms();
            // Trigger background sync for all active dashboards
            window.dispatchEvent(new CustomEvent('pos-refresh'));
        });

        newSocket.on('reconnect', (attempt) => {
            setSocketConnected(true);
            setServerStatus('online');
            console.log(`🔄 Socket reconnected (${attempt}) — re-syncing state`);
            joinRooms();
            // Ensure data consistency after reconnection
            window.dispatchEvent(new CustomEvent('pos-refresh'));
        });

        newSocket.on('disconnect', (reason) => {
            setSocketConnected(false);
            if (reason === 'io server disconnect') {
                newSocket.connect();
            }
            if (reason !== 'io client disconnect') {
                console.warn(`⚠️ Socket disconnected: ${reason}`);
            }
        });

        newSocket.on('connect_error', (err) => {
            setSocketConnected(false);
            setServerStatus('offline');
            console.error('❌ Socket connection error:', err.message);
        });

        socketRef.current = newSocket;
        setSocket(newSocket);
        return newSocket;
    }, [user?.token]);

    // ── Fetch settings ────────────────────────────────────────────────────────
    const fetchSettings = useCallback(async () => {
        const attempt = async () => {
            const res = await api.get('/settings');
            setSettings(res.data);
            setServerStatus('online');
        };
        try {
            await attempt();
        } catch (error) {
            const status = error.response?.status;
            if (!status || status >= 500) {
                // Retry once after 2s on network error or 5xx (e.g. Appwrite cold-start)
                setTimeout(async () => {
                    try {
                        await attempt();
                    } catch (retryErr) {
                        console.warn('⚠️ Settings fetch failed (retry):', retryErr.message);
                        if (!retryErr.response) setServerStatus('offline');
                    }
                }, 2000);
            } else {
                console.warn('⚠️ Settings fetch failed:', error.message);
            }
        }
    }, []);

    // ── Side effects ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (user) {
            initSocket(user.role);
        }
        fetchSettings();

        return () => {
            if (socketRef.current) {
                const s = socketRef.current;
                socketRef.current = null;
                if (s.connected) s.disconnect();
            }
        };
    }, [user, initSocket, fetchSettings]);

    // ── Live settings sync via socket ─────────────────────────────────────
    useEffect(() => {
        if (!socket) return;
        const onSettingsUpdated = (updatedSettings) => {
            setSettings(updatedSettings);
        };
        socket.on('settings-updated', onSettingsUpdated);
        return () => socket.off('settings-updated', onSettingsUpdated);
    }, [socket]);


    // ── Login ─────────────────────────────────────────────────────────────────
    const login = async (username, password) => {
        setLoading(true);
        try {
            const res = await api.post('/auth/login', { username, password });
            const userData = res.data;

            setUser(userData);
            sessionStorage.setItem('user', JSON.stringify(userData));

            initSocket(userData.role, userData.token);
            fetchSettings();

            setLoading(false);
            return userData;
        } catch (error) {
            setLoading(false);
            const msg = error.response?.data?.message || error.message || 'Login failed';
            throw msg;
        }
    };

    // ── Logout ────────────────────────────────────────────────────────────────
    const logout = () => {
        setUser(null);
        sessionStorage.removeItem('user');
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
        }
        setSocket(null);
        setSocketConnected(false);
        setSettings({
            restaurantName: 'KAGZSO',
            currency: 'INR',
            currencySymbol: '₹',
            sgst: 0,
            cgst: 0,
            gstNumber: '',
            dashboardView: 'all',
            menuView: 'grid',
        });
    };

    // ── Helpers ───────────────────────────────────────────────────────────────
    const formatPrice = (amount) => {
        return `${settings.currencySymbol}${(amount || 0).toFixed(0)}`;
    };

    const role = user?.role || null;
    const isAdmin = role === 'admin';

    return (
        <AuthContext.Provider value={{
            user,
            login,
            logout,
            loading,
            socket,
            socketConnected,
            serverStatus,
            settings,
            fetchSettings,
            formatPrice,
            role,
            isAdmin,
        }}>
            {children}
        </AuthContext.Provider>
    );
};


