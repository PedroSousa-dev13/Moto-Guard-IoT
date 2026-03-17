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

  // Se já estiver autenticado, redirecionar para dashboard
  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  return (
    <LoginSidebar
      isOpen
      onClose={() => navigate("/", { replace: true })}
      onSuccess={() => navigate(redirectTo, { replace: true })}
    />
  );
}
