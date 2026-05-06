# Design Document: Agentic Workflow Builder

## Overview

The Agentic Workflow Builder is a visual drag-and-drop interface for creating, configuring, and executing automated testing workflows within the CI/CD dashboard. Inspired by n8n's workflow paradigm, this feature enables users to design complex test automation flows by connecting nodes that represent different actions (test execution, AI evaluation, conditional logic, data transformation, notifications, etc.) without writing code.

### Design Goals

1. **Visual Simplicity**: Provide an intuitive canvas-based interface that makes workflow creation accessible to users without programming expertise
2. **Seamless Integration**: Leverage existing dashboard infrastructure (test execution, AI evaluation, reporting, authentication) to avoid code duplication
3. **Extensibility**: Design a node system that allows easy addition of new node types in the future
4. **Performance**: Handle workflows with up to 100 nodes efficiently with real-time execution feedback
5. **Collaboration**: Enable workflow sharing and team collaboration through database-backed persistence

### Key Features

- **Visual Canvas**: Zoomable, pannable grid-based drawing area with minimap for large workflows
- **Node Library**: Pre-built node types organized by category (Triggers, Actions, Flow Control, etc.)
- **Real-time Execution**: Live progress tracking with node-level status indicators
- **Workflow Templates**: Pre-configured workflows for common testing scenarios
- **Debugging Tools**: Step-through execution, input/output inspection, execution history
- **Persistence**: Database-backed storage with version history and auto-save
- **Sharing**: Workflow sharing with permission management

## Architecture

### High-Level Architecture

```mermaid
graph TB
    subgraph "Frontend (Browser)"
        UI[Workflow Builder UI]
        Canvas[Canvas Renderer]
        NodeLib[Node Library]
        ConfigPanel[Configuration Panel]
        ExecMonitor[Execution Monitor]
    end
    
    subgraph "Backend API (Node.js/Express)"
        API[REST API Endpoints]
        WorkflowCtrl[Workflow Controller]
        ExecEngine[Execution Engine]
        NodeRegistry[Node Registry]
    end
    
    subgraph "Data Layer"
        MySQL[(MySQL Database)]
        FileStore[File Storage]
    end
    
    subgraph "Existing Services"
        TestExec[Test Execution Service]
        AIEval[AI Evaluation Service]
        ReportGen[Report Generator]
    end
    
    UI --> Canvas
    UI --> NodeLib
    UI --> ConfigPanel
    UI --> ExecMonitor
    
    Canvas --> API
    ConfigPanel --> API
    ExecMonitor --> API
    
    API --> WorkflowCtrl
    API --> ExecEngine
    
    WorkflowCtrl --> MySQL
    ExecEngine --> NodeRegistry
    ExecEngine --> MySQL
    
    NodeRegistry --> TestExec
    NodeRegistry --> AIEval
    NodeRegistry --> ReportGen
    
    ExecEngine --> FileStore
```

### Component Breakdown

#### Frontend Components

1. **Workflow Canvas** (`workflow-canvas.js`)
   - Renders the visual workflow graph using HTML5 Canvas or SVG
   - Handles zoom, pan, drag-and-drop interactions
   - Manages node positioning and connection rendering
   - Implements minimap for navigation

2. **Node Library Panel** (`node-library.js`)
   - Displays available node types organized by category
   - Provides search and filtering capabilities
   - Handles drag initiation for node creation

3. **Node Configuration Panel** (`node-config-panel.js`)
   - Dynamic form generation based on node type schema
   - Real-time validation of configuration parameters
   - Expression builder for condition nodes
   - Test execution for individual nodes

4. **Execution Monitor** (`execution-monitor.js`)
   - Real-time status updates during workflow execution
   - Progress indicators and execution logs
   - Error display and debugging information

5. **Workflow Manager** (`workflow-manager.js`)
   - Workflow CRUD operations (create, read, update, delete)
   - Template management
   - Import/export functionality
   - Version history management

#### Backend Components

1. **Workflow Controller** (`workflow.controller.js`)
   - REST API endpoints for workflow CRUD
   - Workflow validation logic
   - Permission checking and access control

2. **Execution Engine** (`execution-engine.js`)
   - Topological sorting of workflow graph
   - Sequential and parallel node execution
   - Execution context management
   - Error handling and recovery

3. **Node Registry** (`node-registry.js`)
   - Registry of all available node types
   - Node schema definitions
   - Node execution handlers
   - Integration with existing services

4. **Workflow Validator** (`workflow-validator.js`)
   - Validates workflow structure (cycles, orphans, etc.)
   - Validates node configurations
   - Validates data type compatibility

### Integration Points

The Workflow Builder integrates with existing dashboard components:

1. **Authentication**: Uses `AuthManager` for user authentication and session management
2. **Test Execution**: Reuses test execution logic from `src/platforms/*.ts` for Run Test nodes
3. **AI Evaluation**: Integrates with `src/utils/ai-evaluator.ts` for AI Evaluate nodes
4. **Report Generation**: Uses `src/utils/report-generator.ts` for Generate Report nodes
5. **Database**: Extends existing schema with new workflow-related tables
6. **Activity Logging**: Posts workflow events to `activity_logs` table
7. **Artifact Storage**: Stores workflow-generated artifacts in `artifacts` table

## Components and Interfaces

### Frontend Component Structure

```
ci-dashboard/
├── workflow-builder/
│   ├── workflow-canvas.js          # Canvas rendering and interaction
│   ├── node-library.js             # Node library panel
│   ├── node-config-panel.js        # Node configuration UI
│   ├── execution-monitor.js        # Execution monitoring
│   ├── workflow-manager.js         # Workflow CRUD operations
│   ├── workflow-validator.js       # Client-side validation
│   ├── workflow-templates.js       # Template management
│   ├── nodes/
│   │   ├── base-node.js           # Base node class
│   │   ├── trigger-nodes.js       # Trigger node implementations
│   │   ├── action-nodes.js        # Action node implementations
│   │   ├── control-nodes.js       # Flow control nodes
│   │   └── transform-nodes.js     # Data transformation nodes
│   └── utils/
│       ├── graph-utils.js         # Graph algorithms (topological sort, etc.)
│       ├── canvas-utils.js        # Canvas rendering utilities
│       └── connection-utils.js    # Connection validation and rendering
└── workflow-builder.html           # Main workflow builder page
```

### Backend API Structure

