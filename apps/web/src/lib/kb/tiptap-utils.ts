/**
 * Tiptap Utility Functions
 *
 * Utilities for extracting plain text, headings, and validating Tiptap JSON content.
 * Used for search indexing, table of contents generation, and content validation.
 */

import type { TiptapContent, TiptapNode, ExtractedHeading } from './types';

/**
 * Recursively extracts plain text from a Tiptap JSON document.
 * Used for search indexing and preview generation.
 */
export function extractPlainText(tiptapJson: TiptapContent): string {
  if (!tiptapJson || !tiptapJson.content) {
    return '';
  }
  return extractTextFromNodes(tiptapJson.content).trim();
}

function extractTextFromNodes(nodes: readonly TiptapNode[]): string {
  const parts: string[] = [];

  for (const node of nodes) {
    switch (node.type) {
      case 'text': {
        if (node.text) {
          parts.push(node.text);
        }
        break;
      }
      case 'paragraph':
      case 'heading':
      case 'blockquote': {
        if (node.content) {
          parts.push(extractTextFromNodes(node.content));
        }
        parts.push('\n');
        break;
      }
      case 'bulletList':
      case 'orderedList': {
        if (node.content) {
          parts.push(extractTextFromNodes(node.content));
        }
        break;
      }
      case 'listItem': {
        if (node.content) {
          parts.push(extractTextFromNodes(node.content));
        }
        break;
      }
      case 'codeBlock': {
        if (node.content) {
          parts.push(extractTextFromNodes(node.content));
        }
        parts.push('\n');
        break;
      }
      case 'table': {
        if (node.content) {
          parts.push(extractTextFromNodes(node.content));
        }
        break;
      }
      case 'tableRow': {
        if (node.content) {
          parts.push(extractTextFromNodes(node.content));
        }
        parts.push('\n');
        break;
      }
      case 'tableCell':
      case 'tableHeader': {
        if (node.content) {
          parts.push(extractTextFromNodes(node.content));
          parts.push(' ');
        }
        break;
      }
      case 'hardBreak': {
        parts.push('\n');
        break;
      }
      case 'horizontalRule': {
        parts.push('\n---\n');
        break;
      }
      case 'image': {
        // Include alt text for search indexing
        if (node.attrs?.alt && typeof node.attrs.alt === 'string') {
          parts.push(node.attrs.alt);
          parts.push('\n');
        }
        break;
      }
      default: {
        // For any other node type, try to extract text from children
        if (node.content) {
          parts.push(extractTextFromNodes(node.content));
        }
        break;
      }
    }
  }

  return parts.join('');
}

/**
 * Extracts h2/h3 headings from Tiptap JSON for table of contents generation.
 * Returns headings with auto-generated anchor IDs.
 */
export function extractHeadings(tiptapJson: TiptapContent): ExtractedHeading[] {
  if (!tiptapJson || !tiptapJson.content) {
    return [];
  }

  const headings: ExtractedHeading[] = [];

  for (const node of tiptapJson.content) {
    if (node.type === 'heading' && node.attrs?.level) {
      const level = node.attrs.level as number;
      if (level === 2 || level === 3) {
        const text = node.content ? extractTextFromNodes(node.content).trim() : '';
        if (text) {
          headings.push({
            level,
            text,
            id: slugify(text),
          });
        }
      }
    }
  }

  return headings;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Validates that the provided JSON conforms to the basic Tiptap document structure.
 * Returns an object with `valid` boolean and optional `error` message.
 */
export function validateTiptapContent(json: unknown): { valid: boolean; error?: string } {
  if (!json || typeof json !== 'object') {
    return { valid: false, error: 'Content must be a non-null object' };
  }

  const doc = json as Record<string, unknown>;

  if (doc.type !== 'doc') {
    return { valid: false, error: 'Root node must have type "doc"' };
  }

  if (!Array.isArray(doc.content)) {
    return { valid: false, error: 'Root node must have a "content" array' };
  }

  if (doc.content.length === 0) {
    return { valid: false, error: 'Document must have at least one content node' };
  }

  for (let i = 0; i < doc.content.length; i++) {
    const node = doc.content[i] as Record<string, unknown>;
    if (!node || typeof node !== 'object') {
      return { valid: false, error: `Content node at index ${i} must be an object` };
    }
    if (typeof node.type !== 'string') {
      return { valid: false, error: `Content node at index ${i} must have a string "type" field` };
    }
    // Validate nested content recursively
    if (node.content !== undefined && !Array.isArray(node.content)) {
      return { valid: false, error: `Content node at index ${i} has non-array "content" field` };
    }
  }

  return { valid: true };
}
