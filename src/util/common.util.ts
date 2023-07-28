import { Config, names, uniqueNamesGenerator } from 'unique-names-generator';

const config: Config = {
  dictionaries: [names],
};

export const getNotificationChannel = (type: string, uid: string) => {
  return type + ':' + uid;
};

export const routes = {
  auctionRequests: 'dashboard/auction-requests',
};

export const MODNotificationChannel = 'noti-mod';

export const getCronString = (date: Date) => {
  const minute = date.getMinutes();
  const hour = date.getHours();
  const dayOfMonth = date.getDate();
  const month = date.getMonth() + 1; // Months are 0-indexed in JavaScript
  const dayOfWeek = date.getDay();

  return `${minute} ${hour} ${dayOfMonth} ${month} ${dayOfWeek}`;
};

interface BasicSocketEvent {
  join: string;
  joined: string;
  leave: string;
  left: string;
  view: string;
  create: string;
  created: string;
  update: string;
  updated: string;
}

export const getBasicEvents = (tag: string): BasicSocketEvent => {
  return {
    join: `${tag}:join`,
    joined: `${tag}:joined`,
    leave: `${tag}:leave`,
    left: `${tag}:left`,
    view: `${tag}:view`,
    create: `${tag}:create`,
    created: `${tag}:created`,
    update: `${tag}:update`,
    updated: `${tag}:updated`,
  };
};

export const randomName = () => {
  return uniqueNamesGenerator(config);
};
