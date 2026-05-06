-- =============================================
-- Automation Testing Database Schema (PostgreSQL)
-- =============================================

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  gemini_api_key TEXT,
  groq_api_key TEXT,
  cerebras_api_key TEXT,
  openai_api_key TEXT,
  custom_api_url TEXT,
  custom_api_key TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Test Runs (Summary of each test execution)
CREATE TABLE IF NOT EXISTS test_runs (
  id SERIAL PRIMARY KEY,
  user_id INT,
  test_id VARCHAR(100) NOT NULL,
  run_title VARCHAR(255),
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
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_tr_user ON test_runs(user_id);
CREATE INDEX idx_tr_platform ON test_runs(platform);
CREATE INDEX idx_tr_date ON test_runs(date_test);
CREATE INDEX idx_tr_tester ON test_runs(tester_name);
CREATE INDEX idx_tr_test_id ON test_runs(test_id);

-- Test Results (Detail per question/answer)
CREATE TABLE IF NOT EXISTS test_results (
  id SERIAL PRIMARY KEY,
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
  CONSTRAINT fk_run FOREIGN KEY (run_id) REFERENCES test_runs(id) ON DELETE CASCADE
);

CREATE INDEX idx_tres_run_id ON test_results(run_id);
CREATE INDEX idx_tres_status ON test_results(status);
CREATE INDEX idx_tres_skor ON test_results(skor);

-- Presets (Saved test configurations)
CREATE TABLE IF NOT EXISTS presets (
  id SERIAL PRIMARY KEY,
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
  CONSTRAINT fk_p_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Activity Logs
CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  user_id INT,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) DEFAULT 'system',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_al_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_al_user ON activity_logs(user_id);
CREATE INDEX idx_al_type ON activity_logs(type);
CREATE INDEX idx_al_created ON activity_logs(created_at);

-- Artifacts (Store test reports and other artifacts)
CREATE TABLE IF NOT EXISTS artifacts (
  id SERIAL PRIMARY KEY,
  run_id INT NOT NULL,
  artifact_type VARCHAR(50) NOT NULL, -- json, html, excel, screenshot, etc
  filename VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INT DEFAULT 0,
  mime_type VARCHAR(100) DEFAULT 'application/octet-stream',
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_art_run FOREIGN KEY (run_id) REFERENCES test_runs(id) ON DELETE CASCADE
);

CREATE INDEX idx_art_run_id ON artifacts(run_id);
CREATE INDEX idx_art_type ON artifacts(artifact_type);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    type VARCHAR(50) DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_n_read ON notifications(is_read);
CREATE INDEX idx_n_created ON notifications(created_at);

-- Schedules
CREATE TABLE IF NOT EXISTS schedules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    interval_min INT NOT NULL,
    preset_id INT NULL,
    paused BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_s_preset FOREIGN KEY (preset_id) REFERENCES presets(id) ON DELETE SET NULL
);

CREATE INDEX idx_s_paused ON schedules(paused);
