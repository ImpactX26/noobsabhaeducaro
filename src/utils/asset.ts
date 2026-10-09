/**
 * URL of a file in /public that works under any base path (the site root, or a GitHub Pages
 * repository subpath such as /noobsabhaeducaro/). Never hard-code a leading "/" for these files.
 */
export const asset = (name: string): string => `${import.meta.env.BASE_URL}${name.replace(/^\/+/, '')}`;
