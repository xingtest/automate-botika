# Requirements Document

## Introduction

The Agentic Workflow Builder is a visual drag-and-drop interface for creating, configuring, and executing automated testing workflows in the CI/CD dashboard. Similar to n8n, this feature enables users to design complex test automation flows by connecting nodes that represent different actions (test execution, AI evaluation, conditional logic, data transformation, notifications, etc.) without writing code. The workflow builder integrates seamlessly with the existing dashboard's test execution system, AI evaluation capabilities, and reporting infrastructure.

## Glossary

- **Workflow_Builder**: The visual canvas interface where users create workflows by dragging and connecting nodes
- **Workflow_Node**: A single unit of work in a workflow (e.g., Run Test, Evaluate Response, Send Notification)
- **Workflow_Connection**: A directed edge connecting two nodes, representing data flow and execution order
- **Workflow_Canvas**: The main drawing area where nodes and connections are displayed
- **Workflow_Definition**: The complete specification of a workflow including all nodes, connections, and configurations
- **Node_Configuration**: The settings and parameters specific to each node type
- **Execution_Context**: Runtime data passed between nodes during workflow execution
- **Trigger_Node**: A special node type that initiates workflow execution (manual, scheduled, webhook, event-based)
- **Action_Node**: A node that performs an operation (test execution, data transformation, API call)
- **Condition_Node**: A node that evaluates expressions and routes execution based on results
- **Workflow_Template**: A pre-configured workflow that users can clone and customize
- **Node_Library**: The collection of available node types users can add to workflows
- **Workflow_Executor**: The backend service that processes and executes workflow definitions
- **Workflow_State**: The current execution status and data of a running workflow
- **Dashboard**: The existing CI/CD automation testing dashboard application

## Requirements

### Requirement 1: Visual Workflow Canvas

**User Story:** As a test automation engineer, I want a visual canvas where I can drag and drop nodes to create test workflows, so that I can design complex automation sequences without writing code.

#### Acceptance Criteria

1. THE Workflow_Canvas SHALL render a zoomable and pannable grid-based drawing area
2. WHEN a user drags a node from the Node_Library, THE Workflow_Canvas SHALL display a ghost preview of the node
3. WHEN a user drops a node onto the Workflow_Canvas, THE Workflow_Builder SHALL create a new Workflow_Node instance at the drop location
4. THE Workflow_Canvas SHALL support zoom levels between 25% and 200%
5. WHEN a user pans the Workflow_Canvas, THE Workflow_Builder SHALL maintain node positions relative to the canvas coordinate system
6. THE Workflow_Canvas SHALL display a minimap showing the entire workflow when the canvas contains more than 10 nodes
7. THE Workflow_Builder SHALL persist canvas zoom and pan state in localStorage
8. THE Workflow_Canvas SHALL use the existing dashboard glass-morphism design style with dark/light theme support

### Requirement 2: Node Library and Types

**User Story:** As a test automation engineer, I want access to a library of pre-built node types, so that I can quickly assemble workflows using common testing operations.

#### Acceptance Criteria

1. THE Node_Library SHALL provide at least the following node categories: Triggers, Test Actions, AI Evaluation, Data Processing, Flow Control, Notifications, and Integrations
2. THE Node_Library SHALL include a "Manual Trigger" node type that starts workflow execution on user command
3. THE Node_Library SHALL include a "Schedule Trigger" node type that starts workflow execution based on cron expressions
4. THE Node_Library SHALL include a "Run Test" node type that executes tests on specified platforms (webchat, telegram, instagram, facebook, dhai)
5. THE Node_Library SHALL include an "AI Evaluate" node type that evaluates test responses using configured AI providers (Gemini, Groq, Cerebras, OpenAI, Custom)
6. THE Node_Library SHALL include a "Condition" node type that evaluates expressions and routes execution to different branches
7. THE Node_Library SHALL include a "Transform Data" node type that maps, filters, and transforms data between nodes
8. THE Node_Library SHALL include a "Send Notification" node type that creates dashboard notifications
9. THE Node_Library SHALL include a "Generate Report" node type that creates test reports in JSON, HTML, or Excel formats
10. THE Node_Library SHALL include a "Wait" node type that pauses execution for a specified duration
11. WHEN a user searches the Node_Library, THE Workflow_Builder SHALL filter nodes by name, category, and description
12. THE Node_Library SHALL display each node type with an icon, name, and brief description

