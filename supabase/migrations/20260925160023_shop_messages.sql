-- ============================================================
-- Messages de WISHOP aux boutiques (console d'administration)
-- ============================================================
-- Décision du 25/09/2026 : l'administrateur écrit à une boutique, ou à
-- toutes (shop_id NULL), depuis la console. Le message s'affiche en haut de
-- l'application de la Propriétaire jusqu'à ce qu'elle le marque comme lu.
-- Les e-mails automatiques viendront plus tard (feuille de route : il faut un
-- nom de domaine et un service d'envoi).

CREATE TABLE public.shop_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID,
    title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 120),
    body TEXT NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 2000),
    tone TEXT NOT NULL DEFAULT 'INFO' CHECK (tone IN ('INFO', 'WARNING')),
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX shop_messages_shop_idx ON public.shop_messages (shop_id, created_at DESC);

CREATE TABLE public.shop_message_reads (
    message_id UUID NOT NULL REFERENCES public.shop_messages(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL,
    read_by UUID,
    read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (message_id, shop_id)
);

ALTER TABLE public.shop_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_message_reads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shop_messages, public.shop_message_reads FROM anon, authenticated;
GRANT SELECT ON public.shop_messages, public.shop_message_reads TO authenticated;

-- Une boutique lit ses messages et ceux adressés à toutes ; l'écriture passe
-- par les fonctions ci-dessous.
CREATE POLICY "Messages readable by their shop" ON public.shop_messages
    FOR SELECT TO authenticated USING (shop_id IS NULL OR shop_id = get_current_shop_id());
CREATE POLICY "Message reads readable by their shop" ON public.shop_message_reads
    FOR SELECT TO authenticated USING (shop_id = get_current_shop_id());

-- La Propriétaire marque un message comme lu (pour toute la boutique).
CREATE OR REPLACE FUNCTION public.mark_shop_message_read(_message_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
    _shop UUID := get_current_shop_id();
BEGIN
    IF NOT is_shop_manager() THEN
        RAISE EXCEPTION 'access_denied';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM shop_messages WHERE id = _message_id AND (shop_id IS NULL OR shop_id = _shop)
    ) THEN
        RAISE EXCEPTION 'admin_invalid';
    END IF;
    INSERT INTO shop_message_reads (message_id, shop_id, read_by)
    VALUES (_message_id, _shop, auth.uid())
    ON CONFLICT (message_id, shop_id) DO NOTHING;
END;
$$;

-- Console : écrire à une boutique (ou à toutes : _shop_id NULL).
CREATE OR REPLACE FUNCTION public.admin_send_message(_shop_id UUID, _title TEXT, _body TEXT, _tone TEXT DEFAULT 'INFO')
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
    _id UUID;
BEGIN
    IF NOT is_platform_admin() THEN
        RAISE EXCEPTION 'access_denied';
    END IF;
    IF _shop_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM settings WHERE shop_id = _shop_id) THEN
        RAISE EXCEPTION 'shop_not_found';
    END IF;
    IF _tone IS NULL OR _tone NOT IN ('INFO', 'WARNING')
       OR length(btrim(coalesce(_title, ''))) NOT BETWEEN 1 AND 120
       OR length(btrim(coalesce(_body, ''))) NOT BETWEEN 1 AND 2000 THEN
        RAISE EXCEPTION 'admin_invalid';
    END IF;
    INSERT INTO shop_messages (shop_id, title, body, tone, created_by)
    VALUES (_shop_id, btrim(_title), btrim(_body), _tone, auth.uid())
    RETURNING id INTO _id;
    RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_message(_message_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
    IF NOT is_platform_admin() THEN
        RAISE EXCEPTION 'access_denied';
    END IF;
    DELETE FROM shop_messages WHERE id = _message_id;
END;
$$;

-- Messages envoyés à une boutique (_shop_id) ou à toutes (NULL), avec leur
-- lecture : date de lecture pour une boutique, nombre de boutiques pour tous.
CREATE OR REPLACE FUNCTION public.admin_list_messages(_shop_id UUID DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    shop_id UUID,
    title TEXT,
    body TEXT,
    tone TEXT,
    created_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    read_count BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
    SELECT m.id, m.shop_id, m.title, m.body, m.tone, m.created_at,
           (SELECT r.read_at FROM shop_message_reads r WHERE r.message_id = m.id AND r.shop_id = m.shop_id),
           (SELECT count(*) FROM shop_message_reads r WHERE r.message_id = m.id)
    FROM shop_messages m
    WHERE is_platform_admin() AND m.shop_id IS NOT DISTINCT FROM _shop_id
    ORDER BY m.created_at DESC;
$$;

-- Une boutique supprimée par la console emporte ses messages.
CREATE OR REPLACE FUNCTION public.delete_shop_messages_on_shop_delete()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
    DELETE FROM shop_message_reads WHERE shop_id = OLD.shop_id;
    DELETE FROM shop_messages WHERE shop_id = OLD.shop_id;
    RETURN OLD;
END;
$$;
CREATE TRIGGER delete_shop_messages AFTER DELETE ON public.settings
    FOR EACH ROW EXECUTE FUNCTION public.delete_shop_messages_on_shop_delete();

REVOKE EXECUTE ON FUNCTION public.mark_shop_message_read(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_send_message(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_delete_message(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_messages(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_shop_messages_on_shop_delete() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_shop_message_read(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_send_message(UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_delete_message(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_messages(UUID) TO authenticated, service_role;
