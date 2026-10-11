# 移除 i18n 翻译系统 - 硬编码双语实施计划

## 任务概述

完全移除 Mira Villa 施工管理系统的 i18n 动态翻译系统，将所有前端 JS 文件中的 `t('xxx')` 和 `i18n.t('xxx')` 调用替换为硬编码的双语字符串（格式："中文 ภาษาไทย"）。

**工作目录**: `e:\3XBANG`  
**翻译映射来源**: `e:\3XBANG/frontend/js/i18n.js` 的 `translations` 对象

---

## 翻译映射表（从 i18n.js 提取）

以下是从 i18n.js 中提取的完整双语映射。所有替换将严格基于此映射表：

### app 应用级
- `app.title` → `Mira Villa`
- `app.subtitle` → `建筑项目管理系统 ระบบจัดการโครงการก่อสร้าง`

### nav 导航
- `nav.projects` → `项目管理 จัดการโครงการ`
- `nav.processes` → `工序进度 ความคืบหน้างาน`
- `nav.materials` → `材料管理 จัดการวัสดุ`
- `nav.photos` → `现场照片 รูปถ่ายหน้างาน`
- `nav.dailyTasks` → `今日任务 งานวันนี้`
- `nav.users` → `用户管理 ผู้ใช้งาน`

### common 通用
- `common.logout` → `退出 ออกจากระบบ`
- `common.save` → `保存 บันทึก`
- `common.cancel` → `取消 ยกเลิก`
- `common.delete` → `删除 ลบ`
- `common.edit` → `编辑 แก้ไข`
- `common.confirm` → `确认 ยืนยัน`
- `common.confirmDelete` → `确认删除 ยืนยันลบ`
- `common.loading` → `加载中... กำลังโหลด...`
- `common.success` → `成功 สำเร็จ`
- `common.error` → `错误 ผิดพลาด`
- `common.notes` → `备注 หมายเหตุ`
- `common.noData` → `暂无数据 ไม่มีข้อมูล`
- `common.add` → `添加 เพิ่ม`
- `common.remove` → `移除 ลบออก`
- `common.close` → `关闭 ปิด`
- `common.submit` → `提交 ส่ง`
- `common.back` → `返回 กลับ`
- `common.next` → `下一步 ถัดไป`
- `common.create` → `创建 สร้าง`
- `common.thai` → `泰语 ภาษาไทย`
- `common.chinese` → `中文 中文`

### dashboard 仪表盘
- `dashboard.title` → `项目概览 แดชบอร์ดโครงการ`
- `dashboard.noProjects` → `暂无项目 ยังไม่มีโครงการ`
- `dashboard.noProjectsDesc` → `开始创建第一个项目 เริ่มต้นสร้างโครงการแรกของคุณ`
- `dashboard.myProjects` → `我的项目 โครงการของฉัน`

### projectDetail 项目详情
- `projectDetail.overview` → `项目概览 ภาพรวมโครงการ`
- `projectDetail.settings` → `项目设置 ตั้งค่าโครงการ`

### overview 概览
- `overview.totalProcesses` → `总工序数 จำนวนงานทั้งหมด`
- `overview.completedProcesses` → `已完成 เสร็จแล้ว`
- `overview.inProgress` → `进行中 กำลังดำเนินการ`
- `overview.teamMembers` → `团队成员 สมาชิกทีม`
- `overview.projectInfo` → `项目信息 ข้อมูลโครงการ`（需从 i18n.js 补充确认）

### projects 项目管理
- `projects.title` → `项目管理 จัดการโครงการ`
- `projects.name` → `项目名称 ชื่อโครงการ`
- `projects.code` → `项目编号 รหัสโครงการ`
- `projects.description` → `项目描述 คำอธิบาย`
- `projects.location` → `项目地址 ที่ตั้งโครงการ`
- `projects.startDate` → `开始日期 วันเริ่ม`
- `projects.endDate` → `结束日期 วันสิ้นสุด`
- `projects.manager` → `项目经理 ผู้จัดการโครงการ`
- `projects.create` → `创建项目 สร้างโครงการ`
- `projects.edit` → `编辑项目 แก้ไขโครงการ`
- `projects.delete` → `删除项目 ลบโครงการ`
- `projects.confirmDelete` → `确认删除项目？ ยืนยันลบโครงการ?`
- `projects.createSuccess` → `项目创建成功 สร้างโครงการสำเร็จ`
- `projects.updateSuccess` → `项目更新成功 อัพเดทโครงการสำเร็จ`
- `projects.deleteSuccess` → `项目删除成功 ลบโครงการสำเร็จ`
- `projects.loadError` → `加载项目失败 โหลดโครงการไม่สำเร็จ`
- `projects.basicInfo` → `基本信息 ข้อมูลพื้นฐาน`
- `projects.selectProcesses` → `选择工序 เลือกงาน`
- `projects.processes` → `工序 งาน`
- `projects.addProcess` → `添加工序 เพิ่มงาน`
- `projects.noProcesses` → `暂无工序 ยังไม่มีงาน`
- `projects.noProcessesDesc` → `开始添加第一个工序 เริ่มต้นเพิ่มงานแรก`
- `projects.addFirst` → `添加第一个工序 เพิ่มงานแรก`
- `projects.add` → `添加项目 เพิ่มโครงการ`（推断）
- `projects.client` → `客户 ลูกค้า`（推断）
- `projects.status` → `状态 สถานะ`（推断）
- `projects.progress` → `进度 ความคืบหน้า`（推断）
- `projects.qualityPoints` → `质量要点 จุดตรวจสอบคุณภาพ`（推断）
- `projects.selectAll` → `全选 เลือกทั้งหมด`（推断）
- `projects.deselectAll` → `取消全选 ยกเลิกทั้งหมด`（推断）
- `projects.processesSelected` → `个工序已选 งานถูกเลือก`（推断）
- `projects.loadProcessError` → `加载工序失败 โหลดงานไม่สำเร็จ`（推断）
- `projects.selectProcessesHelp` → `请选择要添加的工序 กรุณาเลือกงานที่ต้องการเพิ่ม`（推断）
- `projects.clientPlaceholder` → `客户名称 ชื่อลูกค้า`（推断）
- `projects.createFirst` → `创建第一个项目 สร้างโครงการแรก`（推断）
- `projects.membersManagement` → `成员管理 จัดการสมาชิก`（推断）
- `projects.members` → `成员 สมาชิก`（推断）
- `projects.createSuccessProcessWarning` → `项目创建成功但添加工序失败 สร้างโครงการสำเร็จแต่เพิ่มงานไม่สำเร็จ`（推断）
- `projects.status.active` → `进行中 กำลังดำเนินการ`（推断）
- `projects.status.completed` → `已完成 เสร็จแล้ว`（推断）
- `projects.status.paused` → `已暂停 หยุดชั่วคราว`（推断）
- `projects.status.cancelled` → `已取消 ยกเลิกแล้ว`（推断）
- `projects.deleteWarning` → `确定要删除此项目吗？ ยืนยันลบโครงการนี้?`（推断）
- `projects.deleteItems.processes` → `所有工序 งานทั้งหมด`（推断）
- `projects.deleteItems.materials` → `所有材料 วัสดุทั้งหมด`（推断）
- `projects.deleteItems.photos` → `所有照片 รูปภาพทั้งหมด`（推断）
- `projects.deleteItems.progress` → `所有进度记录 บันทึกความคืบหน้าทั้งหมด`（推断）
- `projects.deleteItems.members` → `所有成员分配 การจัดสรรสมาชิกทั้งหมด`（推断）
- `projects.deleteFinalWarning` → `此操作无法撤销！ การดำเนินการนี้ไม่สามารถย้อนกลับได้!`（推断）
- `projects.createError` → `创建项目失败 สร้างโครงการไม่สำเร็จ`（推断）
- `projects.updateError` → `更新项目失败 อัพเดทโครงการไม่สำเร็จ`（推断）
- `projects.deleteError` → `删除项目失败 ลบโครงการไม่สำเร็จ`（推断）
- `projects.selectProject` → `选择项目 เลือกโครงการ`（推断）

