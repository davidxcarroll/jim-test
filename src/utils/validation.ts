import { z } from 'zod'

// User registration schema
export const userRegistrationSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  displayName: z.string().min(2, 'Display name must be at least 2 characters'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

// User login schema
export const userLoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

// Game pick schema
export const gamePickSchema = z.object({
  gameId: z.string().min(1, 'Game is required'),
  pickedTeamId: z.string().min(1, 'Team selection is required'),
  confidence: z.number().min(1).max(10, 'Confidence must be between 1 and 10'),
})

// Email subscription schema
export const emailSubscriptionSchema = z.object({
  email: z.string().email('Invalid email address'),
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  preferences: z.object({
    gameReminders: z.boolean().default(true),
    pickReminders: z.boolean().default(true),
    analytics: z.boolean().default(false),
  }),
})

// ESPN API response schemas
export const teamSchema = z.object({
  id: z.string(),
  name: z.string(),
  abbreviation: z.string(),
  city: z.string(),
  division: z.string(),
  league: z.string(),
  logo: z.string().optional(),
})

export const gameSchema = z.object({
  id: z.string(),
  date: z.string(),
  homeTeam: teamSchema,
  awayTeam: teamSchema,
  homeScore: z.number().optional(),
  awayScore: z.number().optional(),
  status: z.enum(['scheduled', 'live', 'final']),
  inning: z.number().optional(),
  topInning: z.boolean().optional(),
  venue: z.string().optional(),
  startTime: z.string().optional(),
})

export type UserRegistration = z.infer<typeof userRegistrationSchema>
export type UserLogin = z.infer<typeof userLoginSchema>
export type GamePick = z.infer<typeof gamePickSchema>
export type EmailSubscription = z.infer<typeof emailSubscriptionSchema>
export type Team = z.infer<typeof teamSchema>
export type Game = z.infer<typeof gameSchema> 