### Requirement 3: Node Configuration Interface

**User Story:** As a test automation engineer, I want to configure each node's parameters through an intuitive interface, so that I can customize node behavior without manual JSON editing.

#### Acceptance Criteria

1. WHEN a user double-clicks a Workflow_Node, THE Workflow_Builder SHALL open a configuration panel for that node
2. THE Node_Configuration panel SHALL display all configurable parameters for the selected node type
3. THE Node_Configuration panel SHALL validate parameter values in real-time and display error messages for invalid inputs
4. THE Node_Configuration panel SHALL support the following input types: text, number, select dropdown, multi-select, boolean toggle, JSON editor, expression builder, and file upload
5. WHEN a user configures a "Run Test" node, THE Node_Configuration SHALL provide fields for platform selection, test data file, tester name, greeting message, and platform-specific URLs
6. WHEN a user configures an "AI Evaluate" node, THE Node_Configuration SHALL provide fields for AI provider selection, evaluation criteria, scoring thresholds, and custom prompts
7. WHEN a user configures a "Condition" node, THE Node_Configuration SHALL provide an expression builder with autocomplete for available variables from previous nodes
8. THE Node_Configuration panel SHALL display a "Test" button that executes the node in isolation with sample data
9. THE Node_Configuration panel SHALL save changes automatically when the user closes the panel
10. THE Workflow_Builder SHALL highlight nodes with incomplete or invalid configurations in red

### Requirement 4: Node Connections and Data Flow

**User Story:** As a test automation engineer, I want to connect nodes together to define execution order and data flow, so that I can create sequential and branching workflows.

#### Acceptance Criteria

1. WHEN a user drags from a node's output port, THE Workflow_Builder SHALL display a connection line following the cursor
2. WHEN a user drops a connection onto a valid input port, THE Workflow_Builder SHALL create a Workflow_Connection between the nodes
3. THE Workflow_Builder SHALL prevent connections that would create circular dependencies
4. THE Workflow_Builder SHALL display connection lines as curved Bezier paths with directional arrows
5. WHEN a user hovers over a Workflow_Connection, THE Workflow_Builder SHALL highlight the connection and display a delete button
6. THE Workflow_Builder SHALL support multiple output connections from a single node (for branching)
7. THE Workflow_Builder SHALL limit input connections to one per input port (except for merge nodes)
8. WHEN a user deletes a Workflow_Node, THE Workflow_Builder SHALL automatically delete all connected Workflow_Connections
9. THE Workflow_Builder SHALL display data type indicators on connection ports (string, number, object, array, boolean, any)
10. THE Workflow_Builder SHALL validate that connected ports have compatible data types and display warnings for type mismatches

### Requirement 5: Workflow Execution Engine

**User Story:** As a test automation engineer, I want to execute workflows and see real-time progress, so that I can monitor test automation runs and debug issues.

#### Acceptance Criteria

1. WHEN a user clicks "Run Workflow", THE Workflow_Executor SHALL validate the Workflow_Definition for completeness and correctness
2. IF the Workflow_Definition is invalid, THEN THE Workflow_Builder SHALL display validation errors and prevent execution
3. WHEN workflow execution starts, THE Workflow_Executor SHALL initialize the Execution_Context with trigger node data
4. THE Workflow_Executor SHALL execute nodes in topological order based on Workflow_Connections
5. WHEN a node completes execution, THE Workflow_Executor SHALL pass output data to connected downstream nodes via the Execution_Context
6. THE Workflow_Builder SHALL display real-time execution status on each node (pending, running, success, failed, skipped)
7. WHEN a node is executing, THE Workflow_Builder SHALL display a pulsing animation on that node
8. WHEN a node fails, THE Workflow_Executor SHALL halt execution and display the error message on the failed node
9. THE Workflow_Builder SHALL provide a "Continue on Error" option for each node that allows execution to proceed despite failures
10. THE Workflow_Builder SHALL display execution duration for each node and total workflow execution time
11. THE Workflow_Executor SHALL log all execution events to the activity feed
12. WHEN workflow execution completes, THE Workflow_Builder SHALL display a summary notification with success/failure counts

