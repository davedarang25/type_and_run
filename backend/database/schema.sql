-- =============================================================================
-- Type-to-Run · MySQL 8.0.16+ / MariaDB 10.4+ schema (the 10 tables from the spec)
-- =============================================================================
-- Run with: npm run db:reset   (drops and recreates everything, then loads seed.sql)
-- Notes:
--   * users.password stores a bcrypt hash (never plaintext); the API hashes it.
--   * haunted_places.is_unlocked = unlocked for every new player (starter maps).
--     Per-player unlocks are rows in user_place_progress; clearing a place
--     unlocks the next place_id.
--   * CHECK constraints are enforced on MySQL 8.0.16+ and MariaDB 10.2+.
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS user_inventory, user_place_progress, place_item_spawns, ghost_required_items,
  place_ghosts, items, haunted_places, ghost_type, word_bank, users;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. USERS --------------------------------------------------------------------
CREATE TABLE users (
  user_id                   INT          NOT NULL AUTO_INCREMENT,
  username                  VARCHAR(40)  NOT NULL,
  email                     VARCHAR(255) NOT NULL,
  password                  VARCHAR(255) NOT NULL COMMENT 'bcrypt hash',
  created_at                DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total_playtime            INT          NOT NULL DEFAULT 0 COMMENT 'seconds',
  total_locations_completed INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id),
  UNIQUE KEY users_email_uq (email),
  CONSTRAINT users_playtime_ck CHECK (total_playtime >= 0),
  CONSTRAINT users_completed_ck CHECK (total_locations_completed >= 0)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- 2. WORD_BANK ----------------------------------------------------------------
