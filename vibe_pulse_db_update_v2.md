-- Vibe Pulse Suite Database Update v2
-- Update social_accounts table to support OAuth tokens and expiry
-- Add posts table for scheduling and history

ALTER TABLE social_accounts 
ADD COLUMN access_token TEXT,
ADD COLUMN refresh_token TEXT,
ADD COLUMN expires_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    content TEXT NOT NULL,
    platforms JSON NOT NULL,
    status ENUM('draft', 'scheduled', 'published', 'failed') DEFAULT 'draft',
    scheduled_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INT NOT NULL
);

-- Note: In MongoDB, Mongoose handles these fields automatically based on the updated schema in server.ts.
-- This SQL script is provided for reference or for use in SQL-based environments.