### Requirement 6: Workflow Persistence and Management

**User Story:** As a test automation engineer, I want to save, load, and manage multiple workflows, so that I can reuse and organize my automation configurations.

#### Acceptance Criteria

1. THE Workflow_Builder SHALL provide a "Save Workflow" button that persists the current Workflow_Definition
2. WHEN a user saves a workflow, THE Workflow_Builder SHALL prompt for a workflow name and optional description
3. THE Workflow_Builder SHALL store Workflow_Definitions in the MySQL database with user_id association
4. THE Workflow_Builder SHALL provide a "Load Workflow" dialog that displays all saved workflows for the current user
5. THE Workflow_Builder SHALL display workflow cards showing name, description, node count, last modified date, and thumbnail preview
6. WHEN a user loads a workflow, THE Workflow_Builder SHALL clear the current canvas and render the loaded Workflow_Definition
7. THE Workflow_Builder SHALL provide a "Duplicate Workflow" action that creates a copy with a new name
8. THE Workflow_Builder SHALL provide a "Delete Workflow" action with confirmation dialog
9. THE Workflow_Builder SHALL support exporting workflows as JSON files for backup and sharing
10. THE Workflow_Builder SHALL support importing workflows from JSON files
11. THE Workflow_Builder SHALL track workflow version history and allow reverting to previous versions
12. THE Workflow_Builder SHALL auto-save workflow changes every 30 seconds to prevent data loss

### Requirement 7: Workflow Templates

**User Story:** As a test automation engineer, I want to start from pre-built workflow templates, so that I can quickly create common testing scenarios without building from scratch.

#### Acceptance Criteria

1. THE Workflow_Builder SHALL provide a "Templates" library with at least 5 pre-configured Workflow_Templates
2. THE Workflow_Builder SHALL include a "Simple Platform Test" template that runs tests on a single platform and generates a report
3. THE Workflow_Builder SHALL include a "Multi-Platform Batch Test" template that runs tests across all platforms in parallel
4. THE Workflow_Builder SHALL include an "AI Evaluation Pipeline" template that runs tests, evaluates responses with AI, and sends notifications based on score thresholds
5. THE Workflow_Builder SHALL include a "Scheduled Regression Test" template with schedule trigger and email notifications
6. THE Workflow_Builder SHALL include a "Conditional Test Flow" template demonstrating branching logic based on test results
7. WHEN a user selects a Workflow_Template, THE Workflow_Builder SHALL create a new workflow pre-populated with the template's nodes and connections
8. THE Workflow_Builder SHALL allow users to save their own workflows as custom templates
9. THE Workflow_Builder SHALL display template cards with name, description, preview image, and node count

### Requirement 8: Integration with Existing Dashboard Features

**User Story:** As a test automation engineer, I want workflows to integrate seamlessly with existing dashboard features, so that I can leverage current test execution, reporting, and scheduling capabilities.

#### Acceptance Criteria

