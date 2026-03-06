-- Security Update Script for Existing Database

-- 1. Add length constraints to the name column
-- Note: If you already have names longer than 50 chars, this will fail. You may need to manually shorten them first.
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_name_length_check 
CHECK (char_length(name) > 0 AND char_length(name) <= 50);

-- 2. Drop the old insecure policy
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;

-- 3. Create the new secure policy that forces role = 'user'
CREATE POLICY "Users can insert their own profile." ON public.profiles
FOR INSERT WITH CHECK (auth.uid() = id AND role = 'user');
