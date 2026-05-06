-- =============================================
-- Workflow Builder Database Schema Migration
-- =============================================

-- Workflows table
CREATE TABLE IF NOT EXISTS workflows (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  version INT DEFAULT 1,
  definition JSONB NOT NULL,           -- Complete workflow definition
  canvas_state JSONB,                  -- Zoom, pan state
  thumbnail_path VARCHAR(500),         -- Preview image path
  is_template BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_wf_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_wf_user ON workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_wf_template ON workflows(is_template);
CREATE INDEX IF NOT EXISTS idx_wf_public ON workflows(is_public);
CREATE INDEX IF NOT EXISTS idx_wf_updated ON workflows(updated_at);

-- Workflow versions (for history tracking)
CREATE TABLE IF NOT EXISTS workflow_versions (
  id SERIAL PRIMARY KEY,
  workflow_id INT NOT NULL,
  version INT NOT NULL,
  definition JSONB NOT NULL,
  change_description TEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_wfv_workflow FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
  CONSTRAINT fk_wfv_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(workflow_id, version)
);

CREATE INDEX IF NOT EXISTS idx_wfv_workflow ON workflow_versions(workflow_id);

-- Workflow executions
CREATE TABLE IF NOT EXISTS workflow_executions (
  id SERIAL PRIMARY KEY,
  execution_id VARCHAR(100) NOT NULL UNIQUE,  -- UUID
  workflow_id INT NOT NULL,
  user_id INT NOT NULL,
  status VARCHAR(50) NOT NULL,                -- pending, running, completed, failed, cancelled
  trigger_data JSONB,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  duration_ms INT,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_wfe_workflow FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
  CONSTRAINT fk_wfe_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_wfe_workflow ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_wfe_user ON workflow_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_wfe_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_wfe_created ON workflow_executions(created_at);

-- Node execution logs
CREATE TABLE IF NOT EXISTS node_executions (
  id SERIAL PRIMARY KEY,
  execution_id VARCHAR(100) NOT NULL,
  node_id VARCHAR(100) NOT NULL,
  node_type VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL,                -- success, failed, skipped
  input_data JSONB,
  output_data JSONB,
  error_message TEXT,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  duration_ms INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ne_execution FOREIGN KEY (execution_id) REFERENCES workflow_executions(execution_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ne_execution ON node_executions(execution_id);
CREATE INDEX IF NOT EXISTS idx_ne_node ON node_executions(node_id);
CREATE INDEX IF NOT EXISTS idx_ne_status ON node_executions(status);

-- Workflow sharing and permissions
CREATE TABLE IF NOT EXISTS workflow_permissions (
  id SERIAL PRIMARY KEY,
  workflow_id INT NOT NULL,
  user_id INT NOT NULL,
  permission VARCHAR(50) NOT NULL,            -- view, edit, execute
  granted_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_wfp_workflow FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
  CONSTRAINT fk_wfp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_wfp_granter FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(workflow_id, user_id, permission)
);

CREATE INDEX IF NOT EXISTS idx_wfp_workflow ON workflow_permissions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_wfp_user ON workflow_permissions(user_id);