1. THE Workflow_Builder SHALL reuse existing test execution logic from the "Run Tests" page for "Run Test" nodes
2. THE Workflow_Builder SHALL reuse existing AI evaluation logic from the "Judge" feature for "AI Evaluate" nodes
3. WHEN a workflow generates test results, THE Workflow_Executor SHALL store results in the test_runs and test_results tables using the existing schema
4. THE Workflow_Builder SHALL display workflow executions in the "Run History" page alongside manual test runs
5. THE Workflow_Builder SHALL support creating artifacts (JSON, HTML, Excel, screenshots) and storing them in the artifacts table
6. THE Workflow_Builder SHALL integrate with the existing scheduler to enable scheduled workflow execution
7. THE Workflow_Builder SHALL post execution events to the activity_logs table
8. THE Workflow_Builder SHALL support loading test data from presets configured in the "Test Presets" page
9. THE Workflow_Builder SHALL respect user authentication and only display workflows owned by the current user
10. THE Workflow_Builder SHALL use the existing BackendAPI client for all server communication

### Requirement 9: Workflow Debugging and Monitoring

**User Story:** As a test automation engineer, I want to debug workflows by inspecting node inputs/outputs and execution logs, so that I can troubleshoot failures and optimize performance.

#### Acceptance Criteria

1. THE Workflow_Builder SHALL provide a "Debug Mode" toggle that enables detailed execution logging
2. WHEN Debug Mode is enabled, THE Workflow_Builder SHALL display input and output data for each executed node
3. THE Workflow_Builder SHALL provide a "Step Through" execution mode that pauses after each node and waits for user confirmation
4. WHEN a user clicks on a completed node, THE Workflow_Builder SHALL display a panel showing execution logs, input data, output data, and execution duration
5. THE Workflow_Builder SHALL highlight the data flow path when a user hovers over a Workflow_Connection
6. THE Workflow_Builder SHALL provide a "Replay Execution" feature that re-runs a workflow using saved execution data
7. THE Workflow_Builder SHALL display execution history for each workflow with timestamps, duration, status, and error messages
8. THE Workflow_Builder SHALL provide a "Test Node" feature that executes a single node with mock input data
9. THE Workflow_Builder SHALL validate expressions in Condition nodes and display evaluation results in debug mode
10. THE Workflow_Builder SHALL log all workflow executions to the activity feed with detailed status information

### Requirement 10: User Interface and Navigation

**User Story:** As a test automation engineer, I want the workflow builder to be accessible from the dashboard navigation and follow the existing UI design patterns, so that it feels like a native part of the application.

#### Acceptance Criteria

1. THE Dashboard SHALL add a new navigation link "Workflow Builder" under the "Main" section in the sidebar
2. THE Dashboard SHALL use the icon "fa-project-diagram" for the Workflow Builder navigation link
3. WHEN a user navigates to the Workflow Builder page, THE Dashboard SHALL display the Workflow_Canvas as the main content area
4. THE Workflow_Builder SHALL display a toolbar at the top with buttons for: New Workflow, Save, Load, Run, Stop, Debug Mode, Templates, Export, Import, and Settings
5. THE Workflow_Builder SHALL display the Node_Library in a collapsible left panel with category tabs
6. THE Workflow_Builder SHALL display node configuration in a right panel that slides in when a node is selected
7. THE Workflow_Builder SHALL display execution logs in a bottom panel that can be expanded, collapsed, or hidden
8. THE Workflow_Builder SHALL use the existing glass-morphism card style for all panels and dialogs
9. THE Workflow_Builder SHALL support keyboard shortcuts: Ctrl+S (save), Ctrl+R (run), Delete (delete selected), Ctrl+Z (undo), Ctrl+Y (redo), Ctrl+C (copy), Ctrl+V (paste)
10. THE Workflow_Builder SHALL display a breadcrumb showing: Home / Workflow Builder / [Workflow Name]
11. THE Workflow_Builder SHALL adapt to mobile screens by stacking panels vertically and providing a simplified touch interface

### Requirement 11: Workflow Validation and Error Handling

**User Story:** As a test automation engineer, I want the workflow builder to validate my workflow configuration and provide clear error messages, so that I can fix issues before execution.

#### Acceptance Criteria

