-- ============================================================
-- Signalements de contenu sur les vitrines
-- ============================================================
-- Conditions d'utilisation, article 13 : « Toute personne peut signaler un
-- contenu illicite (contrefaçon, produit interdit, contenu trompeur) via le
-- lien « Signaler ». » Le signalement est adressé à WISHOP, pas à la boutique :
-- personne ne peut le lire depuis l'application (aucune règle RLS de lecture) ;
-- WISHOP le consulte depuis le tableau de bord Supabase.

CREATE TABLE public.content_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL,
    product_id UUID REFERENCES public.products(id),
    reason TEXT NOT NULL CHECK (reason IN ('COUNTERFEIT', 'PROHIBITED', 'MISLEADING', 'OTHER')),
    details TEXT CHECK (length(details) <= 1000),
    reporter_contact TEXT CHECK (length(reporter_contact) <= 120),
    status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'REVIEWED', 'REMOVED', 'DISMISSED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    handled_at TIMESTAMPTZ
);

CREATE INDEX content_reports_shop_created_idx ON public.content_reports (shop_id, created_at DESC);

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.content_reports FROM anon, authenticated;

-- Seule porte d'entrée : cette fonction, ouverte aux visiteurs de la vitrine.
CREATE OR REPLACE FUNCTION public.report_storefront_content(
    _shop_slug TEXT,
    _reason TEXT,
    _details TEXT DEFAULT NULL,
    _product_id UUID DEFAULT NULL,
    _reporter_contact TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _shop_id UUID;
BEGIN
    SELECT shop_id INTO _shop_id FROM settings WHERE shop_slug = _shop_slug;
    IF _shop_id IS NULL THEN
        RAISE EXCEPTION 'shop_not_found';
    END IF;

    IF _reason IS NULL OR _reason NOT IN ('COUNTERFEIT', 'PROHIBITED', 'MISLEADING', 'OTHER') THEN
        RAISE EXCEPTION 'report_invalid';
    END IF;

    _details := nullif(btrim(coalesce(_details, '')), '');
    _reporter_contact := nullif(btrim(coalesce(_reporter_contact, '')), '');
    IF length(_details) > 1000 OR length(_reporter_contact) > 120 THEN
        RAISE EXCEPTION 'report_invalid';
    END IF;

    -- Un article d'une autre boutique n'est jamais rattaché au signalement.
    IF _product_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM products WHERE id = _product_id AND shop_id = _shop_id) THEN
        _product_id := NULL;
    END IF;

    -- Frein aux abus : au plus 20 signalements par vitrine et par heure.
    IF (SELECT count(*) FROM content_reports
        WHERE shop_id = _shop_id AND created_at > now() - interval '1 hour') >= 20 THEN
        RAISE EXCEPTION 'report_rate_limited';
    END IF;

    INSERT INTO content_reports (shop_id, product_id, reason, details, reporter_contact)
    VALUES (_shop_id, _product_id, _reason, _details, _reporter_contact);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.report_storefront_content(TEXT, TEXT, TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_storefront_content(TEXT, TEXT, TEXT, UUID, TEXT) TO anon, authenticated, service_role;
