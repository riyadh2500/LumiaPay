/**
 * Lightweight fetch helpers for use in API routes and server components.
 */

export function ok<T>(data: T, status = 200): Response {
  return Response.json(data, { status });
}

export function err(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

export function unauthorized(): Response {
  return err('Unauthorized', 401);
}

export function notFound(resource = 'Resource'): Response {
  return err(`${resource} not found`, 404);
}
