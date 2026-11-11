import { redirect } from 'next/navigation';

export default function Page() {
  redirect('/leave?tab=approvals');
}
