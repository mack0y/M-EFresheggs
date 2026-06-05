import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import { ToastContainer } from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';

const Dashboard = lazy(() => import('./components/Dashboard'));
const Inventory = lazy(() => import('./components/Inventory'));
const PriceSettings = lazy(() => import('./components/PriceSettings'));
const SalesLog = lazy(() => import('./components/SalesLog'));
const Analytics = lazy(() => import('./components/Analytics'));
const Reports = lazy(() => import('./components/Reports'));
const Expenses = lazy(() => import('./components/Expenses'));
const Spoilage = lazy(() => import('./components/Spoilage'));
const Customers = lazy(() => import('./components/Customers'));
const Suppliers = lazy(() => import('./components/Suppliers'));
const Deliveries = lazy(() => import('./components/Deliveries'));

function PageLoading() {
  return (
    <div style={{ padding: '2rem' }}>
      <div className="skeleton" style={{ width: '40%', height: 24, marginBottom: '1rem' }}>&nbsp;</div>
      <div className="skeleton" style={{ width: '100%', height: 200, borderRadius: 'var(--radius-lg)' }}>&nbsp;</div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/M-EFresheggs">
      <Layout>
        <Suspense fallback={<PageLoading />}>
          <Routes>
            <Route path="/" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
            <Route path="/inventory" element={<ErrorBoundary><Inventory /></ErrorBoundary>} />
            <Route path="/prices" element={<ErrorBoundary><PriceSettings /></ErrorBoundary>} />
            <Route path="/sales" element={<ErrorBoundary><SalesLog /></ErrorBoundary>} />
            <Route path="/analytics" element={<ErrorBoundary><Analytics /></ErrorBoundary>} />
            <Route path="/expenses" element={<ErrorBoundary><Expenses /></ErrorBoundary>} />
            <Route path="/spoilage" element={<ErrorBoundary><Spoilage /></ErrorBoundary>} />
            <Route path="/customers" element={<ErrorBoundary><Customers /></ErrorBoundary>} />
            <Route path="/suppliers" element={<ErrorBoundary><Suppliers /></ErrorBoundary>} />
            <Route path="/deliveries" element={<ErrorBoundary><Deliveries /></ErrorBoundary>} />
            <Route path="/reports" element={<ErrorBoundary><Reports /></ErrorBoundary>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        <ToastContainer />
      </Layout>
    </BrowserRouter>
  );
}
