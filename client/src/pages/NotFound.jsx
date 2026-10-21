import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
export default function NotFound() {
  return <div className="container bz-page"><EmptyState icon="bi-compass" title="Page not found" action={<Link to="/" className="btn btn-bz">Back to home</Link>}>That page doesn't exist or has moved.</EmptyState></div>;
}
