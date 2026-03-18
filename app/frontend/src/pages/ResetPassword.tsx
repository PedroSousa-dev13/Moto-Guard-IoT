import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';

export default function ResetPassword() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isTokenValid, setIsTokenValid] = useState<boolean | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Token de recuperação inválido');
      return;
    }

    // Verificar se o token é válido
    const verifyToken = async () => {
      try {
        const response = await authAPI.verifyResetToken(token);
        setIsTokenValid(response.data.valid);
        if (!response.data.valid) {
          setError('Token inválido ou expirado');
        }
      } catch (err) {
        setError('Erro ao verificar token');
        setIsTokenValid(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    if (newPassword.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setIsLoading(true);

    try {
      const response = await authAPI.resetPassword(token!, newPassword);
      setSuccess(response.data.message);
      
      // Redirecionar para login após 3 segundos
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Erro ao redefinir senha';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (isTokenValid === null) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-state-icon">🔐</div>
          <div className="empty-state-title">A verificar token...</div>
          <div className="empty-state-text">Por favor, aguarde.</div>
        </div>
      </div>
    );
  }

  if (isTokenValid === false) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-state-icon">⛔</div>
          <div className="empty-state-title">Token inválido</div>
          <div className="empty-state-text">
            O token de recuperação é inválido ou expirou.
          </div>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
            <button className="btn btn-primary" onClick={() => navigate("/login")}>
              Voltar para Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Redefinir senha</div>
          <div className="page-subtitle">Define uma nova senha para a tua conta.</div>
        </div>
      </div>
      
      {success ? (
        <div className="alert alert-success">
          {success}
          <div style={{ marginTop: 8, fontSize: "0.95rem", color: "var(--muted)" }}>
            A ser redirecionado para o login...
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="auth-form" style={{ maxWidth: 420 }}>
          <div className="field">
            <div className="field-label">Nova senha</div>
            <input
              className="control"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <div className="field">
            <div className="field-label">Confirmar nova senha</div>
            <input
              className="control"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {error && (
            <div className="alert alert-danger">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-primary btn-block"
          >
            {isLoading ? 'A processar...' : 'Redefinir Senha'}
          </button>
        </form>
      )}
    </div>
  );
}
