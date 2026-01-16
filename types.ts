
export enum AppView {
  SELECTION = 'SELECTION',
  LOGIN = 'LOGIN',
  REGISTER = 'REGISTER',
  CHOOSE_DISCIPLESHIP = 'CHOOSE_DISCIPLESHIP',
  LEADER_LIST = 'LEADER_LIST',
  LEADER_DASHBOARD = 'LEADER_DASHBOARD',
  DISCIPLE_DASHBOARD = 'DISCIPLE_DASHBOARD',
  PASTOR_DASHBOARD = 'PASTOR_DASHBOARD',
  RANKING = 'RANKING',
  ALL_LEADERS = 'ALL_LEADERS'
}

export interface Discipleship {
  id: string;
  name: string;
  discipuladorName: string;
  discipuladorPhoto?: string;
  email: string;
  password?: string;
  theme_color?: string;
  role?: 'pastor' | 'discipulador';
  access_pin?: string;
  pastor_id?: string;
  push_token?: string;
}

export interface Week {
  id: string;
  label: string;
  range: string;
  month: string;
  year: number;
}

export interface Leader {
  id: string;
  name: string;
  discipleshipId: string;
  push_token?: string;
  goal_cell?: number;
  goal_worship?: number;
}

export interface Report {
  leaderId: string;
  weekId: string;
  cellCount: number;
  worshipCount: number;
  cellSent?: boolean;
  worshipSent?: boolean;
  goalCell?: number;
  goalWorship?: number;
}

export interface Settings {
  userName: string;
  discipleshipName: string;
  themeColor: string;
}