CREATE TABLE word_bank (
  word_id     INT         NOT NULL AUTO_INCREMENT,
  word        VARCHAR(60) NOT NULL,
  action_type VARCHAR(20) NOT NULL,
  difficulty  VARCHAR(10) NOT NULL,
  time_limit  INT         NOT NULL COMMENT 'seconds',
  PRIMARY KEY (word_id),
  UNIQUE KEY word_bank_word_action_uq (word, action_type),
  KEY word_bank_lookup_idx (action_type, difficulty),
  CONSTRAINT word_bank_action_ck CHECK (action_type IN ('movement', 'hide', 'interact', 'exorcise')),
  CONSTRAINT word_bank_difficulty_ck CHECK (difficulty IN ('easy', 'medium', 'hard')),
  CONSTRAINT word_bank_time_ck CHECK (time_limit BETWEEN 1 AND 60)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- 3. GHOST_TYPE ---------------------------------------------------------------
CREATE TABLE ghost_type (
  ghost_id       INT         NOT NULL AUTO_INCREMENT,
  ghost_name     VARCHAR(60) NOT NULL,
  description    TEXT,
  behavior       VARCHAR(20) NOT NULL,
  hostility      VARCHAR(10) NOT NULL,
  movement_speed INT         NOT NULL,
  weakness       TEXT,
  PRIMARY KEY (ghost_id),
  UNIQUE KEY ghost_type_name_uq (ghost_name),
  CONSTRAINT ghost_type_behavior_ck CHECK (behavior IN ('stalker', 'aggressive', 'patrol')),
  CONSTRAINT ghost_type_hostility_ck CHECK (hostility IN ('low', 'medium', 'high', 'extreme')),
  CONSTRAINT ghost_type_speed_ck CHECK (movement_speed BETWEEN 1 AND 10)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- 4. HAUNTED_PLACES -----------------------------------------------------------
CREATE TABLE haunted_places (
  place_id    INT         NOT NULL AUTO_INCREMENT,
  place_name  VARCHAR(80) NOT NULL,
  description TEXT,
  difficulty  VARCHAR(10) NOT NULL,
  atmosphere  VARCHAR(40),
  is_unlocked BOOLEAN     NOT NULL DEFAULT FALSE,
  PRIMARY KEY (place_id),
  UNIQUE KEY haunted_places_name_uq (place_name),
  CONSTRAINT haunted_places_difficulty_ck CHECK (difficulty IN ('easy', 'medium', 'hard'))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- 5. ITEMS --------------------------------------------------------------------
CREATE TABLE items (
  item_id     INT         NOT NULL AUTO_INCREMENT,
  item_name   VARCHAR(60) NOT NULL,
  description TEXT,
  item_type   VARCHAR(20) NOT NULL,
  PRIMARY KEY (item_id),
  UNIQUE KEY items_name_uq (item_name),
  CONSTRAINT items_type_ck CHECK (item_type IN ('ritual_salt', 'relic', 'candle', 'talisman'))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- 6. PLACE_GHOSTS  (GHOST_TYPE appears_in HAUNTED_PLACES) ---------------------
CREATE TABLE place_ghosts (
  place_ghost_id INT     NOT NULL AUTO_INCREMENT,
  place_id       INT     NOT NULL,
  ghost_id       INT     NOT NULL,
  spawn_chance   INT     NOT NULL COMMENT '% per room explored',
  is_boss        BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (place_ghost_id),
  UNIQUE KEY place_ghosts_pair_uq (place_id, ghost_id),
  KEY place_ghosts_ghost_idx (ghost_id),
  CONSTRAINT place_ghosts_place_fk FOREIGN KEY (place_id) REFERENCES haunted_places (place_id) ON DELETE CASCADE,
  CONSTRAINT place_ghosts_ghost_fk FOREIGN KEY (ghost_id) REFERENCES ghost_type (ghost_id) ON DELETE CASCADE,
  CONSTRAINT place_ghosts_chance_ck CHECK (spawn_chance BETWEEN 0 AND 100)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- 7. GHOST_REQUIRED_ITEMS  (GHOST_TYPE requires ITEMS) ------------------------
CREATE TABLE ghost_required_items (
  requirement_id    INT NOT NULL AUTO_INCREMENT,
  ghost_id          INT NOT NULL,
  item_id           INT NOT NULL,
  quantity_required INT NOT NULL,
  PRIMARY KEY (requirement_id),
  UNIQUE KEY ghost_required_items_pair_uq (ghost_id, item_id),
  KEY ghost_required_items_item_idx (item_id),
  CONSTRAINT gri_ghost_fk FOREIGN KEY (ghost_id) REFERENCES ghost_type (ghost_id) ON DELETE CASCADE,
  CONSTRAINT gri_item_fk FOREIGN KEY (item_id) REFERENCES items (item_id) ON DELETE RESTRICT,
  CONSTRAINT gri_quantity_ck CHECK (quantity_required > 0)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- 8. PLACE_ITEM_SPAWNS  (HAUNTED_PLACES spawns ITEMS) -------------------------
CREATE TABLE place_item_spawns (
  spawn_id           INT         NOT NULL AUTO_INCREMENT,
  place_id           INT         NOT NULL,
  item_id            INT         NOT NULL,
  spawn_location     VARCHAR(80) NOT NULL,
  quantity_available INT         NOT NULL,
  PRIMARY KEY (spawn_id),
  KEY place_item_spawns_place_idx (place_id),
  KEY place_item_spawns_item_idx (item_id),
  CONSTRAINT pis_place_fk FOREIGN KEY (place_id) REFERENCES haunted_places (place_id) ON DELETE CASCADE,
  CONSTRAINT pis_item_fk FOREIGN KEY (item_id) REFERENCES items (item_id) ON DELETE RESTRICT,
  CONSTRAINT pis_quantity_ck CHECK (quantity_available > 0)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- 9. USER_PLACE_PROGRESS  (USERS tracks HAUNTED_PLACES) -----------------------
CREATE TABLE user_place_progress (
  progress_id           INT          NOT NULL AUTO_INCREMENT,
  user_id               INT          NOT NULL,
  place_id              INT          NOT NULL,
  status                VARCHAR(12)  NOT NULL DEFAULT 'unlocked',
  exploration_completed BOOLEAN      NOT NULL DEFAULT FALSE,
  ritual_completed      BOOLEAN      NOT NULL DEFAULT FALSE,
  best_wpm              DECIMAL(6,2) NULL,
  best_accuracy         DECIMAL(5,2) NULL,
  PRIMARY KEY (progress_id),
  UNIQUE KEY upp_user_place_uq (user_id, place_id),
  KEY upp_place_idx (place_id),
  CONSTRAINT upp_user_fk FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
  CONSTRAINT upp_place_fk FOREIGN KEY (place_id) REFERENCES haunted_places (place_id) ON DELETE CASCADE,
  CONSTRAINT upp_status_ck CHECK (status IN ('unlocked', 'in_progress', 'cleared')),
  CONSTRAINT upp_wpm_ck CHECK (best_wpm >= 0),
  CONSTRAINT upp_accuracy_ck CHECK (best_accuracy BETWEEN 0 AND 100)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- 10. USER_INVENTORY  (USERS owns ITEMS) --------------------------------------
CREATE TABLE user_inventory (
  inventory_id INT NOT NULL AUTO_INCREMENT,
  user_id      INT NOT NULL,
  item_id      INT NOT NULL,
  quantity     INT NOT NULL,
  PRIMARY KEY (inventory_id),
  UNIQUE KEY user_inventory_pair_uq (user_id, item_id),
  KEY user_inventory_item_idx (item_id),
  CONSTRAINT ui_user_fk FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
  CONSTRAINT ui_item_fk FOREIGN KEY (item_id) REFERENCES items (item_id) ON DELETE RESTRICT,
  CONSTRAINT ui_quantity_ck CHECK (quantity >= 0)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
