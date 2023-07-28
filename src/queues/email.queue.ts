import Agenda from 'agenda';

import EnvVars from '@src/constants/EnvVars';

const agenda = new Agenda({
  db: {
    process.env.AGENDA,
    collection: 'emailJob',
  },
});

export default agenda;