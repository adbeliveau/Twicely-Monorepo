export const APP_NAME = 'Twicely' as const;

export const DOMAINS = {
  marketplace: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  hub: process.env.NEXT_PUBLIC_HUB_URL ?? 'http://localhost:3000',
} as const;

export const ROUTES = {
  home: '/',
  search: '/s',
  login: '/auth/login',
  signup: '/auth/signup',
  dashboard: '/my',
  sellerDashboard: '/my/selling',
  hubDashboard: '/d',
} as const;
