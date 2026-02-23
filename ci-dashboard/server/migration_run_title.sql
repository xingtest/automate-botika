-- Migration to add run_title to test_runs
ALTER TABLE test_runs ADD COLUMN run_title VARCHAR(255) AFTER test_id;
