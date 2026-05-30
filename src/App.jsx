import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import SalesLog from './components/SalesLog';
import Analytics from './components/Analytics';
import { ToastContainer } from './components/Toast';
import SetupGuide from './components/SetupGuide';

export default function App() {
  // Check if Supabase is configured
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const isConfigured = !!supabaseUrl;

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/sales" element={<SalesLog />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/setup" element={<SetupGuide />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <ToastContainer />
      </Layout>
    </BrowserRouter>
  );
}
