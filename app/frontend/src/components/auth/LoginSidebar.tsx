import React, { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { authAPI } from "../../services/api";

interface LoginSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const LoginSidebar: React.FC<LoginSidebarProps> = ({ isOpen, onClose }) => {
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
        onClose();
      } else {
        await register(email, password, name);
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
        className="auth-overlay"
        onClick={onClose}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          backdropFilter: "blur(4px)",
          zIndex: 1000,
        }}
      />

      {/* Sidebar */}
      <div
        className="auth-sidebar"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          width: "400px",
          height: "100%",
          backgroundColor: "white",
          boxShadow: "-4px 0 20px rgba(0, 0, 0, 0.1)",
          zIndex: 1001,
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.3s ease-in-out",
        }}
      >
        <div className="auth-content" style={{ padding: "2rem" }}>
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "2rem",
            }}
          >
            <h2 style={{ margin: 0, color: "#1f2937" }}>
              {showForgotPassword
                ? "Recuperar Senha"
                : isLogin
                  ? "Login"
                  : "Registar"}
            </h2>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                fontSize: "1.5rem",
                cursor: "pointer",
                color: "#6b7280",
              }}
            >
              ×
            </button>
          </div>

          {/* Forgot Password */}
          {showForgotPassword ? (
            <div>
              {/* Botão voltar */}
              <button
                type="button"
                onClick={closeForgotPassword}
                style={{
                  background: "none",
                  border: "none",
                  color: "#667eea",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  marginBottom: "1rem",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                ← Voltar ao login
              </button>

              {forgotSuccess ? (
                <div
                  style={{
                    padding: "1rem",
                    backgroundColor: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    borderRadius: "8px",
                    color: "#15803d",
                    fontSize: "0.9rem",
                    lineHeight: 1.5,
                  }}
                >
                  <strong>Email enviado!</strong>
                  <p style={{ marginTop: "0.5rem" }}>
                    Se o endereço existir na nossa base de dados, receberás
                    instruções de recuperação em breve.
                  </p>
                </div>
              ) : (
                <>
                  <p
                    style={{
                      color: "#6b7280",
                      marginBottom: "1.5rem",
                      fontSize: "0.9rem",
                    }}
                  >
                    Introduz o teu email para receberes instruções de
                    recuperação de senha.
                  </p>
                  <form onSubmit={handleForgotPasswordSubmit}>
                    <div style={{ marginBottom: "1rem" }}>
                      <label
                        style={{
                          display: "block",
                          marginBottom: "0.5rem",
                          color: "#374151",
                        }}
                      >
                        Email
                      </label>
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        required
                        autoFocus
                        autoComplete="email"
                        style={{
                          width: "100%",
                          padding: "0.75rem",
                          border: "1px solid #d1d5db",
                          borderRadius: "6px",
                          fontSize: "1rem",
                        }}
                      />
                    </div>
                    {forgotError && (
                      <div
                        style={{
                          marginBottom: "1rem",
                          padding: "0.75rem",
                          backgroundColor: "#fef2f2",
                          border: "1px solid #fecaca",
                          borderRadius: "6px",
                          color: "#dc2626",
                          fontSize: "0.875rem",
                        }}
                      >
                        {forgotError}
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      style={{
                        width: "100%",
                        padding: "0.75rem",
                        backgroundColor: "#667eea",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "1rem",
                        cursor: forgotLoading ? "not-allowed" : "pointer",
                        opacity: forgotLoading ? 0.7 : 1,
                      }}
                    >
                      {forgotLoading ? "A enviar..." : "Enviar Email"}
                    </button>
                  </form>
                </>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {/* Register Name Field */}
              {!isLogin && (
                <div style={{ marginBottom: "1rem" }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "0.5rem",
                      color: "#374151",
                    }}
                  >
                    Nome
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required={!isLogin}
                    autoComplete="name"
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: "1px solid #d1d5db",
                      borderRadius: "6px",
                      fontSize: "1rem",
                    }}
                  />
                </div>
              )}

              {/* Email Field */}
              <div style={{ marginBottom: "1rem" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    color: "#374151",
                  }}
                >
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #d1d5db",
                    borderRadius: "6px",
                    fontSize: "1rem",
                  }}
                />
              </div>

              {/* Password Field */}
              <div style={{ marginBottom: "1rem" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    color: "#374151",
                  }}
                >
                  Senha
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #d1d5db",
                    borderRadius: "6px",
                    fontSize: "1rem",
                  }}
                />
              </div>

              {/* Remember Me (Login only) */}
              {isLogin && (
                <div style={{ marginBottom: "1.5rem" }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      color: "#374151",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      style={{ marginRight: "0.5rem" }}
                    />
                    Lembrar de mim
                  </label>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div
                  style={{
                    marginBottom: "1rem",
                    padding: "0.75rem",
                    backgroundColor: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: "6px",
                    color: "#dc2626",
                    fontSize: "0.875rem",
                  }}
                >
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  backgroundColor: "#667eea",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "1rem",
                  cursor: isLoading ? "not-allowed" : "pointer",
                  opacity: isLoading ? 0.7 : 1,
                  marginBottom: "1rem",
                }}
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
                <div style={{ textAlign: "center", marginBottom: "1rem" }}>
                  <button
                    type="button"
                    onClick={openForgotPassword}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#667eea",
                      cursor: "pointer",
                      fontSize: "0.875rem",
                    }}
                  >
                    Esqueci a senha
                  </button>
                </div>
              )}

              {/* Toggle Login/Register */}
              <div style={{ textAlign: "center", color: "#6b7280" }}>
                {isLogin ? "Não tem conta?" : "Já tem conta?"}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    clearError();
                    closeForgotPassword();
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#667eea",
                    cursor: "pointer",
                    fontWeight: "500",
                  }}
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
