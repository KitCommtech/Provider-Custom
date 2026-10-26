-- Additive migration only. No credential or existing user-table changes.
CREATE TABLE IF NOT EXISTS pc_admin_audit (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 operator_name VARCHAR(128) NOT NULL,
 action VARCHAR(64) NOT NULL,
 username VARCHAR(128) NOT NULL DEFAULT '',
 session_id VARCHAR(128) NOT NULL DEFAULT '',
 status VARCHAR(32) NOT NULL,
 detail TEXT NOT NULL,
 INDEX(created_at), INDEX(username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS pc_user_access (
 username VARCHAR(128) NOT NULL PRIMARY KEY,
 auth_snapshot TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
