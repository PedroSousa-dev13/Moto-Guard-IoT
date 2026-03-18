import { describe, it, expect } from 'vitest';
import type {
  TelemetryData,
  IMUData,
  ActiveSafety,
  HealthData,
  LocationData,
  SystemData,
  TelemetryPayload,
  SimulatorCommand,
  BackendStatus,
} from '../backend/src/models/telemetry.model';

describe('Telemetry Models', () => {
  describe('TelemetryData', () => {
    it('deve aceitar dados de telemetria válidos', () => {
      const telemetryData: TelemetryData = {
        speed_kmh: 50.5,
        rpm: 3000,
        gear: 3,
        throttle_pct: 25.5,
        engine_temp_c: 85.5,
        voltage: 12.6,
        brake_front_pct: 0,
        brake_rear_pct: 10.5,
        odometer_km: 12345.6,
        clutch_engaged: true,
      };
      
      expect(telemetryData.speed_kmh).toBe(50.5);
      expect(telemetryData.rpm).toBe(3000);
      expect(telemetryData.gear).toBe(3);
      expect(telemetryData.throttle_pct).toBe(25.5);
      expect(telemetryData.engine_temp_c).toBe(85.5);
      expect(telemetryData.voltage).toBe(12.6);
      expect(telemetryData.brake_front_pct).toBe(0);
      expect(telemetryData.brake_rear_pct).toBe(10.5);
      expect(telemetryData.odometer_km).toBe(12345.6);
      expect(telemetryData.clutch_engaged).toBe(true);
    });

    it('deve aceitar valores zero e negativos', () => {
      const telemetryData: TelemetryData = {
        speed_kmh: 0,
        rpm: -100,
        gear: 0,
        throttle_pct: 0,
        engine_temp_c: -10,
        voltage: 0,
        brake_front_pct: 0,
        brake_rear_pct: 0,
        odometer_km: 0,
        clutch_engaged: false,
      };
      
      expect(telemetryData.speed_kmh).toBe(0);
      expect(telemetryData.rpm).toBe(-100);
      expect(telemetryData.gear).toBe(0);
      expect(telemetryData.engine_temp_c).toBe(-10);
      expect(telemetryData.clutch_engaged).toBe(false);
    });

    it('deve aceitar valores decimais precisos', () => {
      const telemetryData: TelemetryData = {
        speed_kmh: 123.456789,
        rpm: 1234.5678,
        gear: 1,
        throttle_pct: 99.999,
        engine_temp_c: 150.123,
        voltage: 14.4321,
        brake_front_pct: 50.5,
        brake_rear_pct: 75.25,
        odometer_km: 99999.999,
        clutch_engaged: true,
      };
      
      expect(telemetryData.speed_kmh).toBe(123.456789);
      expect(telemetryData.voltage).toBe(14.4321);
      expect(telemetryData.brake_front_pct).toBe(50.5);
    });
  });

  describe('IMUData', () => {
    it('deve aceitar dados IMU válidos', () => {
      const imuData: IMUData = {
        roll_deg: 15.5,
        pitch_deg: 2.5,
        yaw_deg: 180.0,
        g_force: 1.2,
      };
      
      expect(imuData.roll_deg).toBe(15.5);
      expect(imuData.pitch_deg).toBe(2.5);
      expect(imuData.yaw_deg).toBe(180.0);
      expect(imuData.g_force).toBe(1.2);
    });

    it('deve aceitar valores negativos e zero', () => {
      const imuData: IMUData = {
        roll_deg: -45.5,
        pitch_deg: -10.0,
        yaw_deg: 0,
        g_force: 0,
      };
      
      expect(imuData.roll_deg).toBe(-45.5);
      expect(imuData.pitch_deg).toBe(-10.0);
      expect(imuData.yaw_deg).toBe(0);
      expect(imuData.g_force).toBe(0);
    });

    it('deve aceitar valores de ângulo completos', () => {
      const imuData: IMUData = {
        roll_deg: 360,
        pitch_deg: -180,
        yaw_deg: 720,
        g_force: 2.5,
      };
      
      expect(imuData.roll_deg).toBe(360);
      expect(imuData.pitch_deg).toBe(-180);
      expect(imuData.yaw_deg).toBe(720);
      expect(imuData.g_force).toBe(2.5);
    });
  });

  describe('ActiveSafety', () => {
    it('deve aceitar dados de segurança ativa válidos', () => {
      const activeSafety: ActiveSafety = {
        abs_active: true,
        tc_active: false,
        side_stand_down: false,
      };
      
      expect(activeSafety.abs_active).toBe(true);
      expect(activeSafety.tc_active).toBe(false);
      expect(activeSafety.side_stand_down).toBe(false);
    });

    it('deve aceitar todos os valores booleanos', () => {
      const activeSafety: ActiveSafety = {
        abs_active: false,
        tc_active: true,
        side_stand_down: true,
      };
      
      expect(activeSafety.abs_active).toBe(false);
      expect(activeSafety.tc_active).toBe(true);
      expect(activeSafety.side_stand_down).toBe(true);
    });
  });

  describe('HealthData', () => {
    it('deve aceitar dados de saúde válidos', () => {
      const healthData: HealthData = {
        oil_pressure_bar: 2.5,
        tire_pressure_front_bar: 2.2,
        tire_pressure_rear_bar: 2.3,
      };
      
      expect(healthData.oil_pressure_bar).toBe(2.5);
      expect(healthData.tire_pressure_front_bar).toBe(2.2);
      expect(healthData.tire_pressure_rear_bar).toBe(2.3);
    });

    it('deve aceitar valores baixos e zero', () => {
      const healthData: HealthData = {
        oil_pressure_bar: 0.5,
        tire_pressure_front_bar: 1.0,
        tire_pressure_rear_bar: 0,
      };
      
      expect(healthData.oil_pressure_bar).toBe(0.5);
      expect(healthData.tire_pressure_front_bar).toBe(1.0);
      expect(healthData.tire_pressure_rear_bar).toBe(0);
    });

    it('deve aceitar valores altos', () => {
      const healthData: HealthData = {
        oil_pressure_bar: 10.0,
        tire_pressure_front_bar: 5.5,
        tire_pressure_rear_bar: 6.0,
      };
      
      expect(healthData.oil_pressure_bar).toBe(10.0);
      expect(healthData.tire_pressure_front_bar).toBe(5.5);
      expect(healthData.tire_pressure_rear_bar).toBe(6.0);
    });
  });

  describe('LocationData', () => {
    it('deve aceitar dados de localização válidos', () => {
      const locationData: LocationData = {
        latitude: 40.7128,
        longitude: -74.0060,
      };
      
      expect(locationData.latitude).toBe(40.7128);
      expect(locationData.longitude).toBe(-74.0060);
    });

    it('deve aceitar coordenadas globais', () => {
      const locationData: LocationData = {
        latitude: 90,
        longitude: 180,
      };
      
      expect(locationData.latitude).toBe(90);
      expect(locationData.longitude).toBe(180);
    });

    it('deve aceitar coordenadas negativas', () => {
      const locationData: LocationData = {
        latitude: -90,
        longitude: -180,
      };
      
      expect(locationData.latitude).toBe(-90);
      expect(locationData.longitude).toBe(-180);
    });

    it('deve aceitar coordenadas com alta precisão', () => {
      const locationData: LocationData = {
        latitude: 51.507351,
        longitude: -0.127758,
      };
      
      expect(locationData.latitude).toBe(51.507351);
      expect(locationData.longitude).toBe(-0.127758);
    });
  });

  describe('SystemData', () => {
    it('deve aceitar dados de sistema válidos', () => {
      const systemData: SystemData = {
        device_id: 'device-123456',
        moto_model: 'Honda CBR500R',
        event_status: 'normal',
        tick: 12345,
        timestamp: '2024-01-15T10:30:00.000Z',
      };
      
      expect(systemData.device_id).toBe('device-123456');
      expect(systemData.moto_model).toBe('Honda CBR500R');
      expect(systemData.event_status).toBe('normal');
      expect(systemData.tick).toBe(12345);
      expect(systemData.timestamp).toBe('2024-01-15T10:30:00.000Z');
    });

    it('deve aceitar diferentes formatos de timestamp', () => {
      const systemData1: SystemData = {
        device_id: 'device-1',
        moto_model: 'Yamaha MT-07',
        event_status: 'crash',
        tick: 1,
        timestamp: '2024-01-15T10:30:00Z',
      };
      
      const systemData2: SystemData = {
        device_id: 'device-2',
        moto_model: 'Kawasaki Ninja 400',
        event_status: 'overheat',
        tick: 999999,
        timestamp: '2024-12-31T23:59:59.999Z',
      };
      
      expect(systemData1.timestamp).toBe('2024-01-15T10:30:00Z');
      expect(systemData2.timestamp).toBe('2024-12-31T23:59:59.999Z');
    });

    it('deve aceitar diferentes status de evento', () => {
      const systemData: SystemData = {
        device_id: 'device-test',
        moto_model: 'BMW R1250GS',
        event_status: 'HARD_BRAKING',
        tick: 42,
        timestamp: new Date().toISOString(),
      };
      
      expect(systemData.event_status).toBe('HARD_BRAKING');
    });
  });

  describe('TelemetryPayload', () => {
    it('deve aceitar payload completo válido', () => {
      const payload: TelemetryPayload = {
        telemetry: {
          speed_kmh: 75.5,
          rpm: 4500,
          gear: 4,
          throttle_pct: 65.5,
          engine_temp_c: 92.5,
          voltage: 13.8,
          brake_front_pct: 20.5,
          brake_rear_pct: 15.0,
          odometer_km: 25000.5,
          clutch_engaged: false,
        },
        imu: {
          roll_deg: -12.5,
          pitch_deg: 5.5,
          yaw_deg: 225.0,
          g_force: 1.15,
        },
        active_safety: {
          abs_active: true,
          tc_active: false,
          side_stand_down: false,
        },
        health: {
          oil_pressure_bar: 3.2,
          tire_pressure_front_bar: 2.25,
          tire_pressure_rear_bar: 2.35,
        },
        location: {
          latitude: 38.7223,
          longitude: -9.1393,
        },
        system: {
          device_id: 'moto-device-001',
          moto_model: 'Honda Africa Twin',
          event_status: 'EXCESSIVE_LEAN',
          tick: 98765,
          timestamp: '2024-01-15T14:45:30.123Z',
        },
      };
      
      expect(payload.telemetry.speed_kmh).toBe(75.5);
      expect(payload.imu.roll_deg).toBe(-12.5);
      expect(payload.active_safety.abs_active).toBe(true);
      expect(payload.health.oil_pressure_bar).toBe(3.2);
      expect(payload.location.latitude).toBe(38.7223);
      expect(payload.system.event_status).toBe('EXCESSIVE_LEAN');
    });

    it('deve aceitar payload com valores mínimos', () => {
      const payload: TelemetryPayload = {
        telemetry: {
          speed_kmh: 0,
          rpm: 0,
          gear: 0,
          throttle_pct: 0,
          engine_temp_c: 0,
          voltage: 0,
          brake_front_pct: 0,
          brake_rear_pct: 0,
          odometer_km: 0,
          clutch_engaged: false,
        },
        imu: {
          roll_deg: 0,
          pitch_deg: 0,
          yaw_deg: 0,
          g_force: 0,
        },
        active_safety: {
          abs_active: false,
          tc_active: false,
          side_stand_down: false,
        },
        health: {
          oil_pressure_bar: 0,
          tire_pressure_front_bar: 0,
          tire_pressure_rear_bar: 0,
        },
        location: {
          latitude: 0,
          longitude: 0,
        },
        system: {
          device_id: 'min-device',
          moto_model: 'Minimal Model',
          event_status: 'NORMAL',
          tick: 0,
          timestamp: '1970-01-01T00:00:00.000Z',
        },
      };
      
      expect(payload.telemetry.speed_kmh).toBe(0);
      expect(payload.imu.g_force).toBe(0);
      expect(payload.system.tick).toBe(0);
    });
  });

  describe('SimulatorCommand', () => {
    it('deve aceitar comando básico', () => {
      const command: SimulatorCommand = {
        acao: 'start',
      };
      
      expect(command.acao).toBe('start');
      expect(command.modelo).toBeUndefined();
      expect(command.tipo).toBeUndefined();
    });

    it('deve aceitar comando com parâmetros opcionais', () => {
      const command: SimulatorCommand = {
        acao: 'set_speed',
        modelo: 'Honda',
        tipo: 'sport',
      };
      
      expect(command.acao).toBe('set_speed');
      expect(command.modelo).toBe('Honda');
      expect(command.tipo).toBe('sport');
    });

    it('deve aceitar diferentes ações', () => {
      const commands: SimulatorCommand[] = [
        { acao: 'stop' },
        { acao: 'pause' },
        { acao: 'resume' },
        { acao: 'reset' },
        { acao: 'emergency_stop' },
      ];
      
      expect(commands[0].acao).toBe('stop');
      expect(commands[1].acao).toBe('pause');
      expect(commands[2].acao).toBe('resume');
      expect(commands[3].acao).toBe('reset');
      expect(commands[4].acao).toBe('emergency_stop');
    });
  });

  describe('BackendStatus', () => {
    it('deve aceitar status básico do backend', () => {
      const status: BackendStatus = {
        mqttConnected: true,
        telemetryCount: 1234,
        hasData: true,
      };
      
      expect(status.mqttConnected).toBe(true);
      expect(status.telemetryCount).toBe(1234);
      expect(status.hasData).toBe(true);
    });

    it('deve aceitar status desconectado', () => {
      const status: BackendStatus = {
        mqttConnected: false,
        telemetryCount: 0,
        hasData: false,
      };
      
      expect(status.mqttConnected).toBe(false);
      expect(status.telemetryCount).toBe(0);
      expect(status.hasData).toBe(false);
    });

    it('deve aceitar alto contador de telemetria', () => {
      const status: BackendStatus = {
        mqttConnected: true,
        telemetryCount: 999999,
        hasData: true,
      };
      
      expect(status.telemetryCount).toBe(999999);
    });
  });

  describe('Type compatibility', () => {
    it('deve permitir atribuição entre tipos compatíveis', () => {
      const telemetryData: TelemetryData = {
        speed_kmh: 100,
        rpm: 5000,
        gear: 5,
        throttle_pct: 80,
        engine_temp_c: 100,
        voltage: 14.0,
        brake_front_pct: 30,
        brake_rear_pct: 20,
        odometer_km: 50000,
        clutch_engaged: true,
      };
      
      const imuData: IMUData = {
        roll_deg: 30,
        pitch_deg: 10,
        yaw_deg: 90,
        g_force: 1.5,
      };
      
      const payload: TelemetryPayload = {
        telemetry: telemetryData,
        imu: imuData,
        active_safety: {
          abs_active: true,
          tc_active: true,
          side_stand_down: false,
        },
        health: {
          oil_pressure_bar: 4.0,
          tire_pressure_front_bar: 2.5,
          tire_pressure_rear_bar: 2.8,
        },
        location: {
          latitude: 45.5231,
          longitude: -122.6765,
        },
        system: {
          device_id: 'test-device',
          moto_model: 'Test Model',
          event_status: 'NORMAL',
          tick: 12345,
          timestamp: new Date().toISOString(),
        },
      };
      
      expect(payload.telemetry).toBe(telemetryData);
      expect(payload.imu).toBe(imuData);
    });
  });
});