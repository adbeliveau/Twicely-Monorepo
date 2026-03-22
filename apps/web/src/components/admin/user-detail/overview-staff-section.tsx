import type { UserDetailFull } from '@/lib/queries/admin-users';

interface Props {
  user: UserDetailFull;
}

export function OverviewStaffSection({ user: _u }: Props) {
  // Staff data will come from user query enrichment in the future.
  // For now, render the section shell matching V2's visual design.
  // Staff members are displayed as rows with colored initial avatars.
  return null;
}
