import { useState } from 'react';
import {
  X, ChevronLeft, ChevronRight, Zap,
  UtensilsCrossed, Receipt, LayoutDashboard, ClipboardList,
} from 'lucide-react';
const logoImg = '/logo.png';

/* ── Demo slide data ─────────────────────────────────────────────────────── */
const DEMO_SLIDES = [
  {
    Icon: LayoutDashboard,
    color: '#FF6B35',
    title: 'Kitchen Display System',
    desc: 'Real-time order tickets appear instantly on the kitchen screen. Color-coded priority stages keep every chef informed.',
    tags: ['Live Orders', 'Priority Queue', 'Stage Tracking'],
    mockBg: 'linear-gradient(135deg,#0d1526 0%,#1a2744 100%)',
    rows: [
      { label: 'Table 4 — Butter Chicken, Naan x2', status: 'Preparing', color: '#f59e0b' },
      { label: 'Table 7 — Paneer Tikka, Dal Makhani', status: 'Ready', color: '#22c55e' },
      { label: 'Table 2 — Biryani (Special)', status: 'New', color: '#FF6B35' },
    ],
  },
  {
    Icon: ClipboardList,
    color: '#3b82f6',
    title: 'Waiter Order Taking',
    desc: 'Waiters tap a table, select items, and send to kitchen in under 3 seconds. No paper, no errors.',
    tags: ['Dine-In', 'Takeaway', 'Quick Add'],
    mockBg: 'linear-gradient(135deg,#0d1526 0%,#1e293b 100%)',
    rows: [
      { label: 'Table 1 — Occupied', status: '3 items', color: '#FF6B35' },
      { label: 'Table 2 — Free', status: 'Available', color: '#22c55e' },
      { label: 'Table 3 — Occupied', status: '5 items', color: '#FF6B35' },
    ],
  },
  {
    Icon: Receipt,
    color: '#22c55e',
    title: 'Cashier & Billing',
    desc: 'One-click bill generation with GST, discounts, and print-ready receipts. Payment tracking made effortless.',
    tags: ['GST Bill', 'Discount', 'Print Receipt'],
    mockBg: 'linear-gradient(135deg,#0d1526 0%,#1a2744 100%)',
    rows: [
      { label: 'Subtotal', status: '₹480.00', color: '#f8fafc' },
      { label: 'GST (5%)', status: '₹24.00', color: '#94a3b8' },
      { label: 'Total Payable', status: '₹504.00', color: '#22c55e' },
    ],
  },
  {
    Icon: UtensilsCrossed,
    color: '#a855f7',
    title: 'Admin Analytics',
    desc: 'Track daily revenue, best-selling dishes, peak hours, and staff performance from one dashboard.',
    tags: ['Revenue', 'Top Dishes', 'Staff Stats'],
    mockBg: 'linear-gradient(135deg,#0d1526 0%,#1e293b 100%)',
    rows: [
      { label: "Today's Revenue", status: '₹12,480', color: '#a855f7' },
      { label: 'Orders Completed', status: '84', color: '#22c55e' },
      { label: 'Avg Order Time', status: '4.2 min', color: '#f59e0b' },
    ],
  },
];

