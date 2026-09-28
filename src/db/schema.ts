import { pgTable, serial, text, timestamp, real, integer, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table linked to Firebase Auth UID
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Podcast projects table
export const podcasts = pgTable('podcasts', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  language: text('language').notNull().default('fa'),
  sourceText: text('source_text').notNull(),
  voices: jsonb('voices').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Podcast rendered episodes table
export const episodes = pgTable('episodes', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  podcastId: integer('podcast_id').references(() => podcasts.id),
  title: text('title').notNull(),
  durationSec: real('duration_sec').notNull().default(0.0),
  audioUrl: text('audio_url'),
  driveFileId: text('drive_file_id'),
  script: jsonb('script').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Transcriptions table
export const transcriptions = pgTable('transcriptions', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  filename: text('filename').notNull(),
  transcriptText: text('transcript_text').notNull(),
  language: text('language').notNull().default('auto'),
  durationSec: real('duration_sec').notNull().default(0.0),
  createdAt: timestamp('created_at').defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  podcasts: many(podcasts),
  episodes: many(episodes),
  transcriptions: many(transcriptions),
}));
