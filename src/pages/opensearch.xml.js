import config from '../../data/config.json';

export const GET = ({ site }) => new Response(`<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>${config.name}</ShortName>
  <Description>Search vinyl records in stock at independent record shops</Description>
  <Tags>vinyl record LP EP shop search</Tags>
  <Url type="text/html" template="${new URL('/', site).href}?q={searchTerms}"/>
  <Image height="64" width="64" type="image/png">${new URL('/favicon.png', site).href}</Image>
  <Query role="example" searchTerms="Joy Division"/>
  <InputEncoding>UTF-8</InputEncoding>
</OpenSearchDescription>
`, { headers: { 'content-type': 'application/opensearchdescription+xml' } });
