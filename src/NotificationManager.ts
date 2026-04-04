import { IWebSocketHandler } from './IWebSocketHandler';
import { IWebSocketMessage } from './IWebSocketMessage';
import { WebSocketServer } from './WebSocketServer';
import { App } from './App';
import { EventBus } from './EventBus';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'critical' | 'info' | 'success' | 'warning';
}

interface Vibration {
  id: string;
  type: 'left' | 'center' | 'right' | 'low' | 'high';
  amplitude: number;
  duration: number;
  durationUnit: string;
}

interface PopUp {
  id: string;
  title: string;
  message: string;
  type: string;
}

interface VibrationEvent {
  id: string;
  timestamp: number;
  message: string;
  type: string;
  amplitude: number;
  duration: number;
  durationUnit: string;
}

interface PopUpEvent {
  id: string;
  timestamp: number;
  message: string;
  type: string;
}

export class NotificationManager {
  private readonly eventBus: EventBus = new EventBus();
  private readonly notificationId: string = 'notify-' + Date.now();
  private notifications: Map<string, Notification> = new Map();
  private vibrationInstances: Map<string, Vibration> = new Map();
  private popUps: Map<string, PopUp> = new Map();

  public addNotification(id: string, title: string, message: string, type: Notification['type'] = 'info'): Notification {
    this.notifications.set(id, {
      id,
      title,
      message,
      type,
    });
    this.eventBus.fire(new NotificationEvent(id, title, message, type));
    return this.getNotification(id);
  }

  public removeNotification(id: string): void {
    if (this.notifications.has(id)) {
      this.notifications.delete(id);
    }
  }

  private getNotification(id: string): Notification | null {
    return this.notifications.get(id);
  }

  public on(message: IWebSocketMessage): void {
    if (message.type === 'notification') {
      const id = message.id;
      const title = message.title;
      const messageText = message.text;
      const type = message.type;

      if (this.notifications.has(id)) {
        this.eventBus.fire(new NotificationEvent(id, title, messageText, type));
      }
    }
  }

  public notify(message: IWebSocketMessage): void {
    if (message.type === 'notification') {
      const id = message.id;
      const title = message.title;
      const messageText = message.text;
      const type = message.type;

      if (this.notifications.has(id)) {
        this.eventBus.fire(new NotificationEvent(id, title, messageText, type));
      }
    }
  }

  // Get list of active notifications
  public getNotifications(): Notification[] {
    return Array.from(this.notifications.values());
  }

  // Clear all notifications
  public clearNotifications(): void {
    this.notifications.clear();
  }

  // Add vibration instance
  public addVibration(type: string, amplitude: number, duration: number, durationUnit: string = 'ms'): void {
    if (type !== 'left' && type !== 'center' && type !== 'right') {
      return;
    }

    if (this.vibrationInstances.has(type)) {
      this.logger.warn(`Already adding vibration instance for ${type}`);
      return;
    }

    const vibration: Vibration = {
      id: type,
      type,
      amplitude,
      duration,
      durationUnit,
    };

    this.vibrationInstances.set(type, vibration);
    this.eventBus.fire(new VibrationEvent(type, amplitude, duration));
  }

  // Remove vibration instance
  public removeVibration(type: string): void {
    if (this.vibrationInstances.has(type)) {
      this.vibrationInstances.delete(type);
      this.eventBus.fire(new VibrationEvent(type, 0, 0));
    }
  }

  // Add pop-up UI
  public addPopUp(id: string, title: string, message: string, type: string): PopUp {
    this.popUps.set(id, {
      id,
      title,
      message,
      type,
    });
    return this.getPopUp(id);
  }

  public getPopUp(id: string): PopUp | null {
    return this.popUps.get(id);
  }

  public on(message: IWebSocketMessage): void {
    if (message.type === 'popUp') {
      const id = message.id;
      const title = message.title;
      const messageText = message.text;
      const type = message.type;

      if (this.popUps.has(id)) {
        this.eventBus.fire(new PopUpEvent(id, title, messageText, type));
      }
    }
  }

  public notify(message: IWebSocketMessage): void {
    if (message.type === 'popUp') {
      const id = message.id;
      const title = message.title;
      const messageText = message.text;
      const type = message.type;

      if (this.popUps.has(id)) {
        this.eventBus.fire(new PopUpEvent(id, title, messageText, type));
      }
    }
  }

  // Get list of active pop-ups
  public getPopUps(): PopUp[] {
    return Array.from(this.popUps.values());
  }

  // Clear all pop-ups
  public clearPopUps(): void {
    this.popUps.clear();
  }
}

export class RealTimeWebSocketHandler implements IWebSocketHandler {
  private ws: WebSocket;
  private notificationManager: NotificationManager = new NotificationManager();
  private activeNotifications: Map<string, Notification> = new Map();
  private notificationsToSend: Map<string, string> = new Map();
  private lastMessageId: string = '';

  constructor(ws: WebSocket) {
    this.ws = ws;
    const channel = new EventChannel();
    channel.onmessage = (e: MessageEvent) => {
      if (e.data instanceof NotificationEvent) {
        this.onNotification(e.data.id, e.data.title, e.data.text, e.data.type);
      }
    };
    channel.onmessage = (e: MessageEvent) => {
      this.onNotification(e.data.id, e.data.title, e.data.text, e.data.type);
    };
    this.eventBus.register(channel as EventChannel, true);
    this.lastMessageId = channel.messageId;
  }

  async connect(url: string): Promise<void> {
    const ws = new WebSocket(url);
    if (!ws.connecting) ws.close(101, 'Connection error');
    else {
      ws.onopen = () => {
        this.startNotifications();
        this.activeNotifications.clear();
      };
      ws.onmessage = (e: MessageEvent) => this.onMessage(e.data as NotificationEvent);
      ws.onerror = (err) => {
        this.logger.error('WebSocket error', err);
      };
    }
  }

