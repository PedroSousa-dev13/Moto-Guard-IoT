import { useState, useEffect, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import { Shield, ArrowLeft, Eye, EyeOff, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';

export default function ResetPassword() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isTokenValid, setIsTokenValid] = useState<boolean | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Token de recuperação inválido');
      return;
    }

    const verifyToken = async () => {
      try {
        const response = await authAPI.verifyResetToken(token);
        setIsTokenValid(response.data.valid);
        if (!response.data.valid) {
          setError('Token inválido ou expirado');
        }
      } catch {
        setError('Erro ao verificar token');
        setIsTokenValid(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e: FormEvent) => {
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
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao redefinir senha');
    } finally {
      setIsLoading(false);
    }
  };

  if (isTokenValid === null) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-6 text-center">
          <Loader2 size={48} className="text-accent animate-spin" />
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-black text-text tracking-tight">A verificar token...</h2>
            <p className="text-sm text-muted font-medium">Por favor, aguarde.</p>
          </div>
        </div>
      </div>
    );
  }

  if (isTokenValid === false) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-6">
        <div className="bg-surface/60 backdrop-blur-xl border border-border-glass rounded-3xl p-10 flex flex-col items-center gap-6 text-center max-w-md shadow-2xl">
          <div className="w-20 h-20 rounded-full bg-red/10 flex items-center justify-center text-red border border-red/20">
            <AlertTriangle size={40} />
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-black text-text tracking-tight">Token inválido</h2>
            <p className="text-sm text-muted font-medium">O token de recuperação é inválido ou expirou.</p>
          </div>
          <button className="flex items-center gap-2 px-8 py-3 rounded-2xl bg-accent text-white font-black text-sm shadow-xl shadow-accent/20 hover:scale-105 transition-all" onClick={() => navigate("/login")}>
            <ArrowLeft size={18} /> Voltar para Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-surface/60 backdrop-blur-xl border border-border-glass rounded-3xl p-8 shadow-2xl">
        <div className="flex flex-col items-center text-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-accent/20 flex items-center justify-center text-accent border border-accent/20 shadow-[0_0_20px_rgba(139,92,246,0.15)]">
            <Shield size={32} />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-black text-text tracking-tight">Redefinir senha</h1>
            <p className="text-sm text-muted font-medium">Define uma nova senha para a tua conta.</p>
          </div>
        </div>

        {success ? (
          <div className="p-6 rounded-2xl bg-green/10 border border-green/20 flex flex-col items-center gap-4 text-center">
            <CheckCircle size={32} className="text-green" />
            <div className="flex flex-col gap-1">
              <span className="text-sm font-black text-text">{success}</span>
              <span className="text-xs text-muted">A ser redirecionado para o login...</span>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-[0.7rem] font-black uppercase tracking-widest text-muted ml-1">Nova senha</label>
              <div className="relative">
                <input
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-text font-black focus:border-accent outline-none transition-all pr-12"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required minLength={6}
                  placeholder="••••••••"
                />
                <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-text transition-colors" onClick={() => setShowPassword(v => !v)}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[0.7rem] font-black uppercase tracking-widest text-muted ml-1">Confirmar nova senha</label>
              <input
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-text font-black focus:border-accent outline-none transition-all"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required minLength={6}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-red/10 border border-red/20 text-red text-sm font-bold flex items-center gap-3">
                <AlertTriangle size={18} />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 bg-accent text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30">
              {isLoading ? <><Loader2 size={18} className="animate-spin" /> A processar...</> : 'Redefinir Senha'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
