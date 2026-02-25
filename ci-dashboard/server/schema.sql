-- =============================================
-- Automation Testing Database Schema
-- =============================================

CREATE DATABASE IF NOT EXISTS automation_testing
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE automation_testing;

-- Test Runs (Summary of each test execution)
CREATE TABLE IF NOT EXISTS test_runs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  test_id VARCHAR(100) NOT NULL,
  platform VARCHAR(50) NOT NULL,
  tester_name VARCHAR(255) NOT NULL,
  filename VARCHAR(255),
  ai_evaluation VARCHAR(50) DEFAULT 'gemini',
  url VARCHAR(500),
  page_name VARCHAR(255),
  browser_name VARCHAR(100),
  date_test VARCHAR(50),
  start_time_test VARCHAR(50),
  end_time_test VARCHAR(50),
  duration VARCHAR(50),
  total_title INT DEFAULT 0,
  total_question INT DEFAULT 0,
  success INT DEFAULT 0,
  failed INT DEFAULT 0,
  avg_score DECIMAL(5,3) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user (user_id),
  INDEX idx_platform (platform),
  INDEX idx_date (date_test),
  INDEX idx_tester (tester_name),
  INDEX idx_test_id (test_id)
);

-- Test Results (Detail per question/answer)
CREATE TABLE IF NOT EXISTS test_results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  run_id INT NOT NULL,
  no VARCHAR(20),
  title VARCHAR(500),
  question TEXT,
  response_kb TEXT,
  response_llm TEXT,
  status VARCHAR(50),
  duration VARCHAR(50),
  skor DECIMAL(6,3) DEFAULT 0,
  explanation TEXT,
  image_path VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (run_id) REFERENCES test_runs(id) ON DELETE CASCADE,
  INDEX idx_run_id (run_id),
  INDEX idx_status (status),
  INDEX idx_skor (skor)
);

-- Presets (Saved test configurations)
CREATE TABLE IF NOT EXISTS presets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  name VARCHAR(255) NOT NULL,
  color VARCHAR(20) DEFAULT '#6366f1',
  platform VARCHAR(50) NOT NULL,
  filename VARCHAR(255),
  tester_name VARCHAR(255),
  greeting VARCHAR(255),
  webchat_url VARCHAR(500),
  telegram_bot VARCHAR(255),
  instagram_user VARCHAR(255),
  facebook_id VARCHAR(255),
  dhai_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Activity Logs
CREATE TABLE IF NOT EXISTS activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) DEFAULT 'system',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id),
  INDEX idx_type (type),
  INDEX idx_created (created_at)
);

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
-- Artifacts (Store test reports and other artifacts)
CREATE TABLE IF NOT EXISTS artifacts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  run_id INT NOT NULL,
  artifact_type VARCHAR(50) NOT NULL COMMENT 'json, html, excel, screenshot, qa_video, qa_audio, etc',
  filename VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INT DEFAULT 0,
  mime_type VARCHAR(100) DEFAULT 'application/octet-stream',
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (run_id) REFERENCES test_runs(id) ON DELETE CASCADE,
  INDEX idx_run_id (run_id),
  INDEX idx_artifact_type (artifact_type)
);