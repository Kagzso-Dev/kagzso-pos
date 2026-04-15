import { calculateTax } from '../utils/tax';

export const printBill = (order, formatPrice, settings = {}, isKOT = false, filterNew = false) => {
    const isPaid = order.paymentStatus === 'paid';
    const restaurantName = settings.restaurantName || 'admin';
    const address = settings.address || '';
    const gstNumber = settings.gstNumber || '';
    const sgstRate = settings.sgst || 0;
    const cgstRate = settings.cgst || 0;
    
    const orderNum = order.orderType === 'dine-in' ? 'DINE' : 'TK';
    const ordNum = String(order.orderNumber).startsWith('ORD-') ? String(order.orderNumber).replace('ORD-', '') : order.orderNumber;
    const displayOrderNumber = `${orderNum}-${ordNum}`;

    const date = new Date(order.createdAt).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });

    let activeItems = (order.items || []).filter(
        (item) => item.status?.toUpperCase() !== 'CANCELLED'
    );

    if (filterNew) {
        activeItems = activeItems.filter(item => item.isNewlyAdded);
    }

    if (activeItems.length === 0) {
        console.warn('No items to print');
        return;
    }

    // Calculate subtotal for the specific items being printed on this slip
    const printSubtotal = activeItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const printResults = calculateTax ? calculateTax(printSubtotal, settings, { discount: 0 }) : {
        finalAmount: printSubtotal,
        sgst: printSubtotal * sgstRate / 100,
        cgst: printSubtotal * cgstRate / 100,
        sgstRate,
        cgstRate
    };

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${filterNew ? 'NEW ITEMS' : (isKOT ? 'KOT' : 'BILL')} — ${displayOrderNumber}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
  
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: 'Courier Prime', 'Courier New', Courier, monospace;
    font-size: 12px;
    width: 72mm;
    margin: 0 auto;
    padding: 10px 5px;
    color: #000;
    background: #f4f4f5; /* Light grey background for preview */
  }
  
  /* Preview Header Styling */
  .preview-header {
    background: white;
    padding: 15px;
    border-radius: 12px;
    margin-bottom: 20px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.05);
    text-align: center;
    font-family: 'Inter', sans-serif;
    position: sticky;
    top: 5px;
    z-index: 100;
    border: 1px solid #e4e4e7;
  }
  .preview-title {
    font-size: 10px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #71717a;
    margin-bottom: 10px;
  }
  .preview-actions {
    display: flex;
    gap: 8px;
    justify-content: center;
  }
  .btn {
    padding: 8px 16px;
    border-radius: 8px;
    font-weight: 700;
    font-size: 11px;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
    text-transform: uppercase;
  }
  .btn-print {
    background: #f97316;
    color: white;
  }
  .btn-print:hover { background: #ea580c; }
  .btn-close {
    background: #e4e4e7;
    color: #3f3f46;
  }
  .btn-close:hover { background: #d4d4d8; }

  /* Receipt Styling */
  .receipt-container {
    background: white;
    padding: 20px 15px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.1);
    min-height: 100vh;
  }

  .center { text-align: center; }
  .right  { text-align: right; }
  .bold   { font-weight: bold; }
  .dash   { border-top: 1px dashed #000; margin: 8px 0; }
  .solid  { border-top: 1px solid  #000; margin: 8px 0; }
  .row    { display:flex; justify-content:space-between; margin:4px 0; font-size:11px; }
  table   { width:100%; border-collapse:collapse; margin:6px 0; }
  th      { font-size:10px; text-align:left; padding:4px 0; border-bottom:1px dashed #000; font-weight:bold; }
  .badge  { display:inline-block; border:1.5px solid #000; padding:2px 10px; font-weight:bold; font-size:12px; letter-spacing:1px; margin-top:2px; }
  
  @page { margin: 0; size: 80mm auto; }
  @media print { 
    body { width: 72mm; padding: 0; background: white; } 
    .preview-header { display: none !important; }
    .receipt-container { box-shadow: none !important; padding: 10px 5px !important; }
  }
</style>
</head>
<body>

<div class="preview-header">
    <div class="preview-title">${filterNew ? 'New Items' : (isKOT ? 'Kitchen Order Ticket' : 'Full Bill')} Preview</div>
    <div class="preview-actions">
        <button class="btn btn-print" onclick="window.print()">Print Receipt</button>
        <button class="btn btn-close" onclick="window.close()">Close Preview</button>
    </div>
</div>

<div class="receipt-container">
    <div class="center bold" style="font-size:18px;letter-spacing:1px;text-transform:uppercase;">${restaurantName} ${filterNew ? '(NEW)' : ''}</div>
    ${address ? `<div class="center" style="font-size:10px;margin-top:2px;max-width:200px;margin-left:auto;margin-right:auto;">${address}</div>` : ''}
    ${gstNumber ? `<div class="center" style="font-size:10px;margin-top:2px;font-weight:bold;">GSTIN: ${gstNumber}</div>` : ''}
    <div class="solid"></div>

    <div class="row"><span>${filterNew ? 'UPDATE' : (isKOT ? 'KOT' : 'BILL')}</span><span class="bold">${displayOrderNumber}</span></div>
    <div class="row"><span>TOKEN</span><span class="bold">#${order.tokenNumber || '—'}</span></div>
    <div class="row"><span>TIME</span><span>${date}</span></div>
    <div class="row"><span>TYPE</span><span class="bold">${order.orderType?.toUpperCase()}</span></div>
    ${order.orderType === 'dine-in'
        ? `<div class="row"><span>TABLE</span><span class="bold">Table ${order.tableId?.number || order.tableId || '—'}</span></div>`
        : ''}

    <div class="dash"></div>

    <table>
      <thead>
        <tr>
          <th style="width:50%;text-align:left;">ITEM</th>
          <th style="width:15%;text-align:center;">QTY</th>
          <th style="width:15%;text-align:right;">RATE</th>
          <th style="width:20%;text-align:right;">AMT</th>
        </tr>
      </thead>
      <tbody>
        ${activeItems.map(item => `
            <tr>
                <td style="padding:4px 0;font-size:11px;vertical-align:top;">
                    ${item.name}${item.isNewlyAdded ? ' <strong style="font-size:9px;">(NEW)</strong>' : ''}
                    ${item.variant ? `<br/><span style="font-size:9px;opacity:0.8;">[${item.variant.name}]</span>` : ''}
                </td>
                <td style="padding:4px 0;font-size:11px;text-align:center;vertical-align:top;">${item.quantity}</td>
                <td style="padding:4px 0;font-size:11px;text-align:right;">${formatPrice(item.price)}</td>
                <td style="padding:4px 0;font-size:11px;text-align:right;font-weight:bold;">${formatPrice(item.price * item.quantity)}</td>
            </tr>`).join('')}
      </tbody>
    </table>

    <div class="dash"></div>
    <div class="row"><span>Subtotal</span><span>${formatPrice(printSubtotal)}</span></div>
    ${printResults.sgstRate > 0 ? `<div class="row"><span>SGST (${printResults.sgstRate}%)</span><span>${formatPrice(printResults.sgst)}</span></div>` : ''}
    ${printResults.cgstRate > 0 ? `<div class="row"><span>CGST (${printResults.cgstRate}%)</span><span>${formatPrice(printResults.cgst)}</span></div>` : ''}
    <div class="solid"></div>
    <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:14px;margin-top:6px;">
      <span>TOTAL</span><span>${formatPrice(printResults.finalAmount)}</span>
    </div>
    <div class="dash" style="margin-top:10px;"></div>
    <div class="row" style="align-items:center;">
      <span class="bold">STATUS</span>
      <span class="badge border-none" style="border:none;">${filterNew ? 'UPDATE' : (isKOT ? 'KOT' : (isPaid ? 'PAID' : 'UNPAID'))}</span>
    </div>

    <div class="solid"></div>
    <div class="center" style="font-size:11px;margin:10px 0 2px;font-weight:bold;">${isKOT ? 'KITCHEN COPY (KOT)' : 'THANK YOU FOR YOUR VISIT!'}</div>
    <div class="center" style="font-size:10px;color:#555;">Please visit us again soon &#9829;</div>
    <div class="center" style="font-size:8px;margin-top:15px;color:#999;letter-spacing:1px;">POWERED BY KAGZSO POS</div>
</div>

<script>
  window.onload = function() {
    window.focus();
    // No automatic print
    window.onafterprint = function() { /* window.close(); removed to allow review after print */ };
  };
</script>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=450,height=700,scrollbars=yes');
    if (!win) {
        alert('Please allow pop-ups in your browser to print the bill.');
        return;
    }
    
    win.document.write(html);
    win.document.close();
};