### processes 工序
- `processes.title` → `工序进度 ความคืบหน้างาน`
- `processes.addProcess` → `添加工序 เพิ่มงาน`
- `processes.noProcesses` → `暂无工序 ยังไม่มีงาน`
- `processes.noProcessesDesc` → `开始添加工序 เริ่มเพิ่มงาน`
- `processes.addFirst` → `添加第一个工序 เพิ่มงานแรก`
- `processes.processCode` → `工序编号 รหัสงาน`
- `processes.status.not_started` → `未开始 ยังไม่เริ่ม`
- `processes.status.in_progress` → `进行中 กำลังดำเนินการ`
- `processes.status.waiting_material` → `等待材料 รอวัสดุ`
- `processes.status.weather_stop` → `天气停工 หยุดเพราะสภาพอากาศ`
- `processes.status.completed` → `已完成 เสร็จแล้ว`
- `processes.status.paused` → `已暂停 หยุดชั่วคราว`
- `processes.fromTemplate` → `从模板添加 เพิ่มจากเทมเพลต`（推断）
- `processes.fromTemplateDesc` → `从工序库选择 เลือกจากคลังงาน`（推断）
- `processes.customProcess` → `自定义工序 งานกำหนดเอง`（推断）
- `processes.customProcessDesc` → `手动创建工序 สร้างงานด้วยตนเอง`（推断）
- `processes.selectFromTemplate` → `从模板选择工序 เลือกงานจากเทมเพลต`（推断）
- `processes.selectTemplateHelp` → `选择要添加的工序 เลือกงานที่ต้องการเพิ่ม`（推断）
- `processes.selectAtLeastOne` → `请至少选择一个工序 กรุณาเลือกงานอย่างน้อยหนึ่งรายการ`（推断）
- `processes.addSuccess` → `工序添加成功 เพิ่มงานสำเร็จ`（推断）
- `processes.addError` → `工序添加失败 เพิ่มงานไม่สำเร็จ`（推断）
- `processes.processName` → `工序名称 ชื่องาน`（推断）
- `processes.codeExample` → `例如: A01 เช่น: A01`（推断）
- `processes.codeHint` → `请输入工序编号 กรุณาใส่รหัสงาน`（推断）
- `processes.unit` → `单位 หน่วย`（推断）
- `processes.fillRequired` → `请填写必填项 กรุณากรอกข้อมูลที่จำเป็น`（推断）
- `processes.confirmDelete` → `确认删除工序？ ยืนยันลบงาน?`（推断）
- `processes.deleteSuccess` → `工序删除成功 ลบงานสำเร็จ`（推断）
- `processes.deleteError` → `工序删除失败 ลบงานไม่สำเร็จ`（推断）
- `processes.workers` → `工人 คนงาน`（推断）

### scheduling 计划
- `scheduling.schedule` → `计划 แผนงาน`
- `scheduling.dependencies` → `依赖 งานที่เกี่ยวข้อง`
- `scheduling.days` → `天 วัน`
- `scheduling.plannedStartDate` → `计划开始 วันเริ่มตามแผน`
- `scheduling.plannedEndDate` → `计划完成 วันสิ้นสุดตามแผน`
- `scheduling.plannedDuration` → `计划工期 ระยะเวลาตามแผน`

### materials 材料
- `materials.title` → `材料管理 จัดการวัสดุ`
- `materials.materialList` → `材料列表 รายการวัสดุ`
- `materials.addMaterial` → `添加材料 เพิ่มวัสดุ`
- `materials.noMaterials` → `暂无材料 ไม่มีวัสดุ`
- `materials.purchased` → `采购 สั่งซื้อ`
- `materials.received` → `到货 เข้าคลัง`
- `materials.used` → `已用 ใช้แล้ว`
- `materials.stock` → `库存 คงเหลือ`

### daily 今日任务
- `daily.title` → `今日任务 งานวันนี้`
- `daily.updateProgress` → `更新进度 อัพเดทความคืบหน้า`
- `daily.viewSubtasks` → `查看子任务 ดูงานย่อย`
- `daily.currentProgress` → `当前完成度 ความคืบหน้าปัจจุบัน`
- `daily.newProgress` → `新的完成度 ความคืบหน้าใหม่ (%)`
- `daily.progressNotes` → `进度说明 หมายเหตุความคืบหน้า`
- `daily.workers` → `工人 คนงาน`（推断）
- `daily.todayPlan` → `今日计划 แผนวันนี้`（推断）
- `daily.todayCompleted` → `今日完成 เสร็จวันนี้`（推断）
- `daily.quantityCompleted` → `完成数量 ปริมาณเสร็จแล้ว`（推断）
- `daily.workStatus` → `工作状态 สถานะงาน`（推断）
- `daily.normal` → `正常 ปกติ`（推断）
- `daily.waitingMaterial` → `等待材料 รอวัสดุ`（推断）
- `daily.weatherStop` → `天气停工 หยุดเพราะสภาพอากาศ`（推断）

### users 用户管理
- `users.title` → `用户管理 จัดการผู้ใช้`
- `users.username` → `用户名 ชื่อผู้ใช้`
- `users.password` → `密码 รหัสผ่าน`
- `users.role` → `角色 บทบาท`
- `users.addUser` → `添加用户 เพิ่มผู้ใช้`
- `users.loadError` → `加载用户失败 โหลดผู้ใช้ไม่สำเร็จ`（推断）
- `users.noUsers` → `暂无用户 ยังไม่มีผู้ใช้`（推断）
- `users.assignProjects` → `分配项目 จัดโครงการ`（推断）
- `users.editUser` → `编辑用户 แก้ไขผู้ใช้`（推断）
- `users.fullName` → `全名 ชื่อเต็ม`（推断）
- `users.selectRole` → `选择角色 เลือกบทบาท`（推断）
- `users.passwordHint` → `至少6个字符 อย่างน้อย 6 ตัวอักษร`（推断）
- `users.addSuccess` → `添加用户成功 เพิ่มผู้ใช้สำเร็จ`（推断）
- `users.addError` → `添加用户失败 เพิ่มผู้ใช้ไม่สำเร็จ`（推断）
- `users.usernameCannotChange` → `用户名不可更改 ชื่อผู้ใช้ไม่สามารถเปลี่ยนได้`（推断）
- `users.newPassword` → `新密码 รหัสผ่านใหม่`（推断）
- `users.passwordOptional` → `不填则不修改 ไม่กรอกก็ไม่เปลี่ยน`（推断）
- `users.updateSuccess` → `更新用户成功 อัพเดทผู้ใช้สำเร็จ`（推断）
- `users.updateError` → `更新用户失败 อัพเดทผู้ใช้ไม่สำเร็จ`（推断）
- `users.confirmDelete` → `确认删除用户 {name}？ ยืนยันลบผู้ใช้ {name}?`（推断）
- `users.deleteSuccess` → `删除用户成功 ลบผู้ใช้สำเร็จ`（推断）
- `users.deleteError` → `删除用户失败 ลบผู้ใช้ไม่สำเร็จ`（推断）
- `users.assignProjectsTo` → `为 {name} 分配项目 จัดโครงการให้ {name}`（推断）
- `users.selectProjects` → `选择项目 เลือกโครงการ`（推断）
- `users.loadProjectsError` → `加载项目失败 โหลดโครงการไม่สำเร็จ`（推断）
- `users.assignProjectsSuccess` → `分配项目成功 จัดโครงการสำเร็จ`（推断）
- `users.assignProjectsError` → `分配项目失败 จัดโครงการไม่สำเร็จ`（推断）

