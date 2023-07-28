import admin, { ServiceAccount } from 'firebase-admin';

import serviceAccount from '@src/libs/fexchange.json';

export const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as ServiceAccount),
});

console.log(app.name); // '[DEFAULT]
