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

  const nodes = [
    { id: "route", label: "Rota (OSRM/GPX)" },
    { id: "targets", label: "Targets (vel/yaw)" },
    { id: "speed", label: "Velocidade + acel." },
    { id: "controls", label: "Throttle + travões" },
    { id: "pitch", label: "Pitch" },
    { id: "rollYaw", label: "Roll + Yaw" },
    { id: "rpm", label: "RPM" },
    { id: "temp", label: "Temp. motor" },
    { id: "volt", label: "Voltagem" },
    { id: "gear", label: "Mudança + embraiagem" },
    { id: "odo", label: "Odómetro" },
    { id: "safety", label: "ABS/TC/descanso" },
    { id: "oil", label: "Pressão óleo" },
    { id: "tires", label: "Pressão pneus" },
    { id: "lux", label: "Luminosidade" },
    { id: "events", label: "Eventos (queda/etc.)" },
    { id: "gps", label: "GPS (lat/lng)" },
    { id: "publish", label: "Payload + MQTT" },
  ];

  const edges = [
    ["route", "targets"],
    ["targets", "speed"],
    ["speed", "controls"],
    ["controls", "pitch"],
    ["targets", "rollYaw"],
    ["speed", "rpm"],
    ["rpm", "temp"],
    ["rpm", "oil"],
    ["temp", "tires"],
    ["controls", "safety"],
    ["speed", "odo"],
    ["speed", "gps"],
    ["rollYaw", "gps"],
    ["pitch", "events"],
    ["rollYaw", "events"],
    ["temp", "events"],
    ["volt", "events"],
    ["oil", "events"],
    ["tires", "events"],
    ["lux", "publish"],
    ["events", "publish"],
    ["gps", "publish"],
    ["speed", "publish"],
    ["rpm", "publish"],
    ["pitch", "publish"],
    ["rollYaw", "publish"],
    ["safety", "publish"],
    ["oil", "publish"],
    ["tires", "publish"],
    ["volt", "publish"],
    ["gear", "publish"],
    ["odo", "publish"],
  ] as const;

  const nodeById = Object.fromEntries(nodes.map((n) => [n.id, n])) as Record<
    string,
    { id: string; label: string }
  >;

  const layout = {
    route: { x: 60, y: 60 },
    targets: { x: 230, y: 60 },
    speed: { x: 400, y: 60 },
    controls: { x: 570, y: 60 },
    pitch: { x: 740, y: 60 },
    rollYaw: { x: 570, y: 150 },
    rpm: { x: 400, y: 150 },
    temp: { x: 230, y: 150 },
    volt: { x: 60, y: 150 },
    gear: { x: 400, y: 240 },
    odo: { x: 570, y: 240 },
    gps: { x: 740, y: 240 },
    safety: { x: 60, y: 240 },
    oil: { x: 230, y: 240 },
    tires: { x: 60, y: 330 },
    lux: { x: 230, y: 330 },
    events: { x: 400, y: 330 },
    publish: { x: 740, y: 330 },
  } as const;

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

      <div className="panel" style={{ marginTop: 14 }}>
        <div className="panel-header">
          <div className="panel-title">Diagrama dos 18 subsistemas</div>
        </div>
        <div className="panel-body">
          <div style={{ overflowX: "auto" }}>
            <svg
              viewBox="0 0 860 420"
              width="100%"
              style={{
                minWidth: 860,
                background:
                  "linear-gradient(180deg, rgba(15, 23, 42, 0.06) 0%, rgba(15, 23, 42, 0.02) 100%)",
                border: "1px solid rgba(15, 23, 42, 0.12)",
                borderRadius: 14,
              }}
            >
              <defs>
                <marker
                  id="arrow"
                  markerWidth="8"
                  markerHeight="8"
                  refX="7"
                  refY="3"
                  orient="auto"
                >
                  <path d="M0,0 L0,6 L8,3 z" fill="rgba(100, 116, 139, 0.95)" />
                </marker>
                <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow
                    dx="0"
                    dy="2"
                    stdDeviation="2"
                    floodColor="rgba(0,0,0,0.5)"
                  />
                </filter>
              </defs>

              {edges.map(([from, to]) => {
                const a = (layout as any)[from] as { x: number; y: number };
                const b = (layout as any)[to] as { x: number; y: number };
                const ax = a.x + 60;
                const ay = a.y + 18;
                const bx = b.x;
                const by = b.y + 18;
                const mx = (ax + bx) / 2;
                const path = `M ${ax} ${ay} C ${mx} ${ay}, ${mx} ${by}, ${bx} ${by}`;
                return (
                  <path
                    key={`${from}-${to}`}
                    d={path}
                    stroke="rgba(100, 116, 139, 0.75)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    fill="none"
                    markerEnd="url(#arrow)"
                  />
                );
              })}

              {nodes.map((n) => {
                const p = (layout as any)[n.id] as { x: number; y: number };
                return (
                  <g key={n.id} transform={`translate(${p.x}, ${p.y})`} filter="url(#shadow)">
                    <rect
                      x="0"
                      y="0"
                      width="120"
                      height="36"
                      rx="10"
                      fill="rgba(15, 23, 42, 0.9)"
                      stroke="rgba(255,255,255,0.12)"
                    />
                    <text
                      x="60"
                      y="22"
                      textAnchor="middle"
                      fontFamily="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
                      fontSize="11.5"
                      fill="rgba(255,255,255,0.9)"
                    >
                      {nodeById[n.id]?.label ?? n.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