### roles 角色
- `roles.manager` → `经理 ผู้จัดการ`（推断）
- `roles.purchaser` → `采购 จัดซื้อ`（推断）
- `roles.executor` → `执行者 ผู้ปฏิบัติ`（推断）

### subtasks 子任务
- `subtasks.title` → `子任务 งานย่อย`（推断）
- `subtasks.view` → `查看子任务 ดูงานย่อย`（推断）
- `subtasks.add` → `添加子任务 เพิ่มงานย่อย`（推断）
- `subtasks.empty` → `暂无子任务 ไม่มีงานย่อย`（推断）
- `subtasks.update` → `更新 อัพเดท`（推断）
- `subtasks.complete` → `完成 เสร็จสิ้น`（推断）
- `subtasks.name` → `名称 ชื่อ`（推断）
- `subtasks.namePlaceholder` → `子任务名称 ชื่องานย่อย`（推断）
- `subtasks.description` → `描述 คำอธิบาย`（推断）
- `subtasks.descPlaceholder` → `任务描述 คำอธิบายงาน`（推断）
- `subtasks.estimatedQuantity` → `预计数量 ปริมาณประมาณการ`（推断）
- `subtasks.unit` → `单位 หน่วย`（推断）
- `subtasks.actualQuantity` → `实际数量 ปริมาณจริง`（推断）

### tasks 任务
- `tasks.assign` → `分配任务 มอบหมายงาน`（推断）

### units 单位
- `units.sqm` → `平方米 ตารางเมตร`（推断）
- `units.cbm` → `立方米 ลูกบาศก์เมตร`（推断）
- `units.item` → `项 รายการ`（推断）
- `units.point` → `点 จุด`（推断）

### login 登录
- `login.error` → `登录失败 เข้าสู่ระบบไม่สำเร็จ`（推断）

### 其他在代码中硬编码的双语字符串（无需替换）
- `项目概览 ภาพรวมโครงการ` (project-detail.js line 73)
- `今日任务 งานวันนี้` (project-detail.js line 78)
- `工序进度 ความคืบหน้างาน` (project-detail.js line 83)
- `材料管理 จัดการวัสดุ` (project-detail.js line 88)
- `现场照片 รูปถ่ายหน้างาน` (project-detail.js line 93)
- `项目设置 ตั้งค่าโครงการ` (project-detail.js line 99)
- `总工序数 จำนวนงานทั้งหมด` (project-detail.js line 122)
- `已完成 เสร็จแล้ว` (project-detail.js line 127)
- `进行中 กำลังดำเนินการ` (project-detail.js line 132)
- `团队成员 สมาชิกทีม` (project-detail.js line 137)

---

## 文件调查与替换清单

### 1. **process-manager.js** (优先级：高)
**路径**: `e:\3XBANG/frontend/js/process-manager.js`

**t() 调用统计**: 约 35 处

**主要替换位置**:
- Line 15: `t('processes.addProcess')` → `"添加工序 เพิ่มงาน"`
- Line 19: `t('processes.fromTemplate')` → `"从模板添加 เพิ่มจากเทมเพลต"`
- Line 20: `t('processes.fromTemplateDesc')` → `"从工序库选择 เลือกจากคลังงาน"`
- Line 24: `t('processes.customProcess')` → `"自定义工序 งานกำหนดเอง"`
- Line 25: `t('processes.customProcessDesc')` → `"手动创建工序 สร้างงานด้วยตนเอง"`
- Line 30: `t('common.cancel')` → `"取消 ยกเลิก"`
- Line 70: `t('processes.selectFromTemplate')` → `"从模板选择工序 เลือกงานจากเทมเพลต"`
- Line 73: `t('processes.selectTemplateHelp')` → `"选择要添加的工序 เลือกงานที่ต้องการเพิ่ม"`
- Line 76: `t('projects.selectAll')` → `"全选 เลือกทั้งหมด"`
- Line 79: `t('projects.deselectAll')` → `"取消全选 ยกเลิกทั้งหมด"`
- Line 91: `t('common.back')` → `"返回 กลับ"`
- Line 94: `t('common.add')` → `"添加 เพิ่ม"`
- Line 94: `t('projects.processesSelected')` → `"个工序已选 งานถูกเลือก"`
- Line 105: `t('projects.loadProcessError')` → `"加载工序失败 โหลดงานไม่สำเร็จ"`
- Line 116: `t('projects.processes')` → `"工序 งาน"`
- Line 142: `t('projects.qualityPoints')` → `"质量要点 จุดตรวจสอบคุณภาพ"`
- Line 198: `t('processes.selectAtLeastOne')` → `"请至少选择一个工序 กรุณาเลือกงานอย่างน้อยหนึ่งรายการ"`
- Line 208: `t('processes.addSuccess')` → `"工序添加成功 เพิ่มงานสำเร็จ"`
- Line 212: `t('processes.addError')` → `"工序添加失败 เพิ่มงานไม่สำเร็จ"`
- Line 216: `t('common.error')` → `"错误 ผิดพลาด"`
- Line 224: `t('processes.customProcess')` → `"自定义工序 งานกำหนดเอง"`
- Line 227: `t('processes.processCode')` → `"工序编号 รหัสงาน"`
- Line 228: `t('processes.codeExample')` → `"例如: A01 เช่น: A01"`
- Line 229: `t('processes.codeHint')` → `"请输入工序编号 กรุณาใส่รหัสงาน"`
- Line 234: `t('processes.processName')` → `"工序名称 ชื่องาน"`
- Line 234: `t('common.thai')` → `"泰语 ภาษาไทย"`
- Line 237: `t('common.chinese')` → `"中文 中文"`
- Line 242: `t('processes.unit')` → `"单位 หน่วย"`
- Line 251: `t('common.back')` → `"返回 กลับ"`
- Line 254: `t('common.add')` → `"添加 เพิ่ม"`
- Line 268: `t('processes.fillRequired')` → `"请填写必填项 กรุณากรอกข้อมูลที่จำเป็น"`
- Line 277: `t('processes.addSuccess')` → `"工序添加成功 เพิ่มงานสำเร็จ"`
- Line 280: `t('processes.addError')` → `"工序添加失败 เพิ่มงานไม่สำเร็จ"`
- Line 283: `t('common.error')` → `"错误 ผิดพลาด"`
- Line 292: `t('processes.confirmDelete')` → `"确认删除工序？ ยืนยันลบงาน?"`
- Line 304: `t('processes.deleteSuccess')` → `"工序删除成功 ลบงานสำเร็จ"`
- Line 307: `t('processes.deleteError')` → `"工序删除失败 ลบงานไม่สำเร็จ"`
- Line 310: `t('common.error')` → `"错误 ผิดพลาด"`

**验证**: 运行 `Select-String -Path "e:\3XBANG\frontend\js\process-manager.js" -Pattern "\bt\(" -AllMatches` 应返回 0 结果

---

### 2. **project-detail.js** (优先级：高)
**路径**: `e:\3XBANG/frontend/js/project-detail.js`

**t() 调用统计**: 约 10 处

