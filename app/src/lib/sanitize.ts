import DOMPurify from "dompurify";
import { JSDOM } from "jsdom";

const { window } = new JSDOM("");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const purify = DOMPurify(window as any);

export function sanitizeMessageBody(body: string): string {
  return purify.sanitize(body, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}
