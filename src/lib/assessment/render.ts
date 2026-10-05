import katex from "katex";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * "text with $latex$" → HTML. Text is escaped; math goes through KaTeX.
 * Content comes from our own assessment data (not user input), and KaTeX output is safe HTML.
 */
export function richToHtml(rich: string): string {
  return rich
    .split(/(\$[^$]+\$)/g)
    .map((part) => {
      if (part.length > 2 && part.startsWith("$") && part.endsWith("$")) {
        return katex.renderToString(part.slice(1, -1), { throwOnError: false, strict: "ignore", output: "html" });
      }
      return escapeHtml(part);
    })
    .join("");
}

/** Choice labels such as "4/6" render as a fraction. */
export function choiceToHtml(choice: string): string {
  const m = /^(\d+)\/(\d+)$/.exec(choice);
  return m ? richToHtml(`$\\dfrac{${m[1]}}{${m[2]}}$`) : escapeHtml(choice);
}
