import { RouterProvider } from 'react-router-dom';
import { router } from '@/routes';

/**
 * Main App Component
 *
 * Renders the application router.
 * Global providers (theme, notifications, etc.) would be added here.
 */
function App() {
  return <RouterProvider router={router} />;
}

export default App;
