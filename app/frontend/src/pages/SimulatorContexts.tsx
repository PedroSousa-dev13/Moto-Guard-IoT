export default function SimulatorContexts() {
  const blocks = [
    {
      title: "Aceleração → Pitch",
      text:
        "Quando o simulador aumenta a aceleração (throttle), a mota transfere peso para trás: o pitch tende a subir. Em travagens fortes acontece o inverso.",
    },
    {
      title: "Yaw/Curva → Roll",
      text:
        "Ao iniciar uma curva (mudança de direção/yaw), a mota inclina-se. O roll acompanha a agressividade da manobra e a velocidade.",
    },
    {
      title: "RPM → Temperatura",
      text:
        "RPM elevado durante períodos prolongados faz a temperatura do motor subir; em trânsito lento pode subir mesmo com velocidades baixas.",
    },
    {
      title: "Carga elétrica → Voltagem",
      text:
        "Variações de voltagem simulam carga do alternador/bateria. Uma tendência descendente pode representar falha de carregamento.",
    },
    {
      title: "Aceleração/Travagem → G‑Force",
      text:
        "A IMU mede a aceleração (g_force). Ao acelerar ou travar, o valor de g_force tende a aumentar.",
    },
    {
      title: "GPS → Rota",
      text:
        "O GPS atualiza latitude/longitude. O dashboard desenha o trilho e a análise pós‑viagem permite rever a rota e marcar eventos no mapa.",
    },
  ];

  const subsystems = [
    "telemetry: velocidade, RPM, mudança, acelerador, travões",
    "imu: roll, pitch, yaw, g_force",
    "active_safety: ABS, TC, descanso",
    "health: pressão do óleo, pressão dos pneus",
    "location: latitude/longitude",
    "environment: luminosidade (lux)",
    "system: device_id, modelo, evento, tick, timestamp",
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">🧠 Contextos do Simulador</div>
          <div className="page-subtitle">
            Como os dados gerados se relacionam e afetam o comportamento da mota
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">Visão geral</div>
        </div>
        <div className="panel-body">
          <div className="page-subtitle" style={{ marginTop: 0 }}>
            O simulador gera telemetria coerente cruzando variáveis (velocidade, RPM, IMU, GPS e saúde). Isto permite testar o backend e o frontend com cenários realistas.
          </div>
          <div className="tile-grid" style={{ marginTop: 12 }}>
            {blocks.map((b) => (
              <div key={b.title} className="tile" style={{ gridColumn: "span 2" }}>
                <div className="tile-k">{b.title}</div>
                <div className="tile-v" style={{ fontSize: 14, color: "var(--muted)" }}>
                  {b.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <div className="panel-header">
          <div className="panel-title">Blocos do payload</div>
        </div>
        <div className="panel-body">
          <div className="tile-grid">
            {subsystems.map((s) => (
              <div key={s} className="tile">
                <div className="tile-v" style={{ fontSize: 14 }}>
                  {s}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