/* ── Demo Modal ──────────────────────────────────────────────────────────── */
const DemoModal = ({ onClose }) => {
  const [idx, setIdx] = useState(0);
  const slide = DEMO_SLIDES[idx];
  const { Icon } = slide;

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '12px', animation: 'heroFadeSlideUp 0.3s ease forwards',
        overflowY: 'auto',
      }}
    >
      <div style={{
        background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '16px', width: '100%', maxWidth: '680px',
        overflow: 'hidden', boxShadow: '0 40px 80px rgba(0,0,0,0.6)',
        margin: 'auto',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={17} color="#FF6B35" />
            <span style={{ color: '#f8fafc', fontWeight: 700, fontSize: '14px' }}>Quick Demo</span>
            <span style={{
              background: 'rgba(255,107,53,0.15)', border: '1px solid rgba(255,107,53,0.3)',
              borderRadius: '999px', padding: '2px 8px', color: '#FF6B35', fontSize: '11px', fontWeight: 600,
            }}>
              {idx + 1} / {DEMO_SLIDES.length}
            </span>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '8px',
            padding: '6px', cursor: 'pointer', color: '#94a3b8',
            display: 'flex', alignItems: 'center',
          }}>
            <X size={16} />
          </button>
        </div>

        {/* Slide body */}
        <div style={{ padding: '16px' }}>
          {/* Mock screen */}
          <div style={{
            background: slide.mockBg, borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '14px', marginBottom: '14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '7px',
                background: slide.color + '22', border: '1px solid ' + slide.color + '44',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon size={14} color={slide.color} />
              </div>
              <span style={{ color: '#f8fafc', fontWeight: 700, fontSize: '12px' }}>{slide.title}</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
                {['#ef4444', '#f59e0b', '#22c55e'].map((c) => (
                  <div key={c} style={{ width: '7px', height: '7px', borderRadius: '50%', background: c }} />
                ))}
              </div>
            </div>
            {slide.rows.map((row, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 10px', marginBottom: '6px',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '7px', border: '1px solid rgba(255,255,255,0.06)',
                gap: '8px',
              }}>
                <span style={{ color: '#cbd5e1', fontSize: '12px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.label}</span>
                <span style={{
                  color: row.color, fontSize: '11px', fontWeight: 700, flexShrink: 0,
                  background: row.color + '18', padding: '2px 8px', borderRadius: '999px',
                }}>{row.status}</span>
              </div>
            ))}
          </div>

          <p style={{ color: '#94a3b8', fontSize: '13px', lineHeight: 1.65, marginBottom: '10px' }}>
            {slide.desc}
          </p>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {slide.tags.map((tag) => (
              <span key={tag} style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '999px', padding: '3px 10px', color: '#64748b', fontSize: '11px',
              }}>{tag}</span>
            ))}
          </div>
        </div>

        {/* Footer nav */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.08)',
          gap: '8px',
        }}>
          <button
            disabled={idx === 0}
            onClick={() => setIdx((s) => Math.max(0, s - 1))}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              background: idx === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
              padding: '8px 12px', color: idx === 0 ? '#334155' : '#94a3b8',
              cursor: idx === 0 ? 'not-allowed' : 'pointer',
              fontSize: '12px', fontWeight: 600,
            }}
          >
            <ChevronLeft size={14} /> Prev
          </button>

          <div style={{ display: 'flex', gap: '5px' }}>
            {DEMO_SLIDES.map((_, i) => (
              <button key={i} onClick={() => setIdx(i)} style={{
                width: i === idx ? '20px' : '7px', height: '7px', borderRadius: '999px',
                border: 'none', cursor: 'pointer', transition: 'all 0.3s',
                background: i === idx ? '#FF6B35' : 'rgba(255,255,255,0.15)',
              }} />
            ))}
          </div>

          {idx < DEMO_SLIDES.length - 1 ? (
            <button
              onClick={() => setIdx((s) => Math.min(DEMO_SLIDES.length - 1, s + 1))}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                background: '#FF6B35', border: 'none', borderRadius: '8px',
                padding: '8px 12px', color: 'white', cursor: 'pointer',
                fontSize: '12px', fontWeight: 700,
                boxShadow: '0 4px 16px rgba(255,107,53,0.4)',
              }}
            >
              Next <ChevronRight size={14} />
            </button>
          ) : (
            <button onClick={onClose} style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              background: 'linear-gradient(135deg,#FF6B35,#dc2626)', border: 'none',
              borderRadius: '8px', padding: '8px 12px', color: 'white',
              cursor: 'pointer', fontSize: '12px', fontWeight: 700,
            }}>
              Got it! ✓
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/* ── Stat card data ───────────────────────────────────────────────────────── */
const STATS = [
  { icon: '🍽️', value: '200+', label: 'Orders Managed Daily' },
  { icon: '⚡', value: '5 sec', label: 'Order to Kitchen Time' },
  { icon: '✅', value: '99%', label: 'Kitchen Accuracy Rate' },
];