```
ci-dashboard/server/
├── routes/
│   └── workflows.js                # Workflow API routes
├── controllers/
│   └── workflow.controller.js      # Workflow business logic
├── services/
│   ├── execution-engine.js         # Workflow execution engine
│   ├── node-registry.js            # Node type registry
│   └── workflow-validator.js       # Server-side validation
├── models/
│   ├── workflow.model.js           # Workflow data model
│   └── workflow-execution.model.js # Execution state model
└── nodes/
    ├── base-node.js                # Base node executor
    ├── trigger-nodes.js            # Trigger node executors
    ├── action-nodes.js             # Action node executors
    ├── control-nodes.js            # Flow control executors
    └── transform-nodes.js          # Data transformation executors
```

### Key Interfaces

#### Workflow Definition

```typescript
interface WorkflowDefinition {
  id: number;
  user_id: number;
  name: string;
  description: string;
  version: number;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  canvas_state: CanvasState;
  created_at: Date;
  updated_at: Date;
}

interface WorkflowNode {
  id: string;                    // Unique node ID (UUID)
  type: string;                  // Node type (e.g., "run-test", "ai-evaluate")
  label: string;                 // Display name
  position: { x: number; y: number };
  config: Record<string, any>;   // Node-specific configuration
  inputs: NodePort[];
  outputs: NodePort[];
}

interface NodePort {
  id: string;
  name: string;
  dataType: DataType;            // string, number, object, array, boolean, any
}

interface WorkflowConnection {
  id: string;
  source_node_id: string;
  source_port_id: string;
  target_node_id: string;
  target_port_id: string;
}

interface CanvasState {
  zoom: number;
  pan: { x: number; y: number };
}

type DataType = 'string' | 'number' | 'object' | 'array' | 'boolean' | 'any';
```

#### Execution Context

```typescript
interface ExecutionContext {
  workflow_id: number;
  execution_id: string;
  user_id: number;
  trigger_data: any;
  node_outputs: Map<string, any>;  // Map of node_id -> output data
  variables: Map<string, any>;     // Global variables
  start_time: Date;
  status: ExecutionStatus;
}

type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

interface NodeExecutionResult {
  node_id: string;
  status: 'success' | 'failed' | 'skipped';
  output: any;
  error?: string;
  duration_ms: number;
  timestamp: Date;
}
```

#### Node Type Schema

```typescript
interface NodeTypeSchema {
  type: string;
  category: NodeCategory;
  label: string;
  description: string;
  icon: string;
  color: string;
  inputs: PortSchema[];
  outputs: PortSchema[];
  config_schema: ConfigField[];
}

type NodeCategory = 'trigger' | 'action' | 'control' | 'transform' | 'notification' | 'integration';

interface PortSchema {
  id: string;
  name: string;
  dataType: DataType;
  required: boolean;
}

interface ConfigField {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  default?: any;
  options?: Array<{ label: string; value: any }>;
  validation?: ValidationRule[];
}

type FieldType = 'text' | 'number' | 'select' | 'multiselect' | 'boolean' | 'json' | 'expression' | 'file';

interface ValidationRule {
  type: 'required' | 'min' | 'max' | 'pattern' | 'custom';
  value?: any;
  message: string;
}
```

### Component Communication

```mermaid
sequenceDiagram
    participant User
    participant Canvas
    participant ConfigPanel
    participant API
    participant ExecEngine
    participant NodeExecutor
    
    User->>Canvas: Drag node from library
    Canvas->>Canvas: Create node instance
    User->>Canvas: Connect nodes
    Canvas->>Canvas: Validate connection
    User->>Canvas: Double-click node
    Canvas->>ConfigPanel: Open config panel
    User->>ConfigPanel: Configure parameters
    ConfigPanel->>ConfigPanel: Validate inputs
    User->>Canvas: Click "Run Workflow"
    Canvas->>API: POST /api/workflows/execute
    API->>ExecEngine: Execute workflow
    ExecEngine->>ExecEngine: Topological sort
    loop For each node
        ExecEngine->>NodeExecutor: Execute node
        NodeExecutor->>NodeExecutor: Process inputs
        NodeExecutor-->>ExecEngine: Return output
        ExecEngine->>API: Send status update
        API-->>Canvas: WebSocket update
        Canvas->>User: Update node status
    end
    ExecEngine-->>API: Execution complete
    API-->>Canvas: Final status
    Canvas->>User: Show completion notification
```

## Data Models

### Database Schema Extensions

```sql
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

CREATE INDEX idx_wf_user ON workflows(user_id);
CREATE INDEX idx_wf_template ON workflows(is_template);
CREATE INDEX idx_wf_public ON workflows(is_public);
CREATE INDEX idx_wf_updated ON workflows(updated_at);

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

CREATE INDEX idx_wfv_workflow ON workflow_versions(workflow_id);

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

CREATE INDEX idx_wfe_workflow ON workflow_executions(workflow_id);
CREATE INDEX idx_wfe_user ON workflow_executions(user_id);
CREATE INDEX idx_wfe_status ON workflow_executions(status);
CREATE INDEX idx_wfe_created ON workflow_executions(created_at);

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

CREATE INDEX idx_ne_execution ON node_executions(execution_id);
CREATE INDEX idx_ne_node ON node_executions(node_id);
CREATE INDEX idx_ne_status ON node_executions(status);

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

CREATE INDEX idx_wfp_workflow ON workflow_permissions(workflow_id);
CREATE INDEX idx_wfp_user ON workflow_permissions(user_id);
```

### Data Flow

```mermaid
graph LR
    A[User Creates Workflow] --> B[workflows table]
    B --> C[workflow_versions table]
    D[User Executes Workflow] --> E[workflow_executions table]
    E --> F[node_executions table]
    F --> G[test_runs table]
    F --> H[artifacts table]
    F --> I[activity_logs table]
    J[User Shares Workflow] --> K[workflow_permissions table]
```

### Node Type Definitions

Each node type has a schema that defines its configuration, inputs, and outputs:

#### Run Test Node