1. THE Workflow_Builder SHALL validate that every workflow has exactly one Trigger_Node
2. THE Workflow_Builder SHALL validate that all nodes except Trigger_Node have at least one incoming connection
3. THE Workflow_Builder SHALL validate that all required node parameters are configured before execution
4. THE Workflow_Builder SHALL validate that Workflow_Connections do not create circular dependencies
5. THE Workflow_Builder SHALL validate that expression syntax in Condition nodes is correct
6. WHEN validation fails, THE Workflow_Builder SHALL display error indicators on invalid nodes and connections
7. THE Workflow_Builder SHALL provide a "Validate Workflow" button that runs all validation checks and displays a report
8. THE Workflow_Builder SHALL display validation errors in a panel with node names, error descriptions, and "Go to Node" links
9. IF a node fails during execution, THEN THE Workflow_Executor SHALL capture the error message, stack trace, and input data
10. THE Workflow_Builder SHALL provide a "Retry Failed Node" action that re-executes a failed node with the same input data

### Requirement 12: Performance and Scalability

**User Story:** As a test automation engineer, I want the workflow builder to handle large workflows efficiently, so that I can create complex automation sequences without performance degradation.

#### Acceptance Criteria

1. THE Workflow_Canvas SHALL render workflows with up to 100 nodes without noticeable lag (< 100ms frame time)
2. THE Workflow_Builder SHALL use virtualization to render only visible nodes when the workflow contains more than 50 nodes
3. THE Workflow_Executor SHALL support parallel execution of independent node branches
4. THE Workflow_Executor SHALL limit concurrent node execution to 5 nodes to prevent resource exhaustion
5. THE Workflow_Builder SHALL debounce auto-save operations to prevent excessive database writes
6. THE Workflow_Builder SHALL compress Workflow_Definitions before storing in the database to reduce storage size
7. THE Workflow_Builder SHALL load workflow thumbnails lazily in the workflow list to improve initial load time
8. THE Workflow_Executor SHALL implement a timeout mechanism that cancels node execution after 5 minutes by default
9. THE Workflow_Builder SHALL provide a progress indicator during workflow execution showing completed/total nodes
10. THE Workflow_Builder SHALL cache Node_Library metadata in localStorage to reduce server requests

### Requirement 13: Security and Access Control

**User Story:** As a system administrator, I want workflow execution to respect user permissions and prevent unauthorized access, so that workflows cannot be exploited for malicious purposes.

#### Acceptance Criteria

1. THE Workflow_Builder SHALL require user authentication via the existing AuthManager before allowing access
2. THE Workflow_Builder SHALL associate all saved workflows with the authenticated user's user_id
3. THE Workflow_Builder SHALL prevent users from loading or executing workflows owned by other users
4. THE Workflow_Executor SHALL validate that the authenticated user has permission to execute the requested workflow
5. THE Workflow_Builder SHALL sanitize all user inputs in node configurations to prevent XSS attacks
6. THE Workflow_Executor SHALL validate all API requests include a valid authentication token
7. THE Workflow_Builder SHALL prevent workflows from accessing file system paths outside the designated artifacts directory
8. THE Workflow_Builder SHALL rate-limit workflow execution to 10 concurrent workflows per user
9. THE Workflow_Builder SHALL log all workflow creation, modification, and execution events to the activity_logs table with user_id
10. THE Workflow_Builder SHALL provide an admin view (for future implementation) that displays all workflows across all users

### Requirement 14: Node Type: Run Test

**User Story:** As a test automation engineer, I want a "Run Test" node that executes tests on specified platforms, so that I can integrate test execution into workflows.

#### Acceptance Criteria

