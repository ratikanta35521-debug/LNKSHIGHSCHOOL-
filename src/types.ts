export type Language = 'en' | 'or';

export type UserRole = 'super_owner' | 'admin' | 'student';

export interface StudentProfile {
  id: number;
  reg_code: string;
  full_name: string;
  gender: 'Boy' | 'Girl';
  class_level: 9 | 10;
  roll_number: string;
  mobile: string;
  is_active?: number;
  created_at: string;
}

export interface AuthUser {
  role: UserRole;
  id: number;
  name: string;
  loginId?: string;
  mobile?: string;
  slotNumber?: number;
  student?: StudentProfile;
}

export interface DashboardSummary {
  studentsTotal: number;
  boysCount: number;
  girlsCount: number;
  class9Count: number;
  class10Count: number;
  materialsCount: number;
  noticesCount: number;
  galleryCount: number;
  messagesCount: number;
  quizzesCount: number;
  activeAdminsCount: number;
}

export interface StudyMaterial {
  id: number;
  title: string;
  title_or: string | null;
  description: string | null;
  class_level: 9 | 10;
  subject_id: string;
  resource_type: 'pdf' | 'photo' | 'link';
  file_url: string | null;
  file_name: string | null;
  external_url: string | null;
  uploaded_by_name: string;
  uploaded_by_role: string;
  created_at: string;
}

export interface SchoolNotice {
  id: number;
  title: string;
  title_or: string | null;
  content: string;
  content_or: string | null;
  priority: 'general' | 'urgent' | 'exam';
  target_class: 'all' | '9' | '10';
  attachment_url: string | null;
  attachment_type: 'none' | 'pdf' | 'photo';
  attachment_name: string | null;
  posted_by_name: string;
  posted_by_role: string;
  created_at: string;
}

export interface GalleryPhoto {
  id: number;
  title: string;
  title_or: string | null;
  caption: string | null;
  category: 'tournament' | 'event' | 'notice' | 'campus';
  image_url: string;
  uploaded_by_name: string;
  uploaded_by_role: string;
  created_at: string;
}

export interface MessageReply {
  id: number;
  message_id: number;
  sender_name: string;
  sender_role: string;
  content: string;
  attachment_url: string | null;
  attachment_type: 'none' | 'pdf' | 'photo';
  attachment_name: string | null;
  created_at: string;
}

export interface StudentMessage {
  id: number;
  student_id: number;
  student_name: string;
  student_gender: 'Boy' | 'Girl';
  student_class: 9 | 10;
  student_roll: string;
  subject_tag: string | null;
  content: string;
  attachment_url: string | null;
  attachment_type: 'none' | 'pdf' | 'photo';
  attachment_name: string | null;
  created_at: string;
  replies: MessageReply[];
}

export interface QuizQuestion {
  id: number;
  class_level: 9 | 10;
  subject_id: string;
  question: string;
  question_or: string | null;
  options: string[];
  correct_index: number;
  explanation: string | null;
  created_by_name: string;
  created_at: string;
}

export interface QuizAttempt {
  id: number;
  student_id: number;
  class_level: 9 | 10;
  subject_id: string;
  score: number;
  total: number;
  created_at: string;
}

export interface AdminSlot {
  slot_number: number;
  name: string | null;
  login_id: string | null;
  is_active: number;
  assigned_at: string | null;
  updated_at: string;
}

export interface TeacherContact {
  id: number;
  name: string;
  designation: string;
  subject: string;
  class_assigned: string;
  phone: string;
  updated_at: string;
}

export type PortalTab =
  | 'overview'
  | 'academics'
  | 'notices'
  | 'messages'
  | 'gallery'
  | 'quiz'
  | 'teachers'
  | 'idcard'
  | 'owner';

