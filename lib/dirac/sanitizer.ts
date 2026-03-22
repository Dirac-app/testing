import sanitizeHtml from "sanitize-html";

/**
 * Sanitizes HTML email/message content to prevent XSS.
 * Allows common formatting tags but strips scripts, iframes, etc.
 */
export function sanitizeEmailHtml(dirty: string): string {
  return sanitizeHtml(dirty, {
    allowedTags: [
      "a", "b", "blockquote", "br", "caption", "code", "col",
      "colgroup", "del", "div", "em", "h1", "h2", "h3", "h4",
      "h5", "h6", "hr", "i", "img", "ins", "li", "nl", "ol",
      "p", "pre", "s", "small", "span", "strong", "sub", "sup",
      "table", "tbody", "td", "tfoot", "th", "thead", "tr", "u", "ul",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan", "scope"],
      "*": ["style", "class"],
    },
    allowedStyles: {
      "*": {
        // Allow only safe CSS properties
        color: [/^#[0-9a-fA-F]{3,6}$/, /^rgb\(\d+,\s*\d+,\s*\d+\)$/],
        "background-color": [/^#[0-9a-fA-F]{3,6}$/, /^rgb\(\d+,\s*\d+,\s*\d+\)$/],
        "font-size": [/^\d+(?:px|em|rem|pt|%)$/],
        "font-weight": [/^(bold|normal|\d+)$/],
        "text-align": [/^(left|right|center|justify)$/],
        "text-decoration": [/^(underline|line-through|none)$/],
        padding: [/^\d+(?:px|em|rem|%)(\s+\d+(?:px|em|rem|%))*$/],
        margin: [/^\d+(?:px|em|rem|%)(\s+\d+(?:px|em|rem|%))*$/],
      },
    },
    // Force external links to open in new tab safely
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
    },
  });
}

/**
 * Strips ALL HTML tags, returning plain text only.
 * Use for snippets, notifications, and AI context injection.
 */
export function stripHtml(dirty: string): string {
  return sanitizeHtml(dirty, { allowedTags: [], allowedAttributes: {} });
}
