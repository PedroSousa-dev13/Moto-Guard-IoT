import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const { isAuthenticated } = useAuth();

  // Se já estiver autenticado, redirecionar para dashboard
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="page">
      <h1>Login</h1>
      <p>Por favor, use o botão "Entrar" na barra superior para aceder à sua conta.</p>
      <p>Se não tiver conta, pode criar uma através do mesmo menu.</p>
    </div>
  );
}
