import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import ConfigPage from './ConfigPage';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigPage />
  </StrictMode>,
);
