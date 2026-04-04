import { IVibration } from './I振动Handler';

export class VibrationHandler implements IVibration {
  private lastVibration: {
    type: string;
    amplitude: number;
    duration: number;
    durationUnit: string;
  } | null = null;

  // Create vibration instance
  public add(type: string, amplitude: number, duration: number, durationUnit: string = 'ms'): void {
    this.lastVibration = {
      type,
      amplitude,
      duration,
      durationUnit,
    };
    this.logger.info(`Added vibration instance: ${type} (${amplitude}ms, ${duration}ms)`);
  }

  // Remove vibration instance
  public remove(type: string): void {
    if (this.lastVibration) {
      this.eventBus.fire(new VibrationEvent(type, this.lastVibration.amplitude, this.lastVibration.duration));
      this.lastVibration = null;
    }
  }

  // Get vibration history
  public getVibrationHistory(limit: number = 10): {
    id: string;
    timestamp: number;
    message: string;
    type: string;
  }[] {
    if (this.lastVibration === null || limit <= 0) {
      return [];
    }

    const history: {
      id: string;
      timestamp: number;
      message: string;
      type: string;
    }[] = [];
    for (let i = this.lastVibration.duration - limit; i >= 0; i -= limit) {
      const data = this.getVibrationData(i);
      history.push(data);
    }

    return history;
  }

  // Get vibration at specific timestamp
  public getVibrationAt(timestamp: number): {
    type: string;
    amplitude: number;
    duration: number;
  } | null {
    if (this.lastVibration === null || timestamp < this.lastVibration.timestamp) {
      return null;
    }

    const data = this.getVibrationData(this.lastVibration.timestamp - timestamp);
    return data;
  }

  // Get vibration details
  public getVibrationDetails(timestamp: number): {
    id: string;
    type: string;
    amplitude: number;
    duration: number;
    durationUnit: string;
    timestamp: number;
    isCurrent: boolean;
  } | null {
    if (this.lastVibration === null) {
      return null;
    }

    const data = this.getVibrationData(this.lastVibration.timestamp - timestamp);
    const isCurrent = timestamp === data.timestamp;
    return {
      id: data.id || `vibration-${Date.now()}`,
      type: data.type,
      amplitude: data.amplitude,
      duration: data.duration,
      durationUnit: data.durationUnit,
      timestamp: data.timestamp,
      isCurrent,
    };
  }

  // Add vibration with metadata
  public async addWithMetadata(messageId: string, message: string): Promise<void> {
    this.add(messageId, message.length, 100, 'ms');

    await this.eventBus.fire(new VibrationEvent(messageId, 0, 100));

    this.logger.info(`Added vibration for message ${messageId} with text: "${message}"`);
  }

  private getVibrationData(timestamp: number): {
    id: string;
    type: string;
    amplitude: number;
    duration: number;
    durationUnit: string;
    timestamp: number;
  } | null {
    if (this.lastVibration === null || timestamp < this.lastVibration.timestamp) {
      return null;
    }

    const data = this.getVibrationHistoryData(timestamp);
    return {
      id: data.id || `vibration-${Date.now()}`,
      type: data.type,
      amplitude: data.amplitude,
      duration: data.duration,
      durationUnit: data.durationUnit,
      timestamp: data.timestamp,
    };
  }

  private getVibrationHistoryData(timestamp: number): {
    id: string;
    type: string;
    amplitude: number;
    duration: number;
    durationUnit: string;
    timestamp: number;
  }[] {
    if (this.lastVibration === null || timestamp < this.lastVibration.timestamp) {
      return [];
    }

    const history: {
      id: string;
      timestamp: number;
      message: string;
      type: string;
    }[] = [];
    const offset = this.lastVibration.timestamp - timestamp;
    const historySize = this.vibrationHistory.length - offset;

    for (let i = 0; i < historySize; i++) {
      history.push({
        id: this.lastVibration.timestamp - offset + i,
        timestamp: this.lastVibration.timestamp,
        message: this.lastVibration.type,
        type: this.lastVibration.type,
      });
    }

    return history;
  }

  private log(level: string, message: string): void {
    if (level === 'info') return;
    this._createLogger().error({
      message,
    });
  }
}
