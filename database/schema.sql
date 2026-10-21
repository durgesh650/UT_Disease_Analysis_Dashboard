CREATE DATABASE IF NOT EXISTS ut_disease_db;
USE ut_disease_db;
CREATE TABLE IF NOT EXISTS disease_cases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  union_territory VARCHAR(150) NOT NULL,
  year INT NOT NULL,
  disease VARCHAR(150) NOT NULL,
  cases BIGINT NOT NULL DEFAULT 0,
  INDEX idx_year (year),
  INDEX idx_ut (union_territory),
  INDEX idx_disease (disease)
);
