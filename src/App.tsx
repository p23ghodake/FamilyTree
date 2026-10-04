import React from 'react';
import { Toaster } from 'react-hot-toast';
import { LanguageProvider } from './context/LanguageContext';
import { FamilyTreeProvider } from './context/FamilyTreeContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import Layout from './components/Layout/Layout';
import TreeLoader from './components/Layout/TreeLoader';

function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <FamilyTreeProvider>
          <TreeLoader />
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
      </LanguageProvider>
    </ErrorBoundary>
  );
}

export default App;