1. THE "Run Test" node SHALL accept configuration parameters: platform (webchat, telegram, instagram, facebook, dhai), test_data_file, tester_name, greeting, and platform-specific URLs
2. THE "Run Test" node SHALL accept input data from upstream nodes to override configuration parameters
3. WHEN the "Run Test" node executes, THE Workflow_Executor SHALL invoke the existing test execution logic from the Dashboard
4. THE "Run Test" node SHALL create a test_runs record in the database with a unique test_id
5. THE "Run Test" node SHALL output the following data: test_id, run_id, platform, status, total_questions, success_count, failed_count, avg_score, duration, and results array
6. THE "Run Test" node SHALL support batch execution by accepting an array of platform configurations
7. IF test execution fails, THEN THE "Run Test" node SHALL output an error object with error_message and error_code
8. THE "Run Test" node SHALL display real-time progress during execution showing current question number and total questions
9. THE "Run Test" node SHALL support loading test data from uploaded files or from preset configurations
10. THE "Run Test" node SHALL respect the user's configured AI evaluation settings (provider, API keys)

### Requirement 15: Node Type: AI Evaluate

**User Story:** As a test automation engineer, I want an "AI Evaluate" node that evaluates test responses using AI, so that I can add intelligent scoring to workflows.

#### Acceptance Criteria

1. THE "AI Evaluate" node SHALL accept configuration parameters: ai_provider (gemini, groq, cerebras, openai, custom), evaluation_criteria, scoring_threshold, and custom_prompt
2. THE "AI Evaluate" node SHALL accept input data containing: question, expected_response, actual_response, and context
3. WHEN the "AI Evaluate" node executes, THE Workflow_Executor SHALL invoke the configured AI provider's API
4. THE "AI Evaluate" node SHALL output the following data: score (0-1), explanation, passed (boolean), confidence, and evaluation_time
5. THE "AI Evaluate" node SHALL use the user's configured API keys from the users table
6. THE "AI Evaluate" node SHALL support batch evaluation by accepting an array of question/response pairs
7. IF AI evaluation fails, THEN THE "AI Evaluate" node SHALL output an error object and optionally continue with a default score
8. THE "AI Evaluate" node SHALL cache evaluation results to avoid redundant API calls for identical inputs
9. THE "AI Evaluate" node SHALL support custom evaluation prompts with variable substitution ({{question}}, {{expected}}, {{actual}})
10. THE "AI Evaluate" node SHALL display the AI provider's response time and token usage in debug mode

### Requirement 16: Node Type: Condition

**User Story:** As a test automation engineer, I want a "Condition" node that routes execution based on expressions, so that I can create branching workflows with conditional logic.

#### Acceptance Criteria

1. THE "Condition" node SHALL accept a JavaScript expression that evaluates to a boolean value
2. THE "Condition" node SHALL provide two output ports: "true" and "false"
3. WHEN the "Condition" node executes, THE Workflow_Executor SHALL evaluate the expression using the current Execution_Context
4. THE "Condition" node SHALL route execution to the "true" output if the expression evaluates to true, otherwise to the "false" output
5. THE "Condition" node SHALL support accessing upstream node outputs using dot notation (e.g., `runTest.avg_score > 0.8`)
6. THE "Condition" node SHALL provide an expression builder UI with autocomplete for available variables
7. THE "Condition" node SHALL validate expression syntax in real-time and display syntax errors
8. THE "Condition" node SHALL support common operators: ==, !=, <, >, <=, >=, &&, ||, !, +, -, *, /, %
9. THE "Condition" node SHALL support common functions: Math.*, String.*, Array.*, includes(), startsWith(), endsWith()
10. THE "Condition" node SHALL display the evaluated expression result in debug mode

### Requirement 17: Node Type: Transform Data

**User Story:** As a test automation engineer, I want a "Transform Data" node that maps and transforms data between nodes, so that I can adapt data formats for downstream nodes.

#### Acceptance Criteria

1. THE "Transform Data" node SHALL accept a mapping configuration that defines output fields based on input fields
2. THE "Transform Data" node SHALL support the following transformation operations: map, filter, reduce, sort, group, flatten, and custom JavaScript
3. WHEN the "Transform Data" node executes, THE Workflow_Executor SHALL apply the configured transformations to the input data
4. THE "Transform Data" node SHALL output the transformed data object
5. THE "Transform Data" node SHALL provide a visual mapping interface where users can drag input fields to output fields
6. THE "Transform Data" node SHALL support JSONPath expressions for accessing nested data (e.g., `$.results[*].score`)
7. THE "Transform Data" node SHALL support template strings with variable substitution (e.g., `"Test ${platform} completed"`)
8. THE "Transform Data" node SHALL validate that output data matches the expected schema for downstream nodes
9. THE "Transform Data" node SHALL display input and output data side-by-side in debug mode
10. THE "Transform Data" node SHALL provide common transformation templates: array to object, object to array, flatten nested, extract fields

