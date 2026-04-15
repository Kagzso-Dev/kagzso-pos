/**
 * Centralized tax calculation utility.
 * Matches Backend logic for consistency across all order types.
 */
export const calculateTax = (subtotal, settings, options = { discount: 0 }) => {
    const { discount = 0 } = options;
    const discountedSubtotal = Math.max(0, subtotal - discount);
    
    const sgstRate = settings?.sgst || 0;
    const cgstRate = settings?.cgst || 0;
    
    const sgst = discountedSubtotal * (sgstRate / 100);
    const cgst = discountedSubtotal * (cgstRate / 100);
    const finalAmount = discountedSubtotal + sgst + cgst;
    
    return {
        subtotal: discountedSubtotal,
        sgst,
        cgst,
        finalAmount,
        sgstRate,
        cgstRate
    };
};
