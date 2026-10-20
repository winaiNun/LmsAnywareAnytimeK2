/** Thai wording for the actions the system writes to AuditLog (pure, no database). An action not listed here is shown as it is. */
export const AUDIT_LABELS: Record<string, string> = {
  "user.register": "สมัครสมาชิก",
  "user.create": "แอดมินเพิ่มสมาชิก",
  "user.update": "แอดมินแก้ข้อมูล/สิทธิ์สมาชิก",
  "user.delete": "ลบสมาชิก",
  "user.import": "นำเข้าสมาชิกจากไฟล์",
  "user.profile-update": "สมาชิกแก้ข้อมูลส่วนตัว",
  "user.password-change": "เปลี่ยนรหัสผ่าน",
  "user.password-reset": "แอดมินตั้งรหัสผ่านใหม่ให้",
  "user.pin-set": "ตั้ง PIN มือถือ",
  "user.pin-change": "เปลี่ยน PIN มือถือ",
  "user.pin-remove": "ลบเครื่องที่ผูก PIN",
  "user.avatar-upload": "อัปโหลดรูปโปรไฟล์",
  "user.avatar-drive": "ตั้งรูปโปรไฟล์จาก Drive",
  "user.honors-prefs": "ตั้งค่าการแสดงตัวในหน้าเชิดชู",
  "creator.request": "ขอเป็นผู้สร้างคอร์ส",
  "creator.approve": "อนุมัติเป็นผู้สร้างคอร์ส",
  "creator.reject": "ไม่อนุมัติผู้สร้างคอร์ส",
  "code.create": "สร้างรหัสสมัคร",
  "code.create-sub": "สร้างรหัสย่อยให้โรงเรียน",
  "code.update": "แก้ไขรหัสสมัคร",
  "code.enable": "เปิดรหัสสมัคร",
  "code.disable": "ปิดรหัสสมัคร",
  "code.delete": "ลบรหัสสมัคร",
  "course.create": "สร้างคอร์ส",
  "course.update": "แก้ไขคอร์ส",
  "course.submit": "ส่งคอร์สขออนุมัติ",
  "course.publish": "เผยแพร่คอร์ส",
  "course.approve": "อนุมัติคอร์ส",
  "course.reject": "ส่งคอร์สกลับให้แก้",
  "course.unpublish": "ถอนคอร์สออกจากการเผยแพร่",
  "course.withdraw": "ถอนคอร์สกลับเป็นร่าง",
  "course.delete": "ลบคอร์ส",
  "course.enroll": "ลงทะเบียนเรียนคอร์ส",
  "course.enroll-open": "เปิดรับลงทะเบียนคอร์ส",
  "course.enroll-close": "ปิดรับลงทะเบียนคอร์ส",
  "course.complete": "เรียนจบคอร์ส",
  "media.create": "ส่งสื่อ",
  "media.update": "แก้ไขสื่อ",
  "media.approve": "อนุมัติสื่อ",
  "media.reject": "ส่งสื่อกลับให้แก้",
  "media.pin": "ปักหมุดสื่อ",
  "media.unpin": "เลิกปักหมุดสื่อ",
  "media.unpublish": "ถอนสื่อออกจากการเผยแพร่",
  "media.delete": "ลบสื่อ",
  "reviewer.add": "แต่งตั้งผู้ตรวจ",
  "reviewer.remove": "ถอดผู้ตรวจ",
  "taxonomy.delete": "ลบกลุ่มสาระ/ประเภทสื่อ",
  "school.import": "นำเข้าทำเนียบโรงเรียน",
  "school.edit": "แก้ข้อมูลโรงเรียน",
  "school.delete": "ลบโรงเรียน",
  "school.password-reset": "ออกรหัสผ่านชั่วคราวให้โรงเรียน",
  "site.page-save": "แก้ไขหน้าข้อมูล",
  "site.page-reset": "คืนหน้าข้อมูลเป็นข้อความเริ่มต้น",
  "site.texts": "แก้ชื่อเมนู/หัวข้อหน้า",
  "site.footer-settings": "แก้ช่องทางติดต่อ/ท้ายเว็บ",
  "honors.settings": "ตั้งค่าหน้าเชิดชู",
  "honors.hide": "ซ่อนสมาชิกจากหน้าเชิดชู",
  "honors.unhide": "คืนสิทธิ์แสดงในหน้าเชิดชู",
  "resource.create": "เพิ่มแหล่งสื่อภายนอก",
  "resource.update": "แก้แหล่งสื่อภายนอก",
  "resource.delete": "ลบแหล่งสื่อภายนอก",
  "resource.hide": "ซ่อนแหล่งสื่อภายนอก",
  "resource.show": "แสดงแหล่งสื่อภายนอก",
  "news.tab.create": "เพิ่มแท็บข่าว",
  "news.tab.update": "แก้แท็บข่าว",
  "news.tab.delete": "ลบแท็บข่าว",
  "news.item.create": "เพิ่มข่าว",
  "news.item.update": "แก้ข่าว",
  "news.item.delete": "ลบข่าว",
  "stat.create": "เพิ่มการ์ดตัวเลข",
  "stat.update": "แก้การ์ดตัวเลข",
  "stat.delete": "ลบการ์ดตัวเลข",
  "stat.move": "จัดลำดับการ์ดตัวเลข",
  "stat.reset": "คืนค่าการ์ดตัวเลข",
  "stat.hide": "ซ่อนการ์ดตัวเลข",
  "stat.show": "แสดงการ์ดตัวเลข",
  "faq.create": "เพิ่มคำถาม FAQ",
  "faq.update": "แก้คำถาม FAQ",
  "faq.delete": "ลบคำถาม FAQ",
  "faq.seed": "ใส่คำถามตัวอย่าง FAQ",
  "faq.show": "แสดงคำถาม FAQ",
  "faq.hide": "ซ่อนคำถาม FAQ",
  "faq.pin": "ปักหมุดคำถาม FAQ",
  "faq.unpin": "เลิกปักหมุดคำถาม FAQ",
  "faq.enable": "เปิดแชต FAQ",
  "faq.disable": "ปิดแชต FAQ",
  "faq.unanswered.clear": "ล้างรายการคำถามที่ตอบไม่ได้",
  "faq.unanswered.delete": "ลบคำถามที่ตอบไม่ได้",
  "faq.unanswered.dismiss": "ปิดคำถามที่ตอบไม่ได้ (ไม่ต้องตอบ)",
  "faq.unanswered.reopen": "เปิดคำถามที่ตอบไม่ได้อีกครั้ง",
  "news.tab.show": "แสดงแท็บข่าว",
  "news.tab.hide": "ซ่อนแท็บข่าว",
  "news.item.show": "แสดงข่าว",
  "news.item.hide": "ซ่อนข่าว",
  "news.item.pin": "ปักหมุดข่าว",
  "news.item.unpin": "เลิกปักหมุดข่าว",
  "system.backup": "สำรองข้อมูล",
  "system.restore-check": "ทดสอบกู้คืนข้อมูล",
  "error.resolve": "ทำเครื่องหมายว่าแก้ข้อผิดพลาดแล้ว",
  "error.reopen": "เปิดข้อผิดพลาดอีกครั้ง",
};

export const auditLabel = (action: string): string => AUDIT_LABELS[action] ?? action;

/** Where the admin can look at the thing an entry is about (null = no page for it). */
export function auditLink(entity: string, id: string | null | undefined): string | null {
  if (!id) return null;
  switch (entity) {
    case "User":
      return `/admin/users/${id}`;
    case "Course":
      return `/admin/courses/${id}`;
    case "Media":
      return `/admin/media/${id}`;
    case "RegistrationCode":
      return `/admin/registration-codes/${id}`;
    case "School":
      return `/admin/schools/${id}`;
    default:
      return null;
  }
}

/** Compact "key: value" text of an entry's details (values cut short; nothing secret is ever written to the log). */
export function auditMeta(meta: unknown): string {
  if (!meta || typeof meta !== "object") return "";
  return Object.entries(meta as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`.slice(0, 90))
    .join(" · ")
    .slice(0, 300);
}
