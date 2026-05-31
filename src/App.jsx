import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import PriceSettings from './components/PriceSettings';
import SalesLog from './components/SalesLog';
import Analytics from './components/Analytics';
import { ToastContainer } from './components/Toast';
import Reports from './components/Reports';
import ErrorBoundary from './components/ErrorBoundary';
import Expenses from './components/Expenses';
import Spoilage from './components/Spoilage';
import Customers from './components/Customers';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
          <Route path="/inventory" element={<ErrorBoundary><Inventory /></ErrorBoundary>} />
          <Route path="/prices" element={<ErrorBoundary><PriceSettings /></ErrorBoundary>} />
          <Route path="/sales" element={<ErrorBoundary><SalesLog /></ErrorBoundary>} />
          <Route path="/analytics" element={<ErrorBoundary><Analytics /></ErrorBoundary>} />
          <Route path="/expenses" element={<ErrorBoundary><Expenses /></ErrorBoundary>} />
          <Route path="/spoilage" element={<ErrorBoundary><Spoilage /></ErrorBoundary>} />
          <Route path="/customers" element={<ErrorBoundary><Customers /></ErrorBoundary>} />
          <Route path="/reports" element={<ErrorBoundary><Reports /></ErrorBoundary>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <ToastContainer />
      </Layout>
    </BrowserRouter>
  );
}
