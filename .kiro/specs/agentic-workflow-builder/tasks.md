# Implementation Plan: Agentic Workflow Builder

## Overview

This implementation plan breaks down the Agentic Workflow Builder feature into discrete, actionable tasks. The workflow builder is a visual drag-and-drop interface for creating automated testing workflows, similar to n8n. It integrates with the existing CI/CD dashboard's vanilla JavaScript frontend, Express.js backend, and MySQL database.

The implementation follows a bottom-up approach: database schema → backend API → execution engine → frontend components → integration → templates and sharing.

## Tasks

- [x] 1. Set up database schema and backend infrastructure
  - Create database migration for workflow-related tables (workflows, workflow_versions, workflow_executions, node_executions, workflow_permissions)
  - Add indexes for performance optimization
  - Create database connection utilities if not already present
  - _Requirements: 6.3, 6.11, 13.9_

- [x] 2. Implement backend API routes and controllers
  - [x] 2.1 Create workflow CRUD API endpoints
    - Implement POST /api/workflows (create workflow)
    - Implement GET /api/workflows (list user's workflows)
    - Implement GET /api/workflows/:id (get workflow by ID)
    - Implement PUT /api/workflows/:id (update workflow)
    - Implement DELETE /api/workflows/:id (delete workflow)
    - Implement POST /api/workflows/:id/duplicate (duplicate workflow)
    - Add authentication middleware to verify user ownership
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.7, 6.8, 8.9, 13.2, 13.3_

  - [x] 2.2 Create workflow version history endpoints
    - Implement GET /api/workflows/:id/versions (get version history)
    - Implement POST /api/workflows/:id/revert/:version (revert to version)
    - Store version snapshots on each save
    - _Requirements: 6.11_

  - [x] 2.3 Create workflow execution endpoints
    - Implement POST /api/workflows/:id/execute (trigger execution)
    - Implement GET /api/workflows/executions (list executions)
    - Implement GET /api/workflows/executions/:id (get execution details)
    - Implement POST /api/workflows/executions/:id/cancel (cancel execution)
    - Implement GET /api/workflows/executions/:id/logs (get execution logs)
    - _Requirements: 5.1, 5.11, 9.7, 13.4_

  - [x] 2.4 Create workflow validation endpoint
    - Implement POST /api/workflows/validate (validate workflow definition)
    - Return detailed validation errors with node references
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.7_

  - [x] 2.5 Create node types metadata endpoint
    - Implement GET /api/workflows/node-types (list available node types)
    - Implement GET /api/workflows/node-types/:type (get node schema)
    - Return node schemas with configuration fields and port definitions
    - _Requirements: 2.1, 2.11, 2.12_

- [x] 3. Implement workflow validation logic
  - [x] 3.1 Create workflow validator module
    - Validate exactly one trigger node exists
    - Validate all non-trigger nodes have incoming connections
    - Validate no circular dependencies using topological sort
    - Validate all required node parameters are configured
    - Validate expression syntax in condition nodes
    - Validate connection data type compatibility
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.8_

  - [ ]* 3.2 Write unit tests for validator
    - Test circular dependency detection
    - Test orphaned node detection
    - Test missing trigger node detection
    - Test multiple trigger nodes detection
    - Test required parameter validation
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

- [x] 4. Implement workflow execution engine
  - [x] 4.1 Create execution context manager
    - Implement ExecutionContext class to store node outputs and state
    - Implement context isolation for concurrent executions
    - Implement input/output data passing between nodes
    - Ensure output immutability after node completion
    - _Requirements: 5.3, 5.5, 10, 11_

  - [x] 4.2 Create topological sort algorithm
    - Implement graph traversal for execution order
    - Detect and prevent circular dependencies
    - Handle parallel branch execution
    - _Requirements: 2, 5.4_

  - [x] 4.3 Create workflow executor service
    - Implement workflow execution orchestration
    - Execute nodes in topological order
    - Handle node success/failure states
    - Implement "continue on error" logic
    - Track execution duration per node and total
    - Store execution records in workflow_executions table
    - Store node execution logs in node_executions table
    - _Requirements: 5.1, 5.2, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 7_

  - [x] 4.4 Implement parallel execution for independent branches
    - Identify independent node branches
    - Execute independent nodes concurrently (max 5 concurrent)
    - Aggregate results from parallel executions
    - _Requirements: 12.3, 12.4_

  - [ ]* 4.5 Write unit tests for execution engine
    - Test sequential execution order
    - Test parallel branch execution
    - Test error handling and continue-on-error
    - Test execution context isolation
    - Test data flow between nodes
    - _Requirements: 5.4, 5.5, 5.8, 5.9, 10_

- [ ] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement node type registry and base executors
  - [x] 6.1 Create node registry system
    - Implement NodeRegistry class to store node type definitions
    - Register all available node types with schemas
    - Provide methods to get node executor by type
    - _Requirements: 2.1, 2.12_

  - [x] 6.2 Create base node executor class
    - Implement BaseNode class with execute() method
    - Implement input/output port handling
    - Implement configuration validation
    - Implement error handling and logging
    - _Requirements: 3.3, 3.9_

  - [x] 6.3 Implement trigger node executors
    - Implement ManualTriggerNode executor
    - Implement ScheduleTriggerNode executor (integrate with existing scheduler)
    - _Requirements: 2.2, 2.3_

- [x] 7. Implement action node executors
  - [x] 7.1 Implement Run Test node executor
    - Integrate with existing platform executors (src/platforms/*.ts)
    - Support all platforms (webchat, telegram, instagram, facebook, dhai)
    - Accept configuration: platform, test_data_file, tester_name, greeting, platform_url
    - Store test results in test_runs and test_results tables
    - Output test results with run_id, test_id, platform, status, scores, results array
    - _Requirements: 2.4, 8.1, 8.4, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 14.9, 14.10_

  - [x] 7.2 Implement AI Evaluate node executor
    - Integrate with existing AI evaluator (src/utils/ai-evaluator.ts)
    - Support all AI providers (gemini, groq, cerebras, openai, custom)
    - Accept configuration: ai_provider, scoring_threshold, custom_prompt
    - Use user's API keys from database
    - Output evaluation results with scores, explanations, pass/fail status
    - Implement result caching to avoid redundant API calls
    - _Requirements: 2.5, 8.2, 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9, 15.10_

  - [x] 7.3 Implement Generate Report node executor
    - Integrate with existing report generator (src/utils/report-generator.ts)
    - Support formats: json, html, excel
    - Accept configuration: report_format, template, output_filename, include_screenshots
    - Store generated reports in artifacts table
    - Output artifact metadata with download URL
    - _Requirements: 2.9, 8.5, 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 18.8, 18.9, 18.10_

  - [x] 7.4 Implement Send Notification node executor
    - Create notifications in notifications table
    - Support notification types: info, success, warning, error
    - Accept configuration: title, message, type, recipients
    - Support template variable substitution
    - Display notifications in dashboard notification panel
    - _Requirements: 2.8, 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7, 19.8, 19.9, 19.10_

  - [ ]* 7.5 Write unit tests for action nodes
    - Test Run Test node with mock platform executor
    - Test AI Evaluate node with mock AI provider
    - Test Generate Report node with mock report generator
    - Test Send Notification node
    - _Requirements: 14.1, 15.1, 18.1, 19.1_

- [x] 8. Implement control flow node executors
  - [x] 8.1 Implement Condition node executor
    - Implement safe JavaScript expression evaluation (sandboxed)
    - Support accessing upstream node outputs via dot notation
    - Route execution to "true" or "false" output based on expression result
    - Support common operators and functions
    - _Requirements: 2.6, 16.1, 16.2, 16.3, 16.4, 16.5, 16.7, 16.8, 16.9, 16.10_

  - [x] 8.2 Implement Wait node executor
    - Pause execution for specified duration
    - Accept configuration: duration_seconds
    - Output actual wait duration
    - _Requirements: 2.10_

  - [ ]* 8.3 Write unit tests for control flow nodes
    - Test Condition node with various expressions
    - Test Wait node timing accuracy
    - _Requirements: 16.1, 2.10_

- [x] 9. Implement data transformation node executors
  - [x] 9.1 Implement Transform Data node executor
    - Support transformation operations: map, filter, reduce, sort, group, flatten, custom
    - Support JSONPath expressions for nested data access
    - Support template strings with variable substitution
    - Validate output data schema
    - _Requirements: 2.7, 17.1, 17.2, 17.3, 17.4, 17.6, 17.7, 17.8, 17.10_

  - [ ]* 9.2 Write unit tests for transform node
    - Test map, filter, reduce operations
    - Test JSONPath expressions
    - Test template string substitution
    - _Requirements: 17.1, 17.2, 17.3_

- [ ] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Create frontend workflow canvas component
  - [ ] 11.1 Create workflow-canvas.js module
    - Implement zoomable and pannable canvas using HTML5 Canvas or SVG
    - Support zoom levels 25% - 200%
    - Implement grid-based drawing area
    - Persist zoom and pan state in localStorage
    - Display minimap when workflow has > 10 nodes
    - _Requirements: 1.1, 1.4, 1.5, 1.6, 1.7, 1.8_

  - [ ] 11.2 Implement drag-and-drop node creation
    - Handle drag from node library
    - Display ghost preview during drag
    - Create node instance on drop
    - Position node at drop location
    - _Requirements: 1.2, 1.3_

  - [ ] 11.3 Implement node rendering and interaction
    - Render nodes with icons, labels, and ports
    - Support node selection (click)
    - Support node movement (drag)
    - Support node deletion (delete key)
    - Display node status indicators (pending, running, success, failed)
    - Highlight nodes with invalid configurations
    - _Requirements: 3.10, 5.6, 5.7, 5.8, 11.6_

  - [ ] 11.4 Implement connection creation and rendering
    - Handle drag from output port
    - Display connection line following cursor
    - Validate connection target (prevent cycles, type compatibility)
    - Create connection on drop to valid input port
    - Render connections as curved Bezier paths with arrows
    - Display delete button on connection hover
    - Support multiple output connections
    - Limit input connections to one per port
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10_

  - [ ] 11.5 Implement real-time execution visualization
    - Display node status during execution (running, success, failed)
    - Show pulsing animation on running nodes
    - Display execution duration on nodes
    - Highlight data flow path on connection hover
    - _Requirements: 5.6, 5.7, 5.8, 5.10, 9.5_

- [ ] 12. Create frontend node library component
  - [ ] 12.1 Create node-library.js module
    - Display node library in collapsible left panel
    - Organize nodes by category (Triggers, Actions, Control, Transform, Notifications)
    - Display node cards with icon, name, description
    - Implement search and filtering by name, category, description
    - Handle drag initiation for node creation
    - _Requirements: 2.1, 2.11, 2.12, 10.5_

- [ ] 13. Create frontend node configuration component
  - [ ] 13.1 Create node-config-panel.js module
    - Display configuration panel in right panel (slides in on node selection)
    - Generate dynamic forms based on node type schema
    - Support input types: text, number, select, multiselect, boolean, json, expression, file
    - Implement real-time validation with error messages
    - Auto-save changes when panel closes
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.9, 10.6_

  - [ ] 13.2 Implement platform-specific configuration forms
    - Create configuration form for Run Test node (platform, test_data_file, tester_name, greeting, URLs)
    - Create configuration form for AI Evaluate node (ai_provider, scoring_threshold, custom_prompt)
    - Create configuration form for Condition node with expression builder
    - Create configuration form for Transform Data node with mapping interface
    - Create configuration form for Generate Report node (format, template, filename)
    - Create configuration form for Send Notification node (title, message, type, recipients)
    - _Requirements: 3.5, 3.6, 3.7, 14.1, 15.1, 16.1, 17.1, 18.1, 19.1_

  - [ ] 13.3 Implement expression builder for Condition nodes
    - Provide autocomplete for available variables from upstream nodes
    - Validate expression syntax in real-time
    - Display syntax errors
    - _Requirements: 3.7, 16.6, 16.7_

  - [ ] 13.4 Implement "Test Node" feature
    - Add "Test" button to configuration panel
    - Execute node in isolation with sample data
    - Display test results in panel
    - _Requirements: 3.8, 9.8_

- [ ] 14. Create frontend workflow manager component
  - [ ] 14.1 Create workflow-manager.js module
    - Implement "Save Workflow" functionality with name and description prompt
    - Implement "Load Workflow" dialog with workflow cards
    - Display workflow cards with name, description, node count, last modified, thumbnail
    - Implement workflow export to JSON
    - Implement workflow import from JSON
    - Implement auto-save every 30 seconds
    - _Requirements: 6.1, 6.2, 6.4, 6.5, 6.9, 6.10, 6.12, 15_

  - [ ] 14.2 Implement workflow list and filtering
    - Display user's workflows in grid layout
    - Support sorting by name, date, node count
    - Support filtering by name
    - _Requirements: 6.4, 6.5_

- [ ] 15. Create frontend execution monitor component
  - [ ] 15.1 Create execution-monitor.js module
    - Display execution logs in bottom panel (expandable/collapsible)
    - Show real-time status updates via WebSocket or polling
    - Display progress indicator (completed/total nodes)
    - Show execution summary notification on completion
    - _Requirements: 5.6, 5.11, 5.12, 10.7, 12.9_

  - [ ] 15.2 Implement debug mode features
    - Add "Debug Mode" toggle in toolbar
    - Display input/output data for each executed node
    - Implement "Step Through" execution mode
    - Display execution history with timestamps and status
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.7_

  - [ ] 15.3 Implement execution detail panel
    - Show execution logs, input data, output data, duration when clicking completed node
    - Display error messages and stack traces for failed nodes
    - Provide "Retry Failed Node" action
    - _Requirements: 9.4, 11.9, 11.10_

- [ ] 16. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 17. Integrate workflow builder with existing dashboard
  - [ ] 17.1 Add navigation link to sidebar
    - Add "Workflow Builder" link under "Main" section
    - Use icon "fa-project-diagram"
    - Update Router to handle workflow-builder page
    - _Requirements: 10.1, 10.2_

  - [ ] 17.2 Create workflow builder main page
    - Create workflow-builder.html or add page section to index.html
    - Implement toolbar with buttons: New, Save, Load, Run, Stop, Debug, Templates, Export, Import, Settings
    - Layout: Node library (left), Canvas (center), Config panel (right), Logs (bottom)
    - Apply glass-morphism design style consistent with dashboard
    - _Requirements: 10.3, 10.4, 10.5, 10.6, 10.7, 10.8_

  - [ ] 17.3 Implement keyboard shortcuts
    - Ctrl+S: Save workflow
    - Ctrl+R: Run workflow
    - Delete: Delete selected node/connection
    - Ctrl+Z: Undo
    - Ctrl+Y: Redo
    - Ctrl+C: Copy node
    - Ctrl+V: Paste node
    - _Requirements: 10.9_

  - [ ] 17.4 Implement breadcrumb navigation
    - Display: Home / Workflow Builder / [Workflow Name]
    - _Requirements: 10.10_

  - [ ] 17.5 Implement mobile responsive layout
    - Stack panels vertically on mobile
    - Provide simplified touch interface
    - Use bottom sheet for node library
    - Use modal for configuration
    - _Requirements: 10.11_

- [ ] 18. Implement workflow templates
  - [ ] 18.1 Create template management system
    - Create workflow-templates.js module
    - Store templates in database with is_template flag
    - Implement template loading and instantiation
    - _Requirements: 7.1, 7.8_

  - [ ] 18.2 Create pre-built workflow templates
    - Create "Simple Platform Test" template (single platform test + report)
    - Create "Multi-Platform Batch Test" template (parallel tests across all platforms)
    - Create "AI Evaluation Pipeline" template (test + AI eval + conditional notification)
    - Create "Scheduled Regression Test" template (schedule trigger + tests + email notification)
    - Create "Conditional Test Flow" template (test + condition + branching logic)
    - _Requirements: 7.2, 7.3, 7.4, 7.5, 7.6_

  - [ ] 18.3 Implement template UI
    - Add "Templates" button to toolbar
    - Display template library dialog with template cards
    - Show template preview, name, description, node count
    - Implement "Use Template" action to create workflow from template
    - Implement "Save as Template" action for user workflows
    - _Requirements: 7.7, 7.8, 7.9_

- [ ] 19. Implement workflow sharing and permissions
  - [ ] 19.1 Create sharing API endpoints
    - Implement POST /api/workflows/:id/share (generate shareable link)
    - Implement GET /api/workflows/:id/permissions (get permissions)
    - Implement POST /api/workflows/:id/permissions (grant permission)
    - Implement DELETE /api/workflows/:id/permissions/:userId (revoke permission)
    - Implement GET /api/workflows/shared (list workflows shared with user)
    - _Requirements: 20.1, 20.6, 20.8, 20.9, 20.10_

  - [ ] 19.2 Implement sharing UI
    - Add "Share Workflow" button to toolbar
    - Create sharing dialog with permission options (read-only, editable)
    - Display workflow permissions dialog showing all users with access
    - Implement "Clone to My Workflows" action for shared workflows
    - Display "Shared with me" section in workflow list
    - Show creator username on workflow cards
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.8, 20.10_

  - [ ] 19.3 Implement permission enforcement
    - Verify user permissions before allowing workflow access
    - Prevent unauthorized users from loading/executing workflows
    - Log all workflow modifications with user attribution
    - _Requirements: 13.2, 13.3, 13.4, 20.7_

- [ ] 20. Implement security and access control
  - [ ] 20.1 Add authentication checks to all workflow endpoints
    - Verify JWT token on all API requests
    - Associate workflows with authenticated user's user_id
    - Validate user has permission to access requested workflow
    - _Requirements: 13.1, 13.2, 13.3, 13.4_

  - [ ] 20.2 Implement input sanitization
    - Sanitize all user inputs in node configurations (XSS prevention)
    - Validate API request payloads
    - Escape special characters in expressions
    - _Requirements: 13.5_

  - [ ] 20.3 Implement safe expression evaluation
    - Use sandboxed VM for expression evaluation (vm2 or similar)
    - Whitelist allowed functions
    - Implement timeout for long-running expressions (5 seconds)
    - Limit memory usage
    - _Requirements: 13.6_

  - [ ] 20.4 Implement rate limiting
    - Limit workflow execution to 10 concurrent workflows per user
    - Implement API rate limiting (100 requests/minute per user)
    - Implement execution timeout (5 minutes default)
    - _Requirements: 13.8, 12.8_

  - [ ] 20.5 Implement activity logging
    - Log all workflow creation, modification, execution events to activity_logs table
    - Include user_id and timestamp in all logs
    - _Requirements: 8.7, 13.9_

- [ ] 21. Implement performance optimizations
  - [ ] 21.1 Optimize canvas rendering
    - Implement viewport culling (only render visible nodes)
    - Use requestAnimationFrame for smooth animations
    - Debounce pan/zoom events
    - Cache rendered node images
    - _Requirements: 12.1, 12.2_

  - [ ] 21.2 Optimize data persistence
    - Compress workflow definitions before storing in database
    - Debounce auto-save operations
    - Implement lazy loading for workflow thumbnails
    - _Requirements: 12.5, 12.6, 12.7_

  - [ ] 21.3 Optimize execution engine
    - Implement execution queue with priority
    - Cache node executors in memory
    - Use connection pooling for database
    - _Requirements: 12.4, 12.10_

- [ ] 22. Implement error handling and recovery
  - [ ] 22.1 Add comprehensive error handling
    - Implement error response format with error codes
    - Display user-friendly error messages in UI
    - Log errors to activity_logs and console
    - Implement retry mechanism for transient failures
    - _Requirements: 5.8, 11.9_

  - [ ] 22.2 Implement validation error display
    - Display validation errors in panel with node names and descriptions
    - Provide "Go to Node" links in error panel
    - Highlight invalid nodes and connections in canvas
    - _Requirements: 11.6, 11.7, 11.8_

- [ ] 23. Write integration tests
  - [ ]* 23.1 Test workflow CRUD operations
    - Test creating, reading, updating, deleting workflows via API
    - Test workflow version history
    - Test workflow duplication
    - _Requirements: 6.1, 6.2, 6.3, 6.7, 6.11_

  - [ ]* 23.2 Test workflow execution end-to-end
    - Test simple sequential workflow execution
    - Test workflow with branching (condition nodes)
    - Test workflow with parallel branches
    - Test error handling and continue-on-error
    - _Requirements: 5.1, 5.4, 5.8, 5.9_

  - [ ]* 23.3 Test node integrations
    - Test Run Test node with existing test execution service
    - Test AI Evaluate node with existing AI evaluator
    - Test Generate Report node with existing report generator
    - Test Send Notification node with notifications table
    - _Requirements: 8.1, 8.2, 8.5, 14.1, 15.1, 18.1, 19.1_

  - [ ]* 23.4 Test sharing and permissions
    - Test workflow sharing with different permission levels
    - Test permission enforcement
    - Test cloning shared workflows
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.6_

- [ ] 24. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 25. Create documentation and user guide
  - Create README.md with setup instructions
  - Document API endpoints with request/response examples
  - Create user guide for workflow builder UI
  - Document node types and their configurations
  - Document workflow templates and use cases

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- The implementation uses JavaScript (Vanilla JS frontend + Express.js backend) as confirmed by the user
- Integration with existing dashboard features (test execution, AI evaluation, reporting) is prioritized to avoid code duplication
- Security and performance considerations are integrated throughout the implementation
- The workflow builder follows the existing dashboard's glass-morphism design style and authentication patterns
