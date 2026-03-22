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
