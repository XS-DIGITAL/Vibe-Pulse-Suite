-- Vibe Pulse Suite Database Update
-- Added MongoDB integration notes and additional fields for real features

-- No changes needed to the existing schema for now, but ensure these tables exist:
-- users, social_accounts, posts, post_platforms

-- If you need to track AI usage:
CREATE TABLE IF NOT EXISTS ai_usage (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    prompt TEXT,
    response TEXT,
    tokens_used INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
