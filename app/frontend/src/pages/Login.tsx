import React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import LoginSidebar from "../components/auth/LoginSidebar";

export default function Login() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname as string | undefined;
  const redirectTo = from && from !== "/login" ? from : "/dashboard";
  const params = new URLSearchParams(location.search);
  const mode = params.get("mode");
  const defaultMode = mode === "register" ? "register" : "login";

  // Se já estiver autenticado, redirecionar para dashboard
  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  return (
    <LoginSidebar
      isOpen
      defaultMode={defaultMode}
      onClose={() => navigate("/", { replace: true })}
      onSuccess={() => navigate(redirectTo, { replace: true })}
    />
  );
}
