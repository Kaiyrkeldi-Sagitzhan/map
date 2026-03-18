-- Migration: Create geo_object_history table
-- Stores history of changes to geo objects

CREATE TABLE IF NOT EXISTS geo_object_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    object_id UUID NOT NULL,
    user_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('create', 'update', 'delete')),
    description TEXT NOT NULL,
    before_snapshot JSONB,
    after_snapshot JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for faster queries by object_id
CREATE INDEX IF NOT EXISTS idx_geo_object_history_object_id 
ON geo_object_history(object_id);

-- Index for faster queries by user_id
CREATE INDEX IF NOT EXISTS idx_geo_object_history_user_id 
ON geo_object_history(user_id);

-- Index for faster queries by created_at
CREATE INDEX IF NOT EXISTS idx_geo_object_history_created_at 
ON geo_object_history(created_at DESC);

-- Function to automatically record history on object creation
CREATE OR REPLACE FUNCTION record_geo_object_create_history()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO geo_object_history (object_id, user_id, action, description, after_snapshot)
    VALUES (
        NEW.id,
        COALESCE(NEW.owner_id, '00000000-0000-0000-0000-000000000000'),
        'create',
        format('Создан объект "%s"', NEW.name),
        to_jsonb(NEW) - 'id' - 'created_at' - 'updated_at'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create history is now handled by Go service code (with proper GeoJSON geometry)
DROP TRIGGER IF EXISTS trigger_geo_object_create_history ON geo_objects;

-- Function to automatically record history on object update
CREATE OR REPLACE FUNCTION record_geo_object_update_history()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO geo_object_history (object_id, user_id, action, description, before_snapshot, after_snapshot)
    VALUES (
        NEW.id,
        COALESCE(NEW.owner_id, '00000000-0000-0000-0000-000000000000'),
        'update',
        format('Изменён объект "%s"', NEW.name),
        to_jsonb(OLD) - 'id' - 'created_at' - 'updated_at',
        to_jsonb(NEW) - 'id' - 'created_at' - 'updated_at'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update history is now handled by Go service code (with proper GeoJSON geometry)
DROP TRIGGER IF EXISTS trigger_geo_object_update_history ON geo_objects;

-- Function to automatically record history on object deletion
CREATE OR REPLACE FUNCTION record_geo_object_delete_history()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO geo_object_history (object_id, user_id, action, description, before_snapshot)
    VALUES (
        OLD.id,
        COALESCE(OLD.owner_id, '00000000-0000-0000-0000-000000000000'),
        'delete',
        format('Удалён объект "%s"', OLD.name),
        to_jsonb(OLD) - 'id' - 'created_at' - 'updated_at'
    );
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-recording object deletion
DROP TRIGGER IF EXISTS trigger_geo_object_delete_history ON geo_objects;
CREATE TRIGGER trigger_geo_object_delete_history
AFTER DELETE ON geo_objects
FOR EACH ROW
EXECUTE FUNCTION record_geo_object_delete_history();
