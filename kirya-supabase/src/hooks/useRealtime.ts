/**
 * useRealtime
 * ───────────
 * Supabase Realtime Broadcast replacement for socket.io.
 *
 * Supabase "Broadcast" sends ephemeral messages between clients via a named
 * channel — no database writes needed, just like socket.io events.
 *
 * Channel map (mirrors the old socket.io events exactly):
 *
 *   Channel "kirya:riders"
 *     event: rider_location   → { id, name, lat, lng, taskStatus }
 *     event: rider_status     → { riderId, status }
 *     event: rider_connect    → { riderId, name }
 *     event: rider_disconnect → { riderId }
 *
 *   Channel "kirya:orders"
 *     event: order_placed     → Order
 *     event: order_assigned   → { orderId, riderId }
 *     event: order_updated    → Order
 *
 *   Channel "kirya:chat"
 *     event: chat_message     → { orderId, role, text, ts }
 *
 * Usage:
 *   const { channel, connected } = useRealtime('kirya:riders');
 *   channel.send({ type: 'broadcast', event: 'rider_location', payload: { ... } });
 *   channel.on('broadcast', { event: 'rider_location' }, ({ payload }) => { ... });
 */

import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

// Keep one channel instance per name across re-renders
const _channels = new Map<string, RealtimeChannel>();

function getChannel(name: string): RealtimeChannel {
  if (!_channels.has(name)) {
    const ch = supabase.channel(name, {
      config: { broadcast: { self: true } },
    });
    _channels.set(name, ch);
    ch.subscribe();
  }
  return _channels.get(name)!;
}

export function useRealtime(channelName: string) {
  const channel = useRef<RealtimeChannel>(getChannel(channelName));
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ch = channel.current;

    // Re-subscribe and track status
    ch.subscribe(status => {
      setConnected(status === 'SUBSCRIBED');
    });

    return () => {
      // Don't unsubscribe the singleton — other components share it.
      // Supabase Realtime handles cleanup on page unload automatically.
    };
  }, [channelName]);

  return { channel: channel.current, connected };
}

// ─── Convenience: broadcast a typed event ─────────────────────────────────────
export function broadcast(channelName: string, event: string, payload: object) {
  const ch = getChannel(channelName);
  ch.send({ type: 'broadcast', event, payload });
}

// ─── Named channel constants (avoids typos) ───────────────────────────────────
export const CHANNELS = {
  RIDERS: 'kirya:riders',
  ORDERS: 'kirya:orders',
  CHAT:   'kirya:chat',
} as const;