### Requirement 18: Node Type: Generate Report

**User Story:** As a test automation engineer, I want a "Generate Report" node that creates test reports, so that I can produce formatted output from workflow results.

#### Acceptance Criteria

1. THE "Generate Report" node SHALL accept configuration parameters: report_format (json, html, excel), template, output_filename, and include_screenshots
2. THE "Generate Report" node SHALL accept input data containing test results, scores, and metadata
3. WHEN the "Generate Report" node executes, THE Workflow_Executor SHALL generate a report file in the specified format
4. THE "Generate Report" node SHALL store the generated report in the artifacts table with artifact_type matching the report_format
5. THE "Generate Report" node SHALL output the following data: artifact_id, filename, file_path, file_size, and download_url
6. THE "Generate Report" node SHALL reuse existing report generation logic from the Dashboard's report-generator.ts
7. THE "Generate Report" node SHALL support custom HTML templates with variable substitution
8. THE "Generate Report" node SHALL include execution metadata: workflow_name, execution_time, total_duration, node_count
9. THE "Generate Report" node SHALL support generating multiple report formats in a single execution
10. THE "Generate Report" node SHALL provide a preview of the generated report in the node configuration panel

### Requirement 19: Node Type: Send Notification

**User Story:** As a test automation engineer, I want a "Send Notification" node that creates dashboard notifications, so that I can alert users about workflow events.

#### Acceptance Criteria

1. THE "Send Notification" node SHALL accept configuration parameters: title, message, type (info, success, warning, error), and recipients
2. THE "Send Notification" node SHALL accept input data to populate notification content using template variables
3. WHEN the "Send Notification" node executes, THE Workflow_Executor SHALL create a record in the notifications table
4. THE "Send Notification" node SHALL support template strings in title and message with variable substitution
5. THE "Send Notification" node SHALL output the following data: notification_id, created_at, and delivery_status
6. THE "Send Notification" node SHALL display the notification in the Dashboard's notification panel
7. THE "Send Notification" node SHALL support conditional notifications based on input data (e.g., only notify on failure)
8. THE "Send Notification" node SHALL support rich formatting in messages including bold, italic, code blocks, and links
9. THE "Send Notification" node SHALL provide notification templates: Test Complete, Test Failed, High Score Alert, Low Score Alert
10. THE "Send Notification" node SHALL support future email/webhook delivery (for future implementation)

### Requirement 20: Workflow Sharing and Collaboration

**User Story:** As a test automation engineer, I want to share workflows with team members, so that we can collaborate on automation configurations.

#### Acceptance Criteria

1. THE Workflow_Builder SHALL provide a "Share Workflow" button that generates a shareable link
2. THE Workflow_Builder SHALL support sharing workflows as read-only or editable
3. WHEN a user accesses a shared workflow link, THE Workflow_Builder SHALL load the workflow in read-only mode by default
4. THE Workflow_Builder SHALL provide a "Clone to My Workflows" action for shared workflows
5. THE Workflow_Builder SHALL track workflow ownership and display the creator's username on workflow cards
6. THE Workflow_Builder SHALL support adding collaborators by username who can view and edit the workflow
7. THE Workflow_Builder SHALL log all workflow modifications with user attribution in the activity_logs table
8. THE Workflow_Builder SHALL provide a "Workflow Permissions" dialog showing all users with access
9. THE Workflow_Builder SHALL support revoking access for specific users
10. THE Workflow_Builder SHALL display a "Shared with me" section in the workflow list showing workflows shared by others

