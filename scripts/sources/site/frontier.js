/**
 * Today's fetch queue of one shop: [url, priority] items, lowest priority first, in two lanes.
 * Product-looking URLs get `share` of the fetches once a few pages are done, so a site
 * with many category pages can't starve its product pages (and the other way round).
 */
export function createQueue({ isProduct, share = 0.7 }) {
  const list = [];
  const queued = new Set();
  let fetched = 0;
  let products = 0;
  const better = (a, b) => !b || a[1] < b[1];
  return {
    size: () => list.length,
    push(url, prio) {
      if (queued.has(url)) return;
      queued.add(url);
      list.push([url, prio]);
    },
    pop() {
      const wantProduct = fetched >= 3 && products < share * fetched;
      let best = -1;
      let any = -1;
      for (let i = 0; i < list.length; i++) {
        if (better(list[i], list[any])) any = i;
        if (isProduct(list[i][0]) === wantProduct && better(list[i], list[best])) best = i;
      }
      const [item] = list.splice(best >= 0 ? best : any, 1);
      fetched++;
      if (isProduct(item[0])) products++;
      return item[0];
    },
  };
}
