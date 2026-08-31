-- 1. Use gen_random_uuid() instead of uuid_generate_v4()
-- 2. Safely cast JSONB to text
-- 3. Explicitly insert setting ID in case table default is broken

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    new_shop_id UUID;
    user_name TEXT;
BEGIN
    new_shop_id := gen_random_uuid();
    
    -- Extract name safely
    IF new.raw_user_meta_data IS NOT NULL AND new.raw_user_meta_data ? 'full_name' THEN
        user_name := new.raw_user_meta_data->>'full_name';
    ELSE
        user_name := new.email;
    END IF;

    -- Create profile
    INSERT INTO public.profiles (id, shop_id, role, full_name)
    VALUES (new.id, new_shop_id, 'MANAGER', user_name);

    -- Create settings (explicit id to avoid uuid-ossp dependency)
    INSERT INTO public.settings (id, shop_id)
    VALUES (gen_random_uuid(), new_shop_id);

    RETURN new;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error to Postgres log (can be seen in Supabase dashboard)
        RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
        -- Re-raise so transaction rolls back
        RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix the default on settings table if it was using uuid_generate_v4
ALTER TABLE IF EXISTS public.settings 
ALTER COLUMN id SET DEFAULT gen_random_uuid();
