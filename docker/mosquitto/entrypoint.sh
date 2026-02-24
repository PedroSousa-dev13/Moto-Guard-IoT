#!/bin/sh
# =============================================================================
# MotoGuard IoT — Mosquitto Entrypoint
# =============================================================================
# Gera o ficheiro de passwords na primeira execução e arranca o broker.
# Utiliza variáveis de ambiente para configurar utilizadores MQTT.
# =============================================================================

PASSWORD_FILE="/mosquitto/config/password.txt"

# ─── Gerar ficheiro de passwords se não existir ─────────────────────────────
if [ ! -f "$PASSWORD_FILE" ]; then
    echo "[MotoGuard] A criar ficheiro de passwords MQTT..."

    # Utilizador principal (simulador + backend partilham)
    MQTT_USER="${MQTT_USER:-motoguard}"
    MQTT_PASS="${MQTT_PASS:-motoguard123}"
    mosquitto_passwd -c -b "$PASSWORD_FILE" "$MQTT_USER" "$MQTT_PASS"
    echo "[MotoGuard]   → Utilizador '$MQTT_USER' criado"

    # Utilizador dedicado ao simulador (opcional)
    MQTT_SIM_USER="${MQTT_SIM_USER:-simulator}"
    MQTT_SIM_PASS="${MQTT_SIM_PASS:-simulator123}"
    mosquitto_passwd -b "$PASSWORD_FILE" "$MQTT_SIM_USER" "$MQTT_SIM_PASS"
    echo "[MotoGuard]   → Utilizador '$MQTT_SIM_USER' criado"

    # Utilizador dedicado ao backend (opcional)
    MQTT_BACK_USER="${MQTT_BACK_USER:-backend}"
    MQTT_BACK_PASS="${MQTT_BACK_PASS:-backend123}"
    mosquitto_passwd -b "$PASSWORD_FILE" "$MQTT_BACK_USER" "$MQTT_BACK_PASS"
    echo "[MotoGuard]   → Utilizador '$MQTT_BACK_USER' criado"

    echo "[MotoGuard] Ficheiro de passwords criado com sucesso."
else
    echo "[MotoGuard] Ficheiro de passwords já existe — a reutilizar."
fi

# ─── Garantir permissões corretas ───────────────────────────────────────────
chown mosquitto:mosquitto "$PASSWORD_FILE" 2>/dev/null || true
chmod 600 "$PASSWORD_FILE"

# ─── Arrancar Mosquitto ─────────────────────────────────────────────────────
echo "[MotoGuard] A arrancar Eclipse Mosquitto..."
exec /usr/sbin/mosquitto -c /mosquitto/config/mosquitto.conf
