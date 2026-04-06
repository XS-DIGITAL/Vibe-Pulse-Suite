-- Vibe Pulse Suite Database Update v3
-- Update users table to support roles
-- Update posts table to support real performance metrics

ALTER TABLE users 
ADD COLUMN role ENUM('user', 'admin') DEFAULT 'user';

-- Set the first user as admin (if you know the ID)
-- UPDATE users SET role = 'admin' WHERE id = 1;

ALTER TABLE posts 
ADD COLUMN impressions INT DEFAULT 0,
ADD COLUMN engagements INT DEFAULT 0,
ADD COLUMN clicks INT DEFAULT 0;

-- Note: In MongoDB, Mongoose handles these fields automatically based on the updated schema in server.ts.
-- This SQL script is provided for reference or for use in SQL-based environments.
