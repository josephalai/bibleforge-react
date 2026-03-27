-- BibleForge Database Initialization
-- This script creates the table structure for the BibleForge database.
-- For full Bible data, import the SQL dumps from https://github.com/bibleforge/BibleForgeDB

CREATE TABLE IF NOT EXISTS `bible_en` (
  `id` int NOT NULL,
  `book` tinyint NOT NULL,
  `chapter` smallint NOT NULL,
  `verse` smallint NOT NULL,
  `words` text NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_book_chapter` (`book`, `chapter`),
  FULLTEXT KEY `idx_words` (`words`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `display_name` VARCHAR(100),
  `avatar_url` VARCHAR(500),
  `provider` ENUM('local', 'google', 'github') DEFAULT 'local',
  `provider_id` VARCHAR(255),
  `email_verified` BOOLEAN DEFAULT FALSE,
  `verification_token` VARCHAR(255),
  `reset_token` VARCHAR(255),
  `reset_token_expires` DATETIME,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_email` (`email`),
  KEY `idx_provider` (`provider`, `provider_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
