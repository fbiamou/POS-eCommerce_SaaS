-- ============================================================
-- Correctif : les règles de formule bloquaient toutes les ventes
-- ============================================================
-- enforce_shop_plan (20260925131242_plan_enforcement) testait
-- « TG_TABLE_NAME = 'products' AND NEW.is_active » dans une seule
-- condition. PL/pgSQL prépare la condition entière, y compris
-- NEW.is_active, même quand la table n'est pas products : sur une table
-- sans colonne is_active (lignes de facture, paiements, mouvements de
-- stock, catégories, bons de commande...), chaque écriture échouait avec
-- « record "new" has no field "is_active" ». Résultat : aucune vente,
-- aucun paiement ni correction de stock possible depuis le 25/09/2026.
-- La vérification de is_active passe dans un IF à part, lu seulement pour
-- la table products. Les règles elles-mêmes ne changent pas.
CREATE OR REPLACE FUNCTION public.enforce_shop_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    _plan TEXT;
    _read_only BOOLEAN;
    _limit INTEGER;
BEGIN
    SELECT plan, read_only INTO _plan, _read_only FROM shop_plan_state(NEW.shop_id);

    IF _read_only THEN
        RAISE EXCEPTION 'shop_read_only';
    END IF;

    IF TG_TABLE_NAME = 'invoices' THEN
        IF TG_OP = 'INSERT' THEN
            IF NEW.paid_amount < NEW.total_amount AND NOT plan_allows(_plan, 'credit') THEN
                RAISE EXCEPTION 'plan_credit_locked';
            END IF;
            IF NEW.loyalty_reward_used AND NOT plan_allows(_plan, 'loyalty') THEN
                RAISE EXCEPTION 'plan_feature_locked';
            END IF;
        END IF;
    ELSIF TG_TABLE_NAME = 'purchase_orders' THEN
        IF TG_OP = 'INSERT' AND NOT plan_allows(_plan, 'purchase_orders') THEN
            RAISE EXCEPTION 'plan_feature_locked';
        END IF;
    ELSIF TG_TABLE_NAME = 'shipments' THEN
        IF TG_OP = 'INSERT' AND NOT plan_allows(_plan, 'shipments') THEN
            RAISE EXCEPTION 'plan_feature_locked';
        END IF;
    ELSIF TG_TABLE_NAME = 'online_orders' THEN
        IF TG_OP = 'INSERT' AND NOT plan_allows(_plan, 'storefront') THEN
            RAISE EXCEPTION 'plan_feature_locked';
        END IF;
    ELSIF TG_TABLE_NAME = 'reminder_logs' THEN
        IF TG_OP = 'INSERT' AND NOT plan_allows(_plan, 'reminders') THEN
            RAISE EXCEPTION 'plan_feature_locked';
        END IF;
    ELSIF TG_TABLE_NAME = 'products' THEN
        IF NEW.is_active THEN
            -- Un article déjà actif qu'on modifie ne compte pas une deuxième fois.
            IF TG_OP = 'UPDATE' THEN
                IF OLD.is_active THEN
                    RETURN NEW;
                END IF;
            END IF;
            _limit := plan_item_limit(_plan);
            IF _limit IS NOT NULL
               AND (SELECT count(*) FROM products WHERE shop_id = NEW.shop_id AND is_active) >= _limit THEN
                RAISE EXCEPTION 'plan_limit_items';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;
