-- Migration to add user_id for data isolation

ALTER TABLE test_runs ADD COLUMN user_id INT AFTER id;
ALTER TABLE test_runs ADD CONSTRAINT fk_test_runs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE presets ADD COLUMN user_id INT AFTER id;
ALTER TABLE presets ADD CONSTRAINT fk_presets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE activity_logs ADD COLUMN user_id INT AFTER id;
ALTER TABLE activity_logs ADD CONSTRAINT fk_activity_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE notifications ADD COLUMN user_id INT AFTER id;
ALTER TABLE notifications ADD CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE schedules ADD COLUMN user_id INT AFTER id;
ALTER TABLE schedules ADD CONSTRAINT fk_schedules_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
