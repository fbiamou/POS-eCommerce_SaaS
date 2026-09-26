-- Till codes (code de caisse), security review of 26/09/2026.
--
-- Until now every account of a shop could read every colleague's till code
-- print (pin_salt, pin_hash). A 4-digit code is found from its print in a
-- second, so an employee could find the owner's code and take her rights.
--
-- 1. The prints are no longer readable through the table: `has_pin` says
--    whether someone has a code. The prints a device needs to hand the till
--    over without internet come from get_team_pins(): the account's own, and
--    the sellers' of its shop. A manager's code is checked by the server only.
-- 2. verify_member_pin counts wrong codes: after 5, that code is locked for
--    15 minutes (pin_attempts).
--
-- Note for later migrations: signed-in accounts read `profiles` column by
-- column (grant below). A new column must be added to that grant to be
-- readable by the app.

ALTER TABLE public.profiles
    ADD COLUMN has_pin BOOLEAN GENERATED ALWAYS AS (pin_hash IS NOT NULL) STORED;

REVOKE SELECT ON TABLE public.profiles FROM authenticated;
GRANT SELECT (id, shop_id, role, full_name, created_at, updated_at, is_active, allowed_pages, has_pin)
    ON TABLE public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.get_team_pins()
RETURNS TABLE (id UUID, pin_salt TEXT, pin_hash TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT p.id, p.pin_salt, p.pin_hash
    FROM profiles p
    WHERE p.pin_hash IS NOT NULL
      AND p.is_active
      AND (p.id = auth.uid() OR (p.shop_id = get_current_shop_id() AND p.role = 'SELLER'));
$$;

REVOKE EXECUTE ON FUNCTION public.get_team_pins() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_team_pins() TO authenticated;

-- Wrong codes per person. Technical table (no shop data): only the till
-- code functions below read and write it, so RLS is on with no policy.
CREATE TABLE public.pin_attempts (
    member_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    failures INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ
);
ALTER TABLE public.pin_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.pin_attempts FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.verify_member_pin(_member_id UUID, _pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _target profiles%ROWTYPE;
    _locked TIMESTAMPTZ;
    _failures INTEGER;
BEGIN
    SELECT * INTO _target FROM profiles WHERE id = _member_id;
    IF NOT FOUND OR _target.shop_id IS DISTINCT FROM get_current_shop_id() THEN
        RETURN FALSE;
    END IF;
    IF NOT _target.is_active OR _target.pin_salt IS NULL OR _target.pin_hash IS NULL OR _pin !~ '^[0-9]{4}$' THEN
        RETURN FALSE;
    END IF;

    SELECT locked_until INTO _locked FROM pin_attempts WHERE member_id = _member_id;
    IF _locked IS NOT NULL AND _locked > now() THEN
        RAISE EXCEPTION 'pin_locked';
    END IF;

    IF _target.pin_hash = encode(extensions.digest(_target.pin_salt || _pin, 'sha256'), 'hex') THEN
        DELETE FROM pin_attempts WHERE member_id = _member_id;
        RETURN TRUE;
    END IF;

    INSERT INTO pin_attempts AS a (member_id, failures) VALUES (_member_id, 1)
    ON CONFLICT (member_id) DO UPDATE SET failures = a.failures + 1
    RETURNING failures INTO _failures;
    IF _failures >= 5 THEN
        UPDATE pin_attempts SET failures = 0, locked_until = now() + interval '15 minutes'
        WHERE member_id = _member_id;
    END IF;
    RETURN FALSE;
END;
$$;

-- A new code starts with no wrong attempts.
CREATE OR REPLACE FUNCTION public.set_member_pin(_member_id UUID, _pin TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _me profiles%ROWTYPE;
    _target profiles%ROWTYPE;
    _salt TEXT;
BEGIN
    SELECT * INTO _me FROM profiles WHERE id = auth.uid();
    IF NOT FOUND THEN
        RAISE EXCEPTION 'unauthorized';
    END IF;
    SELECT * INTO _target FROM profiles WHERE id = _member_id;
    IF NOT FOUND OR _target.shop_id <> _me.shop_id THEN
        RAISE EXCEPTION 'member_not_found';
    END IF;
    IF _me.id <> _target.id AND _me.role <> 'MANAGER' THEN
        RAISE EXCEPTION 'access_denied';
    END IF;

    PERFORM set_config('wishop.pin_change', 'on', true);
    IF _pin IS NULL THEN
        UPDATE profiles SET pin_salt = NULL, pin_hash = NULL WHERE id = _member_id;
    ELSE
        IF _pin !~ '^[0-9]{4}$' THEN
            RAISE EXCEPTION 'pin_invalid';
        END IF;
        _salt := encode(extensions.gen_random_bytes(16), 'hex');
        UPDATE profiles
        SET pin_salt = _salt,
            pin_hash = encode(extensions.digest(_salt || _pin, 'sha256'), 'hex')
        WHERE id = _member_id;
    END IF;
    PERFORM set_config('wishop.pin_change', '', true);
    DELETE FROM pin_attempts WHERE member_id = _member_id;
END;
$$;
