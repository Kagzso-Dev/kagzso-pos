import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
const logoImg = '/logo.png';


const Logo = ({ size = 'md', showText = true }) => {
    const { settings } = useContext(AuthContext);
    const sizeClasses = {
        sm: 'w-8 h-8',
        md: 'w-12 h-12',
        lg: 'w-16 h-16',
        xl: 'w-24 h-24'
    };

    return (
        <div className="flex flex-col items-center justify-center group">
            <div className={`${sizeClasses[size]} bg-gradient-to-br from-white to-gray-50 rounded-2xl flex items-center justify-center shadow-xl p-2 border border-[var(--theme-border)] group-hover:scale-105 group-hover:rotate-3 transition-all duration-300 relative overflow-hidden`}>
                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <img src={logoImg} alt="KAGSZO" className="w-full h-full object-contain relative z-10" />
            </div>
            {showText && (
                <div className="text-center mt-4">
                    <h1 className="text-2xl font-black text-[var(--theme-text-main)] tracking-[-0.05em] uppercase flex items-center justify-center gap-2">
                        KAGZSO
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    </h1>
                    <p className="text-[10px] text-[var(--theme-text-muted)] font-black uppercase tracking-[0.3em] mt-1 opacity-80">Premium POS System</p>
                </div>
            )}
        </div>
    );
};

export default Logo;

