/**
 * The docs (docs/*.md) for the /docs/ pages: each with its slug ("" for index.md), title, description,
 * audience ("users" | "contributors" | none for the index) and order, and its rendered Content.
 */
const files = import.meta.glob('../../docs/*.md', { eager: true });

export const docs = Object.entries(files)
  .map(([file, mod]) => {
    const name = file.match(/([\w-]+)\.md$/)[1];
    const { title, description = '', audience = null, order = 99 } = mod.frontmatter;
    return { slug: name === 'index' ? '' : name, title, description, audience, order, Content: mod.Content };
  })
  .sort((a, b) => a.order - b.order);

export const docsHref = (doc) => `/docs/${doc.slug ? `${doc.slug}/` : ''}`;