```typescript
{
  type: 'run-test',
  category: 'action',
  label: 'Run Test',
  description: 'Execute tests on specified platform',
  icon: 'fa-play-circle',
  color: '#6366f1',
  inputs: [
    { id: 'trigger', name: 'Trigger', dataType: 'any', required: false }
  ],
  outputs: [
    { id: 'result', name: 'Test Result', dataType: 'object', required: true },
    { id: 'error', name: 'Error', dataType: 'object', required: false }
  ],
  config_schema: [
    { key: 'platform', label: 'Platform', type: 'select', required: true,
      options: [
        { label: 'WebChat', value: 'webchat' },
        { label: 'Telegram', value: 'telegram' },
        { label: 'Instagram', value: 'instagram' },
        { label: 'Facebook', value: 'facebook' },
        { label: 'DHAI', value: 'dhai' }
      ]
    },
    { key: 'test_data_file', label: 'Test Data File', type: 'file', required: true },
    { key: 'tester_name', label: 'Tester Name', type: 'text', required: true, default: 'Workflow Bot' },
    { key: 'greeting', label: 'Greeting Message', type: 'text', required: false, default: 'Haloo' },
    { key: 'platform_url', label: 'Platform URL', type: 'text', required: true }
  ]
}
```

#### AI Evaluate Node

```typescript
{
  type: 'ai-evaluate',
  category: 'action',
  label: 'AI Evaluate',
  description: 'Evaluate responses using AI',
  icon: 'fa-brain',
  color: '#8b5cf6',
  inputs: [
    { id: 'test_result', name: 'Test Result', dataType: 'object', required: true }
  ],
  outputs: [
    { id: 'evaluation', name: 'Evaluation Result', dataType: 'object', required: true }
  ],
  config_schema: [
    { key: 'ai_provider', label: 'AI Provider', type: 'select', required: true,
      options: [
        { label: 'Gemini', value: 'gemini' },
        { label: 'Groq', value: 'groq' },
        { label: 'Cerebras', value: 'cerebras' },
        { label: 'OpenAI', value: 'openai' },
        { label: 'Custom', value: 'custom' }
      ]
    },
    { key: 'scoring_threshold', label: 'Pass Threshold', type: 'number', required: true, default: 0.7 },
    { key: 'custom_prompt', label: 'Custom Evaluation Prompt', type: 'text', required: false }
  ]
}
```

#### Condition Node

```typescript
{
  type: 'condition',
  category: 'control',
  label: 'Condition',
  description: 'Route execution based on expression',
  icon: 'fa-code-branch',
  color: '#f59e0b',
  inputs: [
    { id: 'input', name: 'Input', dataType: 'any', required: true }
  ],
  outputs: [
    { id: 'true', name: 'True', dataType: 'any', required: true },
    { id: 'false', name: 'False', dataType: 'any', required: true }
  ],
  config_schema: [
    { key: 'expression', label: 'Condition Expression', type: 'expression', required: true,
      validation: [{ type: 'custom', message: 'Invalid JavaScript expression' }]
    }
  ]
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Workflow Definition Persistence

*For any* valid workflow definition, saving the workflow SHALL store it in the database and subsequent loading SHALL retrieve an equivalent workflow definition with all nodes, connections, and configurations intact.

**Validates: Requirements 6.1, 6.2, 6.3, 6.6**

### Property 2: Topological Execution Order

*For any* workflow without circular dependencies, the execution engine SHALL execute nodes in topological order such that all upstream dependencies of a node complete before that node executes.

**Validates: Requirements 5.4**

### Property 3: Circular Dependency Detection

*For any* workflow definition, the validator SHALL detect circular dependencies and prevent workflow execution if cycles exist in the connection graph.

**Validates: Requirements 4.3, 11.4**

### Property 4: Data Flow Preservation

*For any* node execution, the output data SHALL be passed to all connected downstream nodes via the execution context, and downstream nodes SHALL receive the exact output produced by upstream nodes.

**Validates: Requirements 4.9, 5.5**

### Property 5: Node Configuration Validation

*For any* node with required configuration parameters, the workflow validator SHALL prevent execution if any required parameter is missing or invalid.

**Validates: Requirements 3.3, 11.3**

### Property 6: Execution State Consistency

*For any* workflow execution, the execution state (pending, running, completed, failed) SHALL accurately reflect the current status, and state transitions SHALL follow the valid sequence: pending → running → (completed | failed).

**Validates: Requirements 5.6, 5.7, 5.8**

### Property 7: Error Isolation

*For any* node that fails during execution, if "Continue on Error" is disabled, the workflow SHALL halt and mark the execution as failed; if enabled, the workflow SHALL continue executing independent branches.

**Validates: Requirements 5.8, 5.9**

### Property 8: Connection Type Compatibility

*For any* connection between two nodes, if the source port data type is not compatible with the target port data type (excluding 'any' type), the validator SHALL display a type mismatch warning.

**Validates: Requirements 4.10**

### Property 9: Workflow Import/Export Round-Trip

*For any* workflow, exporting to JSON and then importing SHALL produce an equivalent workflow with the same nodes, connections, configurations, and canvas state.

**Validates: Requirements 6.9, 6.10**

### Property 10: Execution Context Isolation

*For any* two concurrent workflow executions, each execution SHALL maintain its own isolated execution context, and modifications to one context SHALL NOT affect the other.

**Validates: Requirements 5.3, 5.5**

### Property 11: Node Output Immutability

*For any* node execution, once the node completes and produces output, that output SHALL remain immutable in the execution context for the duration of the workflow execution.

**Validates: Requirements 5.5**

### Property 12: Trigger Node Uniqueness

*For any* workflow definition, there SHALL be exactly one trigger node, and the validator SHALL reject workflows with zero or multiple trigger nodes.

**Validates: Requirements 11.1**

### Property 13: Node Connectivity

*For any* non-trigger node in a workflow, the node SHALL have at least one incoming connection, and the validator SHALL flag orphaned nodes.

**Validates: Requirements 11.2**

### Property 14: Permission Enforcement

*For any* workflow access attempt, the system SHALL verify that the requesting user has the required permission (view, edit, or execute), and SHALL deny access if permission is not granted.

**Validates: Requirements 13.2, 13.3, 13.4, 20.2, 20.6**

### Property 15: Auto-Save Consistency

*For any* workflow being edited, auto-save SHALL persist changes every 30 seconds, and the persisted version SHALL match the current canvas state at the time of save.

**Validates: Requirements 6.12**

## Error Handling

### Error Categories

1. **Validation Errors**: Detected before execution
   - Missing required configuration
   - Circular dependencies
   - Type mismatches
   - Orphaned nodes
   - Missing trigger node

2. **Runtime Errors**: Occur during execution
   - Node execution failures
   - API call failures
   - Timeout errors
   - Resource exhaustion

3. **System Errors**: Infrastructure failures
   - Database connection errors
   - File system errors
   - Authentication failures

### Error Handling Strategy

```mermaid
graph TD
    A[Error Occurs] --> B{Error Type?}
    B -->|Validation| C[Display in UI]
    B -->|Runtime| D{Continue on Error?}
    B -->|System| E[Log & Notify Admin]
    
    C --> F[Highlight Invalid Nodes]
    C --> G[Show Error Panel]
    
    D -->|Yes| H[Mark Node Failed]
    D -->|No| I[Halt Execution]
    
    H --> J[Continue Next Branch]
    I --> K[Mark Workflow Failed]
    
    E --> L[Show User-Friendly Message]
    E --> M[Log to Activity Feed]
