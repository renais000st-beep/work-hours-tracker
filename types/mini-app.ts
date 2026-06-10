export interface UserProfile {
  profileId: string;
  username: string;
  isAdmin: boolean;
  groups: { id: string; name: string; role: string }[];
}

export interface WorkShift {
  id: number;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  group: string;
  day_hours: number;
  night_hours: number;
  total_hours: number;
  sunday_hours: number;
  holiday_hours: number;
}

export interface PlannedShift {
  id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  group_name: string;
  username: string;
}

export type Tab = 'shifts' | 'schedule' | 'profile';
