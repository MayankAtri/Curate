import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Layout from './components/common/Layout';
import HomePage from './pages/HomePage';
import PreferencesPage from './pages/PreferencesPage';
import LoginPage from './pages/LoginPage';
import OnboardingPage from './pages/OnboardingPage';
import LandingPage from './pages/LandingPage';
import AnalyticsPage from './pages/AnalyticsPage';

// Separate component to use useLocation hook
function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Layout />}>
          <Route index element={<LandingPage />} />
          <Route path="feed" element={<HomePage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="preferences" element={<PreferencesPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="onboarding" element={<OnboardingPage />} />
        </Route>
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AnimatedRoutes />
    </BrowserRouter>
  );
}

export default App;