**主要替换位置**:
- Line 54: `t('common.back')` → `"返回 กลับ"`
- Line 62: `t('projects.progress')` → `"进度 ความคืบหน้า"`
- Line 148: `t('overview.projectInfo')` → `"项目信息 ข้อมูลโครงการ"`（需确认 i18n.js 是否有此键）
- Line 151: `t('projects.client')` → `"客户 ลูกค้า"`
- Line 155: `t('projects.startDate')` → `"开始日期 วันเริ่ม"`
- Line 159: `t('projects.endDate')` → `"结束日期 วันสิ้นสุด"`
- Line 163: `t('projects.status')` → `"状态 สถานะ"`
- Line 166: `t('projects.status.' + this.project.status)` → 根据状态值动态替换
- Line 236: `t('projects.membersManagement')` → `"成员管理 จัดการสมาชิก"`

**注意**: 
- Lines 73, 78, 83, 88, 93, 99, 122, 127, 132, 137 已经是硬编码双语字符串，无需修改
- 动态状态需要创建状态映射对象

**验证**: 运行 `Select-String -Path "e:\3XBANG\frontend\js\project-detail.js" -Pattern "\bt\(" -AllMatches` 应返回 0 结果

---

### 3. **project-dashboard.js** (优先级：高)
**路径**: `e:\3XBANG/frontend/js/project-dashboard.js`

**t() 调用统计**: 约 60 处

**主要替换位置**:
- Line 39: `t('projects.loadError')` → `"加载项目失败 โหลดโครงการไม่สำเร็จ"`
- Line 41: `t('common.error')` → `"错误 ผิดพลาด"`
- Line 59: `t('dashboard.title')` → `"项目概览 แดชบอร์ดโครงการ"`
- Line 62: `t('projects.add')` → `"添加项目 เพิ่มโครงการ"`
- Line 83: `t('projects.status.' + statusClass)` → 动态状态映射
- Line 89: `t('projects.location')` → `"项目地址 ที่ตั้งโครงการ"`
- Line 93: `t('projects.client')` → `"客户 ลูกค้า"`
- Line 97: `t('projects.startDate')` → `"开始日期 วันเริ่ม"`
- Line 103: `t('projects.progress')` → `"进度 ความคืบหน้า"`
- Line 115: `t('projects.edit')` → `"编辑项目 แก้ไขโครงการ"`
- Line 121: `t('projects.delete')` → `"删除项目 ลบโครงการ"`
- Line 136: `t('dashboard.noProjects')` → `"暂无项目 ยังไม่มีโครงการ"`
- Line 137: `t('dashboard.noProjectsDesc')` → `"开始创建第一个项目 เริ่มต้นสร้างโครงการแรกของคุณ"`
- Line 141: `t('projects.createFirst')` → `"创建第一个项目 สร้างโครงการแรก"`
- Line 169: `t('projects.add')` → `"添加项目 เพิ่มโครงการ"`
- Line 175: `t('projects.basicInfo')` → `"基本信息 ข้อมูลพื้นฐาน"`
- Line 178: `t('projects.selectProcesses')` → `"选择工序 เลือกงาน"`
- Line 182: `t('projects.name')` → `"项目名称 ชื่อโครงการ"`
- Line 182, 186, 190, 194: `t('common.thai')` → `"泰语 ภาษาไทย"`
- Line 185, 189: `t('common.chinese')` → `"中文 中文"`
- Line 190: `t('projects.location')` → `"项目地址 ที่ตั้งโครงการ"`
- Line 198: `t('projects.client')` → `"客户 ลูกค้า"`
- Line 199: `t('projects.clientPlaceholder')` → `"客户名称 ชื่อลูกค้า"`
- Line 202: `t('projects.startDate')` → `"开始日期 วันเริ่ม"`
- Line 207: `t('projects.endDate')` → `"结束日期 วันสิ้นสุด"`
- Line 214: `t('common.next')` → `"下一步 ถัดไป"`
- Line 258: `t('projects.basicInfo')` → `"基本信息 ข้อมูลพื้นฐาน"`
- Line 263: `t('projects.selectProcesses')` → `"选择工序 เลือกงาน"`
- Line 269: `t('projects.selectProcessesHelp')` → `"请选择要添加的工序 กรุณาเลือกงานที่ต้องการเพิ่ม"`
- Line 272: `t('projects.selectAll')` → `"全选 เลือกทั้งหมด"`
- Line 275: `t('projects.deselectAll')` → `"取消全选 ยกเลิกทั้งหมด"`
- Line 287: `t('common.back')` → `"返回 กลับ"`
- Line 290: `t('common.create')` → `"创建 สร้าง"`
- Line 290: `t('projects.processesSelected')` → `"个工序已选 งานถูกเลือก"`
- Line 304: `t('projects.loadProcessError')` → `"加载工序失败 โหลดงานไม่สำเร็จ"`
- Line 315: `t('projects.processes')` → `"工序 งาน"`
- Line 329: `t('projects.qualityPoints')` → `"质量要点 จุดตรวจสอบคุณภาพ"`
- Line 373: `t('projects.createError')` → `"创建项目失败 สร้างโครงการไม่สำเร็จ"`
- Line 381: `t('projects.createSuccessProcessWarning')` → `"项目创建成功但添加工序失败 สร้างโครงการสำเร็จแต่เพิ่มงานไม่สำเร็จ"`
- Line 385: `t('projects.createSuccess')` → `"项目创建成功 สร้างโครงการสำเร็จ"`
- Line 398: `t('common.error')` → `"错误 ผิดพลาด"`
- Line 408: `t('projects.edit')` → `"编辑项目 แก้ไขโครงการ"`
- Line 413-435: 多处 `t('projects.name')`, `t('projects.location')`, `t('projects.client')`, `t('projects.status')`, `t('projects.startDate')`, `t('projects.endDate')` 等
- Line 481: `t('projects.updateError')` → `"更新项目失败 อัพเดทโครงการไม่สำเร็จ"`
- Line 485: `t('projects.updateSuccess')` → `"项目更新成功 อัพเดทโครงการสำเร็จ"`
- Line 500: `t('projects.delete')` → `"删除项目 ลบโครงการ"`
- Line 506: `t('projects.confirmDelete')` → `"确认删除项目？ ยืนยันลบโครงการ?"`
- Line 508: `t('projects.deleteWarning', { name: projectName })` → `"确定要删除此项目吗？ ยืนยันลบโครงการนี้?"`
- Line 511-515: `t('projects.deleteItems.xxx')` 各删除项
- Line 517: `t('projects.deleteFinalWarning')` → `"此操作无法撤销！ การดำเนินการนี้ไม่สามารถย้อนกลับได้!"`
- Line 524: `t('common.confirmDelete')` → `"确认删除 ยืนยันลบ"`
- Line 541: `t('projects.deleteError')` → `"删除项目失败 ลบโครงการไม่สำเร็จ"`
- Line 545: `t('projects.deleteSuccess')` → `"项目删除成功 ลบโครงการสำเร็จ"`

**验证**: 运行 `Select-String -Path "e:\3XBANG\frontend\js\project-dashboard.js" -Pattern "\bt\(" -AllMatches` 应返回 0 结果

---

### 4. **app.js** (优先级：高)
**路径**: `e:\3XBANG/frontend/js/app.js`

**t() 调用统计**: 约 70+ 处（文件被截断，需完整读取）

