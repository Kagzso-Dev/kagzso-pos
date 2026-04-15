import api from '../api';
import {
  getPendingOrders,
  updatePendingOrderStatus,
  deletePendingOrder,
  savePendingOrder,
  cacheOrder,
  getCategories,
  saveCategories,
  getMenus,
  saveMenus,
  getSetting,
  saveSetting,
} from '../db/db';

let syncInProgress = false;
let syncListeners = [];

export const syncPendingPayments = async () => {
  if (!navigator.onLine) return;

  try {
    const user = JSON.parse(sessionStorage.getItem('user'));
    if (!user || !['cashier', 'admin'].includes(user.role)) {
      return;
    }
  } catch {
    return;
  }

  const pending = JSON.parse(localStorage.getItem('pendingPayments') || '[]');
  if (pending.length === 0) return;

  const processed = [];
  const failed = [];

  const pendingOrders = await getPendingOrders();
  const orderIdMap = {};
  for (const o of pendingOrders) {
    if (o.serverId) orderIdMap[o.localId] = o.serverId;
  }

  for (const p of pending) {
    if (p.status === 'processed') {
      processed.push(p);
      continue;
    }

    let orderIdToUse = p.orderId;
    if (p.orderId?.startsWith('local_') && orderIdMap[p.orderId]) {
      orderIdToUse = orderIdMap[p.orderId];
    }

    try {
      const res = await api.post(`/api/payments/${orderIdToUse}/process`, p.payload);
      if (res.data?.payment) {
        p.status = 'processed';
        processed.push(p);
        window.dispatchEvent(new CustomEvent('offline-payment-synced', { detail: { orderId: orderIdToUse, payment: res.data.payment } }));
      }
    } catch (error) {
      console.error('Payment sync failed:', error);
      // If order is not found (404), don't retry this payment
      if (error.response?.status === 404) {
        console.warn(`[SyncEngine] Purging payment sync for non-existent order: ${orderIdToUse}`);
        continue; 
      }
      failed.push(p);
    }
  }

  localStorage.setItem('pendingPayments', JSON.stringify(failed));
};

export const addSyncListener = (callback) => {
  syncListeners.push(callback);
  return () => {
    syncListeners = syncListeners.filter((l) => l !== callback);
  };
};

const notifyListeners = (event, data) => {
  syncListeners.forEach((listener) => listener(event, data));
};

export const syncPendingOrders = async () => {
  if (syncInProgress || !navigator.onLine) return;

  syncInProgress = true;
  notifyListeners('sync:start', {});
  console.log('[syncPendingOrders] Starting sync...');

  try {
    const pendingOrders = await getPendingOrders();
    console.log('[syncPendingOrders] Found pending orders:', pendingOrders.length);

    for (const order of pendingOrders) {
      console.log('[syncPendingOrders] Syncing order:', order.localId, order.status);
      try {
        const payload = {
          orderType: order.type,
          tableId: order.tableId || null,
          items: order.items,
          totalAmount: order.totalAmount || 0,
          sgst: order.sgst || 0,
          cgst: order.cgst || 0,
          finalAmount: order.finalAmount || 0,
        };
        
        const response = await api.post('/api/orders', payload);
        console.log('[syncPendingOrders] Success:', response.data);

        if (response.data?._id) {
          await updatePendingOrderStatus(order.id, 'synced', response.data._id);
          notifyListeners('order:synced', { localId: order.id, serverId: response.data._id });
        }
      } catch (error) {
        console.error('[syncPendingOrders] Failed to sync order:', order.localId, error.message);
      }
    }
  } catch (error) {
    console.error('[syncPendingOrders] Sync error:', error);
  } finally {
    syncInProgress = false;
    notifyListeners('sync:complete', {});
  }
};

export const queueOrder = async (orderData) => {
  const localId = `local_${Date.now()}`;
  const token = parseInt(localId.toString().slice(-4));
  const order = {
    localId,
    tokenNumber: token,
    ...orderData,
    createdAt: Date.now(),
    status: 'pending',
  };

  await savePendingOrder(order);
  
  if (navigator.onLine) {
    syncPendingOrders();
  }
  
  return { localId, tokenNumber: token };
};

export const queueAction = async (action) => {
  const localId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const actionData = { ...action, localId, createdAt: Date.now(), synced: false };

  const pending = JSON.parse(localStorage.getItem('offlineActions') || '[]');
  pending.push(actionData);
  localStorage.setItem('offlineActions', JSON.stringify(pending));

  if (navigator.onLine) {
    syncPendingActions();
  }

  return { localId, offline: !navigator.onLine };
};

export const syncPendingActions = async () => {
  if (!navigator.onLine) return;

  const pending = JSON.parse(localStorage.getItem('offlineActions') || '[]');
  if (pending.length === 0) return;

  const failed = [];

  for (const action of pending) {
    if (action.synced) continue;

    try {
      const { type, endpoint, data, method } = action;
      let response;

      if (type === 'add-items' && action.orderId && action.items) {
        response = await api.post(`/api/orders/${action.orderId}/add-items`, { items: action.items });
      } else if (method === 'POST') {
        response = await api.post(endpoint, data);
      } else if (method === 'PUT') {
        response = await api.put(endpoint, data);
      } else if (method === 'DELETE') {
        response = await api.delete(endpoint);
      }

      if (response?.data || response?.status === 200) {
        action.synced = true;
        if (type === 'category') {
          const cats = await getCategories();
          await saveCategories(cats);
        } else if (type === 'menu') {
          const items = await getMenus();
          await saveMenus(items);
        }
      }
    } catch (error) {
      console.error('Sync action failed:', error);
      failed.push(action);
    }
  }

  localStorage.setItem('offlineActions', JSON.stringify(failed));
};

const autoSync = () => {
  console.log('[AutoSync] Running... online:', navigator.onLine);
  if (navigator.onLine) {
    syncPendingOrders();
    syncPendingActions();
    syncPendingPayments();
  }
};

window.addEventListener('online', autoSync);

setInterval(autoSync, 30000);

setTimeout(() => {
  console.log('[AutoSync] Initial sync on load');
  autoSync();
}, 1000);

export const syncNow = async () => {
  if (navigator.onLine) {
    await syncPendingOrders();
    await syncPendingActions();
    await syncPendingPayments();
  }
};

export default syncPendingOrders;