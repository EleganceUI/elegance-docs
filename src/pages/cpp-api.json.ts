// The sidebar's data, for opening a part of it the page didn't render (src/components/Sidebar.astro).
import { api } from '../scripts/api';

export const GET = () => new Response(JSON.stringify(api), { headers: { 'Content-Type': 'application/json' } });
