
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useDemoContext } from '../demo/DemoContext';
import LoginSidebar from "../components/auth/LoginSidebar";
import HomePage from './HomePage';

export default function Login() {
  const { isAuthenticated } = useAuth();
  const { isDemoMode } = useDemoContext();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname as string | undefined;
  const redirectTo = from && from !== "/login" ? from : "/dashboard";
  const params = new URLSearchParams(location.search);
  const mode = params.get("mode");
  const defaultMode = mode === "register" ? "register" : "login";

  // Se estiver em modo demo, redirecionar para dashboard
  if (isDemoMode) {
    return <Navigate to="/dashboard" replace />;
  }

  // Se já estiver autenticado, redirecionar para dashboard
  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  return (
    <>
      <HomePage />
      <LoginSidebar
        isOpen
        defaultMode={defaultMode}
        onClose={() => navigate("/", { replace: true })}
        onSuccess={() => navigate(redirectTo, { replace: true })}
        onRegisterSuccess={() => navigate("/garage", { replace: true })}
      />
    </>
  );
}
