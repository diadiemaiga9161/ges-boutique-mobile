import { Injectable, OnDestroy } from '@angular/core';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import * as SockJS from 'sockjs-client';
import { Subject, BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';

export type WsTopicEvent = {
  type: string;
  timestamp: string;
  data: any;
};

export type WsStatus = 'connecting' | 'connected' | 'disconnected';

@Injectable({ providedIn: 'root' })
export class WebSocketService implements OnDestroy {

  private client: Client;
  private subscriptions: Map<string, StompSubscription> = new Map();

  // État de connexion observable
  private statusSubject = new BehaviorSubject<WsStatus>('disconnected');
  status$ = this.statusSubject.asObservable();

  // Sujets par topic
  private subjects: Map<string, Subject<WsTopicEvent>> = new Map();

  private wsUrl = `${window.location.origin}/ws`;

  constructor() {
    this.client = new Client({
      webSocketFactory: () => new SockJS(this.wsUrl.startsWith('http')
        ? this.wsUrl
        : `${window.location.origin}${this.wsUrl}`
      ),
      reconnectDelay: 3000,
      onConnect: () => {
        this.statusSubject.next('connected');
        this.resubscribeAll();
      },
      onDisconnect: () => {
        this.statusSubject.next('disconnected');
      },
      onStompError: () => {
        this.statusSubject.next('disconnected');
      }
    });
  }

  connect(): void {
    if (!this.client.active) {
      this.statusSubject.next('connecting');
      this.client.activate();
    }
  }

  disconnect(): void {
    this.client.deactivate();
    this.statusSubject.next('disconnected');
  }

  isConnected(): boolean {
    return this.statusSubject.value === 'connected';
  }

  /**
   * S'abonner à un topic STOMP.
   * Retourne un Subject qui émet les événements reçus.
   * Utilisez .subscribe() sur le Subject retourné dans votre composant.
   */
  subscribeTopic(topic: string): Subject<WsTopicEvent> {
    if (!this.subjects.has(topic)) {
      this.subjects.set(topic, new Subject<WsTopicEvent>());
    }

    if (this.client.active && this.client.connected && !this.subscriptions.has(topic)) {
      this.doSubscribe(topic);
    }

    return this.subjects.get(topic)!;
  }

  unsubscribeTopic(topic: string): void {
    const sub = this.subscriptions.get(topic);
    if (sub) {
      sub.unsubscribe();
      this.subscriptions.delete(topic);
    }
  }

  private doSubscribe(topic: string): void {
    const sub = this.client.subscribe(topic, (message: IMessage) => {
      try {
        const event: WsTopicEvent = JSON.parse(message.body);
        this.subjects.get(topic)?.next(event);
      } catch {
        // message non JSON, ignorer
      }
    });
    this.subscriptions.set(topic, sub);
  }

  private resubscribeAll(): void {
    this.subscriptions.clear();
    this.subjects.forEach((_, topic) => this.doSubscribe(topic));
  }

  ngOnDestroy(): void {
    this.disconnect();
    this.subjects.forEach(s => s.complete());
  }
}
