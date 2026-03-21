// =============================================================================
// MACRO VARIABLE SUBSTITUTION
// Pure, synchronous, client-safe utility.
// Canonical §9.3 — Template variables.
// =============================================================================

export interface MacroContext {
  buyerName?: string | null;
  caseNumber?: string | null;
  orderNumber?: string | null;
  agentName?: string | null;
  // These resolve to empty string when not available (per canonical)
  listingTitle?: string | null;
  sellerName?: string | null;
  returnStatus?: string | null;
}

/**
 * Substitutes {{variable_name}} placeholders in a macro template string.
 * Variables that cannot resolve are replaced with an empty string.
 * Per canonical §9.3: "Variables that can't resolve render as empty string."
 */
export function substituteMacroVariables(template: string, context: MacroContext): string {
  if (!template) return template;

  const substitutions: Record<string, string> = {
    buyer_name: context.buyerName ?? '',
    case_number: context.caseNumber ?? '',
    order_number: context.orderNumber ?? '',
    agent_name: context.agentName ?? '',
    listing_title: context.listingTitle ?? '',
    seller_name: context.sellerName ?? '',
    return_status: context.returnStatus ?? '',
  };

  // Replace all occurrences of known variables, replace unknown ones with ''
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key: string) => {
    const trimmedKey = key.trim();
    if (trimmedKey in substitutions) {
      return substitutions[trimmedKey] ?? '';
    }
    // Unknown variable → empty string per canonical
    return '';
  });
}
