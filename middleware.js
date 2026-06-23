const unauthorized = () =>
  new Response('Authentifizierung erforderlich.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="GBS Energy Vorschau", charset="UTF-8"',
    },
  });

export default function middleware(request) {
  const expectedUser = process.env.BASIC_AUTH_USER;
  const expectedPass = process.env.BASIC_AUTH_PASSWORD;

  if (!expectedUser || !expectedPass) {
    return new Response('Vorschau-Schutz ist nicht konfiguriert (BASIC_AUTH_* fehlt).', {
      status: 503,
    });
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Basic ')) {
    return unauthorized();
  }

  let decoded = '';
  try {
    decoded = atob(authHeader.slice(6));
  } catch {
    return unauthorized();
  }

  const separator = decoded.indexOf(':');
  if (separator === -1) {
    return unauthorized();
  }

  const user = decoded.slice(0, separator);
  const pass = decoded.slice(separator + 1);

  if (user === expectedUser && pass === expectedPass) {
    return new Response(null, {
      status: 200,
      headers: {
        'x-middleware-next': '1',
      },
    });
  }

  return unauthorized();
}

export const config = {
  matcher: ['/((?!_vercel).*)'],
};
