import config from '../../data/config.json';

export const GET = () => new Response(`google.com, ${config.ads.adsenseClient.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`);
