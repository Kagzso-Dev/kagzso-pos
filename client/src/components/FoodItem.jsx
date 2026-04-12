import { useState, useEffect, memo } from 'react';
import { Plus, Minus, Edit, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

import OptimizedImage from './OptimizedImage';

/* ── Reusable +/- stepper ─────────────────────────────────────────────── */
const QtyControl = ({ qty, onAdd, onRemove, size = 'md' }) => {
    const isSm = size === 'sm';
    const btnCls = isSm ? 'w-[22px] h-[22px]' : 'w-9 h-9';
    const numCls = isSm ? 'min-w-[12px] text-[10px]' : 'min-w-[28px] text-sm';
    const iconSize = isSm ? 10 : 16;

    if (qty === 0) {
        return (
            <button
                onClick={(e) => { e.stopPropagation(); onAdd(); }}
                className={`${btnCls} rounded-xl flex items-center justify-center bg-[var(--theme-bg-dark)] hover:bg-orange-500 hover:text-white text-orange-500 shadow-sm active:scale-95 transition-all flex-shrink-0 border border-orange-500/20`}
                style={{ width: isSm ? '26px' : '36px', height: isSm ? '26px' : '36px' }}
            >
                <Plus size={iconSize} strokeWidth={3} />
            </button>
        );
    }

    return (
        <div className="flex items-center gap-1.5 flex-shrink-0 p-1 bg-[var(--theme-bg-dark)] rounded-xl border border-[var(--theme-border)]" onClick={e => e.stopPropagation()}>
            <button
                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                className={`${btnCls} rounded-lg flex items-center justify-center bg-[var(--theme-bg-card)] text-[var(--theme-text-muted)] hover:text-rose-500 hover:bg-rose-500/10 transition-all shadow-sm active:scale-95 border border-[var(--theme-border)]`}
            >
                <Minus size={iconSize} strokeWidth={3} />
            </button>
            <span className={`${numCls} text-center font-black text-[var(--theme-text-main)] tabular-nums px-1`}>{qty}</span>
            <button
                onClick={(e) => { e.stopPropagation(); onAdd(); }}
                className={`${btnCls} rounded-lg flex items-center justify-center bg-orange-500 text-white hover:bg-orange-600 transition-all shadow-md shadow-orange-500/20 active:scale-95`}
            >
                <Plus size={iconSize} strokeWidth={3} />
            </button>
        </div>
    );
};

const FoodItem = memo(({
    item,
    viewMode,
    formatPrice,
    onAdd,
    onRemove,
    onEdit,
    onDelete,
    onToggleAvailability,
    showActions = true,
    isAdmin = false,
    cartQty = 0,
    itemCart = []
}) => {
    // Current selected variant index for the 'rotate/scroll' behavior
    const [selIdx, setSelIdx] = useState(0);

    // Get the actual variant object
    const selectedSize = (item.variants && item.variants.length > 0)
        ? item.variants[selIdx]
        : null;

    const isVeg = item.isVeg;

    /* ── MINI TAB VIEW (Compact Grid) ───────────────────────────────────── */
    if (viewMode === 'mini') {
        const currentVariantKey = selectedSize ? `${item._id}_${selectedSize.name}` : item._id;
        const currentVariantQty = selectedSize
            ? (itemCart?.find(c => c.cartKey === currentVariantKey)?.quantity || 0)
            : cartQty;

        return (
            <div
                className={`group relative bg-[var(--theme-bg-card)] rounded-xl border transition-all flex items-center p-2 gap-3 animate-fade-in ${cartQty > 0 ? 'border-orange-500 shadow-sm ring-1 ring-orange-500/10' : 'border-[var(--theme-border)] hover:border-orange-500/20 active:scale-[0.99]'} ${!isAdmin && item.availability !== false ? 'cursor-pointer' : ''}`}
                onClick={() => !isAdmin && item.availability !== false && onAdd(item, selectedSize)}
            >
                {/* Mini Color Indicator */}
                <div className={`w-1 h-8 rounded-full shrink-0 ${isVeg ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                
                <div className="flex-1 min-w-0">
                    <h3 className="text-[12px] font-black text-[var(--theme-text-main)] leading-tight truncate uppercase tracking-tight">{item.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] font-black text-orange-500 tracking-tighter">
                            {formatPrice(selectedSize ? selectedSize.price : item.price)}
                        </span>
                        {item.variants?.length > 0 && (
                            <span className="text-[8px] font-bold text-[var(--theme-text-muted)] uppercase px-1.5 py-0.5 bg-[var(--theme-bg-dark)] rounded-md border border-[var(--theme-border)]">
                                {selectedSize ? selectedSize.name : 'Multiple'}
                            </span>
                        )}
                    </div>
                </div>

                {showActions && !isAdmin && (
                    <QtyControl
                        qty={currentVariantQty}
                        onAdd={() => onAdd(item, selectedSize)}
                        onRemove={() => onRemove(item.variants?.length > 0 ? currentVariantKey : item._id)}
                        size="sm"
                    />
                )}
            </div>
        );
    }

    /* ── LIST VIEW ──────────────────────────────────────────────────────── */
    if (viewMode === 'list') {
        const basePrice = item.price;

        return (
            <div
                className={`group bg-[var(--theme-bg-card)] rounded-xl overflow-hidden border transition-all animate-fade-in ${cartQty > 0 ? 'border-orange-500/50 shadow-md ring-1 ring-orange-500/10' : 'border-[var(--theme-border)] hover:border-gray-400/20'} ${!isAdmin && item.availability !== false ? 'cursor-pointer active:scale-[0.99]' : ''}`}
                onClick={() => !isAdmin && item.availability !== false && !item.variants?.length && onAdd(item)}
            >
                <div className="flex items-center gap-3 p-2 sm:p-3">
                    <OptimizedImage
                        src={item.image}
                        alt={item.name}
                        width={120}
                        containerClassName="w-14 h-14 sm:w-16 sm:h-16 rounded-lg flex-shrink-0"
                    >
                        {item.availability === false && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                <span className="text-white text-[8px] font-black uppercase tracking-tight">Off</span>
                            </div>
                        )}
                    </OptimizedImage>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${isVeg ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            <h3 className="text-[14px] font-black text-[var(--theme-text-main)] leading-tight truncate uppercase tracking-tight">{item.name}</h3>
                        </div>
                        <p className="text-[10px] text-[var(--theme-text-muted)] truncate font-bold uppercase tracking-widest opacity-60 mt-0.5">{item.category?.name || 'Item'}</p>

                        {item.variants?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {item.variants.map((v, i) => {
                                    const variantKey = `${item._id}_${v.name}`;
                                    const variantCartItem = itemCart?.find(c => c.cartKey === variantKey);
                                    const q = variantCartItem?.quantity || 0;
                                    return (
                                        <div key={i} className="flex-shrink-0">
                                            {isAdmin ? (
                                                <div className="px-2 py-0.5 rounded-lg bg-gray-500/10 text-[9px] font-black text-gray-500 border border-gray-500/10">
                                                    {v.name}
                                                </div>
                                            ) : (
                                                <div className={`flex items-center gap-1 rounded-xl border transition-all ${q > 0 ? 'bg-orange-500 text-white border-orange-500 shadow-sm' : 'bg-[var(--theme-bg-dark)] text-[var(--theme-text-muted)] border-[var(--theme-border)] hover:border-orange-500/50 hover:bg-orange-500/5'}`}>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onAdd(item, v); }}
                                                        className="px-2 py-1 text-[9px] font-black uppercase flex items-center gap-1.5"
                                                    >
                                                        {q > 0 && <span>{q}x</span>}
                                                        {v.name} &middot; {formatPrice(v.price)}
                                                    </button>
                                                    {q > 0 && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); onRemove(variantKey); }}
                                                            className="pr-1.5 h-full opacity-70 hover:opacity-100 flex items-center justify-center"
                                                        >
                                                            <Minus size={10} strokeWidth={4} />
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        {item.variants?.length === 0 && (
                            <span className="text-[13px] font-black text-orange-500 tabular-nums tracking-tighter">
                                {formatPrice(basePrice)}
                            </span>
                        )}
                        {showActions && (
                            isAdmin ? (
                                <div className="flex items-center gap-1.5">
                                    <button onClick={(e) => { e.stopPropagation(); onEdit(item); }} className="p-2 text-[var(--theme-text-muted)] hover:text-blue-400 bg-[var(--theme-bg-dark)] rounded-lg border border-[var(--theme-border)]">
                                        <Edit size={12} />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); onDelete(item._id); }} className="p-2 text-[var(--theme-text-muted)] hover:text-red-400 bg-[var(--theme-bg-dark)] rounded-lg border border-[var(--theme-border)]">
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            ) : (
                                !item.variants?.length && <QtyControl qty={cartQty} onAdd={() => onAdd(item)} onRemove={() => onRemove(item._id)} size="sm" />
                            )
                        )}
                    </div>
                </div>
            </div>
        );
    }

    /* ── GRID VIEW ──────────────────────────────────────────────────────── */
    const currentVariantKey = selectedSize ? `${item._id}_${selectedSize.name}` : item._id;
    const currentVariantQty = selectedSize
        ? (itemCart?.find(c => c.cartKey === currentVariantKey)?.quantity || 0)
        : cartQty;

    return (
        <div
            className={`group relative bg-[var(--theme-bg-card)] rounded-2xl border transition-all flex flex-col animate-fade-in overflow-hidden ${cartQty > 0 ? 'border-orange-500/40 shadow-md ring-1 ring-orange-500/10' : 'border-[var(--theme-border)] hover:border-orange-500/20 active:scale-[0.99]'} ${!isAdmin && item.availability !== false ? 'cursor-pointer' : ''}`}
            onClick={() => !isAdmin && item.availability !== false && onAdd(item, selectedSize)}
        >
            <div className="relative aspect-[4/3] overflow-hidden">
                <OptimizedImage
                    src={item.image}
                    alt={item.name}
                    fill
                    className="group-hover:scale-105 duration-500 ease-out object-cover"
                />

                {/* Badges */}
                <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-md border border-white/10">
                        <div className={`w-1.5 h-1.5 rounded-full ${isVeg ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        <span className="text-[8px] font-black text-white/90 tracking-tighter uppercase">{isVeg ? 'Veg' : 'Non'}</span>
                    </div>
                </div>

                {item.variants?.length > 0 && !isAdmin && (
                    <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 rounded-md bg-orange-600/90 text-white text-[7px] font-bold uppercase tracking-tight shadow-lg">
                        {item.variants.length} Sizes
                    </div>
                )}

                {item.availability === false && (
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-[1px] flex items-center justify-center z-20 text-center px-4">
                        <span className="text-white text-[10px] font-black uppercase tracking-widest bg-red-600 px-3 py-1 rounded-lg shadow-lg">Not Available</span>
                    </div>
                )}
            </div>

            <div className="p-2 sm:p-3 flex flex-col flex-1">
                <div className="min-h-[40px] mb-2 flex justify-between items-start">
                    <div className="min-w-0 pr-2">
                        <h3 className="text-[14px] font-black text-[var(--theme-text-main)] leading-tight line-clamp-2 uppercase tracking-tight">{item.name}</h3>
                        <p className="text-[10px] text-[var(--theme-text-muted)] font-black mt-0.5 opacity-60 uppercase tracking-widest">{item.category?.name || 'Item'}</p>
                    </div>

                    {/* Mobile/Tablet Price: Visible on small and medium screens */}
                    <div className="flex lg:hidden flex-col items-end shrink-0">
                        <span className="text-[7px] font-black text-gray-400 uppercase tracking-wider mb-0.5">Price</span>
                        <span className="text-[14px] font-black text-orange-600 tabular-nums leading-none">
                            {(!selectedSize || item.variants?.length === 0) ? formatPrice(item.price) : formatPrice(selectedSize.price)}
                        </span>
                    </div>
                </div>

                <div className="mt-auto pt-2.5 flex flex-col gap-2.5 border-t border-[var(--theme-border)]/50">
                    <div className="flex items-center justify-between">
                        {showActions && (
                            isAdmin ? (
                                <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                                    <button onClick={(e) => { e.stopPropagation(); onEdit(item); }} className="w-8 h-8 flex items-center justify-center text-[var(--theme-text-muted)] hover:text-blue-400 bg-[var(--theme-bg-dark)] rounded-lg border border-[var(--theme-border)] transition-colors">
                                        <Edit size={14} />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); onDelete(item._id); }} className="w-8 h-8 flex items-center justify-center text-[var(--theme-text-muted)] hover:text-red-400 bg-[var(--theme-bg-dark)] rounded-lg border border-[var(--theme-border)] transition-colors">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ) : (
                                <div className="shrink-0">
                                    <QtyControl
                                        qty={currentVariantQty}
                                        onAdd={() => onAdd(item, selectedSize)}
                                        onRemove={() => onRemove(item.variants?.length > 0 ? currentVariantKey : item._id)}
                                        size="sm"
                                    />
                                </div>
                            )
                        )}

                        {/* Desktop Price: Visible only on large screens */}
                        <div className="hidden lg:flex flex-col items-end">
                            <span className="text-[8px] font-black text-[var(--theme-text-muted)] uppercase tracking-[0.2em] opacity-40 mb-0.5 leading-none">Price</span>
                            <span className="text-[14px] xs:text-[15px] font-black text-orange-500 tabular-nums tracking-tighter leading-none shrink-0 whitespace-nowrap">
                                {(!selectedSize || item.variants?.length === 0) ? formatPrice(item.price) : formatPrice(selectedSize.price)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* STATIC SIZE SELECTOR (SCROLL TYPE) */}
                {!isAdmin && item.variants?.length > 0 && (
                    <div className="mt-3 relative">
                        <div className="flex items-center gap-1 bg-[var(--theme-bg-dark)] p-1 rounded-xl border border-[var(--theme-border)] overflow-hidden">
                            {/* Scroll through sizes */}
                            <div className="flex gap-1 overflow-x-auto no-scrollbar scroll-smooth snap-x">
                                {item.variants.map((v, i) => {
                                    const isSel = selIdx === i;
                                    const cartKey = `${item._id}_${v.name}`;
                                    const q = itemCart?.find(c => c.cartKey === cartKey)?.quantity || 0;
                                    return (
                                        <button
                                            key={i}
                                            onClick={(e) => { e.stopPropagation(); setSelIdx(i); }}
                                            className={`snap-center flex-shrink-0 min-w-[50px] px-2 py-2 rounded-lg text-[8px] font-black border transition-all relative ${isSel ? 'bg-orange-500 text-white border-orange-600 shadow-sm shadow-orange-500/20' : 'bg-transparent text-[var(--theme-text-muted)] border-transparent hover:text-[var(--theme-text-main)]'}`}
                                        >
                                            <span className="truncate block max-w-full uppercase">{v.name}</span>
                                            {q > 0 && (
                                                <span className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full text-[6px] flex items-center justify-center font-bold shadow-sm ${isSel ? 'bg-orange-500 text-white' : 'bg-emerald-500 text-white'}`}>
                                                    {q}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Navigation dots/indicators for Rotate type feel */}
                        {item.variants.length > 2 && (
                            <div className="flex justify-center gap-1 mt-2">
                                {item.variants.map((_, i) => (
                                    <div
                                        key={i}
                                        className={`w-1 h-1 rounded-full transition-all ${selIdx === i ? 'bg-orange-500 w-3' : 'bg-gray-700'}`}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
});

export default FoodItem;
