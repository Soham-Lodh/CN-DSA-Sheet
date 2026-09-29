-- ==============================================================================
-- SUPABASE AUTH INSTITUTION DOMAIN RESTRICTION & USER PROFILE SYNC
-- ==============================================================================

-- 1. Create table for allowed email domains (single source of truth for institution domains)
CREATE TABLE IF NOT EXISTS public.allowed_email_domains (
    domain TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default KIIT domain
INSERT INTO public.allowed_email_domains (domain)
VALUES ('kiit.ac.in')
ON CONFLICT (domain) DO NOTHING;

-- 2. Auth hook function to validate institutional domain before signup completes
CREATE OR REPLACE FUNCTION public.check_institutional_email()
RETURNS TRIGGER AS $$
DECLARE
    user_email TEXT;
    email_domain TEXT;
    is_allowed BOOLEAN;
BEGIN
    user_email := LOWER(NEW.email);
    
    -- Extract domain part after '@'
    email_domain := SUBSTRING(user_email FROM '@(.*)$');

    -- Check if domain exists in allowed_email_domains
    SELECT EXISTS(
        SELECT 1 FROM public.allowed_email_domains WHERE LOWER(domain) = email_domain
    ) INTO is_allowed;

    IF NOT is_allowed THEN
        RAISE EXCEPTION 'Access Denied: Only institutional emails ending in @% are allowed to register.', 
            (SELECT string_agg(domain, ', ') FROM public.allowed_email_domains);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users before insert
DROP TRIGGER IF EXISTS tr_check_institutional_email ON auth.users;
CREATE TRIGGER tr_check_institutional_email
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.check_institutional_email();

-- 3. Trigger to automatically create or update public.profiles on new auth user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    raw_user_meta JSONB;
    extracted_name TEXT;
    extracted_avatar TEXT;
    user_roll_number TEXT;
    local_part TEXT;
BEGIN
    raw_user_meta := NEW.raw_user_meta_data;
    extracted_name := COALESCE(raw_user_meta->>'full_name', raw_user_meta->>'name', SPLIT_PART(NEW.email, '@', 1));
    extracted_avatar := COALESCE(raw_user_meta->>'avatar_url', raw_user_meta->>'picture', NULL);
    
    -- Extract potential roll number from email local-part
    local_part := SPLIT_PART(LOWER(NEW.email), '@', 1);
    -- If local_part matches alphanumeric patterns, use it as initial roll number
    user_roll_number := local_part;

    INSERT INTO public.profiles (id, email, name, "avatarUrl", "rollNumber", role, "createdAt", "updatedAt")
    VALUES (
        NEW.id::text,
        LOWER(NEW.email),
        extracted_name,
        extracted_avatar,
        user_roll_number,
        'USER',
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = COALESCE(EXCLUDED.name, public.profiles.name),
        "avatarUrl" = COALESCE(EXCLUDED."avatarUrl", public.profiles."avatarUrl"),
        "updatedAt" = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_on_auth_user_created ON auth.users;
CREATE TRIGGER tr_on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- ADMIN MANAGEMENT HELPER QUERIES
-- ==============================================================================
-- To promote a user to administrator:
-- UPDATE public.profiles SET role = 'ADMIN' WHERE LOWER(email) = LOWER('admin@kiit.ac.in');
--
-- To inspect all current administrators:
-- SELECT id, email, name, "rollNumber", role, "createdAt" FROM public.profiles WHERE role = 'ADMIN';
