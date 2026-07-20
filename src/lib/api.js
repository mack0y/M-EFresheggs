// ===== Barrel file =====
// Re-exports everything from sub-modules for backward compatibility.
// Components can continue importing from '../lib/api'.

// Utils & constants
export { getLocalDate, TRAY_SIZE, getEggCount, formatInventory, formatPeso } from './utils';

// Egg sizes
export { EGG_SIZES } from './eggSizes';

// Inventory
export { fetchInventory, updateInventory, incrementInventory } from './inventory';

// Pricing
export { fetchPriceSettings, updatePriceSetting } from './pricing';

// Sales
export { recordSale, fetchSales, fetchTodaySales, deleteSale, deleteSales } from './sales';

// Reports
export { fetchSalesReport } from './reports';

// Expenses
export { EXPENSE_CATEGORIES, fetchExpenses, fetchTodayExpenses, recordExpense, deleteExpense, deleteExpenses } from './expenses';

// Spoilage
export { SPOILAGE_REASONS, recordSpoilage, deleteSpoilageRecords, fetchSpoilageByIds, restoreInventoryForSpoilage } from './spoilage';

// Customers
export { fetchCustomers, addCustomer, updateCustomer, deleteCustomer, fetchCustomerSales } from './customers';

// Suppliers
export { fetchSuppliers, addSupplier, updateSupplier, deleteSupplier } from './suppliers';

// Deliveries
export { PAYMENT_STATUSES, fetchDeliveries, recordDeliveryBatch, deleteDeliveryBatch, updateDeliveryPayment, deleteDelivery } from './deliveries';

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
export { fetchSalesBySize, fetchSalesByHour, fetchSalesTrend, fetchCostsPerEgg, fetchCostsPerProduct, fetchProfitMargins, fetchProductSalesBySize, fetchProductSalesByHour, fetchProductSalesTrend } from './analytics';

// ===== Products & Deliveries =====
export { fetchProducts, addProduct, updateProduct, deleteProduct, updateProductStock, calculateSellingPrice, autoFillPricing } from './products';
export { fetchProductDeliveries, recordProductDelivery, updateProductDeliveryPayment, deleteProductDelivery } from './productDeliveries';

// ===== Product Sales =====
export { recordProductSale, fetchProductSales, fetchTodayProductSales, deleteProductSale, deleteProductSales, fetchProductSalesReport } from './productSales';

// ===== Unified Transactions =====
export { recordTransaction } from './transactions';

// Cross-module utilities (inventory value, spoilage with cost, export)
export { fetchInventoryValue, fetchSpoilageWithCost, exportAllData, APP_VERSION } from './export';
