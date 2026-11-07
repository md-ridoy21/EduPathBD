import type { Response } from "express";

type ChannelClient = { response: Response; heartbeat: NodeJS.Timeout };
const channels = new Map<string, Set<ChannelClient>>();

export function subscribeToChannel(channel: string, response: Response) {
  response.status(200);
  response.setHeader("Content-Type", "text/event-stream");
  response.setHeader("Cache-Control", "no-cache, no-transform");
  response.setHeader("Connection", "keep-alive");
  response.flushHeaders();
  response.write(`event: connected\ndata: ${JSON.stringify({ channel })}\n\n`);

  const heartbeat = setInterval(() => response.write(": keep-alive\n\n"), 25_000);
  const client = { response, heartbeat };
  const clients = channels.get(channel) ?? new Set<ChannelClient>();
  clients.add(client);
  channels.set(channel, clients);

  response.on("close", () => {
    clearInterval(heartbeat);
    clients.delete(client);
    if (!clients.size) channels.delete(channel);
  });
}

export function publishToChannel(channel: string, event: string, payload: unknown) {
  const encoded = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of channels.get(channel) ?? []) client.response.write(encoded);
}
