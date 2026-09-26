-- ============================================================
-- Changer de caissier : les droits suivent la personne (26/09/2026)
--
-- Quand une vendeuse prend la caisse avec son code sur l'appareil de la
-- propriétaire, elle n'a que ses propres droits : les pages que la
-- propriétaire lui a ouvertes, pas les réglages. Le serveur le vérifie
-- avec ce contrôle du code avant de passer la caisse à quelqu'un (ou de
-- la rendre à la propriétaire).
-- ============================================================

CREATE OR REPLACE FUNCTION public.verify_member_pin(_member_id uuid, _pin text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    _target profiles%ROWTYPE;
BEGIN
    SELECT * INTO _target FROM profiles WHERE id = _member_id;
    IF NOT FOUND OR _target.shop_id IS DISTINCT FROM get_current_shop_id() THEN
        RETURN FALSE;
    END IF;
    IF NOT _target.is_active OR _target.pin_salt IS NULL OR _target.pin_hash IS NULL OR _pin !~ '^[0-9]{4}$' THEN
        RETURN FALSE;
    END IF;
    RETURN _target.pin_hash = encode(extensions.digest(_target.pin_salt || _pin, 'sha256'), 'hex');
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.verify_member_pin(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_member_pin(uuid, text) TO authenticated, service_role;
