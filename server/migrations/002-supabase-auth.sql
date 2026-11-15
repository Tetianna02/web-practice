ALTER TABLE shop.users
  ADD COLUMN auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE shop.users ALTER COLUMN password_hash DROP NOT NULL;
