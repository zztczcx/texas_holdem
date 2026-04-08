/**
 * Shared Zod validation helpers for Server Actions and API routes.
 * All input validation at the network boundary goes through these schemas.
 */
export {
  GameSettingsSchema,
  CreateTableSchema,
  JoinTableSchema,
  PlayerActionSchema,
  StartGameSchema,
  BuyBackSchema,
  KickPlayerSchema,
} from '../../types/api';
