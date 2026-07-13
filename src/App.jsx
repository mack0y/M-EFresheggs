import { lazy, Suspense, Component } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import { ToastContainer } from './components/Toast';
const Dashboard = lazy(() => import('./components/Dashboard'));
const Inventory = lazy(() => import('./components/Inventory'));
const PriceSettings = lazy(() => import('./components/PriceSettings'));
const SalesLog = lazy(() => import('./components/SalesLog'));
const NewSale = lazy(() => import('./components/NewSale'));
const Analytics = lazy(() => import('./components/Analytics'));
const Reports = lazy(() => import('./components/Reports'));
const Profits = lazy(() => import('./components/Profits'));
const ExpensesFunds = lazy(() => import('./components/ExpensesFunds'));
const Spoilage = lazy(() => import('./components/Spoilage'));
const Customers = lazy(() => import('./components/Customers'));
const Suppliers = lazy(() => import('./components/Suppliers'));
const Deliveries = lazy(() => import('./components/Deliveries'));
const Products = lazy(() => import('./components/Products'));
const ProductSales = lazy(() => import('./components/ProductSales'));
const ProductDeliveries = lazy(() => import('./components/ProductDeliveries'));

function PageLoading() {
  return (
    <div style={{ padding: '2rem' }}>
      <div className="skeleton" style={{ width: '40%', height: 24, marginBottom: '1rem' }}>&nbsp;</div>
      <div className="skeleton" style={{ width: '100%', height: 200, borderRadius: 'var(--radius-lg)' }}>&nbsp;</div>
    </div>
  );
}

class ChunkErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  handleRetry = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: '2rem', textAlign: 'center' }}>
          <p style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>Failed to load page</p>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>Check your connection and try again.</p>
          <button className="btn btn-primary" onClick={this.handleRetry}>Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <BrowserRouter basename="/M-EFresheggs">
      <Layout>
        <ChunkErrorBoundary>
          <Suspense fallback={<PageLoading />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/prices" element={<PriceSettings />} />
              <Route path="/sales" element={<SalesLog />} />
              <Route path="/sales/new" element={<NewSale />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/expenses-funds" element={<ExpensesFunds />} />
              <Route path="/operational-expenses" element={<Navigate to="/expenses-funds" replace />} />
              <Route path="/spoilage" element={<Spoilage />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/suppliers" element={<Suppliers />} />
              <Route path="/deliveries" element={<Deliveries />} />
              <Route path="/products" element={<Products />} />
              <Route path="/product-sales" element={<ProductSales />} />
              <Route path="/product-sales/new" element={<Navigate to="/sales/new" replace />} />
              <Route path="/product-deliveries" element={<ProductDeliveries />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/profits" element={<Profits />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ChunkErrorBoundary>
        <ToastContainer />
      </Layout>
    </BrowserRouter>
  );
}
