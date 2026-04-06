-- Vibe Pulse Suite Database Update
-- Created for LookoutPost to switch to the 'vibe_pulse' database

-- SQL Update:
CREATE DATABASE IF NOT EXISTS vibe_pulse;
USE vibe_pulse;

-- MongoDB Update:
-- The application (server.ts) has been updated to use the 'vibe-pulse' database.
-- Mongoose will automatically create the database upon the first write operation.
