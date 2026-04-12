/**
 * BillPrint.jsx
 * Opens a new window and prints an 80mm thermal-style receipt.
 * Updated to support KOT (Kitchen Order Ticket) mode which hides financial details.
 */

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

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${filterNew ? 'NEW ITEMS' : (isKOT ? 'KOT' : 'BILL')} — ${displayOrderNumber}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: 'Courier Prime', 'Courier New', Courier, monospace;
    font-size: 12px;
    width: 72mm;
    margin: 0 auto;
    padding: 10px 5px;
    color: #000;
    background: #fff;
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
  @media print { body { width: 72mm; } }
</style>
</head>
<body>

<div class="center bold" style="font-size:18px;letter-spacing:1px;text-transform:uppercase;">${restaurantName} ${filterNew ? '(NEW)' : ''}</div>
${!isKOT && address ? `<div class="center" style="font-size:10px;margin-top:2px;max-width:200px;margin-left:auto;margin-right:auto;">${address}</div>` : ''}
${!isKOT && gstNumber ? `<div class="center" style="font-size:10px;margin-top:2px;font-weight:bold;">GSTIN: ${gstNumber}</div>` : ''}
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
      ${!isKOT ? `<th style="width:15%;text-align:right;">RATE</th><th style="width:20%;text-align:right;">AMT</th>` : ''}
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
            ${!isKOT ? `
            <td style="padding:4px 0;font-size:11px;text-align:right;">${formatPrice(item.price)}</td>
            <td style="padding:4px 0;font-size:11px;text-align:right;font-weight:bold;">${formatPrice(item.price * item.quantity)}</td>
            ` : ''}
        </tr>`).join('')}
  </tbody>
</table>

${!isKOT ? `
<div class="dash"></div>
<div class="row"><span>Subtotal</span><span>${formatPrice(order.totalAmount)}</span></div>
${order.sgst > 0 ? `<div class="row"><span>SGST (${sgstRate}%)</span><span>${formatPrice(order.sgst)}</span></div>` : (sgstRate > 0 ? `<div class="row"><span>SGST (${sgstRate}%)</span><span>${formatPrice(order.totalAmount * sgstRate / 100)}</span></div>` : '')}
${order.cgst > 0 ? `<div class="row"><span>CGST (${cgstRate}%)</span><span>${formatPrice(order.cgst)}</span></div>` : (cgstRate > 0 ? `<div class="row"><span>CGST (${cgstRate}%)</span><span>${formatPrice(order.totalAmount * cgstRate / 100)}</span></div>` : '')}
${(order.sgst || 0) === 0 && (order.cgst || 0) === 0 && sgstRate === 0 && cgstRate === 0 && order.tax > 0 ? `<div class="row"><span>Tax</span><span>${formatPrice(order.tax)}</span></div>` : ''}
${order.discount > 0 ? `<div class="row"><span>Discount</span><span>&#8722; ${formatPrice(order.discount)}</span></div>` : ''}
<div class="solid"></div>
<div style="display:flex;justify-content:space-between;font-weight:bold;font-size:14px;margin-top:6px;">
  <span>GRAND TOTAL</span><span>${formatPrice(order.finalAmount)}</span>
</div>
<div class="dash" style="margin-top:10px;"></div>
<div class="row" style="align-items:center;">
  <span class="bold">PAYMENT</span>
  <span class="badge">${isPaid ? 'PAID' : 'UNPAID'}</span>
</div>
${isPaid && order.paymentMethod ? `<div class="row"><span>Method</span><span class="bold">${order.paymentMethod.toUpperCase().replace('_', ' ')}</span></div>` : ''}
` : ''}

<div class="solid"></div>
<div class="center" style="font-size:11px;margin:10px 0 2px;font-weight:bold;">${isKOT ? 'KITCHEN COPY (KOT)' : 'THANK YOU FOR YOUR VISIT!'}</div>
${!isKOT ? `<div class="center" style="font-size:10px;color:#555;">Please visit us again soon &#9829;</div>` : ''}
<div class="center" style="font-size:8px;margin-top:15px;color:#999;letter-spacing:1px;">POWERED BY KAGZSO POS</div>

<script>
  window.onload = function() {
    window.focus();
    setTimeout(() => {
        window.print();
        window.onafterprint = function() { window.close(); };
        // Close if canceled
        setTimeout(() => { if(!window.closed) window.close(); }, 5000);
    }, 500);
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
