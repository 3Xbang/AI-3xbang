# 数据库实体关系图 (ERD)

## 核心实体关系

```
┌─────────────────────────────────────────────────────────────────────┐
│                         系统基础模块                                  │
└─────────────────────────────────────────────────────────────────────┘

    ┌──────────────┐
    │  sys_users   │  用户表
    │──────────────│
    │ id (PK)      │
    │ username     │
    │ password_hash│
    │ full_name    │
    └──────┬───────┘
           │
           │ 1:N
           ▼
    ┌──────────────┐          ┌──────────────┐
    │ sys_projects │◄─────────│ sys_roles    │  角色表
    │──────────────│   N:1    │──────────────│
    │ id (PK)      │          │ id (PK)      │
    │ project_code │          │ role_code    │
    │ owner_id (FK)│          │ role_name    │
    │ pm_id (FK)   │          │ permissions  │
    └──────┬───────┘          └──────────────┘
           │
           │ N:N
           ▼
    ┌──────────────────┐
    │ project_members  │  项目成员关联表
    │──────────────────│
    │ id (PK)          │
    │ project_id (FK)  │
    │ user_id (FK)     │
    │ role_id (FK)     │
    └──────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│                    工序管理与验收模块                                 │
└─────────────────────────────────────────────────────────────────────┘

    ┌──────────────────┐
    │   wbs_tasks      │  工序任务表
    │──────────────────│
    │ id (PK)          │
    │ project_id (FK)  │
    │ task_code        │
    │ phase (1-8)      │
    │ planned_quantity │
    │ actual_quantity  │
    │ assigned_to (FK) │
    │ verifier_id (FK) │
    │ status           │
    └────────┬─────────┘
             │
             │ 1:N
             ▼
    ┌──────────────────────┐
    │ task_verifications   │  工序验收记录
    │──────────────────────│
    │ id (PK)              │
    │ task_id (FK)         │
    │ verifier_id (FK)     │
    │ result               │
    │ quality_score        │
    │ photos_json (JSONB)  │
    └──────────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│                三级进度汇报模块 (核心新增)                            │
└─────────────────────────────────────────────────────────────────────┘

    ┌──────────────────────┐
    │   daily_reports      │  日报表 ⭐
    │──────────────────────│
    │ id (PK)              │
    │ project_id (FK)      │
    │ report_date          │
    │ submitter_id (FK)    │
    │ completed_tasks (JSONB)│
    │ photos_json (JSONB)  │  强制 >= 3张
    │ status               │
    │ reviewer_id (FK)     │
    └──────────┬───────────┘
               │
               │ 自动汇总
               ▼
    ┌──────────────────────┐
    │   weekly_reports     │  周报表
    │──────────────────────│
    │ id (PK)              │
    │ project_id (FK)      │
    │ week_start           │
    │ submitter_id (FK)    │
    │ plan_vs_actual_json (JSONB)│
    │ deviation_percentage │  > 10% 标红
    │ status               │
    │ approver_id (FK)     │
    └──────────┬───────────┘
               │
               │ 自动生成
               ▼
    ┌──────────────────────┐
    │   monthly_reports    │  月报表
    │──────────────────────│
    │ id (PK)              │
    │ project_id (FK)      │
    │ report_month         │
    │ milestone_achievement_json│
    │ cost_variance        │
    │ status               │
    │ approver_id (FK)     │
    └──────────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│              材料采购闭环模块 (三单匹配) ⭐                           │
└─────────────────────────────────────────────────────────────────────┘

    ┌──────────────────────┐
    │ purchase_requests    │  采购申请
    │──────────────────────│
    │ id (PK)              │
    │ project_id (FK)      │
    │ initiator_id (FK)    │  发起人
    │ items_json (JSONB)   │
    │ status               │
    │ approver_id (FK)     │  审批人
    └──────────┬───────────┘
               │
               │ 1:1
               ▼
    ┌──────────────────────┐
    │  purchase_orders     │  采购订单
    │──────────────────────│
    │ id (PK)              │
    │ request_id (FK)      │
    │ purchaser_id (FK)    │  执行人
    │ items_json (JSONB)   │  订单qty ①
    │ total_amount         │
    └──────────┬───────────┘
               │
               │ 1:N
               ▼
    ┌──────────────────────┐
    │   goods_receipts     │  到货验收
    │──────────────────────│
    │ id (PK)              │
    │ order_id (FK)        │
    │ receiver_id (FK)     │  验收人
    │ items_json (JSONB)   │  实收qty ②
    │ photos_json (JSONB)  │
    └──────────┬───────────┘
               │
               │              ┌─────────────────────┐
               │              │  三单匹配算法       │
               ▼              │─────────────────────│
    ┌──────────────────────┐ │ 订单qty (PO)        │
    │      invoices        │ │ 实收qty (GR)        │
    │──────────────────────│ │ 账单qty (INV)       │
    │ id (PK)              │ │                     │
    │ order_id (FK)        │ │ 误差 = |INV-GR|/PO  │
    │ items_json (JSONB)   │ │ 阈值 = 2%           │
    │ total_amount         │─┤ matched: 误差<=2%   │
    │ matching_status      │ │ mismatched: 误差>2% │
    │ payment_status       │ │                     │
    └──────────────────────┘ │ mismatched → 禁止付款│
                              └─────────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│                       工程变更签证模块                                │
└─────────────────────────────────────────────────────────────────────┘

    ┌──────────────────────┐
    │   change_orders      │  工程变更
    │──────────────────────│
    │ id (PK)              │
    │ project_id (FK)      │
    │ initiator_id (FK)    │  发起人
    │ cost_impact          │  成本影响
    │ schedule_impact_days │  工期影响
    │ before_photos_json   │  变更前照片
    │ after_photos_json    │  变更后照片
    │ status               │
    │ approver_id (FK)     │  审批人 (仅老板)
    │ executor_id (FK)     │  执行人
    └──────────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│                       通用照片管理模块                                │
└─────────────────────────────────────────────────────────────────────┘

    ┌──────────────────────┐
    │       photos         │  照片统一管理
    │──────────────────────│
    │ id (PK)              │
    │ project_id (FK)      │
    │ uploader_id (FK)     │
    │ related_type         │  关联类型
    │ related_id           │  关联ID
    │ file_path            │
    │ watermark_info (JSONB)│ 水印信息
    └──────────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│                       系统审计日志                                    │
└─────────────────────────────────────────────────────────────────────┘

    ┌──────────────────────┐
    │    audit_logs        │  审计日志
    │──────────────────────│
    │ id (PK)              │
    │ user_id (FK)         │
    │ action               │
    │ target_type          │
    │ target_id            │
    │ ip_address           │
    │ request_body (JSONB) │
    │ created_at           │
    └──────────────────────┘
```

