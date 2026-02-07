import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Prevent scroll from changing number input values globally
document.addEventListener('wheel', (e) => {
  if (document.activeElement.type === 'number') {
    document.activeElement.blur();
  }
}, { passive: true });

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
