import { Peer, DataConnection } from 'peerjs';
import { NetworkMessage } from '../types';
import { DEFAULT_ICE_SERVERS, PLAYER_COLORS } from '../constants';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
export type MessageCallback = (message: NetworkMessage) => void;
export type StatusCallback = (status: ConnectionStatus) => void;
export type PlayerListCallback = (players: PlayerInfo[]) => void;

export interface PlayerInfo {
  id: string;
  name: string;
  color: string;
}

const MAX_PLAYERS = 4; // Максимум 4 игрока (хост + 3 гостя)

export class WebRTCManager {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private isHost: boolean;
  private localPlayerId: string;
  private localPlayerName: string;
  private messageCallbacks: MessageCallback[] = [];
  private statusCallbacks: StatusCallback[] = [];
  private playerListCallbacks: PlayerListCallback[] = [];
  private currentStatus: ConnectionStatus = 'disconnected';
  private hostPeerId: string | null = null; // ID хоста (для гостей)
  private connectedPlayers: Map<string, PlayerInfo> = new Map();
  private isInitialized: boolean = false; // Защита от множественной инициализации

  constructor(isHost: boolean, localPlayerId: string, playerName: string = 'Player') {
    this.isHost = isHost;
    this.localPlayerId = localPlayerId;
    this.localPlayerName = playerName;
  }

  // Инициализация хоста
  async initAsHost(): Promise<string> {
    if (this.isInitialized) {
      console.log('[WebRTCManager] Already initialized as host');
      return this.getInviteLink(this.hostPeerId || '');
    }
    this.isInitialized = true;
    this.setStatus('connecting');
    console.log('[WebRTCManager] Initializing as host...');

    // Закрываем предыдущий peer если есть
    if (this.peer) {
      this.peer.destroy();
    }

    // Создаём уникальный ID для комнаты
    const roomId = this.generateRoomId();
    console.log('[WebRTCManager] Generated room ID:', roomId);

    this.peer = new Peer(roomId, {
      debug: 1 // Включаем debug для более подробных логов
    });

    return new Promise((resolve, reject) => {
      if (!this.peer) return;

      // Таймаут инициализации
      const timeout = setTimeout(() => {
        console.error('[WebRTCManager] Host initialization timeout');
        this.setStatus('error');
        reject(new Error('Host initialization timeout'));
      }, 15000);

      this.peer.on('open', (id) => {
        clearTimeout(timeout);
        console.log('[WebRTCManager] Host peer opened with ID:', id);
        this.hostPeerId = id;
        this.localPlayerId = id; // Обновляем localPlayerId на реальный peer ID

        // Добавляем хоста в список игроков
        this.addPlayer(this.localPlayerId, this.localPlayerName, PLAYER_COLORS[0]);
        console.log('[WebRTCManager] Host added to player list');

        // Хост принимает входящие соединения
        this.peer.on('connection', (conn) => {
          console.log('[WebRTCManager] Host received connection event from:', conn.peer);
          this.handleIncomingConnection(conn);
        });

        console.log('[WebRTCManager] Host ready, invite link:', this.getInviteLink(id));
        resolve(this.getInviteLink(id));
      });

      this.peer.on('error', (err) => {
        clearTimeout(timeout);
        console.error('[WebRTCManager] Peer error:', err);
        console.error('[WebRTCManager] Error type:', err.type);
        this.setStatus('error');
        reject(err);
      });
    });
  }