/* ── Hero Section ────────────────────────────────────────────────────────── */
const HeroSection = ({ onSignIn, settings }) => {
  const [showDemo, setShowDemo] = useState(false);

  return (
    <div className="login-scroll">
      <style>{`
        /* ── Hero responsive overrides ───────────────────────── */
        .hero-section {
          background-image: url(/bg-hero.jpg.png);
          background-size: cover;
          background-position: center;
          background-attachment: scroll; /* fixed breaks on iOS */
          min-height: 100svh;
          position: relative;
        }

        .hero-contact-bar {
          position: absolute; top: 0; left: 0; right: 0; z-index: 101;
          display: flex; justify-content: space-between; align-items: center;
          gap: 20px; padding: 12px 24px;
          background: rgba(0,0,0,0.4);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        .hero-contact-link {
          display: flex; align-items: center; gap: 6px;
          color: rgba(255,255,255,0.8); text-decoration: none;
          font-size: 13px; font-weight: 500; transition: color 0.2s;
          white-space: nowrap;
        }
        .hero-email-link { display: flex; }

        .hero-content {
          position: relative; z-index: 1;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          min-height: 100svh; text-align: center;
          padding: 90px 20px 56px;
        }

        .hero-headline {
          font-size: clamp(28px, 6vw, 68px);
          font-weight: 800; color: white;
          line-height: 1.1; margin-bottom: 20px; letter-spacing: -1px;
        }

        .hero-subtitle {
          font-size: clamp(14px, 2vw, 19px);
          color: rgba(255,255,255,0.72);
          max-width: 540px; line-height: 1.75; margin-bottom: 40px;
        }

        .hero-cta-group {
          display: flex; gap: 12px; flex-wrap: wrap;
          justify-content: center; margin-bottom: 56px;
        }
        .hero-btn-demo {
          background: linear-gradient(135deg,#FF6B35,#dc2626);
          color: white; padding: 13px 28px; border-radius: 10px;
          font-weight: 700; font-size: 15px; border: none; cursor: pointer;
          box-shadow: 0 6px 24px rgba(255,107,53,0.45); transition: all 0.3s;
          display: flex; align-items: center; gap: 8px;
        }
        .hero-btn-signin {
          background: transparent; color: white;
          padding: 13px 28px; border-radius: 10px;
          font-weight: 600; font-size: 15px;
          border: 2px solid rgba(255,255,255,0.35); transition: all 0.3s;
          cursor: pointer;
        }

        .hero-stats {
          display: flex; gap: 12px; flex-wrap: wrap; justify-content: center;
        }
        .hero-stat-card {
          background: rgba(255,255,255,0.07); backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.13);
          border-radius: 14px; padding: 14px 22px;
          color: white; text-align: center; min-width: 120px;
        }

        /* ── Tablet (≤ 768px) ─────────────────────────────────── */
        @media (max-width: 768px) {
          .hero-contact-bar { gap: 14px; padding: 10px 16px; }
          .hero-contact-link { font-size: 12px; gap: 5px; }
          .hero-content { padding: 80px 16px 48px; }
          .hero-headline { margin-bottom: 16px; }
          .hero-subtitle { margin-bottom: 32px; padding: 0 4px; }
          .hero-cta-group { gap: 10px; margin-bottom: 44px; }
          .hero-stats { gap: 10px; }
          .hero-stat-card { min-width: 100px; padding: 12px 16px; }
        }

        /* ── Mobile (≤ 480px) ─────────────────────────────────── */
        @media (max-width: 480px) {
          .hero-email-link { display: none; }
          .hero-contact-bar { padding: 8px 12px; gap: 10px; justify-content: flex-end; }
          .hero-contact-link { font-size: 11px; }
          .hero-content { padding: 72px 16px 40px; }
          .hero-btn-demo { padding: 12px 22px; font-size: 14px; }
          .hero-btn-signin { padding: 12px 22px; font-size: 14px; }
          .hero-stats { gap: 8px; }
          .hero-stat-card { min-width: 0; flex: 1; padding: 10px 10px; min-width: 90px; }
        }

        /* ── Glass Shimmer Animation for KAGZSO Brand ── */
        @keyframes glass-shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .glass-brand-text {
          background: linear-gradient(
            110deg,
            #3b82f6 0%,
            #60a5fa 25%,
            #ffffff 45%,
            #ffffff 55%,
            #60a5fa 75%,
            #3b82f6 100%
          );
          background-size: 200% auto;
          background-clip: text;
          -webkit-background-clip: text;
          color: transparent;
          animation: glass-shimmer 3s infinite linear;
          filter: drop-shadow(0 0 8px rgba(59, 130, 246, 0.4));
          font-weight: 1000;
          letter-spacing: 0.2em;
          text-transform: uppercase;
        }

        /* ── Very small (≤ 360px) ─────────────────────────────── */
        @media (max-width: 360px) {
          .hero-contact-link span { display: none; }
          .hero-btn-demo { padding: 11px 18px; font-size: 13px; }
          .hero-btn-signin { padding: 11px 18px; font-size: 13px; }
          .hero-stat-card { padding: 8px 8px; }
        }
      `}</style>

      <section className="hero-section">
        {/* Overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg,rgba(0,0,0,0.80) 0%,rgba(10,15,30,0.75) 100%)',
        }} />

        {/* Top bar (Desktop: Brand + Contact | Mobile: Contact Only) */}
        <div className="hero-contact-bar">
          {/* Desktop Brand (Hidden on Mobile) */}
          <div className="hidden sm:flex items-center gap-3 group cursor-default">
            <div className="relative animate-float scale-100">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/30 to-purple-500/30 rounded-xl blur-lg opacity-40 group-hover:opacity-100 animate-pulse transition duration-500"></div>
              <div className="relative w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg bg-slate-900/60 backdrop-blur-xl p-1 border border-white/20 overflow-hidden shadow-orange-500/20">
                <img src={logoImg} alt="KAGZSO" className="w-[85%] h-[85%] object-contain animate-inner-shimmer" />
              </div>
            </div>
            <div className="flex flex-col animate-fade-in-right animation-delay-300">
              <h1 className="text-sm sm:text-lg glass-brand-text leading-none">KAGZSO</h1>
              <p className="text-[7px] sm:text-[9px] text-white/50 font-black tracking-[0.1em] uppercase mt-1 leading-none">
                {settings?.restaurantName || 'Smart Kitchen System'}
              </p>
            </div>
          </div>

          {/* Spacer for mobile to push contacts to right */}
          <div className="sm:hidden flex-1" />

          {/* Contact Links */}
          <div className="flex items-center gap-4 sm:gap-6">
            <a
              href="tel:+917397111142"
              className="hero-contact-link"
              onMouseEnter={e => e.currentTarget.style.color = '#FF6B35'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'}
            >
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8 19.79 19.79 0 01.22 2.18 2 2 0 012.18 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.08 6.08l1.28-1.28a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
              </svg>
              <span className="hidden sm:inline">+91 7397111142</span>
            </a>

            <a
              href="https://wa.me/917397111142"
              target="_blank"
              rel="noopener noreferrer"
              className="hero-contact-link"
              onMouseEnter={e => e.currentTarget.style.color = '#25D366'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'}
            >
              <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              <span className="hidden sm:inline">WhatsApp</span>
            </a>

            <a
              href="mailto:kagzso.in@gmail.com"
              className="hero-contact-link hero-email-link"
              onMouseEnter={e => e.currentTarget.style.color = '#FF6B35'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'}
            >
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              <span className="hidden md:inline">kagzso.in@gmail.com</span>
            </a>
          </div>
        </div>

        {/* Mobile Floating Brand (Pin to Left Corner on Mobile) */}
        <div className="sm:hidden fixed top-4 left-4 z-[110] flex items-center gap-2 animate-blur-in hover:scale-105 transition-transform duration-500">
          <div className="flex items-center gap-2 group cursor-default">
            <div className="relative animate-float shadow-2xl">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/30 to-purple-500/30 rounded-xl blur-lg opacity-40 group-hover:opacity-100 animate-pulse transition duration-500"></div>
              <div className="relative w-8 h-8 flex items-center justify-center rounded-lg bg-slate-900/60 backdrop-blur-xl p-1 border border-white/20 overflow-hidden shadow-orange-500/20">
                <img src={logoImg} alt="KAGZSO" className="w-[85%] h-[85%] object-contain animate-inner-shimmer" />
              </div>
            </div>
            <div className="flex flex-col animate-fade-in-right animation-delay-300">
              <h1 className="text-lg glass-brand-text leading-none">KAGZSO</h1>
              <div className="h-[0.5px] w-full bg-gradient-to-r from-blue-500/60 via-purple-500/60 to-transparent mt-1.5 rounded-full overflow-hidden">
                <div className="h-full w-full bg-white/40 animate-progress-glow"></div>
              </div>
              <p className="text-[7.5px] text-white font-black tracking-[0.1em] uppercase mt-1.5 leading-none flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-blue-500 animate-ping"></span>
                {settings?.restaurantName || 'Smart Kitchen System'}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="hero-content animate-blur-in">

          {/* Headline */}
          <h1 className="hero-headline animate-fade-in-up">
            Smart Kitchen &amp; Order
            <br />
            <span style={{ color: '#FF6B35' }}>Management System</span>
          </h1>

          {/* Subtitle */}
          <p className="hero-subtitle animate-fade-in-up animation-delay-100">
            From table to kitchen in seconds. Manage orders, track kitchen stages,
            and streamline billing — all in one place.
          </p>

          {/* CTA buttons */}
          <div className="hero-cta-group animate-fade-in-up animation-delay-200">
            <button
              onClick={() => setShowDemo(true)}
              className="hero-btn-demo tap-scale active:scale-95"
            >
              <Zap size={17} /> Quick Demo
            </button>

            <button
              onClick={onSignIn}
              className="hero-btn-signin tap-scale active:scale-95 group overflow-hidden relative"
            >
              <span className="relative z-10">Sign In →</span>
              <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
            </button>
          </div>

          {/* Floating stat cards */}
          <div className="hero-stats animate-fade-in-up animation-delay-300">
            {STATS.map((stat, i) => (
              <div
                key={i}
                className={`hero-stat-card stat-card-hover hero-float hero-float-delay-${i}`}
              >
                <div style={{ fontSize: '20px', marginBottom: '4px' }}>{stat.icon}</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#FF6B35', lineHeight: 1.1 }}>{stat.value}</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginTop: '4px', fontWeight: 500 }}>{stat.label}</div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {showDemo && <DemoModal onClose={() => setShowDemo(false)} />}
    </div>
  );
};

export default HeroSection;
