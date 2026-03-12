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
        <h1>A verificar token...</h1>
        <p>Por favor, aguarde.</p>
      </div>
    );
  }

  if (isTokenValid === false) {
    return (
      <div className="page">
        <h1>Token Inválido</h1>
        <p>O token de recuperação é inválido ou expirou.</p>
        <button onClick={() => navigate('/login')}>
          Voltar para Login
        </button>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Redefinir Senha</h1>
      
      {success ? (
        <div style={{
          padding: '1rem',
          backgroundColor: '#d1fae5',
          border: '1px solid #a7f3d0',
          borderRadius: '6px',
          color: '#065f46',
          marginBottom: '1rem',
        }}>
          {success}
          <p style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
            A ser redirecionado para o login...
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ maxWidth: '400px' }}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#374151' }}>
              Nova Senha
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '1rem',
              }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#374151' }}>
              Confirmar Nova Senha
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '1rem',
              }}
            />
          </div>

          {error && (
            <div style={{
              marginBottom: '1rem',
              padding: '0.75rem',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              color: '#dc2626',
              fontSize: '0.875rem',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '1rem',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            {isLoading ? 'A processar...' : 'Redefinir Senha'}
          </button>
        </form>
      )}
    </div>
  );
}
