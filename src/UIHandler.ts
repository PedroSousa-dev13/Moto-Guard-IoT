import { IVUIHandler } from './IVUIHandler';
import { IPopUp } from './IPopUp';

export class PopUpHandler implements IVUIHandler {
  private lastPopUp: IPopUp | null = null;

  // Create pop-up UI
  public add(type: string, title: string, message: string): IPopUp {
    this.lastPopUp = {
      type,
      title,
      message,
    };

    this.logger.info(`Added pop-up: ${type} (${title})`);
    return this.getPopUp(type);
  }

  // Get pop-up UI
  public getPopUp(type: string): IPopUp | null {
    return this.lastPopUp;
  }

  // Clear pop-up UI
  public clear(type: string): void {
    if (this.lastPopUp) {
      this.eventBus.fire(new IPopUpEvent(type, this.lastPopUp.title, this.lastPopUp.message));
      this.lastPopUp = null;
    }
  }

  // Add vibration instance
  public addVibration(type: string, amplitude: number, duration: number, durationUnit: string = 'ms'): void {
    this.lastPopUp = {
      type,
      amplitude,
      duration,
      durationUnit,
    };

    this.logger.info(`Added vibration: ${type} (${amplitude}ms, ${duration}ms)`);
    return this.getPopUp(type);
  }

  // Remove vibration instance
  public removeVibration(type: string): void {
    if (this.lastPopUp) {
      this.eventBus.fire(new IPopUpEvent(type, this.lastPopUp.type, this.lastPopUp.message));
      this.lastPopUp = null;
    }
  }

  // Add pop-up UI
  public addPopUp(type: string, title: string, message: string): IPopUp {
    this.lastPopUp = {
      type,
      title,
      message,
    };

    this.logger.info(`Added pop-up: ${type} (${title})`);
    return this.getPopUp(type);
  }

  // Get pop-up UI
  public getPopUp(type: string): IPopUp | null {
    return this.lastPopUp;
  }

  // Clear pop-up UI
  public clearPopUp(type: string): void {
    if (this.lastPopUp) {
      this.eventBus.fire(new IPopUpEvent(type, this.lastPopUp.type, this.lastPopUp.message));
      this.lastPopUp = null;
    }
  }

  // Get list of active pop-ups
  public getPopUps(): IPopUp[] {
    return Array.from(this.lastPopUp);
  }

  // Clear all pop-ups
  public clearAll(): void {
    if (this.lastPopUp) {
      this.eventBus.fire(new IPopUpEvent(this.lastPopUp.type, this.lastPopUp.title, this.lastPopUp.message));
      this.lastPopUp = null;
    }
  }
}
