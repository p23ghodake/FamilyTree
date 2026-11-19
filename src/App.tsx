import React from 'react';
import { Toaster } from 'react-hot-toast';
import { LanguageProvider } from './context/LanguageContext';
import { FamilyTreeProvider } from './context/FamilyTreeContext';
import { AuthProvider } from './lib/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useLanguage } from './context/LanguageContext';
import Layout from './components/Layout/Layout';

function AppContent() {
  const { t } = useLanguage();
  return (
    <ErrorBoundary
      title={t.errorBoundaryTitle}
      description={t.errorBoundaryDescription}
      reload={t.errorBoundaryReload}
    >
        <AuthProvider>
          <FamilyTreeProvider>
            <Layout />
            <Toaster
              position="bottom-right"
              toastOptions={{
                duration: 4000,
                style: { fontSize: '14px', maxWidth: '360px' },
                error: { duration: 5000 },
              }}
            />
          </FamilyTreeProvider>
        </AuthProvider>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}

export default App;
