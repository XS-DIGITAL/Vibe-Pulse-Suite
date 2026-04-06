-- Vibe Pulse Suite Database Schema
-- Generated for LookoutPost

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS social_accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    platform VARCHAR(20) NOT NULL, -- 'linkedin', 'x', 'facebook'
    platform_user_id VARCHAR(100),
    access_token TEXT,
    refresh_token TEXT,
    connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    content TEXT NOT NULL,
    media_url VARCHAR(255),
    status ENUM('draft', 'scheduled', 'published', 'failed') DEFAULT 'draft',
    scheduled_at DATETIME,
    published_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS post_platforms (
    post_id INT NOT NULL,
    platform_id INT NOT NULL,
    PRIMARY KEY (post_id, platform_id),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (platform_id) REFERENCES social_accounts(id) ON DELETE CASCADE
);