**主要替换位置**（基于已读取部分）:
- Line 53: `t('login.error')` → `"登录失败 เข้าสู่ระบบไม่สำเร็จ"`
- Line 139: `t('projects.empty', currentLang)` → `"暂无项目 ยังไม่มีโครงการ"`
- Line 148: `t('projects.location')` → `"项目地址 ที่ตั้งโครงการ"`
- Line 149: `t('projects.progress')` → `"进度 ความคืบหน้า"`
- Line 159: `t('projects.members')` → `"成员 สมาชิก"`
- Line 171: `t('projects.add')` → `"添加项目 เพิ่มโครงการ"`
- Line 174-193: 多处表单标签 t() 调用
- Line 286: `t('projects.selectProject')` → `"选择项目 เลือกโครงการ"`
- Line 304: `t('common.error')` → `"错误 ผิดพลาด"`
- Line 321: `t('common.noData')` → `"暂无数据 ไม่มีข้อมูล"`
- Line 339-347: 多处 t() 调用（日历任务渲染）
- Line 360: `t('daily.updateProgress')` → `"更新进度 อัพเดทความคืบหน้า"`
- Line 380: `t('daily.quantityCompleted')` → `"完成数量 ปริมาณเสร็จแล้ว"`
- Line 385-392: 表单字段 t() 调用
- Line 476-505: 工序渲染中的 t() 调用
- Line 508-530: 模态框中的 t() 调用
- Line 561-620: 子任务相关 t() 调用

**需要完整读取文件以获取所有 t() 调用位置**

**验证**: 运行 `Select-String -Path "e:\3XBANG\frontend\js\app.js" -Pattern "\bt\(" -AllMatches` 应返回 0 结果

---

### 5. **user-manager.js** (优先级：高)
**路径**: `e:\3XBANG/frontend/js/user-manager.js`

**i18n.t() 调用统计**: 约 45 处（使用 `i18n.t()` 而非 `t()`）

**主要替换位置**:
- Line 23: `i18n.t('users.loadError')` → `"加载用户失败 โหลดผู้ใช้ไม่สำเร็จ"`
- Line 45: `i18n.t('users.noUsers')` → `"暂无用户 ยังไม่มีผู้ใช้"`
- Line 50: `i18n.t(\`roles.${user.role}\`)` → 根据角色动态映射
- Line 61: `i18n.t('users.assignProjects')` → `"分配项目 จัดโครงการ"`
- Line 68: `i18n."编辑 แก้ไข"` → 已经是硬编码（语法错误需修正）
- Line 72: `i18n."删除 ลบ"` → 已经是硬编码（语法错误需修正）
- Line 109: `i18n.t('users.addUser')` → `"添加用户 เพิ่มผู้ใช้"`
- Line 114: `i18n.t('users.username')` → `"用户名 ชื่อผู้ใช้"`
- Line 118: `i18n.t('users.password')` → `"密码 รหัสผ่าน"`
- Line 120: `i18n.t('users.passwordHint')` → `"至少6个字符 อย่างน้อย 6 ตัวอักษร"`
- Line 123: `i18n.t('users.fullName')` → `"全名 ชื่อเต็ม"`
- Line 127: `i18n.t('users.role')` → `"角色 บทบาท"`
- Line 129: `i18n.t('users.selectRole')` → `"选择角色 เลือกบทบาท"`
- Line 130-132: `i18n.t('roles.xxx')` → 角色映射
- Line 137: `i18n."取消 ยกเลิก"` → 已经是硬编码（语法错误需修正）
- Line 140: `i18n.t('common.submit')` → `"提交 ส่ง"`
- Line 170: `i18n.t('users.addSuccess')` → `"添加用户成功 เพิ่มผู้ใช้สำเร็จ"`
- Line 176: `i18n.t('users.addError')` → `"添加用户失败 เพิ่มผู้ใช้ไม่สำเร็จ"`
- Line 180: `i18n.t('users.addError')` → `"添加用户失败 เพิ่มผู้ใช้ไม่สำเร็จ"`
- Line 195: `i18n.t('users.editUser')` → `"编辑用户 แก้ไขผู้ใช้"`
- Line 200-220: 多处表单标签 i18n.t() 调用
- Line 260: `i18n.t('users.updateSuccess')` → `"更新用户成功 อัพเดทผู้ใช้สำเร็จ"`
- Line 266: `i18n.t('users.updateError')` → `"更新用户失败 อัพเดทผู้ใช้ไม่สำเร็จ"`
- Line 270: `i18n.t('users.updateError')` → `"更新用户失败 อัพเดทผู้ใช้ไม่สำเร็จ"`
- Line 281: `i18n.t('users.confirmDelete')` → `"确认删除用户 {name}？ ยืนยันลบผู้ใช้ {name}?"`
- Line 293: `i18n.t('users.deleteSuccess')` → `"删除用户成功 ลบผู้ใช้สำเร็จ"`
- Line 296: `i18n.t('users.deleteError')` → `"删除用户失败 ลบผู้ใช้ไม่สำเร็จ"`
- Line 299: `i18n.t('users.deleteError')` → `"删除用户失败 ลบผู้ใช้ไม่สำเร็จ"`
- 其他多处类似调用

**注意**: 此文件使用 `i18n.t()` 而非 `t()`，并且 Lines 68, 72, 137, 222, 226 存在语法错误 `i18n."xxx"`，需要修正为硬编码字符串 `"xxx"`

**验证**: 运行 `Select-String -Path "e:\3XBANG\frontend\js\user-manager.js" -Pattern "i18n\.t\(" -AllMatches` 应返回 0 结果

---

### 6. **process-enhancements.js** (优先级：中)
**路径**: `e:\3XBANG/frontend/js/process-enhancements.js`

**t() 调用统计**: 约 8 处（文件开头已定义 BilingualTexts 对象，但仍有部分 t() 调用）

**主要替换位置**（基于已读取部分）:
- Line 39: `t('nav.processes')` → `"工序进度 ความคืบหน้างาน"`
- Line 41: `t('processes.addProcess')` → `"添加工序 เพิ่มงาน"`
- Line 50: `t('processes.noProcesses')` → `"暂无工序 ยังไม่มีงาน"`
- Line 51: `t('processes.noProcessesDesc')` → `"开始添加工序 เริ่มเพิ่มงาน"`
- Line 55: `t('processes.addFirst')` → `"添加第一个工序 เพิ่มงานแรก"`
- Line 63: `t(\`processes.status.${statusClass}\`)` → 动态状态映射

**注意**: 此文件已定义 `BilingualTexts` 对象存储双语字符串，但在某些地方仍调用 `t()` 函数，需要将这些调用替换为直接引用 `BilingualTexts` 或硬编码字符串

**验证**: 运行 `Select-String -Path "e:\3XBANG\frontend\js\process-enhancements.js" -Pattern "\bt\(" -AllMatches` 应返回 0 结果

---

### 7. **material-manager-simple.js** (优先级：中)
**路径**: `e:\3XBANG/frontend/js/material-manager-simple.js`

**t() 调用统计**: 约 0 处（文件已定义 MaterialTexts 对象，未使用 t() 函数）

**注意**: 此文件已经使用 `MaterialTexts` 对象存储双语字符串，无需修改

**验证**: 运行 `Select-String -Path "e:\3XBANG\frontend\js\material-manager-simple.js" -Pattern "\bt\(" -AllMatches` 应返回 0 结果

---

### 8. **permissions.js** (优先级：低)
**路径**: `e:\3XBANG/frontend/js/permissions.js`

**t() 调用统计**: 1 处

**主要替换位置**:
- Line 104: `t ? t('common.permissionDenied') : (...)` → 需要处理此三元表达式，建议直接硬编码默认值

**验证**: 运行 `Select-String -Path "e:\3XBANG\frontend\js\permissions.js" -Pattern "\bt\(" -AllMatches` 应返回 0 结果

---

### 9. **daily-tasks.js** (优先级：中)
**路径**: `e:\3XBANG/frontend/js/daily-tasks.js`

**t() 调用统计**: 0 处（已使用硬编码中文字符串，但缺少泰语）

