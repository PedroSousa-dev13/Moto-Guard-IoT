#!/usr/bin/env python3
# =============================================================================
# MotoGuard IoT — Teste do Broker MQTT Local (Mosquitto)
# =============================================================================
# Testa:
#   1. Conexão autenticada (utilizadores motoguard, simulator, backend)
#   2. Rejeição de credenciais inválidas
#   3. Rejeição de conexão anónima
#   4. Publicação + receção (pub/sub)
#   5. Cross-user: simulator publica -> backend recebe
# =============================================================================

import paho.mqtt.client as mqtt
import time
import sys
import json
from datetime import datetime

BROKER = "localhost"
PORT = 1883
TIMEOUT = 3  # segundos de espera por teste


def rc_ok(rc) -> bool:
    """Verifica se o código de retorno indica sucesso (compatível com v1 e v2)."""
    if isinstance(rc, int):
        return rc == 0
    # paho-mqtt v2: ReasonCode object
    return rc == 0 or str(rc) == "Success"


def rc_str(rc) -> str:
    """Representa o código de retorno como string."""
    if isinstance(rc, int):
        codes = {0: "OK", 1: "Bad protocol", 2: "Client ID rejected",
                 3: "Server unavailable", 4: "Bad credentials", 5: "Not authorized"}
        return codes.get(rc, f"Unknown ({rc})")
    return str(rc)


def test_connection(user, password, client_id, expect_success=True):
    """Testa conexão com credenciais."""
    result = {"connected": False, "rc": None}

    def on_connect(client, userdata, flags, rc, props=None):
        result["rc"] = rc
        result["connected"] = rc_ok(rc)

    c = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=client_id)
    c.username_pw_set(user, password)
    c.on_connect = on_connect

    try:
        c.connect(BROKER, PORT, 60)
        c.loop_start()
        time.sleep(TIMEOUT)
        c.loop_stop()
        c.disconnect()
    except Exception as e:
        result["error"] = str(e)

    success = result["connected"] == expect_success
    return success, result


def test_pubsub(user, password, topic):
    """Testa publicação e receção numa mesma sessão."""
    result = {"published": False, "received": False, "payload": None}

    def on_connect(client, userdata, flags, rc, props=None):
        if rc_ok(rc):
            client.subscribe(topic, qos=1)

    def on_message(client, userdata, msg):
        result["received"] = True
        result["payload"] = msg.payload.decode()

    def on_publish(client, userdata, mid, rc=None, props=None):
        result["published"] = True

    c = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="test-pubsub")
    c.username_pw_set(user, password)
    c.on_connect = on_connect
    c.on_message = on_message
    c.on_publish = on_publish

    test_payload = json.dumps({"test": True, "ts": datetime.now().isoformat()})

    try:
        c.connect(BROKER, PORT, 60)
        c.loop_start()
        time.sleep(1)  # esperar subscribe
        c.publish(topic, test_payload, qos=1)
        time.sleep(TIMEOUT)
        c.loop_stop()
        c.disconnect()
    except Exception as e:
        result["error"] = str(e)

    return result["published"] and result["received"], result


def run_tests():
    print("=" * 60)
    print("  MotoGuard IoT — Teste do Broker MQTT (Mosquitto)")
    print(f"  Broker: {BROKER}:{PORT}")
    print(f"  Data: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    print()

    passed = 0
    failed = 0
    total = 0

    def report(name, ok, detail=""):
        nonlocal passed, failed, total
        total += 1
        status = "PASS" if ok else "FAIL"
        icon = "+" if ok else "X"
        if ok:
            passed += 1
        else:
            failed += 1
        print(f"  [{icon}] {status} -- {name}")
        if detail:
            print(f"         {detail}")

    # --- Autenticacao ---
    print("--- Autenticacao ------------------------------------------------")
    ok, res = test_connection("motoguard", "motoguard123", "t1-motoguard")
    report("Utilizador 'motoguard' conecta OK", ok, f"rc={rc_str(res['rc'])}")

    ok, res = test_connection("simulator", "simulator123", "t2-simulator")
    report("Utilizador 'simulator' conecta OK", ok, f"rc={rc_str(res['rc'])}")

    ok, res = test_connection("backend", "backend123", "t3-backend")
    report("Utilizador 'backend' conecta OK", ok, f"rc={rc_str(res['rc'])}")

    ok, res = test_connection("hacker", "wrong", "t4-hacker", expect_success=False)
    report("Credenciais invalidas rejeitadas", ok, f"rc={rc_str(res['rc'])}")

    # Sem credenciais
    result_anon = {"connected": False, "rc": None}
    def on_conn_anon(client, userdata, flags, rc, props=None):
        result_anon["rc"] = rc
        result_anon["connected"] = rc_ok(rc)
    c5 = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="t5-anon")
    c5.on_connect = on_conn_anon
    try:
        c5.connect(BROKER, PORT, 60)
        c5.loop_start()
        time.sleep(TIMEOUT)
        c5.loop_stop()
        c5.disconnect()
    except:
        pass
    report("Conexao anonima rejeitada", not result_anon["connected"],
           f"rc={rc_str(result_anon['rc'])}")

    print()

    # --- Pub/Sub ---
    print("--- Publicacao / Subscricao -------------------------------------")
    ok, res = test_pubsub("motoguard", "motoguard123", "motoguard/telemetria")
    report("motoguard pub+sub em motoguard/telemetria", ok,
           f"pub={res['published']}, recv={res['received']}")

    # --- Cross-user: simulator publica -> backend recebe ---
    cross_result = {"received": False}

    def on_conn_sub(client, userdata, flags, rc, props=None):
        if rc_ok(rc):
            client.subscribe("motoguard/telemetria", qos=1)

    def on_msg_sub(client, userdata, msg):
        cross_result["received"] = True
        cross_result["payload"] = msg.payload.decode()

    # Subscritor (backend)
    sub = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="t7-backend-sub")
    sub.username_pw_set("backend", "backend123")
    sub.on_connect = on_conn_sub
    sub.on_message = on_msg_sub
    sub.connect(BROKER, PORT, 60)
    sub.loop_start()
    time.sleep(1)

    # Publicador (simulator)
    pub = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="t7-sim-pub")
    pub.username_pw_set("simulator", "simulator123")
    pub.connect(BROKER, PORT, 60)
    pub.loop_start()
    time.sleep(0.5)
    payload = json.dumps({"source": "simulator", "ts": datetime.now().isoformat()})
    pub.publish("motoguard/telemetria", payload, qos=1)
    time.sleep(TIMEOUT)

    pub.loop_stop()
    pub.disconnect()
    sub.loop_stop()
    sub.disconnect()

    report("simulator publica -> backend recebe (cross-user)", cross_result["received"])

    print()

    # --- Resumo ---
    print("=" * 60)
    if failed == 0:
        print(f"  RESULTADO: {passed}/{total} testes passaram -- Tudo OK!")
    else:
        print(f"  RESULTADO: {passed}/{total} passaram, {failed} falharam")
    print("=" * 60)

    return failed == 0


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
