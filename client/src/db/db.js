import Dexie from 'dexie';

const db = new Dexie('POSDatabase');

db.version(1).stores({
  menus: '++id, _id, name, categoryId, category.name, availability, price',
  categories: '++id, _id, name, order',
  tables: '++id, _id, number, status',
  settings: 'key',
  pendingOrders: '++id, localId, type, status, createdAt',
  cachedOrders: '++id, _id, orderId, type, status, createdAt',
});

export const saveMenus = async (items) => {
  await db.menus.clear();
  if (items.length) {
    await db.menus.bulkAdd(items);
  }
};

export const getMenus = async () => {
  return await db.menus.toArray();
};

export const saveCategories = async (categories) => {
  await db.categories.clear();
  if (categories.length) {
    await db.categories.bulkAdd(categories);
  }
};

export const getCategories = async () => {
  return await db.categories.toArray();
};

export const saveTables = async (tables) => {
  await db.table('tables').clear();
  if (tables.length) {
    await db.table('tables').bulkAdd(tables);
  }
};

export const getTables = async () => {
  return await db.table('tables').toArray();
};

export const saveSetting = async (key, value) => {
  await db.settings.put({ key, value });
};

export const getSetting = async (key) => {
  const record = await db.settings.get(key);
  return record?.value;
};

export const savePendingOrder = async (order) => {
  return await db.pendingOrders.add({
    ...order,
    status: 'pending',
    createdAt: Date.now(),
    syncedAt: null,
  });
};

export const getPendingOrders = async () => {
  const all = await db.pendingOrders.toArray();
  return all.filter(o => o.status !== 'synced');
};

export const updatePendingOrderStatus = async (localId, status, serverId = null) => {
  const updates = { status };
  if (serverId) updates.serverId = serverId;
  if (status === 'synced') updates.syncedAt = Date.now();
  return await db.pendingOrders.update(localId, updates);
};

export const deletePendingOrder = async (localId) => {
  return await db.pendingOrders.delete(localId);
};

export const clearPendingOrders = async () => {
  return await db.pendingOrders.clear();
};

export const cacheOrder = async (order) => {
  const existing = await db.cachedOrders.where('orderId').equals(order.orderId).first();
  if (existing) {
    await db.cachedOrders.update(existing.id, order);
  } else {
    await db.cachedOrders.add({
      ...order,
      createdAt: Date.now(),
    });
  }
};

export const getCachedOrders = async () => {
  return await db.cachedOrders.orderBy('createdAt').reverse().toArray();
};

export default db;