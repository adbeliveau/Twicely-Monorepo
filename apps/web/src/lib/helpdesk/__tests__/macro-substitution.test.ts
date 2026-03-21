import { describe, it, expect } from 'vitest';
import { substituteMacroVariables } from '../macro-substitution';
import type { MacroContext } from '../macro-substitution';

const fullContext: MacroContext = {
  buyerName: 'Alice Johnson',
  caseNumber: 'HD-000042',
  orderNumber: 'TW-12345',
  agentName: 'Bob Smith',
};

describe('substituteMacroVariables', () => {
  it('substitutes {{buyer_name}} with requester name', () => {
    const result = substituteMacroVariables('Hello {{buyer_name}},', fullContext);
    expect(result).toBe('Hello Alice Johnson,');
  });

  it('substitutes {{case_number}} with HD-format case number', () => {
    const result = substituteMacroVariables('Regarding case {{case_number}},', fullContext);
    expect(result).toBe('Regarding case HD-000042,');
  });

  it('substitutes {{order_number}} with linked order number', () => {
    const result = substituteMacroVariables('Your order {{order_number}} is being reviewed.', fullContext);
    expect(result).toBe('Your order TW-12345 is being reviewed.');
  });

  it('substitutes {{agent_name}} with current agent name', () => {
    const result = substituteMacroVariables('Regards, {{agent_name}}', fullContext);
    expect(result).toBe('Regards, Bob Smith');
  });

  it('renders empty string for {{listing_title}} when no listing linked', () => {
    const result = substituteMacroVariables('Item: {{listing_title}}', fullContext);
    expect(result).toBe('Item: ');
  });

  it('renders empty string for {{seller_name}} when no seller linked', () => {
    const result = substituteMacroVariables('Seller: {{seller_name}}', fullContext);
    expect(result).toBe('Seller: ');
  });

  it('renders empty string for {{return_status}} when no return linked', () => {
    const result = substituteMacroVariables('Return status: {{return_status}}', fullContext);
    expect(result).toBe('Return status: ');
  });

  it('handles multiple variables in same template', () => {
    const template = 'Hi {{buyer_name}}, case {{case_number}} for order {{order_number}} is handled by {{agent_name}}.';
    const result = substituteMacroVariables(template, fullContext);
    expect(result).toBe('Hi Alice Johnson, case HD-000042 for order TW-12345 is handled by Bob Smith.');
  });

  it('leaves text unchanged when no variables present', () => {
    const template = 'Thank you for contacting Twicely support.';
    const result = substituteMacroVariables(template, fullContext);
    expect(result).toBe(template);
  });

  it('handles malformed variable syntax gracefully (e.g., {{unknown_var}})', () => {
    const result = substituteMacroVariables('{{unknown_var}} should be empty', fullContext);
    expect(result).toBe(' should be empty');
  });

  it('does not double-substitute if buyer name contains curly brace syntax', () => {
    const ctx: MacroContext = { buyerName: '{{agent_name}}', caseNumber: 'HD-001' };
    const result = substituteMacroVariables('Hi {{buyer_name}}, from {{agent_name}}', ctx);
    // buyer_name resolves to '{{agent_name}}' string — NOT further substituted
    expect(result).toBe('Hi {{agent_name}}, from ');
  });

  it('handles empty template string', () => {
    const result = substituteMacroVariables('', fullContext);
    expect(result).toBe('');
  });

  it('handles null/undefined context values — renders empty string', () => {
    const ctx: MacroContext = { buyerName: null, caseNumber: undefined };
    const result = substituteMacroVariables('Hi {{buyer_name}}, case {{case_number}}.', ctx);
    expect(result).toBe('Hi , case .');
  });

  it('preserves whitespace and newlines in template', () => {
    const template = 'Dear {{buyer_name}},\n\nThank you for your order {{order_number}}.\n\nBest,\n{{agent_name}}';
    const result = substituteMacroVariables(template, fullContext);
    expect(result).toBe('Dear Alice Johnson,\n\nThank you for your order TW-12345.\n\nBest,\nBob Smith');
  });

  it('substitutes all occurrences of same variable', () => {
    const template = '{{buyer_name}} is our valued customer. Welcome back, {{buyer_name}}!';
    const result = substituteMacroVariables(template, fullContext);
    expect(result).toBe('Alice Johnson is our valued customer. Welcome back, Alice Johnson!');
  });
});
