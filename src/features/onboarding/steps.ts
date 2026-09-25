// The "first steps" guide shown on a new shop's dashboard (pure, tested).
// It disappears once the steps that matter are done; the team step stays
// optional because many shops run alone at first.

export type FirstStepsState = {
  shopDetailsFilled: boolean;
  productCount: number;
  invoiceCount: number;
  storefrontAddress: boolean;
  teamSize: number;
  /** The storefront comes with the Pro plan: below it, no storefront step. */
  storefrontIncluded?: boolean;
};

export type FirstStepKey = "shop" | "stock" | "sale" | "storefront" | "team";

export type FirstStep = {
  key: FirstStepKey;
  href: string;
  done: boolean;
  optional: boolean;
};

export function firstSteps(state: FirstStepsState): FirstStep[] {
  const steps: FirstStep[] = [
    { key: "shop", href: "/settings", done: state.shopDetailsFilled, optional: false },
    { key: "stock", href: "/stock", done: state.productCount > 0, optional: false },
    { key: "sale", href: "/sales", done: state.invoiceCount > 0, optional: false },
    { key: "storefront", href: "/settings", done: state.storefrontAddress, optional: false },
    { key: "team", href: "/settings?tab=equipe", done: state.teamSize > 1, optional: true },
  ];
  return state.storefrontIncluded === false ? steps.filter((step) => step.key !== "storefront") : steps;
}

// The guide stays until every required step is done.
export function showFirstSteps(steps: FirstStep[]): boolean {
  return steps.some((step) => !step.optional && !step.done);
}