**注意**: 此文件中的提示信息已经是硬编码中文，需要补充泰语，如：
- Line 27: `'加载失败'` → `'加载失败 โหลดไม่สำเร็จ'`
- Line 185: `'工序已开始'` → `'工序已开始 งานเริ่มแล้ว'`
- Line 189: `'操作失败'` → `'操作失败 ดำเนินการไม่สำเร็จ'`
- Line 197: `'请输入缺少的材料：'` → `'请输入缺少的材料 กรุณาใส่วัสดุที่ขาด：'`
- 其他类似位置

**验证**: 手动检查文件中的硬编码中文字符串，确认已补充泰语

---

### 10. **photo-manager.js** (优先级：低)
**路径**: `e:\3XBANG/frontend/js/photo-manager.js`

**t() 调用统计**: 0 处（已使用硬编码中文字符串，但缺少泰语）

**注意**: 与 daily-tasks.js 类似，需要补充泰语到硬编码字符串

**验证**: 手动检查文件中的硬编码中文字符串，确认已补充泰语

---

### 11. **其他文件**
以下文件经检查无 t() 或 i18n.t() 调用，或仅包含数据/工具函数：
- `api.js` - API 请求封装，无 UI 文本
- `project-members.js` - 需检查
- `quantities.js` - 需检查
- `subtask-templates.js` - 需检查
- `task-assignment.js` - 需检查
- `project-enhancements.js` - 需检查
- `process-scheduling.js` - 需检查
- `material-manager.js` - 需检查（与 material-manager-simple.js 可能重复）

**需要扫描这些文件确认是否有遗漏的 t() 调用**

---

## 实施步骤

### Phase 1: 完整代码调查（约 1 小时）

- [ ] **步骤 1.1**: 读取并分析 app.js 完整内容
  - 文件: `e:\3XBANG/frontend/js/app.js`
  - 任务: 完整读取文件（使用 offset 参数继续读取截断部分），统计所有 t() 调用位置
  - 验证: 创建完整的 t() 调用清单

- [ ] **步骤 1.2**: 扫描其余未确认的 JS 文件
  - 文件: `project-members.js`, `quantities.js`, `subtask-templates.js`, `task-assignment.js`, `project-enhancements.js`, `process-scheduling.js`, `material-manager.js`
  - 任务: 使用 `grep_search` 工具搜索每个文件中的 `t\(['"]` 和 `i18n\.t\(['"]` 模式
  - 验证: 确认每个文件的 t() 调用数量，补充到本计划

- [ ] **步骤 1.3**: 创建完整的遗漏翻译清单
  - 任务: 对于在代码中找到但 i18n.js 的 translations 对象中不存在的键，标记为"需人工确认"
  - 验证: 生成一个 `missing-translations.txt` 文件列出所有缺失项

---

### Phase 2: 核心文件替换（约 3-4 小时）

- [ ] **步骤 2.1**: 替换 process-manager.js
  - 文件: `e:\3XBANG/frontend/js/process-manager.js`
  - 任务: 将所有 35 处 t() 调用替换为对应的硬编码双语字符串
  - 验证: `Select-String -Path "e:\3XBANG\frontend\js\process-manager.js" -Pattern "\bt\(" -AllMatches | Measure-Object -Line` 返回 Count = 0

- [ ] **步骤 2.2**: 替换 project-detail.js
  - 文件: `e:\3XBANG/frontend/js/project-detail.js`
  - 任务: 替换约 10 处 t() 调用，创建状态映射对象处理动态状态
  - 验证: `Select-String -Path "e:\3XBANG\frontend\js\project-detail.js" -Pattern "\bt\(" -AllMatches | Measure-Object -Line` 返回 Count = 0

- [ ] **步骤 2.3**: 替换 project-dashboard.js
  - 文件: `e:\3XBANG/frontend/js/project-dashboard.js`
  - 任务: 替换约 60 处 t() 调用，处理动态状态和参数插值
  - 验证: `Select-String -Path "e:\3XBANG\frontend\js\project-dashboard.js" -Pattern "\bt\(" -AllMatches | Measure-Object -Line` 返回 Count = 0

- [ ] **步骤 2.4**: 替换 app.js（第一部分：前 1000 行）
  - 文件: `e:\3XBANG/frontend/js/app.js`
  - 任务: 替换前半部分的 t() 调用（约 35 处）
  - 验证: 中间检查，确认替换正确

- [ ] **步骤 2.5**: 替换 app.js（第二部分：剩余部分）
  - 文件: `e:\3XBANG/frontend/js/app.js`
  - 任务: 替换剩余部分的 t() 调用（约 35 处）
  - 验证: `Select-String -Path "e:\3XBANG\frontend\js\app.js" -Pattern "\bt\(" -AllMatches | Measure-Object -Line` 返回 Count = 0

- [ ] **步骤 2.6**: 替换 user-manager.js 并修正语法错误
  - 文件: `e:\3XBANG/frontend/js/user-manager.js`
  - 任务: 
    1. 将所有 i18n.t() 替换为硬编码双语字符串（约 45 处）
    2. 修正语法错误: `i18n."xxx"` → `"xxx"`（Lines 68, 72, 137, 222, 226）
  - 验证: 
    - `Select-String -Path "e:\3XBANG\frontend\js\user-manager.js" -Pattern "i18n\.t\(" -AllMatches | Measure-Object -Line` 返回 Count = 0
    - `Select-String -Path "e:\3XBANG\frontend\js\user-manager.js" -Pattern 'i18n\."' -AllMatches | Measure-Object -Line` 返回 Count = 0

---

### Phase 3: 辅助文件处理（约 2 小时）

- [ ] **步骤 3.1**: 处理 process-enhancements.js
  - 文件: `e:\3XBANG/frontend/js/process-enhancements.js`
  - 任务: 将剩余的 t() 调用替换为 BilingualTexts 引用或硬编码字符串
  - 验证: `Select-String -Path "e:\3XBANG\frontend\js\process-enhancements.js" -Pattern "\bt\(" -AllMatches | Measure-Object -Line` 返回 Count = 0

- [ ] **步骤 3.2**: 补充 daily-tasks.js 的泰语翻译
  - 文件: `e:\3XBANG/frontend/js/daily-tasks.js`
  - 任务: 将所有硬编码中文字符串补充泰语（约 15 处）
  - 验证: 手动检查每个硬编码字符串都包含泰语部分

- [ ] **步骤 3.3**: 补充 photo-manager.js 的泰语翻译
  - 文件: `e:\3XBANG/frontend/js/photo-manager.js`
  - 任务: 将所有硬编码中文字符串补充泰语（约 10 处）
  - 验证: 手动检查每个硬编码字符串都包含泰语部分

- [ ] **步骤 3.4**: 处理 permissions.js
  - 文件: `e:\3XBANG/frontend/js/permissions.js`
  - 任务: 替换 Line 104 的三元表达式为硬编码双语字符串
  - 验证: `Select-String -Path "e:\3XBANG\frontend\js\permissions.js" -Pattern "\bt\(" -AllMatches | Measure-Object -Line` 返回 Count = 0

- [ ] **步骤 3.5**: 处理步骤 1.2 中发现的其他文件
  - 文件: 根据步骤 1.2 的结果确定
  - 任务: 替换这些文件中的 t() 或 i18n.t() 调用
  - 验证: 每个文件运行对应的 grep 检查返回 0 结果

---

### Phase 4: 全局验证与测试（约 1-2 小时）

