import { redirect } from 'next/navigation';

/**
 * Legacy search admin page — redirects to the new /cfg/search dashboard.
 * Decision #143: Search admin moved under /cfg/search/* (Settings section).
 */
export default function SearchAdminPage() {
  redirect('/cfg/search');
}
