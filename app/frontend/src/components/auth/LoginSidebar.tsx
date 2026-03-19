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
      <div className="auth-overlay" onClick={onClose} />

      <div
        className={`auth-sidebar ${isOpen ? "auth-sidebar-open" : ""}`}
      >
        <div className="auth-content">
          <div className="auth-brand">
            <Bike size={32} className="brand-icon" />
            <h2>MotoGuard</h2>
          </div>

          <div className="auth-header">
            <div className="auth-title">
              {showForgotPassword ? "Recuperar Senha" : isLogin ? "Bem-vindo de volta" : "Criar nova conta"}
            </div>
            <button type="button" onClick={onClose} className="auth-close" aria-label="Fechar">
              <X size={20} />
            </button>
          </div>

          {/* Forgot Password */}
          {showForgotPassword ? (
            <div className="forgot-password-container">
              <button
                type="button"
                onClick={closeForgotPassword}
                className="auth-link-back"
              >
                <ArrowLeft size={16} />
                <span>Voltar ao login</span>
              </button>

              {forgotSuccess ? (
                <div className="alert alert-success">
                  <strong>Email enviado!</strong>
                  <div style={{ marginTop: 8 }}>
                    Se o endereço existir na nossa base de dados, receberás
                    instruções de recuperação em breve.
                  </div>
                </div>
              ) : (
                <>
                  <p className="auth-subtitle">
                    Introduz o teu email para receberes instruções de
                    recuperação de senha.
                  </p>
                  <form onSubmit={handleForgotPasswordSubmit} className="auth-form">
                    <div className="field">
                      <div className="field-label">Email</div>
                      <div className="input-with-icon">
                        <Mail size={18} className="input-icon" />
                        <input
                          className="control"
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
                      <div className="alert alert-danger">
                        {forgotError}
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="btn btn-primary btn-block btn-large"
                    >
                      {forgotLoading ? "A enviar..." : "Enviar Email de Recuperação"}
                    </button>
                  </form>
                </>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="auth-form">
              <p className="auth-subtitle">
                {isLogin ? "Introduz os teus dados para aceder à tua conta." : "Regista-te para começar a monitorizar a tua mota."}
              </p>

              {/* Register Name Field */}
              {!isLogin && (
                <div className="field">
                  <div className="field-label">Nome</div>
                  <div className="input-with-icon">
                    <User size={18} className="input-icon" />
                    <input
                      className="control"
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
              <div className="field">
                <div className="field-label">Email</div>
                <div className="input-with-icon">
                  <Mail size={18} className="input-icon" />
                  <input
                    className="control"
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
              <div className="field">
                <div className="field-label">Senha</div>
                <div className="input-with-icon">
                  <Lock size={18} className="input-icon" />
                  <input
                    className="control"
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
                <div className="auth-row">
                  <label className="auth-checkbox">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span>Lembrar de mim</span>
                  </label>
                  <button type="button" onClick={openForgotPassword} className="auth-link-forgot">
                    Esqueci a senha
                  </button>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="alert alert-danger">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary btn-block btn-large"
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
              <div className="auth-footer-toggle">
                <span>{isLogin ? "Não tem conta?" : "Já tem conta?"}</span>{" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    clearError();
                    closeForgotPassword();
                  }}
                  className="auth-link-switch"
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