  // Add notification via URL
  public async addNotification(url: string, message: IWebSocketMessage): Promise<void> {
    const id = this.notificationId;
    const title = message.title || 'Unknown';
    const messageText = message.text || '';
    const type = message.type || 'info';

    const notification = this.addNotification(id, title, messageText, type);

    await ws.send(JSON.stringify({
      id,
      title,
      messageText,
      type,
    } as IWebSocketMessage));

    this.notificationsToSend.set(id, message.text);

    if (!ws.connected) {
      this.logger.info(`Added notification ${id}: ${message.text}`);
    }
  }

  // Remove notification via URL
  public async removeNotification(url: string): Promise<void> {
    const id = this.notificationId;

    const response = await ws.send(JSON.stringify({
      id,
    } as IWebSocketMessage));

    if (!response.startsWith('ok')) {
      this.logger.error('Failed to remove notification', { id });
      return;
    }

    this.removeNotification(id);
    this.eventBus.fire(new NotificationEvent(id, null, null, 'info'));
  }

  // Send notifications
  public async sendNotifications() {
    if (this.notificationsToSend.size === 0) {
      this.logger.info('No notifications to send');
      return;
    }

    const messages: IWebSocketMessage[] = [];

    for (const [id, messageText] of this.notificationsToSend.entries()) {
      const title = this.notificationManager.getNotification(id)?.title || 'Unknown';
      const messageText = this.notificationManager.getNotification(id)?.message || '';

      const notification = this.notificationManager.getNotification(id);
      const titleText = notification?.title || title;
      const messageTextText = notification?.message || messageText;
      const type = notification?.type || 'info';

      messages.push({
        id,
        title: titleText,
        text: messageTextText,
        type,
      });
    }

    for (const message of messages) {
      await this.ws.send(JSON.stringify({
        id: message.id,
        title: message.title,
        text: message.text,
        type: message.type,
      } as IWebSocketMessage));

      this.lastMessageId = message.id;
      this.eventBus.fire(new NotificationEvent(message.id, message.title, message.text, message.type));
    }

    this.logger.info(`Sent ${messages.length} notifications`);
  }

  // Start notifications
  private async startNotifications(): Promise<void> {
    const startUrl = process.env.NOTIFY_START_URL || 'ws://localhost:3000';

    if (!startUrl || !this.ws?.connected) {
      this.logger.error('Failed to start notifications');
      return;
    }

    await this.ws.open();
    await this.ws.send(JSON.stringify({
      id: this.notificationId,
      type: 'start',
      start: Date.now(),
    } as IWebSocketMessage));
    await new Promise((resolve, reject) =>
      this.ws.onmessage((e: MessageEvent) => {
        if (e.data && e.data.status === 'start') {
          resolve();
        } else if (e.data && e.data.status === 'error') {
          reject(e.data.error);
        }
      }) as Promise<void>);
  }

  // Stop notifications
  public async stopNotifications(): Promise<void> {
    const stopUrl = process.env.NOTIFY_STOP_URL || 'ws://localhost:3000';

    if (!stopUrl || !this.ws?.connected) {
      this.logger.info('Failed to stop notifications');
      return;
    }

    await this.ws.send(JSON.stringify({
      id: this.notificationId,
      type: 'stop',
      stop: Date.now(),
    } as IWebSocketMessage));

    this.notificationsToSend.clear();
    this.logger.info(`Stopped notification ID: ${this.notificationId}`);
  }

  // Clear notifications
  public async clearNotifications(): Promise<void> {
    if (this.notificationsToSend.size === 0) {
      this.logger.info('No notifications to clear');
      return;
    }

    for (const [id, messageText] of this.notificationsToSend.entries()) {
      await this.ws.send(JSON.stringify({
        id,
      } as IWebSocketMessage));
      this.notificationsToSend.delete(id);
    }

    this.logger.info(`Cleared notifications ${this.notificationsToSend.size}`);
  }

  private onMessage(message: NotificationEvent): void {
    const id = message.id;

    if (this.activeNotifications.has(id)) {
      const notification = this.activeNotifications.get(id);
      this.notificationManager.sendNotification(
        message,
        notification,
        this.lastMessageId
      );
    }

    this.lastMessageId = message.id;
    this.eventBus.fire(new NotificationEvent(message.id, message.title, message.text, message.type));

    if (id === this.notificationId && message.type === 'stop') {
      this.stopNotifications();
    }
  }

  private onNotification(id: string, title: string, text: string, type: string): void {
    this.activeNotifications.set(id, {
      id,
      title,
      text,
      type,
    });
    this.eventBus.fire(new NotificationEvent(id, title, text, type));
  }

  private onNotificationEvent(id: string, title: string, text: string, type: string): void {
    const id = message.id;

    if (this.activeNotifications.has(id)) {
      this.notificationManager.sendNotification(
        message,
        this.activeNotifications.get(id)!,
        this.lastMessageId
      );
    }
  }

  private logger: LogEntryLogger = this._createLogger();

  private _createLogger(): LogEntryLogger {
    const console = new console();

    console.on('error', (err) => {
      const id = this.lastMessageId;
      this.logger.error({
        id,
        message: err.message,
        type: this.lastMessageId,
      });
    });

    console.on('info', (msg) => {
      const id = this.lastMessageId;
      this.logger.info({
        id,
        message: msg,
        type: this.lastMessageId,
      });
    });

    console.on('error', (err) => {
      this.logger.error({
        message: err.message,
      });
    });
    return console;
  }

  private log(level: string, message: string): void {
    if (level === 'info') return;
    this._createLogger().error({
      message,
    });
  }
}