- [ ] **步骤 4.1**: 全局 grep 检查确认无遗漏
  - 任务: 运行以下命令确认所有 t() 调用已移除
    ```powershell
    Select-String -Path "e:\3XBANG\frontend\js\*.js" -Pattern "\bt\(" -Exclude "i18n.js"
    Select-String -Path "e:\3XBANG\frontend\js\*.js" -Pattern "i18n\.t\("
    ```
  - 验证: 两个命令都应返回 0 结果（除 i18n.js 外）

- [ ] **步骤 4.2**: 检查 getI18nField() 未被错误修改
  - 任务: 确认所有 `getI18nField()` 函数调用保持原样
    ```powershell
    Select-String -Path "e:\3XBANG\frontend\js\*.js" -Pattern "getI18nField" | Select-Object -First 10
    ```
  - 验证: getI18nField() 调用数量与修改前一致

- [ ] **步骤 4.3**: 浏览器渲染测试（手动）
  - 任务: 
    1. 在浏览器中打开 `e:\3XBANG/frontend/index.html`
    2. 检查以下关键页面是否正常显示双语文本：
       - 登录页面
       - 项目仪表盘
       - 项目详情页（概览、今日任务、工序进度、材料管理、现场照片）
       - 用户管理页面
    3. 确认所有按钮、标签、提示信息都显示为 "中文 ภาษาไทย" 格式
  - 验证: 截图关键页面确认双语显示正常

- [ ] **步骤 4.4**: 创建验证报告
  - 任务: 生成 `e:\3XBANG\.agents\tasks\remove-i18n-bilingual\verification-report.md` 文件
  - 内容包括:
    - 修改的文件列表及每个文件的 t() 替换数量
    - 全局 grep 检查结果
    - 遗漏翻译清单（需人工确认的项）
    - 浏览器测试截图路径
  - 验证: 报告文件存在且内容完整

---

## 特殊处理说明

### 1. getI18nField() 函数排除
`getI18nField(obj, fieldName)` 函数用于从数据库返回的 JSON 字段中提取双语值，与 i18n 翻译系统无关。**所有 getI18nField() 调用必须保持不变，不得修改**。

示例（不应修改）：
```javascript
getI18nField(project, 'name')  // 保持原样
getI18nField(category, 'name') // 保持原样
```

### 2. 动态状态映射
对于动态的 t() 调用（如 `t('processes.status.' + statusClass)`），需要创建状态映射对象：

```javascript
// 在文件顶部添加
const ProcessStatusTexts = {
    'not_started': '未开始 ยังไม่เริ่ม',
    'in_progress': '进行中 กำลังดำเนินการ',
    'waiting_material': '等待材料 รอวัสดุ',
    'weather_stop': '天气停工 หยุดเพราะสภาพอากาศ',
    'completed': '已完成 เสร็จแล้ว',
    'paused': '已暂停 หยุดชั่วคราว'
};

// 替换调用
t('processes.status.' + statusClass) → ProcessStatusTexts[statusClass] || statusClass
```

类似地，为项目状态、角色等创建对应的映射对象。

### 3. 参数插值处理
对于带参数的 t() 调用（如 `t('users.confirmDelete').replace('{name}', user.username)`），直接使用模板字符串：

```javascript
// 替换前
t('users.confirmDelete').replace('{name}', user.username)

// 替换后
`确认删除用户 ${user.username}？ ยืนยันลบผู้ใช้ ${user.username}?`
```

### 4. 遗漏翻译标注
如果在代码中发现 t() 调用的键在 i18n.js 的 translations 对象中不存在，按以下格式标注：

```javascript
// TODO: 需人工确认泰语翻译 - 原键: overview.projectInfo
const text = "项目信息 [泰语待补充]";
```

并在 `missing-translations.txt` 中记录此项。

### 5. 语法错误修正
user-manager.js 中存在的语法错误 `i18n."xxx"` 必须修正为正确的字符串字面量 `"xxx"`。

---

## 验证标准

### 代码层面
1. ✅ 所有 JS 文件中不再有 `t('xxx')` 调用（i18n.js 除外）
2. ✅ 所有 JS 文件中不再有 `i18n.t('xxx')` 调用
3. ✅ 所有硬编码字符串符合格式："中文 ภาษาไทย"
4. ✅ getI18nField() 函数调用保持不变
5. ✅ 无语法错误（特别是 user-manager.js）

### 功能层面
1. ✅ 登录页面正确显示双语文本
2. ✅ 项目仪表盘的所有卡片、按钮、标签显示双语
3. ✅ 项目详情页所有选项卡和操作按钮显示双语
4. ✅ 用户管理页面表单和表格显示双语
5. ✅ 所有提示消息（toast/alert）显示双语

### 浏览器控制台
1. ✅ 无 JavaScript 错误
2. ✅ 无 "Translation missing" 警告（因为已移除 t() 函数调用）

---

## 风险与注意事项

### 高风险项
1. **app.js 文件巨大**: 此文件内容被截断，需要完整读取确保没有遗漏
2. **动态键值**: 所有动态构造的翻译键（如 `t('status.' + var)`）必须通过映射对象处理
3. **user-manager.js 语法错误**: 现有代码有语法错误，修复时需格外小心

### 中等风险项
1. **遗漏的翻译键**: 代码中使用但 i18n.js 未定义的键需要人工补充泰语
2. **硬编码格式一致性**: 必须严格遵守 "中文 ภาษาไทย" 格式（中间一个空格）
3. **getI18nField 误删**: 确保不误删 getI18nField() 调用

### 低风险项
1. **已硬编码但缺少泰语的字符串**: 补充泰语即可，不影响功能
2. **BilingualTexts 对象**: process-enhancements.js 和 material-manager-simple.js 已有对象，维护一致性

---

## 后续建议

### 1. 删除 i18n.js 文件
在完成所有替换并验证通过后，可以考虑删除 `e:\3XBANG/frontend/js/i18n.js` 文件，但建议：
- 先备份此文件
- 确认 index.html 中移除对 i18n.js 的 `<script>` 引用
- 保留 getI18nField() 和 getUnitText() 函数到单独的工具文件（如 utils.js）

### 2. 创建双语字符串常量文件（可选）
为了便于维护，可以创建一个中心化的双语字符串常量文件：

```javascript
// e:\3XBANG/frontend/js/bilingual-texts.js
const BilingualTexts = {
    common: {
        save: "保存 บันทึก",
        cancel: "取消 ยกเลิก",
        // ... 其他通用文本
    },
    projects: {
        // ... 项目相关文本
    },
    // ... 其他模块
};
```

然后在各文件中引用此对象，而非直接硬编码，这样未来修改双语文本时只需修改一处。

### 3. 编写自动化测试
建议编写简单的自动化测试脚本，检查：
- 所有页面的关键元素是否包含泰语字符（Unicode 范围 \u0E00-\u0E7F）
- 双语文本格式是否正确（中间有空格）

---

## 估计工时

| 阶段 | 任务 | 预计工时 |
|------|------|---------|
| Phase 1 | 完整代码调查 | 1 小时 |
| Phase 2 | 核心文件替换 (6个主要文件) | 3-4 小时 |
| Phase 3 | 辅助文件处理 (5+ 个文件) | 2 小时 |
| Phase 4 | 全局验证与测试 | 1-2 小时 |
| **总计** | | **7-9 小时** |

---

## 文件清单

