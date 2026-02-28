# =============================================================================
# MotoGuard IoT — Mosquitto Dockerfile
# =============================================================================
# Imagem base do Eclipse Mosquitto 2.x com entrypoint customizado
# que gera automaticamente o ficheiro de passwords na primeira execução.
# =============================================================================

FROM eclipse-mosquitto:2

# Copiar configuração e entrypoint
COPY config/mosquitto.conf /mosquitto/config/mosquitto.conf
COPY config/acl.conf       /mosquitto/config/acl.conf
COPY entrypoint.sh         /entrypoint.sh

# Converter line endings CRLF→LF e tornar executável
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

# Criar diretórios necessários com permissões corretas
RUN mkdir -p /mosquitto/data /mosquitto/log && \
    chown -R mosquitto:mosquitto /mosquitto

# Expor portas MQTT e WebSocket
EXPOSE 1883 9001

ENTRYPOINT ["/entrypoint.sh"]
