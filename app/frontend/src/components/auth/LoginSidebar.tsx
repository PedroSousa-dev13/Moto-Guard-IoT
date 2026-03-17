import React, { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { authAPI } from "../../services/api";

interface LoginSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const LoginSidebar: React.FC<LoginSidebarProps> = ({ isOpen, onClose, onSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
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
          <div className="auth-header">
            <div className="auth-title">
              {showForgotPassword ? "Recuperar Senha" : isLogin ? "Login" : "Registar"}
            </div>
            <button type="button" onClick={onClose} className="auth-close" aria-label="Fechar">
              ×
            </button>
          </div>

          {/* Forgot Password */}
          {showForgotPassword ? (
            <div>
              <button
                type="button"
                onClick={closeForgotPassword}
                className="auth-link"
              >
                ← Voltar ao login
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
                  <div className="page-subtitle" style={{ marginBottom: 12 }}>
                    Introduz o teu email para receberes instruções de
                    recuperação de senha.
                  </div>
                  <form onSubmit={handleForgotPasswordSubmit} className="auth-form">
                    <div className="field">
                      <div className="field-label">Email</div>
                      <input
                        className="control"
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        required
                        autoFocus
                        autoComplete="email"
                      />
                    </div>
                    {forgotError && (
                      <div className="alert alert-danger">
                        {forgotError}
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="btn btn-primary btn-block"
                    >
                      {forgotLoading ? "A enviar..." : "Enviar Email"}
                    </button>
                  </form>
                </>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="auth-form">
              {/* Register Name Field */}
              {!isLogin && (
                <div className="field">
                  <div className="field-label">Nome</div>
                  <input
                    className="control"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required={!isLogin}
                    autoComplete="name"
                  />
                </div>
              )}

              {/* Email Field */}
              <div className="field">
                <div className="field-label">Email</div>
                <input
                  className="control"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              {/* Password Field */}
              <div className="field">
                <div className="field-label">Senha</div>
                <input
                  className="control"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={isLogin ? "current-password" : "new-password"}
                />
              </div>

              {/* Remember Me (Login only) */}
              {isLogin && (
                <label className="auth-checkbox">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span>Lembrar de mim</span>
                </label>
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
                className="btn btn-primary btn-block"
              >
                {isLoading
                  ? isLogin
                    ? "A entrar..."
                    : "A criar conta..."
                  : isLogin
                    ? "Entrar"
                    : "Criar Conta"}
              </button>

              {/* Forgot Password Link (Login only) */}
              {isLogin && (
                <div className="auth-row">
                  <span />
                  <button type="button" onClick={openForgotPassword} className="auth-link">
                    Esqueci a senha
                  </button>
                </div>
              )}

              {/* Toggle Login/Register */}
              <div className="auth-footer">
                <span>{isLogin ? "Não tem conta?" : "Já tem conta?"}</span>{" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    clearError();
                    closeForgotPassword();
                  }}
                  className="auth-link"
                >
                  {isLogin ? "Criar conta" : "Login"}
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
