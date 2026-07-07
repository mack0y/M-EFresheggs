// ===== Barrel file =====
// Re-exports everything from sub-modules for backward compatibility.
// Components can continue importing from '../lib/api'.

// Utils & constants
export { getLocalDate, TRAY_SIZE, getEggCount, toTraysAndPieces, formatInventory, formatPeso } from './utils';

// Egg sizes
export { EGG_SIZES, fetchEggSizes } from './eggSizes';

// Inventory
export { fetchInventory, updateInventory } from './inventory';

// Pricing
export { fetchPriceSettings, updatePriceSetting } from './pricing';

// Sales
export { recordSale, fetchSales, fetchTodaySales, deleteSale, deleteSales } from './sales';

// Reports
export { fetchSalesReport } from './reports';

// Expenses
export { EXPENSE_CATEGORIES, fetchExpenses, fetchTodayExpenses, recordExpense, deleteExpense, deleteExpenses } from './expenses';

// Spoilage
export { SPOILAGE_REASONS, fetchSpoilage, recordSpoilage, deleteSpoilageRecords, fetchSpoilageByIds } from './spoilage';

// Customers
export { fetchCustomers, addCustomer, deleteCustomer } from './customers';

// Suppliers
export { fetchSuppliers, addSupplier, deleteSupplier } from './suppliers';

// Deliveries
export { PAYMENT_STATUSES, fetchDeliveries, recordDelivery, recordDeliveryBatch, deleteDeliveryBatch, updateDeliveryPayment, deleteDelivery } from './deliveries';

// Funds & daily cut
export {
  fetchOperationalFunds,
  addOperationalFund,
  deleteOperationalFund,
  getDailyRevenueCutPreview,
  recordDailyRevenueCut,
  deleteDailyRevenueCut,
  getOperationalBalance,
} from './funds';

// Analytics & margins
export { fetchSalesBySize, fetchSalesByHour, fetchSalesTrend, fetchCostsPerEgg, fetchProfitMargins } from './analytics';

// ===== Products & Deliveries =====
export { fetchProducts, addProduct, updateProduct, deleteProduct, calculateMarkup, calculateSellingPrice, autoFillPricing } from './products';
export { fetchProductDeliveries, recordProductDelivery, updateProductDeliveryPayment, deleteProductDelivery } from './productDeliveries';

// ===== Product Sales =====
export { recordProductSale, fetchProductSales, fetchTodayProductSales, deleteProductSale, deleteProductSales } from './productSales';

// Cross-module utilities (inventory value, spoilage with cost, export)
export { fetchInventoryValue, fetchSpoilageWithCost, exportAllData, APP_VERSION } from './export';
