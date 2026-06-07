import { FC, useMemo, useState } from 'react';
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useDemoContext } from "../demo/DemoContext";
import LoginSidebar from "../components/auth/LoginSidebar";

const HomePage: FC = () => {
  const { isAuthenticated } = useAuth();
  const { activateDemo } = useDemoContext();
  const navigate = useNavigate();
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
    <div className="min-h-screen bg-slate-950 text-white overflow-x-hidden selection:bg-accent selection:text-white">
      {/* BACKGROUND DECORATION */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-accent/20 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue/20 blur-[120px] rounded-full animate-pulse delay-1000" />
      </div>

      {/* HERO SECTION */}
      <section className="relative min-h-screen flex items-center px-6 md:px-12 pt-20 overflow-hidden">
        <div className="container mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="relative z-10 flex flex-col items-center lg:items-start text-center lg:text-left gap-8 animate-slide-up">
            <div className="inline-flex items-center gap-4 px-8 py-4 rounded-full bg-white/5 border border-white/10 backdrop-blur-md shadow-xl">
              <span className="animate-ping w-4 h-4 rounded-full bg-accent" />
              <img src="/logo.svg" alt="MotoGuard Logo" className="h-8 w-auto" />
            </div>
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-none m-0 text-white">
              Monitoramento <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-blue-400">Inteligente</span> <br />
              para Motocicletas
            </h1>
            <p className="text-lg md:text-xl text-muted font-medium max-w-xl leading-relaxed m-0">
              Sistema completo de telemetria em tempo real que revoluciona a segurança e performance da sua mota.
              Conecte-se, monitore e proteja seu investimento com tecnologia de ponta.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4 mt-4 w-full sm:w-auto">
              <button className="w-full sm:w-auto px-10 py-5 rounded-2xl bg-accent text-white font-black text-lg shadow-2xl shadow-accent/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3" onClick={handleGetStarted}>
                🚀 Começar Agora
              </button>
              <button className="w-full sm:w-auto px-10 py-5 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-lg backdrop-blur-md hover:bg-white/10 transition-all flex items-center justify-center gap-3" onClick={() => setIsDemoOpen(true)}>
                📖 Demonstração
              </button>
            </div>
          </div>

          <div className="relative flex justify-center items-center lg:justify-end animate-fade-in delay-500">
            <div className="relative w-80 h-80 md:w-[500px] md:h-[500px] flex items-center justify-center">
              <div className="absolute inset-0 bg-accent/20 blur-[100px] rounded-full animate-pulse" />
              <div className="text-9xl md:text-[12rem] animate-float relative z-10 drop-shadow-[0_20px_50px_rgba(139,92,246,0.3)]">🏍️</div>
              
              {/* DATA POINTS DECORATION */}
              {[
                { icon: "📡", pos: "top-[10%] left-[10%]", delay: "delay-0" },
                { icon: "📊", pos: "top-[20%] right-[10%]", delay: "delay-200" },
                { icon: "⚡", pos: "bottom-[20%] left-[15%]", delay: "delay-500" },
                { icon: "🛡️", pos: "bottom-[10%] right-[20%]", delay: "delay-700" }
              ].map((pt, i) => (
                <div key={i} className={`absolute ${pt.pos} text-3xl md:text-4xl bg-white/5 backdrop-blur-md border border-white/10 w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center shadow-2xl animate-pulse ${pt.delay} z-20`}>
                  {pt.icon}
                </div>
              ))}
              
              {/* SPINNING RINGS */}
              <div className="absolute inset-0 border-2 border-accent/10 rounded-full animate-spin-slow" />
              <div className="absolute inset-[-20px] border border-accent/5 rounded-full animate-spin-slow-reverse" />
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES GRID */}
      <section className="py-32 px-6 bg-slate-900/50 relative">
        <div className="container mx-auto flex flex-col gap-20">
          <div className="flex flex-col items-center text-center gap-4">
            <h2 className="text-4xl md:text-5xl font-black tracking-tight m-0">Recursos <span className="text-accent">Principais</span></h2>
            <p className="text-muted text-lg font-medium max-w-2xl m-0">Tudo o que você precisa para uma pilotagem conectada e segura em um único sistema.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: "📡", title: "Telemetria em Tempo Real", desc: "Monitore velocidade, rotação, temperatura e localização instantaneamente através de sensores avançados." },
              { icon: "⚠️", title: "Alertas Inteligentes", desc: "Receba notificações automáticas sobre comportamentos de risco, manutenção necessária e situações críticas." },
              { icon: "🗺️", title: "Rastreamento GPS", desc: "Acompanhe sua mota em tempo real, visualize rotas percorridas e defina zonas seguras." },
              { icon: "📊", title: "Análise de Performance", desc: "Relatórios detalhados sobre consumo, eficiência, padrões de uso e estatísticas de viagem." },
              { icon: "🔐", title: "Segurança Avançada", desc: "Sistema anti-furto com bloqueio remoto, alertas de movimento e histórico completo de eventos." },
              { icon: "⚙️", title: "Configuração Flexível", desc: "Personalize alertas, limiares de segurança e preferências conforme seu estilo de pilotagem." }
            ].map((f, i) => (
              <div key={i} className="group p-10 rounded-[2.5rem] bg-white/5 border border-white/10 backdrop-blur-xl hover:border-accent/40 hover:bg-white/10 transition-all shadow-xl flex flex-col gap-6">
                <div className="text-5xl group-hover:scale-110 transition-transform">{f.icon}</div>
                <div className="flex flex-col gap-3">
                  <h3 className="text-xl font-black text-white m-0">{f.title}</h3>
                  <p className="text-muted text-sm leading-relaxed m-0">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SIMULATOR MODULES */}
      <section className="py-32 px-6">
        <div className="container mx-auto flex flex-col gap-20">
          <div className="flex flex-col items-center text-center gap-4">
            <h2 className="text-4xl md:text-5xl font-black tracking-tight m-0">Arquitetura do <span className="text-accent">Sistema</span></h2>
            <p className="text-muted text-lg font-medium max-w-2xl m-0">Conheça a tecnologia que impulsiona cada componente da sua experiência.</p>
          </div>
          
          <div className="max-w-4xl mx-auto flex flex-col gap-12 relative">
            <div className="absolute left-[30px] top-0 bottom-0 w-1 bg-gradient-to-b from-accent to-blue-400 hidden md:block" />
            
            {[
              { icon: "📡", title: "MQTT Broker", function: "Canal de comunicação em tempo real entre dispositivos e sistema.", impact: "Latência mínima, comunicação confiável para dados críticos" },
              { icon: "🗄️", title: "InfluxDB + PostgreSQL", function: "Armazenamento especializado - Séries temporais e dados relacionais.", impact: "Consultas rápidas e estrutura robusta para usuários e viagens" },
              { icon: "🔧", title: "Backend Node.js", function: "Processamento de eventos, detecção de padrões de risco e segurança.", impact: "Análise inteligente em tempo real e detecção de anomalias" },
              { icon: "🖥️", title: "Frontend React", function: "Interface moderna e responsiva para visualização e controle total.", impact: "UX intuitiva, gráficos interativos e acesso mobile-friendly" },
              { icon: "🐍", title: "Simulador Python", function: "Geração de dados realistas para cenários de pilotagem variados.", impact: "Testes extensivos e simulação de eventos de risco reais" }
            ].map((m, i) => (
              <div key={i} className="flex flex-col md:flex-row items-start gap-8 relative z-10">
                <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center text-2xl text-white shadow-xl shadow-accent/30 shrink-0 border-4 border-slate-950">
                  {m.icon}
                </div>
                <div className="flex-1 p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-2xl flex flex-col gap-6">
                  <h3 className="text-2xl font-black text-white m-0 tracking-tight">{m.title}</h3>
                  <div className="flex flex-col gap-4">
                    <p className="text-muted text-sm m-0"><strong>Função:</strong> {m.function}</p>
                    <div className="bg-accent/10 border-l-4 border-accent p-4 rounded-r-xl">
                      <span className="block text-[0.6rem] font-black uppercase tracking-widest text-accent mb-1 opacity-80">Impacto</span>
                      <span className="text-accent/90 text-sm font-bold">{m.impact}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RESULTS FLOW */}
      <section className="py-32 px-6 bg-slate-900/50">
        <div className="container mx-auto flex flex-col gap-20">
          <div className="flex flex-col items-center text-center gap-4">
            <h2 className="text-4xl md:text-5xl font-black tracking-tight m-0">Fluxo de <span className="text-accent">Dados</span></h2>
            <p className="text-muted text-lg font-medium max-w-2xl m-0">Como transformamos dados brutos em decisões inteligentes em milissegundos.</p>
          </div>
          
          <div className="flex flex-col lg:flex-row items-center justify-center gap-8 max-w-6xl mx-auto">
            {[
              { num: "1", title: "Coleta", desc: "Sensores via MQTT" },
              { num: "2", title: "Processamento", desc: "Backend analisa riscos" },
              { num: "3", title: "Armazenamento", desc: "Bancos otimizados" },
              { num: "4", title: "Visualização", desc: "Dashboard intuitivo" },
              { num: "5", title: "Ação", desc: "Alertas automáticos" }
            ].map((step, i) => (
              <div key={i} className="flex flex-col lg:flex-row items-center gap-8 flex-1 w-full lg:w-auto">
                <div className="flex flex-col items-center text-center gap-4 group">
                  <div className="w-16 h-16 rounded-2xl bg-accent/20 border border-accent/40 flex items-center justify-center text-2xl font-black text-accent group-hover:bg-accent group-hover:text-white transition-all shadow-xl group-hover:scale-110">
                    {step.num}
                  </div>
                  <div className="flex flex-col gap-1">
                    <h4 className="text-lg font-black text-white m-0">{step.title}</h4>
                    <p className="text-muted text-[0.7rem] font-bold uppercase tracking-widest m-0">{step.desc}</p>
                  </div>
                </div>
                {i < 4 && <div className="text-accent text-3xl hidden lg:block animate-pulse">→</div>}
                {i < 4 && <div className="text-accent text-3xl lg:hidden animate-pulse">↓</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="py-40 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-accent/10 backdrop-blur-3xl animate-pulse" />
        <div className="container mx-auto relative z-10 text-center flex flex-col items-center gap-10">
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter m-0 leading-tight">
            Pronto para Revolucionar <br /> sua <span className="text-accent underline decoration-4 underline-offset-8">Pilotagem</span>?
          </h2>
          <p className="text-lg md:text-xl text-white/80 font-medium max-w-2xl m-0 leading-relaxed">
            Junte-se a milhares de motociclistas que já usam MotoGuard para uma pilotagem mais segura, eficiente e totalmente conectada.
          </p>
          <button className="px-12 py-6 rounded-[2rem] bg-accent text-white font-black text-xl shadow-[0_20px_50px_rgba(139,92,246,0.5)] hover:scale-105 active:scale-95 transition-all" onClick={handleCreateAccount}>
            🚀 Criar Conta Gratuita
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 px-6 border-t border-white/5 bg-slate-950 relative z-10">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-8 opacity-60 hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="MotoGuard Logo" className="h-7 w-auto" />
            <span className="text-lg font-black tracking-tight text-white m-0 uppercase">IoT</span>
          </div>
          <p className="text-sm font-bold text-muted m-0">
            © 2026 MotoGuard IoT. Tecnologia de ponta para quem vive sobre duas rodas.
          </p>
        </div>
      </footer>

      {/* AUTH SIDEBAR */}
      <LoginSidebar
        isOpen={authOpen}
        defaultMode={authMode}
        onClose={() => setAuthOpen(false)}
        onSuccess={() => navigate("/dashboard", { replace: true })}
        onRegisterSuccess={() => navigate("/garage", { replace: true })}
      />

      {/* STEP BY STEP DEMO MODAL */}
      {isDemoOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 md:p-12">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl animate-fade-in" onClick={() => setIsDemoOpen(false)} />
          <div className="relative w-full max-w-4xl max-h-full bg-slate-900 border border-white/10 rounded-[2.5rem] shadow-[0_50px_100px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col animate-slide-up">
            <div className="p-8 border-b border-white/5 flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <h3 className="text-2xl font-black text-white m-0 tracking-tight">Fluxo de Dados <span className="text-accent">(Simulador)</span></h3>
                <p className="text-muted text-sm font-medium m-0 opacity-60 uppercase tracking-widest">Entenda como cada tick é processado</p>
              </div>
              <button className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-muted hover:text-white hover:border-white/20 transition-all" onClick={() => setIsDemoOpen(false)}>
                ✕
              </button>
            </div>
            
            <div className="p-8 overflow-y-auto flex-1 flex flex-col gap-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {demoSteps.map((s, i) => (
                  <div key={i} className="p-6 rounded-3xl bg-black/40 border border-white/5 flex flex-col gap-4 group hover:border-accent/30 transition-all">
                    <span className="text-sm font-black text-accent uppercase tracking-widest">{s.title}</span>
                    <pre className="bg-black/60 p-5 rounded-2xl text-[0.7rem] font-mono text-blue-300 leading-relaxed overflow-x-auto border border-white/5 shadow-inner">
                      {s.body}
                    </pre>
                  </div>
                ))}
              </div>
              
              <div className="flex flex-wrap items-center justify-center gap-4 pt-4 border-t border-white/5">
                <button className="px-8 py-4 rounded-2xl bg-accent text-white font-black text-sm shadow-xl shadow-accent/20 hover:scale-[1.02] transition-all" onClick={handleCreateAccount}>
                  🚀 Criar Conta Gratuita
                </button>
                <button className="px-8 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-sm hover:bg-white/10 transition-all" onClick={() => { activateDemo(); setIsDemoOpen(false); }}>
                  🎮 Explorar Modo Demo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HomePage;
