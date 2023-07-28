/**
 * Environments variables declared here.
 */

/* eslint-disable node/no-process-env */

export default {
  agenda: process.env.DATABASE_URL_AGENDA,
  firebase: {
    bucket: process.env.FIREBASE_BUCKET,
  },
  NodeEnv: process.env.NODE_ENV ?? '',
  Port: process.env.PORT ?? 8080,
  CorsUrl: process.env.CORS_URL,
  GoogleProvider: {
    clientId: process.env.CLIENT_ID,
  },
  Firebase: {
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    projectId: process.env.FIREBASE_PROJECT_ID,
  },
  CookieProps: {
    Key: 'ExpressGeneratorTs',
    Secret: process.env.COOKIE_SECRET ?? '',
    // Casing to match express cookie options
    Options: {
      httpOnly: true,
      signed: true,
      path: process.env.COOKIE_PATH ?? '',
      maxAge: Number(process.env.COOKIE_EXP ?? 0),
      domain: process.env.COOKIE_DOMAIN ?? '',
      secure: process.env.SECURE_COOKIE === 'true',
    },
  },
  Jwt: {
    Secret: process.env.JWT_SECRET ?? '',
    Exp: process.env.COOKIE_EXP ?? '', // exp at the same time as the cookie
  },
} as const;
