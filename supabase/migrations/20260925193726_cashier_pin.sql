-- ============================================================
-- Changer de caissier avec un code PIN (décision du 25/09/2026)
--
-- Sur un appareil partagé (la caisse de la boutique), la personne qui vend
-- tape son code à 4 chiffres : la vente est enregistrée à son nom, même
-- sans internet (comme Loyverse). Le compte connecté sur l'appareil ne
-- change pas : le code dit qui vend, pas ce que l'on peut ouvrir.
--
-- Le code n'est jamais gardé en clair : seulement une empreinte (SHA-256
-- d'un sel aléatoire suivi du code). L'appareil reçoit les empreintes de
-- l'équipe pour vérifier un code sans internet. Un code à 4 chiffres ne
-- protège pas des données (tout membre connecté les voit déjà) : il évite
-- qu'une vente parte au nom d'une collègue par erreur.
-- ============================================================

ALTER TABLE public.profiles
    ADD COLUMN pin_salt TEXT,
    ADD COLUMN pin_hash TEXT;

-- Un membre peut modifier sa fiche (son nom) : les colonnes du code, elles,
-- ne changent que par set_member_pin, qui vérifie qui a le droit.
CREATE OR REPLACE FUNCTION public.guard_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.shop_id IS DISTINCT FROM OLD.shop_id THEN
        RAISE EXCEPTION 'A profile cannot change shop' USING ERRCODE = '42501';
    END IF;

    IF (NEW.role IS DISTINCT FROM OLD.role
        OR NEW.allowed_pages IS DISTINCT FROM OLD.allowed_pages
        OR NEW.is_active IS DISTINCT FROM OLD.is_active)
       AND NOT (is_shop_manager() AND OLD.shop_id = get_current_shop_id()) THEN
        RAISE EXCEPTION 'Only a shop manager can change roles and access' USING ERRCODE = '42501';
    END IF;

    IF (NEW.pin_hash IS DISTINCT FROM OLD.pin_hash OR NEW.pin_salt IS DISTINCT FROM OLD.pin_salt)
       AND COALESCE(current_setting('wishop.pin_change', true), '') <> 'on' THEN
        RAISE EXCEPTION 'The till code changes through set_member_pin only' USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$function$;

-- La propriétaire définit ou retire le code de chaque membre de sa boutique,
-- et chacun peut changer le sien. _pin NULL retire le code.
CREATE OR REPLACE FUNCTION public.set_member_pin(_member_id uuid, _pin text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.set_member_pin(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_member_pin(uuid, text) TO authenticated, service_role;
