import React, { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { authAPI } from "../../services/api";
import { X, Mail, Lock, User, ArrowLeft, Bike } from 'lucide-react';

interface LoginSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onRegisterSuccess?: () => void;
  defaultMode?: "login" | "register";
}

const LoginSidebar: React.FC<LoginSidebarProps> = ({ isOpen, onClose, onSuccess, onRegisterSuccess, defaultMode = "login" }) => {
  const [isLogin, setIsLogin] = useState(defaultMode === "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState(false);

  const { login, register, isLoading, error, clearError } = useAuth();

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotLoading(true);
    try {
      await authAPI.forgotPassword(forgotEmail);
      setForgotSuccess(true);
    } catch (err: any) {
      setForgotError(
        err.response?.data?.error ?? "Erro ao enviar email de recuperação",
      );
    } finally {
      setForgotLoading(false);
    }
  };

  function openForgotPassword() {
    setShowForgotPassword(true);
    setForgotEmail(email); // pre-preencher com o email já digitado
    setForgotError(null);
    setForgotSuccess(false);
  }

  function closeForgotPassword() {
    setShowForgotPassword(false);
    setForgotEmail("");
    setForgotError(null);
    setForgotSuccess(false);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    try {
      if (isLogin) {
        await login(email, password, rememberMe);
        if (onSuccess) {
          onSuccess();
          return;
        }
        onClose();
      } else {
        await register(email, password, name);
        if (onRegisterSuccess) {
          onRegisterSuccess();
          return;
        }
        if (onSuccess) {
          onSuccess();
          return;
        }
        onClose();
      }
    } catch (err) {
      // Error já é tratado no useAuth
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] animate-fade-in" 
        onClick={onClose} 
      />

      {/* Sidebar */}
      <div
        className={`fixed top-0 right-0 w-full max-w-[420px] h-full bg-surface/95 backdrop-blur-2xl border-l border-white/10 shadow-2xl z-[1001] flex flex-col transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-8 custom-scrollbar">
          {/* Brand */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center text-white shadow-lg shadow-accent/20">
              <Bike size={24} strokeWidth={2.5} />
            </div>
            <h2 className="text-2xl font-black text-white tracking-tighter m-0">MotoGuard</h2>
          </div>

          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-xl font-black text-white tracking-tight">
              {showForgotPassword ? "Recuperar Senha" : isLogin ? "Bem-vindo de volta" : "Criar nova conta"}
            </h3>
            <button 
              type="button" 
              onClick={onClose} 
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-muted hover:text-white hover:bg-white/10 transition-all"
              aria-label="Fechar"
            >
              <X size={20} />
            </button>
          </div>

          {/* Forgot Password */}
          {showForgotPassword ? (
            <div className="flex flex-col gap-6 animate-fade-in">
              <button
                type="button"
                onClick={closeForgotPassword}
                className="flex items-center gap-2 text-[0.65rem] font-black uppercase tracking-widest text-muted hover:text-accent transition-colors w-fit"
              >
                <ArrowLeft size={16} />
                <span>Voltar ao login</span>
              </button>

              {forgotSuccess ? (
                <div className="p-6 rounded-2xl bg-green/10 border border-green/20 text-green flex flex-col gap-2">
                  <strong className="text-sm font-black uppercase tracking-widest">Email enviado!</strong>
                  <p className="text-sm font-medium m-0 leading-relaxed opacity-80">
                    Se o endereço existir na nossa base de dados, receberás instruções de recuperação em breve.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium text-muted m-0 leading-relaxed">
                    Introduz o teu email para receberes instruções de recuperação de senha.
                  </p>
                  <form onSubmit={handleForgotPasswordSubmit} className="flex flex-col gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-[0.65rem] font-black uppercase tracking-widest text-muted">Email</label>
                      <div className="relative">
                        <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                        <input
                          className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm font-bold text-text focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all placeholder:text-muted/40"
                          type="email"
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          required
                          autoFocus
                          placeholder="teu@email.com"
                          autoComplete="email"
                        />
                      </div>
                    </div>
                    {forgotError && (
                      <div className="p-4 rounded-xl bg-red/10 border border-red/20 text-red text-xs font-bold animate-shake">
                        {forgotError}
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="w-full py-4 rounded-xl bg-accent text-white font-black text-[0.75rem] uppercase tracking-[0.2em] shadow-xl shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                      {forgotLoading ? "A enviar..." : "Enviar Recuperação"}
                    </button>
                  </form>
                </>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-6 animate-fade-in">
              <p className="text-sm font-medium text-muted m-0 leading-relaxed">
                {isLogin ? "Introduz os teus dados para aceder à tua conta." : "Regista-te para começar a monitorizar a tua mota."}
              </p>

              {/* Register Name Field */}
              {!isLogin && (
                <div className="flex flex-col gap-2">
                  <label className="text-[0.65rem] font-black uppercase tracking-widest text-muted">Nome</label>
                  <div className="relative">
                    <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                      className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm font-bold text-text focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all placeholder:text-muted/40"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required={!isLogin}
                      placeholder="Teu nome completo"
                      autoComplete="name"
                    />
                  </div>
                </div>
              )}

              {/* Email Field */}
              <div className="flex flex-col gap-2">
                <label className="text-[0.65rem] font-black uppercase tracking-widest text-muted">Email</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm font-bold text-text focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all placeholder:text-muted/40"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="teu@email.com"
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="flex flex-col gap-2">
                <label className="text-[0.65rem] font-black uppercase tracking-widest text-muted">Senha</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm font-bold text-text focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all placeholder:text-muted/40"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    autoComplete={isLogin ? "current-password" : "new-password"}
                  />
                </div>
              </div>

              {/* Remember Me (Login only) */}
              {isLogin && (
                <div className="flex items-center justify-between gap-4">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-white/10 bg-black/20 text-accent focus:ring-accent transition-all"
                    />
                    <span className="text-xs font-bold text-muted group-hover:text-white transition-colors">Lembrar de mim</span>
                  </label>
                  <button type="button" onClick={openForgotPassword} className="text-xs font-black text-accent hover:underline uppercase tracking-widest">
                    Esqueci a senha
                  </button>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="p-4 rounded-xl bg-red/10 border border-red/20 text-red text-xs font-bold animate-shake">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 rounded-xl bg-accent text-white font-black text-[0.75rem] uppercase tracking-[0.2em] shadow-xl shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {isLoading
                  ? isLogin
                    ? "A entrar..."
                    : "A criar conta..."
                  : isLogin
                    ? "Entrar na Conta"
                    : "Criar Minha Conta"}
              </button>

              {/* Toggle Login/Register */}
              <div className="text-center flex flex-col gap-2 mt-4">
                <span className="text-xs font-medium text-muted opacity-60">{isLogin ? "Não tem conta?" : "Já tem conta?"}</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    clearError();
                    closeForgotPassword();
                  }}
                  className="text-sm font-black text-white hover:text-accent transition-colors underline decoration-accent/30 underline-offset-4"
                >
                  {isLogin ? "Criar conta agora" : "Fazer login"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
};

export default LoginSidebar;
