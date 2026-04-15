import { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { User, Lock, CheckCircle, Eye, EyeOff, Loader2, ChevronLeft, X } from 'lucide-react';
const logoImg = '/logo.png';
import HeroSection from '../components/HeroSection';

// Helper: get dashboard path by role
const getDashboardPath = (role) => {
    switch (role) {

        case 'admin': return '/admin';
        case 'kitchen': return '/kitchen';
        case 'cashier': return '/cashier';
        case 'waiter': return '/waiter';
        default: return '/';
    }
};

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState(null);
    const [heroVisible, setHeroVisible] = useState(() =>
        sessionStorage.getItem('loginView') !== 'form'
    );
    const [transitioning, setTransitioning] = useState(false);
    const { user, login, loading, settings, serverStatus } = useContext(AuthContext);
    const navigate = useNavigate();

    // If user is already logged in, redirect to their dashboard
    useEffect(() => {
        if (!loading && user) {
            navigate(getDashboardPath(user.role), { replace: true });
        }
    }, [user, loading, navigate]);

    const handleSignIn = () => {
        setTransitioning(true);
        setTimeout(() => {
            setTransitioning(false);
            setHeroVisible(false);
            sessionStorage.setItem('loginView', 'form');
        }, 2400);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const userData = await login(username, password);
            navigate(getDashboardPath(userData.role), { replace: true });
        } catch (err) {
            console.error(err);
            setError(typeof err === 'string' ? err : (err.message || 'Login failed'));
        }
    };

    /* ── Cinematic transition loader ── */
    if (transitioning) {
        const ORBIT_DOTS = [
            { angle: 0,   size: 7, speed: '3s',  opacity: 1,    color: '#FF6B35' },
            { angle: 60,  size: 5, speed: '3s',  opacity: 0.7,  color: '#FFD700' },
            { angle: 120, size: 8, speed: '3s',  opacity: 0.9,  color: '#dc2626' },
            { angle: 180, size: 4, speed: '3s',  opacity: 0.5,  color: '#FFD700' },
            { angle: 240, size: 6, speed: '3s',  opacity: 0.8,  color: '#FF6B35' },
            { angle: 300, size: 5, speed: '3s',  opacity: 0.6,  color: '#FFD700' },
        ];
        return (
            <>
                <style>{`
                    @keyframes kz-bg-breathe {
                        0%,100% { opacity:.5; transform:scale(1); }
                        50%      { opacity:1;  transform:scale(1.18); }
                    }
                    @keyframes kz-grid-drift {
                        0%   { background-position: 0 0; }
                        100% { background-position: 40px 40px; }
                    }
                    @keyframes kz-sonar {
                        0%   { transform:translate(-50%,-50%) scale(.3); opacity:.9; }
                        100% { transform:translate(-50%,-50%) scale(3.2); opacity:0; }
                    }
                    @keyframes kz-ring-cw {
                        from { transform:rotate(0deg); }
                        to   { transform:rotate(360deg); }
                    }
                    @keyframes kz-ring-ccw {
                        from { transform:rotate(0deg); }
                        to   { transform:rotate(-360deg); }
                    }
                    @keyframes kz-orb-glow {
                        0%,100% { box-shadow:0 0 30px 8px rgba(255,107,53,.45),0 0 70px 20px rgba(255,107,53,.15),inset 0 0 20px rgba(255,150,80,.3); }
                        50%     { box-shadow:0 0 55px 18px rgba(255,107,53,.7),0 0 120px 45px rgba(255,107,53,.28),inset 0 0 30px rgba(255,180,100,.5); }
                    }
                    @keyframes kz-icon-pop {
                        0%   { transform:scale(0) rotate(-200deg); opacity:0; }
                        65%  { transform:scale(1.25) rotate(12deg); opacity:1; }
                        80%  { transform:scale(.92) rotate(-5deg); }
                        100% { transform:scale(1) rotate(0deg); opacity:1; }
                    }
                    @keyframes kz-orbit {
                        from { transform:rotate(var(--start)) translateX(80px) rotate(calc(-1*var(--start))); }
                        to   { transform:rotate(calc(var(--start) + 360deg)) translateX(80px) rotate(calc(-1*(var(--start)+360deg))); }
                    }
                    @keyframes kz-dot-pulse {
                        0%,100% { transform:scale(1); opacity:.6; }
                        50%     { transform:scale(1.7); opacity:1; }
                    }
                    @keyframes kz-shimmer {
                        0%   { background-position:-400% center; }
                        100% { background-position:400% center; }
                    }
                    @keyframes kz-title-in {
                        0%   { opacity:0; letter-spacing:.6em; filter:blur(8px); }
                        100% { opacity:1; letter-spacing:.22em; filter:blur(0); }
                    }
                    @keyframes kz-sub-in {
                        0%   { opacity:0; transform:translateY(12px); }
                        100% { opacity:.55; transform:translateY(0); }
                    }
                    @keyframes kz-bounce-dot {
                        0%,80%,100% { transform:translateY(0) scale(1); opacity:.4; }
                        40%         { transform:translateY(-10px) scale(1.3); opacity:1; }
                    }
                    @keyframes kz-bar {
                        0%  { width:0%;   }
                        15% { width:22%;  }
                        40% { width:48%;  }
                        70% { width:74%;  }
                        90% { width:91%;  }
                        100%{ width:100%; }
                    }
                    @keyframes kz-bar-glow {
                        0%,100% { box-shadow:0 0 6px rgba(255,107,53,.5); }
                        50%     { box-shadow:0 0 18px rgba(255,107,53,.9),0 0 32px rgba(255,107,53,.4); }
                    }
                    @keyframes kz-corner-spin {
                        from { transform:rotate(0deg); }
                        to   { transform:rotate(360deg); }
                    }
                    @keyframes kz-sweep {
                        0%   { transform:translateX(-100%); }
                        100% { transform:translateX(200%); }
                    }
                `}</style>

                {/* ── Root ── */}
                <div style={{
                    position:'fixed', inset:0, zIndex:9999,
                    background:'url("/login.jpeg") center/cover no-repeat',
                    display:'flex', flexDirection:'column',
                    alignItems:'center', justifyContent:'center',
                    overflow:'hidden',
                }}>
                    {/* Darker Overlay for loading screen */}
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" />

                    {/* Animated grid mesh */}
                    <div style={{
                        position:'absolute', inset:0, opacity:.06,
                        backgroundImage:'linear-gradient(rgba(255,107,53,.6) 1px,transparent 1px),linear-gradient(90deg,rgba(255,107,53,.6) 1px,transparent 1px)',
                        backgroundSize:'40px 40px',
                        animation:'kz-grid-drift 4s linear infinite',
                    }} />

                    {/* Ambient radial glow */}
                    <div style={{
                        position:'absolute', top:'50%', left:'50%',
                        transform:'translate(-50%,-50%)',
                        width:'520px', height:'520px', borderRadius:'50%',
                        background:'radial-gradient(circle, rgba(255,107,53,.14) 0%, transparent 72%)',
                        animation:'kz-bg-breathe 2.4s ease-in-out infinite',
                        pointerEvents:'none',
                    }} />

                    {/* Sonar pulses */}
                    {[0, 0.6, 1.2].map((delay, i) => (
                        <div key={i} style={{
                            position:'absolute', top:'50%', left:'50%',
                            width:'110px', height:'110px', borderRadius:'50%',
                            border:`${i === 0 ? 2 : 1.5}px solid rgba(255,107,53,${i === 0 ? .8 : .5})`,
                            animation:`kz-sonar 2.4s ${delay}s cubic-bezier(.2,.8,.4,1) infinite`,
                        }} />
                    ))}

                    {/* Outer dashed ring — slow CW */}
                    <div style={{
                        position:'absolute',
                        width:'190px', height:'190px', borderRadius:'50%',
                        border:'1.5px dashed rgba(255,107,53,.25)',
                        animation:'kz-ring-cw 12s linear infinite',
                    }} />

                    {/* Mid ring — medium CCW */}
                    <div style={{
                        position:'absolute',
                        width:'155px', height:'155px', borderRadius:'50%',
                        border:'2px solid transparent',
                        borderTopColor:'rgba(255,107,53,.7)',
                        borderRightColor:'rgba(255,107,53,.2)',
                        borderBottomColor:'rgba(220,38,38,.4)',
                        animation:'kz-ring-ccw 2.2s linear infinite',
                    }} />

                    {/* Inner ring — fast CW */}
                    <div style={{
                        position:'absolute',
                        width:'122px', height:'122px', borderRadius:'50%',
                        border:'2.5px solid transparent',
                        borderTopColor:'#FF6B35',
                        borderLeftColor:'rgba(255,107,53,.35)',
                        animation:'kz-ring-cw 1s linear infinite',
                    }} />

                    {/* Orbiting satellite dots */}
                    <div style={{ position:'absolute', width:'160px', height:'160px', borderRadius:'50%' }}>
                        {ORBIT_DOTS.map((d, i) => (
                            <div key={i} style={{
                                position:'absolute', top:'50%', left:'50%',
                                '--start': `${d.angle}deg`,
                                width:`${d.size}px`, height:`${d.size}px`,
                                marginTop:`-${d.size/2}px`, marginLeft:`-${d.size/2}px`,
                                borderRadius:'50%',
                                background:d.color,
                                opacity:d.opacity,
                                boxShadow:`0 0 ${d.size*2}px ${d.color}`,
                                animation:`kz-orbit ${d.speed} ${(i*0.08).toFixed(2)}s linear infinite`,
                            }} />
                        ))}
                    </div>

                    {/* Central glowing orb */}
                    <div style={{
                        position:'relative', zIndex:2,
                        width:'88px', height:'88px', borderRadius:'50%',
                        background:'radial-gradient(circle at 38% 32%, #FFD700, #FF6B35 45%, #c62828)',
                        animation:'kz-orb-glow 2s ease-in-out infinite',
                        display:'flex', alignItems:'center', justifyContent:'center',
                    }}>
                        {/* Glare highlight */}
                        <div style={{
                            position:'absolute', top:'14%', left:'18%',
                            width:'32%', height:'22%', borderRadius:'50%',
                            background:'rgba(255,255,255,0.35)',
                            filter:'blur(4px)',
                        }} />
                        {/* Icon */}
                        <span style={{
                            fontSize:'34px', lineHeight:1, userSelect:'none',
                            animation:'kz-icon-pop .7s .15s cubic-bezier(.34,1.56,.64,1) both',
                        }}>🍽️</span>
                    </div>

                    {/* Text block */}
                    <div style={{ marginTop:'48px', textAlign:'center', position:'relative', zIndex:2 }}>
                        {/* Brand name shimmer */}
                        <h2 style={{
                            margin:0, fontSize:'26px', fontWeight:900,
                            textTransform:'uppercase',
                            background:'linear-gradient(90deg, #FF6B35 0%, #FFD700 30%, #FF6B35 50%, #FFD700 70%, #FF6B35 100%)',
                            backgroundSize:'400% auto',
                            WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text',
                            animation:'kz-shimmer 2.4s linear infinite, kz-title-in .7s .2s ease both',
                        }}>KAGZSO</h2>

                        {/* Subtitle */}
                        <p style={{
                            margin:'8px 0 0', fontSize:'11px', fontWeight:600,
                            color:'rgba(255,255,255,0.55)', letterSpacing:'.18em',
                            textTransform:'uppercase',
                            animation:'kz-sub-in .6s .5s ease both',
                        }}>{settings?.restaurantName || 'Smart Kitchen System'}</p>

                        {/* Bouncing dots */}
                        <div style={{ display:'flex', gap:'7px', justifyContent:'center', marginTop:'18px' }}>
                            {[0, .18, .36].map((delay, i) => (
                                <div key={i} style={{
                                    width:'7px', height:'7px', borderRadius:'50%',
                                    background:'#FF6B35',
                                    animation:`kz-bounce-dot 1.1s ${delay}s ease-in-out infinite`,
                                }} />
                            ))}
                        </div>
                    </div>

                    {/* Progress bar */}
                    <div style={{
                        position:'absolute', bottom:'44px',
                        width:'220px', height:'3px', borderRadius:'999px',
                        background:'rgba(255,255,255,0.08)', overflow:'visible',
                    }}>
                        <div style={{
                            height:'100%', borderRadius:'999px',
                            background:'linear-gradient(90deg,#dc2626,#FF6B35,#ffb347)',
                            animation:`kz-bar 2.4s cubic-bezier(.4,0,.2,1) forwards, kz-bar-glow 1.2s ease-in-out infinite`,
                            position:'relative', overflow:'hidden',
                        }}>
                            {/* Sweep shine on bar */}
                            <div style={{
                                position:'absolute', inset:0, top:'-2px', bottom:'-2px',
                                background:'linear-gradient(90deg,transparent 0%,rgba(255,255,255,.55) 50%,transparent 100%)',
                                animation:'kz-sweep 1.6s .3s ease-in-out infinite',
                            }} />
                        </div>
                    </div>

                    {/* Corner decorations */}
                    {[
                        { top:18, left:18, r:'0deg' },
                        { top:18, right:18, r:'90deg' },
                        { bottom:18, right:18, r:'180deg' },
                        { bottom:18, left:18, r:'270deg' },
                    ].map((pos, i) => (
                        <div key={i} style={{
                            position:'absolute', ...pos,
                            width:'28px', height:'28px',
                            borderTop:'2px solid rgba(255,107,53,.4)',
                            borderLeft:'2px solid rgba(255,107,53,.4)',
                            animation:`kz-corner-spin ${6 + i}s linear infinite`,
                            transformOrigin:'center',
                        }} />
                    ))}
                </div>
            </>
        );
    }

    /* ── Show hero only ── */
    if (heroVisible) {
        return <HeroSection onSignIn={handleSignIn} settings={settings} />;
    }

    return (
        <div className="login-scroll flex flex-col bg-[#f8fafc] dark:bg-[#0a0f1e] overflow-x-hidden animate-cross-fade">


            {/* Background Image & Effects */}
            <div className="fixed top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none animate-blur-in">
                <div className="absolute inset-0 bg-slate-950/40"></div>
                <div 
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-[20s] scale-110 animate-slow-zoom"
                    style={{ backgroundImage: 'url("/login.jpeg")' }}
                ></div>
                <div className="absolute inset-0 bg-gradient-to-br from-slate-950/60 via-slate-950/40 to-slate-950/80 backdrop-blur-sm"></div>

            </div>

            {/* System Status - Top Right Pin (Hidden on mobile to avoid overlap) */}
            <div className="fixed top-6 right-6 z-[100] hidden sm:block animate-fade-in-down animation-delay-300 pointer-events-none sm:pointer-events-auto">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/40 dark:bg-white/5 backdrop-blur-md border border-white/10 shadow-lg transition-all hover:scale-105">
                    <div className={`w-1.5 h-1.5 rounded-full status-pulse-dot ${serverStatus === 'online' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'}`}></div>
                    <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-[0.15em] text-white/90">
                        {serverStatus === 'online' ? 'System Online' : 'System Offline'}
                    </span>
                </div>
            </div>

            {/* Main Content (Centered) */}
            <div className="flex-1 flex flex-col items-center justify-center py-20 px-4 sm:py-12 z-10 w-full relative min-h-dynamic-screen">
                {/* Top Left Logo Section - Premium Entrance & Float */}
                <div className="fixed top-4 left-4 sm:top-6 sm:left-6 z-[100] flex items-center gap-2 sm:gap-4 animate-blur-in hover:scale-105 transition-transform duration-500">
                    <div className="flex items-center gap-2 sm:gap-4 group cursor-default">
                        <div className="relative animate-float shadow-2xl">
                            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/30 to-purple-500/30 rounded-xl blur-lg opacity-40 group-hover:opacity-100 animate-pulse transition duration-500"></div>
                            <div className="relative w-8 sm:w-11 h-8 sm:h-11 flex items-center justify-center rounded-lg sm:rounded-xl bg-slate-900/60 backdrop-blur-xl p-1 sm:p-1.5 border border-white/20 overflow-hidden shadow-orange-500/20">
                                <img src={logoImg} alt="KAGZSO" className="w-[85%] h-[85%] object-contain animate-inner-shimmer" />
                            </div>
                        </div>
                        <div className="flex flex-col animate-fade-in-right animation-delay-300">
                            <h1 className="text-lg sm:text-2xl font-[1000] tracking-[0.2em] uppercase leading-none drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] bg-gradient-to-r from-yellow-400 via-white to-blue-500 bg-clip-text text-transparent bg-[length:200%_auto] animate-shimmer-sweep">KAGZSO</h1>
                            <div className="h-[0.5px] sm:h-px w-full bg-gradient-to-r from-yellow-500/60 via-blue-500/60 to-transparent mt-1.5 rounded-full overflow-hidden">
                                <div className="h-full w-full bg-white/40 animate-progress-glow"></div>
                            </div>
                            <p className="text-[7.5px] sm:text-[10px] text-white font-black tracking-[0.1em] uppercase mt-1.5 leading-none flex items-center gap-1.5">
                                <span className="w-1 h-1 rounded-full bg-yellow-500 animate-ping"></span>
                                {settings?.restaurantName || 'Smart Kitchen System'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Login Card - Glassmorphism */}
                <div className="w-full max-w-[calc(100%-1.5rem)] sm:max-w-[420px] bg-slate-900/60 backdrop-blur-3xl p-7 sm:p-10 rounded-[2.5rem] shadow-[0_45px_100px_-25px_rgba(0,0,0,0.6)] border border-white/10 animate-fade-in-up animation-delay-100 relative group/card">
                    <button 
                        onClick={() => { sessionStorage.removeItem('loginView'); setHeroVisible(true); }}
                        className="absolute top-6 right-6 px-3 py-1 flex flex-col items-center justify-center rounded-xl bg-white/5 hover:bg-orange-500/20 text-white/40 hover:text-orange-500 border border-white/10 transition-all active:scale-95 z-20 group/back"
                        title="Go Back"
                    >
                        <ChevronLeft size={14} className="group-hover/back:-translate-x-0.5 transition-transform" />
                        <span className="text-[8px] font-black uppercase tracking-widest mt-0.5">back</span>
                    </button>

                    <div className="mb-8 text-center sm:text-left">
                        <h2 className="font-black mb-0 tracking-tight" style={{ color: '#FFFFFF', fontSize: '24px' }}>Login</h2>
                    </div>

                    {error && (
                        <div className="p-3 mb-6 text-sm text-red-500 bg-red-500/10 rounded-lg border border-red-500/20 flex items-center animate-shake">
                            <span className="mr-2">⚠️</span> {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5" autoComplete="off">
                        {/* Username with Floating Label logic (using peer container) */}
                        <div className="relative group field-group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-orange-500 transition-colors z-10">
                                <User size={18} />
                            </div>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                autoComplete="off"
                                className="peer w-full pl-10 pr-4 py-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-slate-900 dark:text-white placeholder-transparent transition-all outline-none"
                                placeholder="Username"
                                id="username"
                            />
                            <label 
                                htmlFor="username"
                                className="absolute left-10 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs uppercase tracking-widest transition-all pointer-events-none peer-focus:top-0 peer-focus:text-[10px] peer-focus:text-orange-500 peer-focus:bg-white dark:peer-focus:bg-[#111827] peer-focus:px-2 peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:text-[10px] peer-[:not(:placeholder-shown)]:bg-white dark:peer-[:not(:placeholder-shown)]:bg-[#111827] peer-[:not(:placeholder-shown)]:px-2"
                            >
                                Username
                            </label>
                        </div>

                        {/* Password with Floating Label logic */}
                        <div className="relative group field-group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-orange-500 transition-colors z-10">
                                <Lock size={18} />
                            </div>
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="new-password"
                                className="peer w-full pl-10 pr-12 py-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-slate-900 dark:text-white placeholder-transparent transition-all outline-none"
                                placeholder="Password"
                                id="password"
                            />
                            <label 
                                htmlFor="password"
                                className="absolute left-10 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs uppercase tracking-widest transition-all pointer-events-none peer-focus:top-0 peer-focus:text-[10px] peer-focus:text-orange-500 peer-focus:bg-white dark:peer-focus:bg-[#111827] peer-focus:px-2 peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:text-[10px] peer-[:not(:placeholder-shown)]:bg-white dark:peer-[:not(:placeholder-shown)]:bg-[#111827] peer-[:not(:placeholder-shown)]:px-2"
                            >
                                Password
                            </label>
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-orange-500 transition-colors focus:outline-none z-10"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 px-4 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-black uppercase tracking-widest rounded-xl shadow-lg shadow-orange-500/25 transition-all transform tap-scale active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 overflow-hidden relative group"
                        >
                            <span className="relative z-10 flex items-center gap-2">
                                {loading ? <><Loader2 size={18} className="animate-spin" /> Signing in…</> : 'Sign In'}
                            </span>
                            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                        </button>
                    </form>
                </div>
            </div>

            {/* Footer Removed per request */}

            {/* Custom Toast Mockup (Top Right) */}
            <div className="absolute top-6 right-6 bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-lg shadow-xl p-4 flex items-center gap-3 animate-slide-in-right opacity-0 pointer-events-none hidden">
                <CheckCircle size={20} className="text-green-500" />
                <div>
                    <h4 className="text-[var(--theme-text-main)] text-sm font-semibold">System Ready</h4>
                    <p className="text-[var(--theme-text-muted)] text-xs">Connected to server securely.</p>
                </div>
            </div>
        </div>
    );
};

export default Login;

