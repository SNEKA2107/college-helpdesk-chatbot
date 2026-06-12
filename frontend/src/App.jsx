import { ToastProvider } from './hooks/useToast';
import AppRoutes from './routes/AppRoutes';

export default function App() {
  return (
    <ToastProvider>
      <AppRoutes />
    </ToastProvider>
  );
}