```

### Error Response Format

```typescript
interface ErrorResponse {
  error: {
    code: string;              // ERROR_CODE
    message: string;           // User-friendly message
    details?: any;             // Technical details
    node_id?: string;          // For node-specific errors
    timestamp: Date;
  };
}

// Error codes
enum ErrorCode {
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  CIRCULAR_DEPENDENCY = 'CIRCULAR_DEPENDENCY',
  MISSING_TRIGGER = 'MISSING_TRIGGER',
  NODE_EXECUTION_FAILED = 'NODE_EXECUTION_FAILED',
  TIMEOUT = 'TIMEOUT',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  DATABASE_ERROR = 'DATABASE_ERROR',
  INVALID_CONFIGURATION = 'INVALID_CONFIGURATION'
}
```

### Error Recovery

1. **Validation Errors**: User must fix issues before execution
2. **Node Failures**: 
   - Retry mechanism for transient failures (network errors)
   - "Retry Failed Node" action in UI
   - Continue on error option for non-critical nodes
3. **System Errors**:
   - Automatic retry with exponential backoff
   - Fallback to localStorage if database unavailable
   - Graceful degradation

### Error Logging

All errors are logged to:
- `activity_logs` table with type='error'
- `node_executions` table with error_message field
- Browser console for debugging
- Server logs for system errors

## Testing Strategy

### Unit Testing

**Focus**: Individual components and functions

**Test Cases**:
1. **Graph Algorithms**
   - Topological sort with various graph structures
   - Cycle detection in directed graphs
   - Reachability analysis

2. **Validation Logic**
   - Node configuration validation
   - Connection type compatibility
   - Workflow structure validation

3. **Data Transformation**
   - Expression evaluation
   - Data mapping and filtering
   - Type conversion

4. **Node Executors**
   - Each node type's execution logic
   - Input/output handling
   - Error scenarios

**Tools**: Jest, Mocha

### Integration Testing

**Focus**: Component interactions and API endpoints

**Test Cases**:
1. **API Endpoints**
   - Workflow CRUD operations
   - Execution triggering
   - Permission management

2. **Database Operations**
   - Workflow persistence
   - Execution logging
   - Version history

3. **Service Integration**
   - Test execution service integration
   - AI evaluation service integration
   - Report generation integration

4. **Authentication**
   - User authentication flow
   - Permission enforcement
   - Session management

**Tools**: Supertest, Chai

### End-to-End Testing

**Focus**: Complete user workflows

**Test Scenarios**:
1. **Workflow Creation**
   - Create workflow from scratch
   - Add and configure nodes
   - Connect nodes
   - Save workflow

2. **Workflow Execution**
   - Execute simple workflow
   - Execute workflow with branching
   - Handle execution errors
   - Monitor execution progress

3. **Template Usage**
   - Load template
   - Customize template
   - Execute template-based workflow

4. **Collaboration**
   - Share workflow
   - Access shared workflow
   - Edit shared workflow

**Tools**: Playwright, Cypress

### Performance Testing

**Focus**: System performance under load

**Test Scenarios**:
1. **Large Workflows**
   - Render workflow with 100 nodes
   - Execute workflow with 50 sequential nodes
   - Execute workflow with 20 parallel branches

2. **Concurrent Executions**
   - 10 concurrent workflow executions
   - 50 concurrent users editing workflows

3. **Database Load**
   - 1000 workflows in database
   - 10000 execution records

**Metrics**:
- Canvas render time < 100ms for 100 nodes
- Workflow execution throughput > 5 workflows/second
- API response time < 200ms (p95)

**Tools**: Artillery, k6

### Manual Testing

**Focus**: User experience and edge cases

**Test Areas**:
1. **UI/UX**
   - Drag-and-drop interactions
   - Zoom and pan smoothness
   - Configuration panel usability

2. **Visual Feedback**
   - Execution status indicators
   - Error highlighting
   - Connection animations

3. **Edge Cases**
   - Very large workflows (200+ nodes)
   - Complex branching scenarios
   - Network interruptions during execution

### Test Data

**Mock Data**:
- Sample workflows for each template
- Test execution results
- AI evaluation responses

**Test Users**:
- Admin user with full permissions
- Regular user with limited permissions
- Guest user with read-only access

### Continuous Integration

**CI Pipeline**:
1. Run unit tests on every commit
2. Run integration tests on pull requests
3. Run E2E tests on staging deployment
4. Performance tests on weekly schedule

**Coverage Goals**:
- Unit test coverage > 80%
- Integration test coverage > 70%
- Critical paths covered by E2E tests


## Node Type Implementation Details

### Trigger Nodes

#### Manual Trigger Node

**Purpose**: Initiates workflow execution on user command

**Configuration**: None required

**Execution Logic**:
```javascript
async execute(context) {
  return {
    timestamp: new Date(),
    triggered_by: context.user_id,
    trigger_type: 'manual'
  };
}
```

**Output Schema**:
```typescript
{
  timestamp: Date,
  triggered_by: number,
  trigger_type: string
}
```

#### Schedule Trigger Node

**Purpose**: Initiates workflow execution based on cron schedule

**Configuration**:
- `cron_expression`: Cron expression (e.g., "0 9 * * *")
- `timezone`: Timezone for schedule (e.g., "Asia/Jakarta")

**Execution Logic**:
```javascript
async execute(context) {
  return {
    timestamp: new Date(),
    scheduled_time: context.trigger_data.scheduled_time,
    trigger_type: 'schedule'
  };
}
```

**Integration**: Uses existing scheduler infrastructure from `schedules` table

### Action Nodes

#### Run Test Node

**Purpose**: Execute tests on specified platform

**Configuration**:
- `platform`: Platform selection (webchat, telegram, instagram, facebook, dhai)
- `test_data_file`: Test data file path or upload
- `tester_name`: Name of tester
- `greeting`: Greeting message
- `platform_url`: Platform-specific URL

**Execution Logic**:
```javascript
async execute(context) {
  const config = this.config;
  const platform = config.platform;
  
  // Load test data
  const testData = await loadTestData(config.test_data_file);
  
  // Get platform executor
  const executor = getPlatformExecutor(platform);
  
  // Execute tests
  const results = await executor.runTests({
    data: testData,
    testerName: config.tester_name,
    greeting: config.greeting,
    url: config.platform_url
  });
  
  // Store in database
  const runId = await storeTestRun(results, context.user_id);
  
  return {
    run_id: runId,
    test_id: results.test_id,
    platform: platform,
    status: results.status,
    total_questions: results.total_questions,
    success_count: results.success_count,
    failed_count: results.failed_count,
    avg_score: results.avg_score,
    duration: results.duration,
    results: results.details
  };
}
```

**Integration**: Reuses platform executors from `src/platforms/*.ts`

#### AI Evaluate Node

**Purpose**: Evaluate test responses using AI

**Configuration**:
- `ai_provider`: AI provider selection (gemini, groq, cerebras, openai, custom)
- `scoring_threshold`: Pass/fail threshold (0.0 - 1.0)
- `custom_prompt`: Optional custom evaluation prompt

**Execution Logic**:
```javascript
async execute(context) {
  const config = this.config;
  const input = context.getInput('test_result');
  
  // Get AI evaluator
  const evaluator = getAIEvaluator(config.ai_provider, context.user_id);
  
  // Evaluate each result
  const evaluations = [];
  for (const result of input.results) {
    const evaluation = await evaluator.evaluateResponse(
      result.question,
      result.expected_response,
      result.actual_response,
      result.title
    );
    
    evaluations.push({
      ...result,
      ai_score: evaluation.score,
      ai_explanation: evaluation.explanation,
      ai_passed: evaluation.score >= config.scoring_threshold,
      ai_provider: evaluation.provider
    });
  }
  
  // Calculate aggregate metrics
  const avgScore = evaluations.reduce((sum, e) => sum + e.ai_score, 0) / evaluations.length;
  const passCount = evaluations.filter(e => e.ai_passed).length;
  
  return {
    run_id: input.run_id,
    evaluations: evaluations,
    avg_ai_score: avgScore,
    pass_count: passCount,
    fail_count: evaluations.length - passCount,
    threshold: config.scoring_threshold
  };
}
```

**Integration**: Uses `src/utils/ai-evaluator.ts` with user's API keys from database

#### Generate Report Node

**Purpose**: Generate test reports in various formats

**Configuration**:
- `report_format`: Format selection (json, html, excel)
- `template`: Template selection (default, detailed, summary)
- `output_filename`: Output file name
- `include_screenshots`: Include screenshots in report

**Execution Logic**:
```javascript
async execute(context) {
  const config = this.config;
  const input = context.getInput('test_result');
  
  // Get report generator
  const generator = getReportGenerator(config.report_format);
  
  // Generate report
  const reportPath = await generator.generate({
    data: input,
    template: config.template,
    filename: config.output_filename,
    includeScreenshots: config.include_screenshots
  });
  
  // Store artifact
  const artifact = await storeArtifact({
    run_id: input.run_id,
    artifact_type: config.report_format,
    filename: config.output_filename,
    file_path: reportPath,
    file_size: getFileSize(reportPath)
  });
  
  return {
    artifact_id: artifact.id,
    filename: artifact.filename,
    file_path: artifact.file_path,
    file_size: artifact.file_size,
    download_url: `/api/artifacts/${artifact.id}/download`
  };
}
```

**Integration**: Uses `src/utils/report-generator.ts` and stores in `artifacts` table

#### Send Notification Node

**Purpose**: Create dashboard notifications

**Configuration**:
- `title`: Notification title (supports template variables)
- `message`: Notification message (supports template variables)
- `type`: Notification type (info, success, warning, error)
- `recipients`: Recipient user IDs (optional)

**Execution Logic**:
```javascript
async execute(context) {
  const config = this.config;
  const input = context.getInput('data');
  
  // Replace template variables
  const title = replaceVariables(config.title, input);
  const message = replaceVariables(config.message, input);
  
  // Create notification
  const notification = await createNotification({
    title: title,
    message: message,
    type: config.type,
    recipients: config.recipients || [context.user_id]
  });
  
  return {
    notification_id: notification.id,
    created_at: notification.created_at,
    delivery_status: 'sent'
  };
}
```

**Integration**: Stores in `notifications` table

### Control Flow Nodes

#### Condition Node

**Purpose**: Route execution based on expression evaluation

**Configuration**:
- `expression`: JavaScript expression to evaluate

**Execution Logic**:
```javascript
async execute(context) {
  const config = this.config;
  const input = context.getInput('input');
  
  // Create safe evaluation context
  const evalContext = {
    input: input,
    ...context.variables
  };
  
  // Evaluate expression safely
  const result = safeEvaluate(config.expression, evalContext);
  
  // Route to appropriate output
  if (result) {
    context.setOutput('true', input);
  } else {
    context.setOutput('false', input);
  }
  
  return {
    expression: config.expression,
    result: result,
    routed_to: result ? 'true' : 'false'
  };
}
```

**Safety**: Uses sandboxed evaluation to prevent code injection

#### Wait Node

**Purpose**: Pause execution for specified duration

**Configuration**:
- `duration_seconds`: Duration to wait in seconds

**Execution Logic**:
```javascript
async execute(context) {
  const config = this.config;
  const startTime = Date.now();
  
  await sleep(config.duration_seconds * 1000);
  
  return {
    waited_seconds: config.duration_seconds,
    actual_duration_ms: Date.now() - startTime
  };
}
```

### Transform Nodes

#### Transform Data Node

**Purpose**: Map and transform data between nodes

**Configuration**:
- `transformations`: Array of transformation rules
- `mode`: Transformation mode (map, filter, reduce, custom)

**Execution Logic**:
```javascript
async execute(context) {
  const config = this.config;
  const input = context.getInput('input');
  
  let output = input;
  
  for (const transform of config.transformations) {
    switch (transform.operation) {
      case 'map':
        output = output.map(item => applyMapping(item, transform.mapping));
        break;
      case 'filter':
        output = output.filter(item => evaluateCondition(item, transform.condition));
        break;
      case 'reduce':
        output = output.reduce((acc, item) => applyReduce(acc, item, transform.reducer), transform.initial);
        break;
      case 'custom':
        output = safeEvaluate(transform.code, { input: output });
        break;
    }
  }
  
  return output;
}
```

**Transformation Examples**:
```javascript
// Map: Extract specific fields
{
  operation: 'map',
  mapping: {
    'question': '$.question',
    'score': '$.ai_score',
    'passed': '$.ai_passed'
  }
}

// Filter: Keep only failed tests
{
  operation: 'filter',
  condition: 'item.ai_passed === false'
}

// Reduce: Calculate average score
{
  operation: 'reduce',
  reducer: 'acc + item.score',
  initial: 0,
  postProcess: 'result / input.length'
}
```

## Workflow Execution Engine

### Execution Flow

```mermaid
stateDiagram-v2
    [*] --> Validate
    Validate --> Initialize: Valid
    Validate --> Failed: Invalid
    Initialize --> TopologicalSort
    TopologicalSort --> ExecuteNodes
    ExecuteNodes --> ExecuteNode
    ExecuteNode --> NodeSuccess: Success
    ExecuteNode --> NodeFailed: Failed
    NodeSuccess --> CheckMore: Has More Nodes
    NodeFailed --> CheckContinue: Continue on Error?
    CheckContinue --> CheckMore: Yes
    CheckContinue --> Failed: No
    CheckMore --> ExecuteNode: Yes
    CheckMore --> Completed: No
    Completed --> [*]
    Failed --> [*]
```

### Execution Algorithm

```javascript
class WorkflowExecutionEngine {
  async execute(workflowId, userId, triggerData) {
    // 1. Load workflow definition
    const workflow = await loadWorkflow(workflowId);
    
    // 2. Validate workflow
    const validation = validateWorkflow(workflow);
    if (!validation.valid) {
      throw new ValidationError(validation.errors);
    }
    
    // 3. Create execution context
    const executionId = generateUUID();
    const context = new ExecutionContext({
      workflow_id: workflowId,
      execution_id: executionId,
      user_id: userId,
      trigger_data: triggerData
    });
    
    // 4. Store execution record
    await createExecution(executionId, workflowId, userId);
    
    // 5. Topological sort
    const executionOrder = topologicalSort(workflow.nodes, workflow.connections);
    
    // 6. Execute nodes in order
    for (const nodeId of executionOrder) {
      const node = workflow.nodes.find(n => n.id === nodeId);
      
      try {
        // Check if all dependencies completed
        const dependencies = getUpstreamNodes(nodeId, workflow.connections);
        const allCompleted = dependencies.every(depId => 
          context.getNodeStatus(depId) === 'success'
        );
        
        if (!allCompleted) {
          context.setNodeStatus(nodeId, 'skipped');
          continue;
        }
        
        // Execute node
        context.setNodeStatus(nodeId, 'running');
        const executor = getNodeExecutor(node.type);
        const result = await executor.execute(context, node.config);
        
        // Store result
        context.setNodeOutput(nodeId, result);
        context.setNodeStatus(nodeId, 'success');
        
        // Log execution
        await logNodeExecution(executionId, nodeId, 'success', result);
        
      } catch (error) {
        // Handle node failure
        context.setNodeStatus(nodeId, 'failed');
        await logNodeExecution(executionId, nodeId, 'failed', null, error.message);
        
        if (!node.config.continueOnError) {
          // Halt execution
          await updateExecution(executionId, 'failed', error.message);
          throw error;
        }
      }
    }
    
    // 7. Mark execution complete
    await updateExecution(executionId, 'completed');
    
    return {
      execution_id: executionId,
      status: 'completed',
      node_results: context.getAllNodeOutputs()
    };
  }
}
```

### Topological Sort Implementation

```javascript
function topologicalSort(nodes, connections) {
  const graph = buildAdjacencyList(nodes, connections);
  const inDegree = calculateInDegree(graph);
  const queue = [];
  const result = [];
  
  // Find all nodes with no incoming edges (trigger nodes)
  for (const [nodeId, degree] of Object.entries(inDegree)) {
    if (degree === 0) {
      queue.push(nodeId);
    }
  }
  
  while (queue.length > 0) {
    const nodeId = queue.shift();
    result.push(nodeId);
    
    // Reduce in-degree for all neighbors
    for (const neighbor of graph[nodeId] || []) {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) {
        queue.push(neighbor);
      }
    }
  }
  
  // Check for cycles
  if (result.length !== nodes.length) {
    throw new Error('Circular dependency detected');
  }
  
  return result;
}
```

### Parallel Execution

For independent branches, the engine supports parallel execution:

```javascript
async executeParallel(nodeIds, context) {
  const promises = nodeIds.map(nodeId => 
    this.executeNode(nodeId, context)
  );
  
  const results = await Promise.allSettled(promises);
  
  // Handle results
  results.forEach((result, index) => {
    const nodeId = nodeIds[index];
    if (result.status === 'fulfilled') {
      context.setNodeOutput(nodeId, result.value);
      context.setNodeStatus(nodeId, 'success');
    } else {
      context.setNodeStatus(nodeId, 'failed');
      // Handle error based on continueOnError setting
    }
  });
}
```

### Execution Context

```javascript
class ExecutionContext {
  constructor(config) {
    this.workflow_id = config.workflow_id;
    this.execution_id = config.execution_id;
    this.user_id = config.user_id;
    this.trigger_data = config.trigger_data;
    this.node_outputs = new Map();
    this.node_status = new Map();
    this.variables = new Map();
    this.start_time = new Date();
  }
  
  getInput(portName) {
    // Get input from connected upstream node
    const connection = this.findInputConnection(portName);
    if (!connection) return null;
    
    return this.node_outputs.get(connection.source_node_id);
  }
  
  setOutput(portName, data) {
    // Store output for downstream nodes
    this.node_outputs.set(this.current_node_id, data);
  }
  
  setNodeStatus(nodeId, status) {
    this.node_status.set(nodeId, status);
    // Emit status update event for real-time UI updates
    this.emit('node_status_changed', { nodeId, status });
  }
  
  getNodeStatus(nodeId) {
    return this.node_status.get(nodeId);
  }
  
  setNodeOutput(nodeId, output) {
    this.node_outputs.set(nodeId, output);
  }
  
  getNodeOutput(nodeId) {
    return this.node_outputs.get(nodeId);
  }
  
  getAllNodeOutputs() {
    return Object.fromEntries(this.node_outputs);
  }
}
```

## API Endpoints

### Workflow Management

```
POST   /api/workflows                    Create new workflow
GET    /api/workflows                    List user's workflows
GET    /api/workflows/:id                Get workflow by ID
PUT    /api/workflows/:id                Update workflow
DELETE /api/workflows/:id                Delete workflow
POST   /api/workflows/:id/duplicate      Duplicate workflow
GET    /api/workflows/:id/versions       Get workflow version history
POST   /api/workflows/:id/revert/:version Revert to specific version
```

### Workflow Execution

```
POST   /api/workflows/:id/execute        Execute workflow
GET    /api/workflows/executions         List executions
GET    /api/workflows/executions/:id     Get execution details
POST   /api/workflows/executions/:id/cancel Cancel execution
POST   /api/workflows/executions/:id/retry  Retry failed execution
GET    /api/workflows/executions/:id/logs   Get execution logs
```

### Templates

```
GET    /api/workflows/templates          List workflow templates
GET    /api/workflows/templates/:id      Get template by ID
POST   /api/workflows/templates          Create template from workflow
```

### Sharing and Permissions

```
POST   /api/workflows/:id/share          Share workflow
GET    /api/workflows/:id/permissions    Get workflow permissions
POST   /api/workflows/:id/permissions    Grant permission
DELETE /api/workflows/:id/permissions/:userId Remove permission
GET    /api/workflows/shared             List workflows shared with user
```

### Node Types

```
GET    /api/workflows/node-types         List available node types
GET    /api/workflows/node-types/:type   Get node type schema
```

### Validation

```
POST   /api/workflows/validate           Validate workflow definition
```

### Example API Request/Response

**Create Workflow**:
```http
POST /api/workflows
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Daily Regression Test",
  "description": "Automated daily regression testing across all platforms",
  "definition": {
    "nodes": [...],
    "connections": [...]
  },
  "canvas_state": {
    "zoom": 1.0,
    "pan": { "x": 0, "y": 0 }
  }
}

Response 201:
{
  "id": 123,
  "name": "Daily Regression Test",
  "version": 1,
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Execute Workflow**:
```http
POST /api/workflows/123/execute
Authorization: Bearer <token>
Content-Type: application/json

{
  "trigger_data": {
    "manual": true,
    "triggered_by": "user@example.com"
  }
}

Response 202:
{
  "execution_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "workflow_id": 123,
  "created_at": "2024-01-15T10:35:00Z"
}
```

## UI/UX Design Patterns

### Canvas Interaction Patterns

**Zoom and Pan**:
- Mouse wheel: Zoom in/out
- Middle mouse drag: Pan canvas
- Pinch gesture (touch): Zoom
- Two-finger drag (touch): Pan
- Zoom controls: +/- buttons in toolbar

**Node Manipulation**:
- Drag from library: Create new node
- Click node: Select node
- Double-click node: Open configuration
- Drag node: Move node
- Delete key: Delete selected node(s)
- Ctrl+C/V: Copy/paste nodes

**Connection Creation**:
- Drag from output port: Start connection
- Hover over input port: Highlight valid targets
- Drop on input port: Create connection
- Hover over connection: Show delete button
- Click connection: Select connection

### Visual Feedback

**Node States**:
- Default: Normal border, white background
- Selected: Accent border, slight glow
- Running: Pulsing animation, blue border
- Success: Green checkmark icon, green border
- Failed: Red X icon, red border
- Invalid config: Red dashed border

**Connection States**:
- Normal: Gray curved line
- Selected: Accent color, thicker line
- Active (data flowing): Animated dots along line
- Type mismatch: Orange dashed line with warning icon

**Canvas States**:
- Empty: Show welcome message and quick start guide
- Loading: Skeleton loaders for nodes
- Executing: Dim non-executing nodes, highlight active path

### Responsive Design

**Desktop (> 1024px)**:
- Three-column layout: Node library (left), Canvas (center), Config panel (right)
- Full toolbar with all actions
- Minimap in bottom-right corner

**Tablet (768px - 1024px)**:
- Two-column layout: Canvas (main), Collapsible panels (overlay)
- Condensed toolbar
- Minimap hidden by default

**Mobile (< 768px)**:
- Single column: Canvas full-screen
- Bottom sheet for node library
- Modal for configuration
- Simplified touch gestures
- Toolbar as bottom navigation

### Accessibility

**Keyboard Navigation**:
- Tab: Navigate between nodes
- Arrow keys: Move selected node
- Enter: Open configuration
- Delete: Delete selected node
- Ctrl+Z/Y: Undo/redo
- Ctrl+S: Save workflow
- Ctrl+R: Run workflow

**Screen Reader Support**:
- ARIA labels for all interactive elements
- Announce node status changes
- Describe connections and data flow
- Provide text alternatives for visual indicators

**Color Contrast**:
- WCAG AA compliance for all text
- High contrast mode support
- Color-blind friendly status indicators (use icons + colors)

## Performance Optimization

### Frontend Optimizations

**Canvas Rendering**:
- Use HTML5 Canvas for large workflows (> 50 nodes)
- Implement viewport culling (only render visible nodes)
- Use requestAnimationFrame for smooth animations
- Debounce pan/zoom events
- Cache rendered node images

**State Management**:
- Use immutable data structures for undo/redo
- Implement virtual scrolling for node library
- Lazy load node configuration schemas
- Debounce auto-save (30 seconds)

**Network Optimization**:
- Compress workflow definitions before sending
- Use WebSocket for real-time execution updates
- Implement optimistic UI updates
- Cache node type schemas in localStorage

### Backend Optimizations

**Database**:
- Index frequently queried fields (user_id, workflow_id, status)
- Use JSONB for flexible workflow definitions
- Implement connection pooling
- Use prepared statements for common queries

**Execution Engine**:
- Limit concurrent executions per user (10 max)
- Implement execution queue with priority
- Use worker threads for CPU-intensive operations
- Cache node executors in memory

**API**:
- Implement rate limiting (100 requests/minute per user)
- Use compression for large responses
- Implement pagination for list endpoints
- Cache node type schemas

### Scalability Considerations

**Horizontal Scaling**:
- Stateless API servers (can add more instances)
- Separate execution workers from API servers
- Use message queue (Redis/RabbitMQ) for execution jobs
- Implement distributed locking for concurrent edits

**Vertical Scaling**:
- Optimize database queries
- Increase worker thread pool size
- Add more memory for execution context caching

**Monitoring**:
- Track execution duration per node type
- Monitor database query performance
- Alert on failed executions
- Track API response times

## Security Considerations

### Authentication and Authorization

**User Authentication**:
- Reuse existing JWT-based authentication
- Validate token on every API request
- Implement token refresh mechanism

**Workflow Permissions**:
- Owner: Full access (view, edit, execute, delete, share)
- Editor: Can view, edit, and execute
- Viewer: Can only view and clone
- Executor: Can view and execute

**Permission Checks**:
```javascript
async function checkPermission(userId, workflowId, requiredPermission) {
  // Check if user is owner
  const workflow = await getWorkflow(workflowId);
  if (workflow.user_id === userId) {
    return true;
  }
  
  // Check explicit permissions
  const permission = await getPermission(workflowId, userId);
  return permission && hasPermission(permission.permission, requiredPermission);
}
```

### Input Validation

**Workflow Definition**:
- Validate JSON schema
- Sanitize node configurations
- Validate expression syntax
- Check for malicious code patterns

**Node Configuration**:
- Validate all required fields
- Sanitize user inputs (XSS prevention)
- Validate file uploads (type, size)
- Escape special characters

### Code Execution Safety

**Expression Evaluation**:
- Use sandboxed VM (vm2 library)
- Whitelist allowed functions
- Timeout long-running expressions (5 seconds)
- Limit memory usage

**Custom Code Nodes** (future):
- Run in isolated containers
- Implement resource limits (CPU, memory, time)
- Restrict network access
- Audit all custom code

### Data Protection

**Sensitive Data**:
- Encrypt API keys in database
- Mask sensitive data in logs
- Implement data retention policies
- Support data export and deletion (GDPR)

**Audit Logging**:
- Log all workflow modifications
- Log all execution attempts
- Log permission changes
- Include user ID and timestamp

### Rate Limiting

**API Endpoints**:
- 100 requests/minute per user (general)
- 10 workflow executions/minute per user
- 5 workflow saves/minute per user

**Execution Limits**:
- Max 10 concurrent executions per user
- Max 5 minutes execution time per workflow
- Max 100 nodes per workflow
- Max 10 MB workflow definition size

## Deployment Strategy

### Development Environment

**Setup**:
```bash
# Install dependencies
npm install

# Setup database
npm run db:setup

# Run migrations
npm run db:migrate

# Start development server
npm run dev
```

**Environment Variables**:
```env
NODE_ENV=development
DATABASE_URL=postgresql://user:pass@localhost:5432/automation_testing
JWT_SECRET=dev_secret_key
PORT=3001
```

### Staging Environment

**Deployment**:
- Deploy to staging server
- Run database migrations
- Run integration tests
- Perform manual QA testing

**Configuration**:
- Use staging database
- Enable debug logging
- Disable rate limiting for testing

### Production Environment

**Deployment Steps**:
1. Run all tests (unit, integration, E2E)
2. Build production bundle
3. Backup database
4. Run database migrations
5. Deploy new version (blue-green deployment)
6. Run smoke tests
7. Monitor for errors
8. Rollback if issues detected

**Configuration**:
```env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@prod-db:5432/automation_testing
JWT_SECRET=<strong_secret>
PORT=3001
ENABLE_RATE_LIMITING=true
MAX_CONCURRENT_EXECUTIONS=50
```

**Monitoring**:
- Application logs (Winston)
- Error tracking (Sentry)
- Performance monitoring (New Relic)
- Database monitoring (pg_stat_statements)
- Uptime monitoring (Pingdom)

### Database Migrations

**Migration Strategy**:
- Use migration tool (node-pg-migrate)
- Version all schema changes
- Test migrations on staging first
- Support rollback for each migration

**Example Migration**:
```sql
-- migrations/001_create_workflows_table.sql
CREATE TABLE IF NOT EXISTS workflows (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  definition JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_wf_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Rollback
DROP TABLE IF EXISTS workflows;
```

### Backup and Recovery

**Database Backups**:
- Daily full backups
- Hourly incremental backups
- Retain backups for 30 days
- Test restore procedure monthly

**Disaster Recovery**:
- Document recovery procedures
- Maintain offsite backups
- Test failover scenarios
- Define RTO (Recovery Time Objective): 4 hours
- Define RPO (Recovery Point Objective): 1 hour

## Future Enhancements

### Phase 2 Features

1. **Custom Node Types**
   - Allow users to create custom node types
   - Visual node builder interface
   - Custom code execution in sandboxed environment
   - Share custom nodes with team

2. **Workflow Marketplace**
   - Public workflow template marketplace
   - Rate and review workflows
   - Import workflows from marketplace
   - Monetization for premium workflows

3. **Advanced Scheduling**
   - Complex scheduling rules (e.g., "every weekday at 9 AM except holidays")
   - Conditional scheduling based on previous execution results
   - Workflow chaining (trigger workflow B after workflow A completes)

4. **Collaboration Features**
   - Real-time collaborative editing (multiple users editing same workflow)
   - Comments and annotations on nodes
   - Change tracking and diff view
   - Approval workflow for production deployments

5. **Advanced Analytics**
   - Workflow execution analytics dashboard
   - Performance metrics per node type
   - Cost analysis (API calls, execution time)
   - Trend analysis and anomaly detection

### Phase 3 Features

1. **AI-Powered Features**
   - AI-suggested workflow optimizations
   - Auto-generate workflows from natural language descriptions
   - Intelligent error recovery suggestions
   - Predictive execution time estimates

2. **Integration Ecosystem**
   - Webhook trigger nodes
   - API integration nodes (Slack, Jira, GitHub, etc.)
   - Database query nodes
   - File system operation nodes

3. **Advanced Debugging**
   - Time-travel debugging (step backward through execution)
   - Breakpoints on nodes
   - Variable watch expressions
   - Performance profiling per node

4. **Enterprise Features**
   - Role-based access control (RBAC)
   - Audit logs with compliance reporting
   - SSO integration (SAML, OAuth)
   - Multi-tenancy support

## Conclusion

The Agentic Workflow Builder represents a significant enhancement to the CI/CD dashboard, enabling users to create sophisticated test automation workflows through an intuitive visual interface. By leveraging existing infrastructure and following established design patterns, the implementation can be completed efficiently while maintaining high quality and performance standards.

The design prioritizes:
- **User Experience**: Intuitive drag-and-drop interface with real-time feedback
- **Integration**: Seamless integration with existing test execution and AI evaluation systems
- **Extensibility**: Modular architecture that supports easy addition of new node types
- **Performance**: Optimized rendering and execution for workflows with up to 100 nodes
- **Security**: Robust authentication, authorization, and input validation
- **Reliability**: Comprehensive error handling and execution monitoring

The phased approach allows for iterative development and validation, ensuring that core functionality is solid before adding advanced features. The architecture supports future enhancements while maintaining backward compatibility with existing workflows.
