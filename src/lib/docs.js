/**
 * The docs (docs/*.md) for the /docs/ pages: each with its slug ("" for index.md), title, description,
 * audience ("users" | "contributors" | none for the index) and order, its rendered Content and its sections
 * (the h2 headings: [{ slug, text }]).
 */
const files = import.meta.glob('../../docs/*.md', { eager: true });

export const docs = Object.entries(files)
  .map(([file, mod]) => {
    const name = file.match(/([\w-]+)\.md$/)[1];
    const { title, description = '', audience = null, order = 99 } = mod.frontmatter;
    const sections = mod.getHeadings().filter((h) => h.depth === 2).map(({ slug, text }) => ({ slug, text }));
    return { slug: name === 'index' ? '' : name, title, description, audience, order, Content: mod.Content, sections };
  })
  .sort((a, b) => a.order - b.order);

export const docsHref = (doc) => `/docs/${doc.slug ? `${doc.slug}/` : ''}`;
