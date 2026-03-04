import { Response } from 'express';

export interface CheckEvent {
  serviceId: string;
  status: string;
  responseTime: number | null;
  errorMessage: string | null;
  checkedAt: string;
}

/**
 * Simple SSE broadcast bus for real-time check result updates.
 * Clients connect via GET /api/checks/events and receive newline-delimited JSON.
 */
class CheckEventBus {
  private clients: Set<Response> = new Set();

  addClient(res: Response): void {
    this.clients.add(res);
  }

  removeClient(res: Response): void {
    this.clients.delete(res);
  }

  broadcast(event: CheckEvent): void {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of this.clients) {
      try {
        client.write(data);
      } catch (_) {
        this.clients.delete(client);
      }
    }
  }
}

export const checkEventBus = new CheckEventBus();