  // Инициализация гостя через PeerJS
  async joinAsGuest(hostPeerId: string): Promise<void> {
    if (this.isInitialized) {
      console.log('[WebRTCManager] Already initialized, skipping joinAsGuest');
      return;
    }
    this.isInitialized = true;
    this.setStatus('connecting');
    this.hostPeerId = hostPeerId;

    console.log('[WebRTCManager] Guest joining room:', hostPeerId);

    // Закрываем предыдущий peer если есть
    if (this.peer) {
      this.peer.destroy();
    }

    // Создаём peer для гостя
    this.peer = new Peer(undefined, {
      debug: 1 // Включаем debug для более подробных логов
    });

    return new Promise((resolve, reject) => {
      if (!this.peer) return;

      // Таймаут подключения
      const timeout = setTimeout(() => {
        console.error('[WebRTCManager] Connection timeout - peer did not open in 15 seconds');
        this.setStatus('error');
        reject(new Error('Connection timeout'));
      }, 15000);

      this.peer.on('open', (id) => {
        clearTimeout(timeout);
        console.log('[WebRTCManager] Guest peer opened with ID:', id);
        console.log('[WebRTCManager] Attempting to connect to host:', hostPeerId);

        // Обновляем localPlayerId на реальный peer ID
        this.localPlayerId = id;

        // Подключаемся к хосту
        const conn = this.peer!.connect(hostPeerId, {
          reliable: false,
          serialization: 'json'
        });

        if (!conn) {
          console.error('[WebRTCManager] Failed to create connection to host');
          this.setStatus('error');
          reject(new Error('Failed to create connection'));
          return;
        }

        console.log('[WebRTCManager] Connection object created, peer:', conn.peer, 'connection type:', conn.serialization);

        // Логируем события соединения для отладки
        conn.on('open', () => {
          console.log('[WebRTCManager] Connection OPEN event fired for host:', hostPeerId);
        });

        conn.on('error', (err) => {
          console.error('[WebRTCManager] Connection ERROR event:', err);
        });

        conn.on('close', () => {
          console.log('[WebRTCManager] Connection CLOSE event fired');
        });

        this.setupConnection(conn);
      });

      this.peer.on('error', (err) => {
        clearTimeout(timeout);
        console.error('[WebRTCManager] Peer error:', err);
        console.error('[WebRTCManager] Error type:', err.type);
        console.error('[WebRTCManager] Error message:', err.message);
        this.setStatus('error');
        reject(err);
      });

      // Резолвим когда подключимся
      const onStatusChange = (status: ConnectionStatus) => {
        console.log('[WebRTCManager] Status change:', status);
        if (status === 'connected') {
          this.offStatusChange(onStatusChange);
          resolve();
        } else if (status === 'error') {
          this.offStatusChange(onStatusChange);
          reject(new Error('Connection failed'));
        }
      };
      this.onStatusChange(onStatusChange);
    });
  }

  // Обработка входящего соединения (на стороне хоста)
  private handleIncomingConnection(conn: DataConnection): void {
    const peerId = conn.peer;

    console.log('[WebRTCManager] Incoming connection from:', peerId);
    console.log('[WebRTCManager] Current players:', this.connectedPlayers.size, '/', MAX_PLAYERS);

    // Проверяем лимит игроков
    if (this.connectedPlayers.size >= MAX_PLAYERS) {
      console.log('[WebRTCManager] Room full, rejecting connection from:', peerId);
      conn.close();
      return;
    }

    // Логируем события соединения для отладки
    conn.on('error', (err) => {
      console.error('[WebRTCManager] Incoming connection error from', peerId, err);
    });

    this.setupConnection(conn);
  }

