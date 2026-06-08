import { Navigate, useParams } from 'react-router';

/** `/share/clip/:id` opens the clip modal on the home feed. */
export default function ShareClipRedirect() {
  const { clipId } = useParams<{ clipId: string }>();
  const id = clipId?.trim();
  if (!id || !/^\d+$/.test(id)) {
    return <Navigate to="/" replace />;
  }
  return <Navigate to={`/?clip=${encodeURIComponent(id)}`} replace />;
}
