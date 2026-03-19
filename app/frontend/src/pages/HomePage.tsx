import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import LoginSidebar from "../components/auth/LoginSidebar";
import './HomePage.css';

const HomePage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isDemoOpen, setIsDemoOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");

  const handleGetStarted = () => {
    if (isAuthenticated) { navigate("/dashboard"); return; }
    setAuthMode("login");
    setAuthOpen(true);
  };

  const handleCreateAccount = () => {
    if (isAuthenticated) { navigate("/dashboard"); return; }
    setAuthMode("register");
    setAuthOpen(true);
  };

  const demoSteps = useMemo(
    () => [
      {
        title: "1) Simulador (Python) gera um tick",
        body: `PUBLISH_INTERVAL = 1s\n\ntick=42\ntelemetry.speed_kmh=68.4\ntelemetry.rpm=6120\nimu.roll_deg=14.2\nimu.g_force=1.31\nlocation.lat=41.55...\nlocation.lng=-8.42...`,
      },
      {
        title: "2) Backend processa e publica",
        body: `[MQTT] motoguard/telemetria\n[InfluxDB] writeTelemetry()\n[Socket.IO] emit telemetry_update`,
      },
      {
        title: "3) Heurísticas detetam risco (exemplo)",
        body: `HARD_BRAKING\nseverity=WARNING\nmsg=\"Travagem brusca (≈0.58G)\"`,
      },
      {
        title: "4) Frontend atualiza UI",
        body: `Dashboard: cards + mapa\nTrips: eventos e score (0–100)`,
      },
    ],
    [],
  );

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">
            🏍️ MotoGuard IoT
          </div>
          <h1 className="hero-title">
            Monitoramento Inteligente para <span className="highlight">Motocicletas</span>
          </h1>
          <p className="hero-description">
            Sistema completo de telemetria em tempo real que revoluciona a segurança e performance da sua mota.
            Conecte-se, monitore e proteja seu investimento com tecnologia de ponta.
          </p>
          <div className="hero-actions">
            <button className="btn-primary" onClick={handleGetStarted}>
              🚀 Começar Agora
            </button>
            <button className="btn-secondary" onClick={() => setIsDemoOpen(true)}>
              📖 Ver Demonstração
            </button>
          </div>
        </div>
        <div className="hero-visual">
          <div className="moto-illustration">
            <div className="moto-body">🏍️</div>
            <div className="data-stream">
              <div className="data-point" style={{ top: '20%', left: '10%' }}>📡</div>
              <div className="data-point" style={{ top: '40%', right: '15%' }}>📊</div>
              <div className="data-point" style={{ bottom: '30%', left: '20%' }}>⚡</div>
              <div className="data-point" style={{ bottom: '50%', right: '10%' }}>🛡️</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="features">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Recursos Principais</h2>
            <p className="section-subtitle">Tudo o que você precisa em um único sistema</p>
          </div>
          
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">📡</div>
              <h3>Telemetria em Tempo Real</h3>
              <p>Monitore velocidade, rotação, temperatura e localização instantaneamente através de sensores avançados.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">⚠️</div>
              <h3>Alertas Inteligentes</h3>
              <p>Receba notificações automáticas sobre comportamentos de risco, manutenção necessária e situações críticas.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">🗺️</div>
              <h3>Rastreamento GPS</h3>
              <p>Acompanhe sua mota em tempo real, visualize rotas percorridas e defina zonas seguras com geofencing.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>Análise de Performance</h3>
              <p>Relatórios detalhados sobre consumo, eficiência, padrões de uso e estatísticas de viagem.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">🔐</div>
              <h3>Segurança Avançada</h3>
              <p>Sistema anti-furto com bloqueio remoto, alertas de movimento e histórico completo de eventos.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">⚙️</div>
              <h3>Configuração Flexível</h3>
              <p>Personalize alertas, limiares de segurança e preferências conforme seu estilo de pilotagem.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Simulator Modules */}
      <section className="simulator">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Módulos do Simulador</h2>
            <p className="section-subtitle">Como cada componente impacta sua experiência</p>
          </div>
          
          <div className="modules-timeline">
            <div className="module-item">
              <div className="module-marker">
                <div className="module-icon">📡</div>
                <div className="module-line"></div>
              </div>
              <div className="module-content">
                <h3>MQTT Broker</h3>
                <p className="module-description">
                  <strong>Função:</strong> Canal de comunicação em tempo real entre dispositivos e sistema.
                </p>
                <div className="impact">
                  <span className="impact-label">Impacto:</span>
                  <span className="impact-text">Latência mínima, comunicação confiável para dados críticos</span>
                </div>
              </div>
            </div>

            <div className="module-item">
              <div className="module-marker">
                <div className="module-icon">🗄️</div>
                <div className="module-line"></div>
              </div>
              <div className="module-content">
                <h3>InfluxDB + PostgreSQL</h3>
                <p className="module-description">
                  <strong>Função:</strong> Armazenamento especializado - InfluxDB para telemetria time-series, PostgreSQL para dados relacionais.
                </p>
                <div className="impact">
                  <span className="impact-label">Impacto:</span>
                  <span className="impact-text">Consultas rápidas de séries temporais, dados estruturados para usuários e viagens</span>
                </div>
              </div>
            </div>

            <div className="module-item">
              <div className="module-marker">
                <div className="module-icon">🔧</div>
                <div className="module-line"></div>
              </div>
              <div className="module-content">
                <h3>Backend Node.js</h3>
                <p className="module-description">
                  <strong>Função:</strong> Cérebro do sistema - processa eventos, detecta padrões de risco, gerencia autenticação.
                </p>
                <div className="impact">
                  <span className="impact-label">Impacto:</span>
                  <span className="impact-text">Análise inteligente em tempo real, detecção de comportamentos anormais</span>
                </div>
              </div>
            </div>

            <div className="module-item">
              <div className="module-marker">
                <div className="module-icon">🖥️</div>
                <div className="module-line"></div>
              </div>
              <div className="module-content">
                <h3>Frontend React</h3>
                <p className="module-description">
                  <strong>Função:</strong> Interface moderna e responsiva para visualização e controle total do sistema.
                </p>
                <div className="impact">
                  <span className="impact-label">Impacto:</span>
                  <span className="impact-text">UX intuitiva, gráficos interativos, acesso mobile-friendly</span>
                </div>
              </div>
            </div>

            <div className="module-item">
              <div className="module-marker">
                <div className="module-icon">🐍</div>
                <div className="module-line"></div>
              </div>
              <div className="module-content">
                <h3>Simulador Python</h3>
                <p className="module-description">
                  <strong>Função:</strong> Gera dados realistas de telemetria simulando diferentes cenários de pilotagem.
                </p>
                <div className="impact">
                  <span className="impact-label">Impacto:</span>
                  <span className="impact-text">Dados variados para testes, simulação de eventos de risco, diferentes perfis de pilotagem</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Results Flow */}
      <section className="results-flow">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Como Tudo se Conecta</h2>
            <p className="section-subtitle">Do dado bruto à decisão inteligente</p>
          </div>
          
          <div className="flow-diagram">
            <div className="flow-step">
              <div className="step-number">1</div>
              <div className="step-content">
                <h4>Coleta de Dados</h4>
                <p>Sensores enviam telemetria via MQTT</p>
              </div>
            </div>
            
            <div className="flow-arrow">→</div>
            
            <div className="flow-step">
              <div className="step-number">2</div>
              <div className="step-content">
                <h4>Processamento</h4>
                <p>Backend analisa padrões e detecta riscos</p>
              </div>
            </div>
            
            <div className="flow-arrow">→</div>
            
            <div className="flow-step">
              <div className="step-number">3</div>
              <div className="step-content">
                <h4>Armazenamento</h4>
                <p>Dados salvos em bancos otimizados</p>
              </div>
            </div>
            
            <div className="flow-arrow">→</div>
            
            <div className="flow-step">
              <div className="step-number">4</div>
              <div className="step-content">
                <h4>Visualização</h4>
                <p>Dashboard interativo mostra insights</p>
              </div>
            </div>
            
            <div className="flow-arrow">→</div>
            
            <div className="flow-step">
              <div className="step-number">5</div>
              <div className="step-content">
                <h4>Ação Inteligente</h4>
                <p>Alertas e recomendações automáticas</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta">
        <div className="container">
          <div className="cta-content">
            <h2>Pronto para Revolucionar sua Pilotagem?</h2>
            <p>Junte-se a milhares de motociclistas que já usam MotoGuard para uma pilotagem mais segura e inteligente.</p>
            <div className="cta-actions">
              <button className="btn-primary btn-large" onClick={handleCreateAccount}>
                🚀 Criar Conta Gratuita
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="home-footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-brand">
              <span className="brand-icon">🏍️</span>
              <span className="brand-name">MotoGuard IoT</span>
            </div>
            <div className="footer-text">
              © 2026 MotoGuard IoT. Tecnologia de ponta para motociclistas.
            </div>
          </div>
        </div>
      </footer>

      <LoginSidebar
        isOpen={authOpen}
        defaultMode={authMode}
        onClose={() => setAuthOpen(false)}
        onSuccess={() => navigate("/dashboard", { replace: true })}
        onRegisterSuccess={() => navigate("/garage", { replace: true })}
      />

      {isDemoOpen && (        <div className="demo-overlay" role="dialog" aria-modal="true">
          <div className="demo-backdrop" onClick={() => setIsDemoOpen(false)} />
          <div className="demo-modal">
            <div className="demo-header">
              <div className="demo-title">Demonstração (Simulador por passos)</div>
              <button className="demo-close" type="button" onClick={() => setIsDemoOpen(false)} aria-label="Fechar">
                ✕
              </button>
            </div>
            <div className="demo-body">
              <div className="demo-lead">
                Exemplo de execução para explicar o fluxo de dados. Os valores são ilustrativos.
              </div>
              <div className="demo-steps">
                {demoSteps.map((s) => (
                  <div key={s.title} className="demo-step">
                    <div className="demo-step-title">{s.title}</div>
                    <pre className="demo-code">{s.body}</pre>
                  </div>
                ))}
              </div>
              <div className="demo-actions">
                <button className="btn-primary" onClick={handleCreateAccount}>
                  🚀 Criar Conta Gratuita
                </button>
                <button className="btn-secondary" onClick={() => setIsDemoOpen(false)}>
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;