  // Настройка соединения
  private setupConnection(conn: DataConnection): void {
    const peerId = conn.peer;
    console.log('[WebRTCManager] Setting up connection with peer:', peerId, 'isHost:', this.isHost);

    conn.on('open', () => {
      console.log('[WebRTCManager] Connection opened with:', peerId, 'isHost:', this.isHost);
      this.connections.set(peerId, conn);
      console.log('[WebRTCManager] Total connections:', this.connections.size);

      if (this.isHost) {
        // Добавляем гостя в список игроков на стороне хоста
        const guestIndex = this.connectedPlayers.size;
        const guestName = `Player ${guestIndex + 1}`;
        const guestColor = PLAYER_COLORS[guestIndex % PLAYER_COLORS.length];

        console.log('[WebRTCManager] Host: Adding guest', guestName, 'with color', guestColor);
        this.addPlayer(peerId, guestName, guestColor);

        // Хост отправляет список игроков новому подключившемуся
        console.log('[WebRTCManager] Host: Sending GAME_STATE to new guest');
        this.sendToPeer(peerId, {
          type: 'GAME_STATE',
          playerId: this.localPlayerId,
          data: {
            players: Array.from(this.connectedPlayers.values())
          },
          timestamp: Date.now()
        });

        // Хост рассылает всем о новом игроке
        console.log('[WebRTCManager] Host: Broadcasting PLAYER_JOINED to all');
        this.broadcast({
          type: 'PLAYER_JOINED',
          playerId: this.localPlayerId,
          data: {
            id: peerId,
            name: guestName,
            color: guestColor
          },
          timestamp: Date.now()
        });
      } else {
        // Гость отправляет своё имя хосту при подключении
        console.log('[WebRTCManager] Guest: Sending PLAYER_NAME_CHANGE to host');
        this.sendToPeer(this.hostPeerId!, {
          type: 'PLAYER_NAME_CHANGE',
          playerId: this.localPlayerId,
          data: { id: this.localPlayerId, name: this.localPlayerName },
          timestamp: Date.now()
        });
      }

      console.log('[WebRTCManager] Updating connection status...');
      this.updateConnectionStatus();
      console.log('[WebRTCManager] New status:', this.currentStatus);
    });

    conn.on('data', (data) => {
      try {
        const message: NetworkMessage = data as NetworkMessage;
        this.handleMessage(message, peerId);
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    });

    conn.on('close', () => {
      console.log('Connection closed with:', peerId);
      this.connections.delete(peerId);
      this.connectedPlayers.delete(peerId);

      // Уведомляем об отключении игрока
      this.notifyMessageListeners({
        type: 'PLAYER_DISCONNECTED',
        playerId: peerId,
        data: { id: peerId },
        timestamp: Date.now()
      });

      this.updateConnectionStatus();
    });

    conn.on('error', (err) => {
      console.error('Connection error with', peerId, err);
    });
  }

  // Обработка входящего сообщения
  private handleMessage(message: NetworkMessage, peerId: string): void {
    console.log('[WebRTCManager] Message received:', message.type, 'from:', peerId, 'isHost:', this.isHost);
    switch (message.type) {
      case 'PLAYER_JOINED':
        // Добавляем нового игрока в список
        if (message.data && message.data.id && message.data.name) {
          this.addPlayer(message.data.id, message.data.name, message.data.color);
        }
        // Рассылаем всем остальным (если мы хост)
        if (this.isHost) {
          this.broadcastToOthers(peerId, message);
        }
        break;

      case 'GAME_STATE':
        // Получили состояние игры от хоста
        if (message.data && message.data.players) {
          message.data.players.forEach((player: PlayerInfo) => {
            if (player.id !== this.localPlayerId) {
              this.connectedPlayers.set(player.id, player);
            }
          });
          this.notifyPlayerListListeners();
        }
        break;

      case 'PAUSE_TOGGLE':
        // Рассылаем всем (только хост инициирует)
        if (this.isHost) {
          this.broadcastToOthers(peerId, message);
        }
        break;

      case 'PLAYER_NAME_CHANGE':
        // Обновляем имя игрока в списке
        if (message.data && message.data.id && message.data.name) {
          const existingPlayer = this.connectedPlayers.get(message.data.id);
          if (existingPlayer) {
            this.connectedPlayers.set(message.data.id, {
              ...existingPlayer,
              name: message.data.name
            });
            this.notifyPlayerListListeners();
          }
        }
        // Рассылаем всем остальным (если мы хост)
        if (this.isHost) {
          this.broadcastToOthers(peerId, message);
        }
        break;

      case 'GAME_START':
        console.log('[WebRTCManager] GAME_START received, isHost:', this.isHost, 'localPlayerId:', this.localPlayerId);
        // Хост рассылает сигнал о начале игры всем
        if (this.isHost) {
          console.log('[WebRTCManager] Host broadcasting GAME_START to others');
          this.broadcastToOthers(peerId, message);
        }
        // Уведомляем локальных слушателей (для всех)
        console.log('[WebRTCManager] Notifying local listeners about GAME_START');
        this.notifyMessageListeners(message);
        break;

      default:
        // Рассылаем игровые сообщения всем
        if (this.isHost) {
          this.broadcastToOthers(peerId, message);
        }
        break;
    }

    // Уведомляем локальных слушателей (кроме GAME_START, который уже обработан)
    if (message.type !== 'GAME_START') {
      this.notifyMessageListeners(message);
    }
  }

  // Добавить игрока в список
  private addPlayer(id: string, name: string, color: string): void {
    this.connectedPlayers.set(id, { id, name, color });
    this.notifyPlayerListListeners();
  }

  // Обновить статус подключения
  private updateConnectionStatus(): void {
    const hasConnections = this.connections.size > 0;
    const status = hasConnections ? 'connected' :
                   (this.peer && this.peer.open) ? 'connecting' : 'disconnected';
    this.setStatus(status);
  }

  // Отправить сообщение конкретному пиру
  private sendToPeer(peerId: string, message: NetworkMessage): void {
    const conn = this.connections.get(peerId);
    if (conn) {
      if (conn.open) {
        conn.send(message);
      } else {
        console.warn('[WebRTCManager] Cannot send to', peerId, '- connection not open. State:', conn.connectionState, 'peer connection:', conn.peerConnection?.iceConnectionState);
      }
    } else {
      console.warn('[WebRTCManager] Cannot send to', peerId, '- no connection found. Available:', Array.from(this.connections.keys()));
    }
  }

  // Отправить сообщение всем подключённым
  broadcast(message: NetworkMessage): void {
    console.log('[WebRTCManager] Broadcasting', message.type, 'to', this.connections.size, 'connections');
    this.connections.forEach((conn) => {
      if (conn.open) {
        conn.send(message);
      } else {
        console.warn('[WebRTCManager] Cannot send to peer - connection not open:', conn.peer);
      }
    });
  }

  // Отправить всем кроме указанного
  private broadcastToOthers(excludePeerId: string, message: NetworkMessage): void {
    console.log('[WebRTCManager] Broadcasting to others (excluding', excludePeerId + ')');
    this.connections.forEach((conn, peerId) => {
      if (peerId !== excludePeerId && conn.open) {
        conn.send(message);
      }
    });
  }

  // Отправить сообщение (для локальной игры)
  send(message: NetworkMessage): void {
    console.log('[WebRTCManager] Sending', message.type, 'isHost:', this.isHost, 'hostPeerId:', this.hostPeerId);
    // В режиме хоста рассылаем всем
    if (this.isHost) {
      this.broadcast(message);
    } else if (this.hostPeerId) {
      // Гость отправляет только хосту
      this.sendToPeer(this.hostPeerId, message);
    } else {
      console.warn('[WebRTCManager] Cannot send - not host and no hostPeerId');
    }
  }

  // Подписаться на сообщения
  onMessage(callback: MessageCallback): void {
    this.messageCallbacks.push(callback);
  }

  // Отписаться от сообщений
  offMessage(callback: MessageCallback): void {
    this.messageCallbacks = this.messageCallbacks.filter(cb => cb !== callback);
  }

  // Подписаться на изменения статуса
  onStatusChange(callback: StatusCallback): void {
    this.statusCallbacks.push(callback);
    callback(this.currentStatus);
  }

  offStatusChange(callback: StatusCallback): void {
    this.statusCallbacks = this.statusCallbacks.filter(cb => cb !== callback);
  }

  // Подписаться на изменения списка игроков
  onPlayerListChange(callback: PlayerListCallback): void {
    this.playerListCallbacks.push(callback);
    callback(Array.from(this.connectedPlayers.values()));
  }

  // Установить статус
  private setStatus(status: ConnectionStatus): void {
    this.currentStatus = status;
    this.statusCallbacks.forEach(cb => cb(status));
  }

  // Уведомить слушателей о сообщении
  private notifyMessageListeners(message: NetworkMessage): void {
    this.messageCallbacks.forEach(cb => cb(message));
  }

  // Уведомить слушателей о списке игроков
  private notifyPlayerListListeners(): void {
    const players = Array.from(this.connectedPlayers.values());
    this.playerListCallbacks.forEach(cb => cb(players));
  }

  // Получить текущий статус
  getStatus(): ConnectionStatus {
    return this.currentStatus;
  }

  // Получить список подключённых игроков
  getConnectedPlayers(): PlayerInfo[] {
    return Array.from(this.connectedPlayers.values());
  }

  // Получить количество подключённых игроков
  getPlayerCount(): number {
    return this.connectedPlayers.size;
  }

  // Можно ли подключить ещё игроков
  canAcceptMorePlayers(): boolean {
    return this.connectedPlayers.size < MAX_PLAYERS;
  }

  // Ссылка-приглашение
  private getInviteLink(hostId: string): string {
    const url = new URL(window.location.href);
    url.searchParams.set('room', hostId);
    return url.toString();
  }

  // Парсинг room ID из URL
  static getRoomIdFromURL(): string | null {
    const url = new URL(window.location.href);
    return url.searchParams.get('room');
  }

  // Очистить URL от параметра room
  static clearRoomFromURL(): void {
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState({}, '', url.toString());
  }

  // Генерация ID комнаты
  private generateRoomId(): string {
    return `robo_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Получить ID хоста
  getHostPeerId(): string | null {
    return this.hostPeerId;
  }

  // Обновить имя локального игрока
  setPlayerName(name: string): void {
    this.localPlayerName = name;

    // Обновляем в списке
    if (this.connectedPlayers.has(this.localPlayerId)) {
      this.connectedPlayers.set(this.localPlayerId, {
        id: this.localPlayerId,
        name,
        color: PLAYER_COLORS[0]
      });
      this.notifyPlayerListListeners();
    }

    // Отправляем всем о смене имени
    if (this.isHost) {
      this.broadcast({
        type: 'PLAYER_NAME_CHANGE',
        playerId: this.localPlayerId,
        data: { id: this.localPlayerId, name },
        timestamp: Date.now()
      });
    } else {
      this.send({
        type: 'PLAYER_NAME_CHANGE',
        playerId: this.localPlayerId,
        data: { id: this.localPlayerId, name },
        timestamp: Date.now()
      });
    }
  }

  // Получить имя локального игрока
  getLocalPlayerName(): string {
    return this.localPlayerName;
  }

  // Получить реальный peer ID
  getPeerId(): string {
    return this.localPlayerId;
  }

  // Закрыть соединение
  close(): void {
    this.connections.forEach((conn) => conn.close());
    this.connections.clear();

    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    this.connectedPlayers.clear();
    this.isInitialized = false;
    this.setStatus('disconnected');
  }

  // Проверить, подключен ли
  isConnected(): boolean {
    return this.currentStatus === 'connected' && this.connections.size > 0;
  }

  // Проверить, является ли хостом
  isHostMode(): boolean {
    return this.isHost;
  }
}

// Утилита для генерации ID игрока
export function generatePlayerId(): string {
  return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