## 关键关系说明

### 1. 用户与项目 (多对多)
```
sys_users ←→ project_members ←→ sys_projects
         1:N              N:1
```
- 一个用户可以参与多个项目
- 一个项目有多个成员
- 通过 `project_members` 实现数据隔离

### 2. 日报 → 周报 → 月报 (汇总关系)
```
daily_reports (每日) 
    ↓ 自动汇总
weekly_reports (每周五)
    ↓ 自动生成
monthly_reports (每月)
```

### 3. 采购三单匹配 (1:1:N:1 关系)
```
purchase_requests (1) 
    ↓
purchase_orders (1)
    ↓
goods_receipts (N - 可能分批到货)
    ↓
invoices (1) → 三单校验算法
```

### 4. 责任追踪字段 (所有核心表共有)
```
initiator_id  → 发起人
approver_id   → 审批人
executor_id   → 执行人
verifier_id   → 验收人
```

## 索引策略

### 高频查询字段索引
- `project_id` (所有业务表)
- `status` (所有有状态的表)
- `report_date` (daily_reports)
- `week_start` (weekly_reports)
- `matching_status` (invoices)
- `created_at` (audit_logs)

### 复合索引
- `(project_id, report_date)` - 日报查询
- `(project_id, status)` - 待办列表
- `(related_type, related_id)` - 照片关联查询

## JSONB 字段说明

### daily_reports.completed_tasks
```json
[
  {
    "task_id": 1,
    "task_name": "浇筑混凝土",
    "qty": 50,
    "unit": "m³"
  }
]
```

### daily_reports.photos_json
```json
[
  {
    "url": "/uploads/daily-reports/2024-01-15/photo1.jpg",
    "watermark": "2024-01-15 16:30 | GPS: 9.5°N, 100.0°E | 项目A | 张三"
  }
]
```

### weekly_reports.plan_vs_actual_json
```json
{
  "planned": 500,
  "actual": 450,
  "completion_rate": 90,
  "tasks": [
    {
      "task_name": "主体结构",
      "planned": 200,
      "actual": 180
    }
  ]
}
```

### purchase_orders.items_json
```json
[
  {
    "material": "水泥",
    "spec": "425#",
    "qty": 100,
    "unit": "吨",
    "price": 480,
    "amount": 48000
  }
]
```

## 状态机定义

### 通用工作流状态
```
pending      → 待处理
approved     → 已批准
rejected     → 已驳回
executing    → 执行中
verifying    → 验收中
completed    → 已完成
cancelled    → 已取消
```

### 三单匹配状态
```
pending      → 待匹配
matched      → 匹配通过 (允许付款)
mismatched   → 有差异 (禁止付款)
```

### 付款状态
```
unpaid       → 未付款
partial      → 部分付款
paid         → 已付款
```

---

**说明**: 本 ERD 展示了系统所有核心实体及其关系，重点关注三级进度管控、采购闭环和责任追踪体系。