### 需要修改的文件（确认）
1. ✅ `e:\3XBANG/frontend/js/process-manager.js` - 约 35 处 t()
2. ✅ `e:\3XBANG/frontend/js/project-detail.js` - 约 10 处 t()
3. ✅ `e:\3XBANG/frontend/js/project-dashboard.js` - 约 60 处 t()
4. ✅ `e:\3XBANG/frontend/js/app.js` - 约 70+ 处 t() （需完整读取确认）
5. ✅ `e:\3XBANG/frontend/js/user-manager.js` - 约 45 处 i18n.t() + 语法错误修正
6. ✅ `e:\3XBANG/frontend/js/process-enhancements.js` - 约 8 处 t()
7. ✅ `e:\3XBANG/frontend/js/daily-tasks.js` - 补充泰语到硬编码字符串
8. ✅ `e:\3XBANG/frontend/js/photo-manager.js` - 补充泰语到硬编码字符串
9. ✅ `e:\3XBANG/frontend/js/permissions.js` - 1 处 t()

### 需要扫描确认的文件
10. ⏳ `e:\3XBANG/frontend/js/project-members.js`
11. ⏳ `e:\3XBANG/frontend/js/quantities.js`
12. ⏳ `e:\3XBANG/frontend/js/subtask-templates.js`
13. ⏳ `e:\3XBANG/frontend/js/task-assignment.js`
14. ⏳ `e:\3XBANG/frontend/js/project-enhancements.js`
15. ⏳ `e:\3XBANG/frontend/js/process-scheduling.js`
16. ⏳ `e:\3XBANG/frontend/js/material-manager.js`

### 无需修改的文件
17. ✅ `e:\3XBANG/frontend/js/material-manager-simple.js` - 已使用 MaterialTexts 对象
18. ✅ `e:\3XBANG/frontend/js/api.js` - 纯 API 封装，无 UI 文本
19. ⚠️  `e:\3XBANG/frontend/js/i18n.js` - 翻译映射来源，完成后可选择性删除

---

## 附录: i18n.js 完整 translations 对象

```javascript
const translations = {
    app: {
        title: 'Mira Villa',
        subtitle: '建筑项目管理系统 ระบบจัดการโครงการก่อสร้าง'
    },
    nav: {
        projects: '项目管理 จัดการโครงการ',
        processes: '工序进度 ความคืบหน้างาน',
        materials: '材料管理 จัดการวัสดุ',
        photos: '现场照片 รูปถ่ายหน้างาน',
        dailyTasks: '今日任务 งานวันนี้',
        users: '用户管理 ผู้ใช้งาน'
    },
    common: {
        logout: '退出 ออกจากระบบ',
        save: '保存 บันทึก',
        cancel: '取消 ยกเลิก',
        delete: '删除 ลบ',
        edit: '编辑 แก้ไข',
        confirm: '确认 ยืนยัน',
        confirmDelete: '确认删除 ยืนยันลบ',
        loading: '加载中... กำลังโหลด...',
        success: '成功 สำเร็จ',
        error: '错误 ผิดพลาด',
        notes: '备注 หมายเหตุ',
        noData: '暂无数据 ไม่มีข้อมูล',
        add: '添加 เพิ่ม',
        remove: '移除 ลบออก',
        close: '关闭 ปิด',
        submit: '提交 ส่ง',
        back: '返回 กลับ',
        next: '下一步 ถัดไป',
        create: '创建 สร้าง'
    },
    dashboard: {
        title: '项目概览 แดชบอร์ดโครงการ',
        noProjects: '暂无项目 ยังไม่มีโครงการ',
        noProjectsDesc: '开始创建第一个项目 เริ่มต้นสร้างโครงการแรกของคุณ',
        myProjects: '我的项目 โครงการของฉัน'
    },
    projectDetail: {
        overview: '项目概览 ภาพรวมโครงการ',
        settings: '项目设置 ตั้งค่าโครงการ'
    },
    overview: {
        totalProcesses: '总工序数 จำนวนงานทั้งหมด',
        completedProcesses: '已完成 เสร็จแล้ว',
        inProgress: '进行中 กำลังดำเนินการ',
        teamMembers: '团队成员 สมาชิกทีม'
    },
    projects: {
        title: '项目管理 จัดการโครงการ',
        name: '项目名称 ชื่อโครงการ',
        code: '项目编号 รหัสโครงการ',
        description: '项目描述 คำอธิบาย',
        location: '项目地址 ที่ตั้งโครงการ',
        startDate: '开始日期 วันเริ่ม',
        endDate: '结束日期 วันสิ้นสุด',
        manager: '项目经理 ผู้จัดการโครงการ',
        create: '创建项目 สร้างโครงการ',
        edit: '编辑项目 แก้ไขโครงการ',
        delete: '删除项目 ลบโครงการ',
        confirmDelete: '确认删除项目？ ยืนยันลบโครงการ?',
        createSuccess: '项目创建成功 สร้างโครงการสำเร็จ',
        updateSuccess: '项目更新成功 อัพเดทโครงการสำเร็จ',
        deleteSuccess: '项目删除成功 ลบโครงการสำเร็จ',
        loadError: '加载项目失败 โหลดโครงการไม่สำเร็จ',
        basicInfo: '基本信息 ข้อมูลพื้นฐาน',
        selectProcesses: '选择工序 เลือกงาน',
        processes: '工序 งาน',
        addProcess: '添加工序 เพิ่มงาน',
        noProcesses: '暂无工序 ยังไม่มีงาน',
        noProcessesDesc: '开始添加第一个工序 เริ่มต้นเพิ่มงานแรก',
        addFirst: '添加第一个工序 เพิ่มงานแรก'
    },
    processes: {
        title: '工序进度 ความคืบหน้างาน',
        addProcess: '添加工序 เพิ่มงาน',
        noProcesses: '暂无工序 ยังไม่มีงาน',
        noProcessesDesc: '开始添加工序 เริ่มเพิ่มงาน',
        addFirst: '添加第一个工序 เพิ่มงานแรก',
        processCode: '工序编号 รหัสงาน',
        status: {
            not_started: '未开始 ยังไม่เริ่ม',
            in_progress: '进行中 กำลังดำเนินการ',
            waiting_material: '等待材料 รอวัสดุ',
            weather_stop: '天气停工 หยุดเพราะสภาพอากาศ',
            completed: '已完成 เสร็จแล้ว',
            paused: '已暂停 หยุดชั่วคราว'
        }
    },
    scheduling: {
        schedule: '计划 แผนงาน',
        dependencies: '依赖 งานที่เกี่ยวข้อง',
        days: '天 วัน',
        plannedStartDate: '计划开始 วันเริ่มตามแผน',
        plannedEndDate: '计划完成 วันสิ้นสุดตามแผน',
        plannedDuration: '计划工期 ระยะเวลาตามแผน'
    },
    materials: {
        title: '材料管理 จัดการวัสดุ',
        materialList: '材料列表 รายการวัสดุ',
        addMaterial: '添加材料 เพิ่มวัสดุ',
        noMaterials: '暂无材料 ไม่มีวัสดุ',
        purchased: '采购 สั่งซื้อ',
        received: '到货 เข้าคลัง',
        used: '已用 ใช้แล้ว',
        stock: '库存 คงเหลือ'
    },
    daily: {
        title: '今日任务 งานวันนี้',
        updateProgress: '更新进度 อัพเดทความคืบหน้า',
        viewSubtasks: '查看子任务 ดูงานย่อย',
        currentProgress: '当前完成度 ความคืบหน้าปัจจุบัน',
        newProgress: '新的完成度 ความคืบหน้าใหม่ (%)',
        progressNotes: '进度说明 หมายเหตุความคืบหน้า'
    },
    users: {
        title: '用户管理 จัดการผู้ใช้',
        username: '用户名 ชื่อผู้ใช้',
        password: '密码 รหัสผ่าน',
        role: '角色 บทบาท',
        addUser: '添加用户 เพิ่มผู้ใช้'
    }
};
```

---

**计划版本**: v1.0  
**创建时间**: 2026-01-10  
**最后更新**: 2026-01-10  
**状态**: 待审核
