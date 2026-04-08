import { z } from 'zod';

// ── Zod schemas for API boundaries ──────────────────────────────────────────

export const GameSettingsSchema = z.object({
  startingChips: z.number().int().min(100).max(1_000_000),
  smallBlind: z.number().int().min(1),
  bigBlind: z.number().int().min(2),
  maxRaises: z.number().int().min(0),
  ante: z.number().int().min(0),
  turnTimerSeconds: z.number().int().min(0).max(300),
  maxPlayers: z.number().int().min(2).max(9),
  allowBuyBack: z.boolean(),
  buyBackAmount: z.number().int().min(0),
});

export const CreateTableSchema = z.object({
  settings: GameSettingsSchema,
  hostName: z
    .string()
    .min(1, 'Name is required')
    .max(20, 'Name too long')
    .regex(/^[a-zA-Z0-9 _-]+$/, 'Invalid characters in name'),
});

export const JoinTableSchema = z.object({
  tableId: z.string().length(6),
  playerName: z
    .string()
    .min(1, 'Name is required')
    .max(20, 'Name too long')
    .regex(/^[a-zA-Z0-9 _-]+$/, 'Invalid characters in name'),
});

export const PlayerActionSchema = z.object({
  tableId: z.string().length(6),
  playerId: z.string().uuid(),
  action: z.object({
    type: z.enum(['fold', 'check', 'call', 'raise', 'allIn']),
    playerId: z.string().uuid(),
    amount: z.number().int().min(0).optional(),
    timestamp: z.number(),
  }),
});

export const StartGameSchema = z.object({
  tableId: z.string().length(6),
  playerId: z.string().uuid(),
});

export const BuyBackSchema = z.object({
  tableId: z.string().length(6),
  playerId: z.string().uuid(),
});

export const KickPlayerSchema = z.object({
  tableId: z.string().length(6),
  hostId: z.string().uuid(),
  targetPlayerId: z.string().uuid(),
});

// ── API response shapes ─────────────────────────────────────────────────────

export interface CreateTableResponse {
  tableId: string;
}

export interface JoinTableResponse {
  playerId: string;
}

export interface ActionError {
  error: string;
  code: string;
}
